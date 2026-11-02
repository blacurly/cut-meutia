import { exampleIncidents, examplePermits } from "../data/admin.js";
import { caregiverDaycareId } from "../data/caregiver.js";
import { addNotification, getDaycare, todayISO, validISODate } from "./parent.js";

export const decisionLabels = { approved: "Disetujui · demo", revision: "Perlu perbaikan", rejected: "Ditolak · demo" };
export const incidentStatusLabels = { local: "Belum ditinjau", reviewing: "Dalam penanganan", closed: "Selesai pada demo" };
export const adminDocuments = state => [...state.caregiver.documents.map(d => ({ ...d, daycareId: caregiverDaycareId, example: false })), ...examplePermits];
export const adminIncidents = state => [...state.incidents, ...exampleIncidents.map(r => ({ ...r, status: state.admin.incidentStates.find(v => v.incidentId === r.id)?.status || r.status }))];
export const verificationFor = (state, id) => state.admin.verifications.find(v => v.documentId === id);
function requireAdmin(state) { if (!state.admin?.enabled) throw new Error("Aktifkan mode demo Administrator terlebih dahulu."); }
const clean = value => typeof value === "string" ? value.trim() : "";
function audit(state, action, target, note) { return { ...state, admin: { ...state.admin, audit: [{ id: crypto.randomUUID(), action, target, note, createdAt: new Date().toISOString() }, ...state.admin.audit].slice(0, 200) } }; }
export function decideVerification(state, documentId, form, today = todayISO()) {
  requireAdmin(state);
  const document = adminDocuments(state).find(d => d.id === documentId); if (!document) throw new Error("Dokumen tidak tersedia. Muat ulang antrean.");
  if (verificationFor(state, documentId)) throw new Error("Dokumen sudah memiliki keputusan. Perbaikan harus diajukan sebagai dokumen baru.");
  if (!Object.hasOwn(decisionLabels, form.decision) || clean(form.note).length < 10 || clean(form.note).length > 1000) throw new Error("Pilih keputusan dan isi catatan pemeriksaan 10–1000 karakter.");
  if (form.confirm !== true) throw new Error("Konfirmasikan bahwa keputusan ini hanya simulasi, bukan verifikasi legal nyata.");
  const fields = Object.fromEntries(["number", "name", "address", "issuer", "expires"].map(key => [key, clean(form[key])]));
  if (["number", "name", "address", "issuer"].some(key => fields[key].length < 3 || fields[key].length > 250) || !validISODate(fields.expires)) throw new Error("Lengkapi metadata izin dengan tanggal yang valid.");
  if (form.decision === "approved" && fields.expires < today) throw new Error("Dokumen kedaluwarsa tidak dapat disetujui, termasuk pada simulasi.");
  const decision = { documentId, daycareId: document.daycareId, decision: form.decision, note: clean(form.note), fields, createdAt: new Date().toISOString() };
  return audit({ ...state, admin: { ...state.admin, verifications: [decision, ...state.admin.verifications] } }, "Keputusan legalitas", getDaycare(document.daycareId).name, `${decisionLabels[form.decision]}: ${decision.note}`);
}
export function handleAdminIncident(state, incidentId, text, status) {
  requireAdmin(state); const report = adminIncidents(state).find(r => r.id === incidentId); if (!report) throw new Error("Insiden tidak ditemukan.");
  if (report.status === "closed") throw new Error("Kasus sudah ditutup. Catatan yang tersimpan tetap dapat dibaca.");
  if (!["reviewing", "closed"].includes(status) || clean(text).length < 20 || clean(text).length > 1500) throw new Error("Pilih status dan tulis catatan penanganan 20–1500 karakter.");
  const response = { incidentId, text: clean(text), status, createdAt: new Date().toISOString() };
  let next = { ...state, incidents: state.incidents.map(r => r.id === incidentId ? { ...r, status } : r), admin: { ...state.admin, responses: [response, ...state.admin.responses], incidentStates: [{ incidentId, status }, ...state.admin.incidentStates.filter(r => r.incidentId !== incidentId)] } };
  next = audit(next, status === "closed" ? "Penutupan insiden" : "Tindak lanjut insiden", getDaycare(report.daycareId).name, response.text);
  return report.example ? next : addNotification(next, "Administrator memperbarui laporan demo", "/laporan", report.urgency === "critical");
}
export function recordContactAttempt(state, incidentId, recipient, note) {
  requireAdmin(state); const report = adminIncidents(state).find(r => r.id === incidentId);
  if (!report || !["caregiver", "parent"].includes(recipient) || clean(note).length < 10 || clean(note).length > 1000) throw new Error("Isi rencana komunikasi 10–1000 karakter untuk penerima yang tersedia.");
  return audit(state, "Rencana komunikasi · belum dikirim", getDaycare(report.daycareId).name, `${recipient === "parent" ? "Orang Tua" : "Pengelola"}: ${clean(note)}`);
}
export function setDaycareState(state, daycareId, status, note) {
  requireAdmin(state); if (!getDaycare(daycareId) || !["active", "restricted"].includes(status) || clean(note).length < 10 || clean(note).length > 1000) throw new Error("Pilih status dan isi alasan 10–1000 karakter.");
  const current = state.admin.daycareStates.find(v => v.daycareId === daycareId)?.status || "active";
  if (current === status) throw new Error("Status demo tidak berubah.");
  const entry = { daycareId, status, note: clean(note), createdAt: new Date().toISOString() };
  return audit({ ...state, admin: { ...state.admin, daycareStates: [entry, ...state.admin.daycareStates.filter(d => d.daycareId !== daycareId)] } }, "Status administrasi demo", getDaycare(daycareId).name, `${status === "active" ? "Aktif" : "Dibatasi"}: ${entry.note}`);
}
