import test from "node:test";
import assert from "node:assert/strict";
import { emptyDemo, decodeDemo, availableSlots, createEnrollment, transitionEnrollment } from "./parent.js";
import { managedDaycare, seedCaregiverDemo, reviewEnrollment, saveJournal, parentJournals, deleteJournalDraft, saveReviewReply, respondIncident, saveBusiness, saveLegalDocument } from "./caregiver.js";
import { adminDocuments, adminIncidents, decideVerification, handleAdminIncident, recordContactAttempt, setDaycareState } from "./admin.js";

const today = "2026-11-01";
const now = new Date("2026-11-01T05:00:00Z");
const fresh = () => ({ ...structuredClone(emptyDemo), caregiver: { ...structuredClone(emptyDemo.caregiver), enabled: true }, admin: { ...structuredClone(emptyDemo.admin), enabled: true } });
const seed = () => seedCaregiverDemo(fresh(), today);
const journal = s => ({ childIds: [s.enrollments.find(e => e.status === "active").childId], type: "play", date: today, time: "09:00", title: "Bermain balok warna", body: "Anak menyusun balok warna bersama pengasuh dalam kegiatan contoh.", reviewed: true });

test("older parent snapshots migrate without losing existing state; corrupt extensions recover independently", () => {
  const old = structuredClone(emptyDemo); delete old.caregiver; delete old.admin; old.profile.name = "Keluarga Lama";
  let restored = decodeDemo(JSON.stringify(old)); assert.equal(restored.profile.name, "Keluarga Lama"); assert.equal(restored.caregiver.enabled, false); assert.equal(restored.admin.enabled, false);
  old.caregiver = { enabled: true, journals: [null], documents: [{ id: "bad", number: "x", issuer: "x", expires: "oops", filename: "x", createdAt: now.toISOString() }] }; old.admin = { enabled: true, verifications: [null], audit: [{}] };
  restored = decodeDemo(JSON.stringify(old)); assert.deepEqual(restored.caregiver.documents, []); assert.deepEqual(restored.admin.audit, []); assert.equal(restored.profile.name, "Keluarga Lama");
});
test("seed is opt-in, idempotent and keeps existing parent data", () => {
  assert.throws(() => seedCaregiverDemo(structuredClone(emptyDemo), today), /Aktifkan/);
  const base = fresh(); base.profile.name = "Pengguna Contoh"; base.compare = ["tunas-bangsa"];
  const seeded = seedCaregiverDemo(base, today); assert.equal(seeded.children.length, 2); assert.equal(seeded.member, false); assert.deepEqual(seeded.compare, base.compare); assert.equal(seeded.profile.name, base.profile.name); assert.equal(seedCaregiverDemo(seeded, today), seeded);
});
test("caregiver review reserves a slot once and rejects foreign, stale and unsupported transitions", () => {
  let state = seed(); const pending = state.enrollments.find(e => e.status === "pending"); const before = availableSlots(managedDaycare, state);
  assert.throws(() => reviewEnrollment(state, pending.id, "rejected", "short"), /10–500/);
  assert.throws(() => reviewEnrollment(state, pending.id, "active"), /hanya/);
  state = reviewEnrollment(state, pending.id, "approved", "Selamat datang pada pengasuhan contoh."); assert.equal(availableSlots(managedDaycare, state), before - 1);
  assert.throws(() => reviewEnrollment(state, pending.id, "approved"), /status/);
  state = transitionEnrollment(state, pending.id, "active"); assert.equal(availableSlots(managedDaycare, state), before - 1);
  const other = createEnrollment({ ...state, member: true }, { daycareId: "tunas-bangsa", childName: "Anak Lain", dob: "2024-01-15", packageId: "full", startDate: today, consent: true }, today);
  assert.throws(() => reviewEnrollment(other, other.enrollments[0].id, "approved"), /bukan milik/);
});
test("journal drafts stay private, require review and exclude uploaded photo data", () => {
  let state = seed(); const form = journal(state);
  state = saveJournal(state, { ...form, reviewed: false, image: "blob:private", attachment: "secret" }, false, now); const id = state.caregiver.journals[0].id;
  assert.equal(parentJournals(state, form.childIds[0], managedDaycare.id, today).length, 0);
  assert.throws(() => saveJournal(state, { ...form, id, reviewed: false }, true, now), /Tinjau/);
  state = saveJournal(state, { ...form, id, image: "blob:private" }, true, now);
  assert.equal(parentJournals(state, form.childIds[0], managedDaycare.id, today).length, 1); assert.equal(parentJournals(state, "other", managedDaycare.id, today).length, 0);
  assert.equal(state.caregiver.journals[0].image, null); assert.equal(state.caregiver.journals[0].attachment, undefined);
  assert.throws(() => deleteJournalDraft(state, id), /Hanya draf/); assert.throws(() => saveJournal(state, { ...form, id }, true, now), /Hanya draf/);
  assert.equal(decodeDemo(JSON.stringify(state)).caregiver.journals[0].status, "published");
  const corrupt = structuredClone(state); corrupt.caregiver.journals[0].date = "2026-02-30";
  assert.equal(decodeDemo(JSON.stringify(corrupt)).caregiver.journals.length, 0);
});
test("journal validates active recipients, service dates and future time", () => {
  const state = seed(); const form = journal(state); const pending = state.enrollments.find(e => e.status === "pending");
  assert.throws(() => saveJournal(state, { ...form, childIds: [pending.childId] }, true, now), /anak aktif/);
  assert.throws(() => saveJournal(state, { ...form, date: "2026-10-31" }, true, now), /mendahului/);
  assert.throws(() => saveJournal(state, { ...form, time: "23:00" }, true, now), /masa depan/);
  assert.throws(() => saveJournal(state, { ...form, date: "2026-02-30" }, true, now), /valid/);
});
test("review replies upsert and foreign reviews cannot be answered", () => {
  let state = saveReviewReply(seed(), "example-sustri", "Terima kasih atas masukan contoh yang diberikan.");
  state = saveReviewReply(state, "example-sustri", "Terima kasih. Tim kami akan mempertahankan komunikasi."); assert.equal(state.caregiver.replies.length, 1);
  assert.throws(() => saveReviewReply(state, "foreign", "Balasan yang cukup panjang."), /tidak tersedia/);
});
test("caregiver and admin incident updates share history and reject reopening closed cases", () => {
  let state = seed(); const childId = state.enrollments.find(e => e.status === "active").childId;
  state.incidents = [{ id: "report-1", childId, daycareId: managedDaycare.id, urgency: "high", description: "Kronologi laporan contoh untuk pemeriksaan fasilitas.", status: "local", createdAt: now.toISOString() }];
  state = respondIncident(state, "report-1", "Pengelola sedang memeriksa fasilitas pada skenario contoh.", "reviewing"); assert.equal(state.incidents[0].status, "reviewing");
  state = handleAdminIncident(state, "report-1", "Pemeriksaan contoh sudah dicatat dan hasilnya telah ditinjau.", "closed"); assert.equal(state.incidents[0].status, "closed"); assert.equal(state.admin.responses.length, 1); assert.equal(state.caregiver.responses.length, 1);
  assert.throws(() => respondIncident(state, "report-1", "Catatan baru yang cukup panjang untuk tindakan.", "reviewing"), /ditutup/);
  assert.throws(() => handleAdminIncident(state, "report-1", "Catatan baru yang cukup panjang untuk tindakan.", "reviewing"), /ditutup/);
});
test("legal metadata enters admin queue; decisions preserve fixture and reject duplicates or expired approval", () => {
  let state = seed(); const file = { name: "contoh.pdf", type: "application/pdf", size: 1024 }; const form = { number: "DEMO-NEW-1", issuer: "Penerbit Contoh", expires: "2028-08-15", consent: true };
  state = saveLegalDocument(state, form, file, today); const doc = adminDocuments(state).find(d => !d.example); assert.ok(doc); assert.equal(doc.filename, file.name); assert.equal(doc.file, undefined);
  const decision = { ...form, name: managedDaycare.name, address: managedDaycare.address, decision: "approved", note: "Metadata fiktif telah ditinjau untuk simulasi.", confirm: true };
  assert.throws(() => decideVerification(state, doc.id, { ...decision, expires: "2020-01-01" }, today), /kedaluwarsa/);
  state = decideVerification(state, doc.id, decision, today); assert.equal(state.admin.verifications[0].documentId, doc.id); assert.equal(state.admin.audit.length, 1); assert.equal(managedDaycare.score, 94);
  assert.throws(() => decideVerification(state, doc.id, decision, today), /sudah memiliki/);
  assert.throws(() => saveLegalDocument(state, form, { ...file, type: "text/html" }, today), /PDF/);
  assert.throws(() => saveLegalDocument(state, form, { ...file, size: 6 * 1024 * 1024 }, today), /5 MB/);
});
test("administrator examples stay separate from parent reports; contact plans only create an audit record", () => {
  let state = fresh(); const report = adminIncidents(state)[0]; state = handleAdminIncident(state, report.id, "Kasus latihan diperiksa dan seluruh tindakan contoh dicatat.", "closed");
  assert.equal(state.incidents.length, 0); assert.equal(adminIncidents(state).find(r => r.id === report.id).status, "closed"); assert.equal(state.notifications.length, 0);
  const next = recordContactAttempt(state, report.id, "parent", "Rencanakan klarifikasi kronologi pada skenario contoh."); assert.equal(next.admin.audit.length, 2); assert.match(next.admin.audit[0].action, /belum dikirim/); assert.deepEqual(next.incidents, state.incidents);
});
test("business drafts and admin restrictions remain separate from public fixture", () => {
  let state = fresh(); const original = managedDaycare.name;
  state = saveBusiness(state, { ...managedDaycare, name: "Nama Bisnis Contoh", phone: "081234567890" }); assert.equal(state.caregiver.business.name, "Nama Bisnis Contoh"); assert.equal(managedDaycare.name, original);
  state = setDaycareState(state, managedDaycare.id, "restricted", "Simulasi peninjauan administrasi daycare."); assert.equal(state.admin.daycareStates[0].status, "restricted"); assert.equal(managedDaycare.verified, true);
  assert.throws(() => setDaycareState({ ...state, admin: { ...state.admin, enabled: false } }, managedDaycare.id, "active", "Aktifkan kembali pada simulasi."), /Aktifkan/);
});
