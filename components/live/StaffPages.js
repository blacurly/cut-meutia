"use client";
/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */

// Portal pages for Pengelola (manager) and Pengasuh (caregiver), backed by
// the API. The selected daycare comes from DaycareContext.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Copy, FileText, ImagePlus, Plus, ShieldAlert, Sparkles, Users } from "lucide-react";
import { useSession } from "@/components/session/SessionProvider";
import { apiSend, useApi } from "@/lib/client-api";
import { invitationUrl } from "@/lib/auth";
import { LinkButton, PageHeader, Panel } from "@/components/features/ParentUI";
import { useDaycare } from "./DaycareContext";
import PhotoTargetPicker from "./PhotoTargetPicker";
import {
  ACTIVITY_TYPES, Badge, ENROLLMENT_STATUS, Empty, ErrorNote, INCIDENT_STATUS, Loading, URGENCY,
  dateText, dateTimeText, nowLocalInput, rupiah, todayJakarta,
} from "./ui";
import p from "@/components/features/Parent.module.css";
import c from "@/components/features/Caregiver.module.css";

function useAction() {
  const [state, setState] = useState({ busy: false, error: null, notice: "" });
  async function run(fn, notice = "") {
    setState({ busy: true, error: null, notice: "" });
    try { const result = await fn(); setState({ busy: false, error: null, notice }); return result ?? true; }
    catch (error) { setState({ busy: false, error, notice: "" }); return null; }
  }
  return [state, run];
}
const Notice = ({ text }) => (text ? <p role="status" className={p.feedback}>{text}</p> : null);
const list = data => (Array.isArray(data) ? data : []);

function ManagerOnly({ children }) {
  const { isManager } = useDaycare();
  return isManager ? children : <Empty title="Khusus Pengelola">Halaman ini hanya untuk Pengelola daycare.</Empty>;
}

// Enrollments the signed-in staff can write for: Manager → approved enrollments
// of the daycare; Caregiver → current assignments.
function useWritableEnrollments() {
  const { daycare, isManager } = useDaycare();
  const managerList = useApi(isManager ? `/api/enrollments?daycare_id=${daycare.id}` : null);
  const assignments = useApi(isManager ? null : "/api/me/assignments");
  const source = isManager ? managerList : assignments;
  const items = isManager
    ? list(managerList.data).filter(e => e.status === "approved")
    : list(assignments.data).map(a => a.enrollment).filter(e => e.daycare?.id === daycare.id);
  return { ...source, items };
}

function EnrollmentSelect({ items, value, onChange, label = "Pilih anak" }) {
  return <select className={p.select} value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{ maxWidth: 420 }}>
    <option value="">{label}</option>
    {items.map(e => <option key={e.id} value={e.id}>{e.child?.full_name ?? "Anak"} · Ref. {e.reference} · {dateText(e.service_date)}</option>)}
  </select>;
}

// --------------------------------------------------------------- dashboard

export function StaffDashboard() {
  const session = useSession();
  const { daycare, isManager } = useDaycare();
  const enrollments = useApi(isManager ? `/api/enrollments?daycare_id=${daycare.id}` : null);
  const incidents = useApi(isManager ? "/api/incidents" : null);
  const assignments = useApi(isManager ? null : "/api/me/assignments");
  const all = list(enrollments.data);
  const openIncidents = list(incidents.data).filter(i => i.daycare?.id === daycare.id && i.status !== "resolved");
  const metrics = isManager
    ? [[ClipboardList, all.filter(e => e.status === "pending").length, "Pengajuan menunggu keputusan"], [Users, all.filter(e => e.status === "approved").length, "Anak aktif"], [ShieldAlert, openIncidents.length, "Insiden belum selesai"]]
    : [[Users, list(assignments.data).length, "Anak yang Anda dampingi"]];
  return <>
    <PageHeader eyebrow={`${isManager ? "DASHBOARD PENGELOLA" : "DASHBOARD PENGASUH"} · ${dateText(todayJakarta())}`} title={`Halo, ${session.name}.`} description={daycare.name} />
    {daycare.status !== "active" && isManager && <p className={p.notice} style={{ marginBottom: 20 }}>Daycare belum aktif. Lengkapi profil, layanan & harga, dan dokumen legal; Admin Ayomi mengaktifkan daycare setelah verifikasi.</p>}
    <div className={p.metrics}>{metrics.map(([Icon, value, label]) => <Panel key={label}><Icon size={19} color="#2a9d8f" /><strong>{value}</strong><p className={p.small}>{label}</p></Panel>)}</div>
    <ErrorNote error={enrollments.error || incidents.error || assignments.error} />
    <Panel>
      <h2 className={p.sectionTitle}>{isManager ? "Pengajuan terbaru" : "Anak yang Anda dampingi"}</h2>
      {(enrollments.loading || assignments.loading) && <Loading />}
      <div className={p.stack} style={{ marginTop: 12 }}>
        {(isManager ? all.slice(0, 6) : list(assignments.data).map(a => a.enrollment)).map(e => <div key={e.id} className={p.between}>
          <div><strong>{e.child?.full_name ?? "Identitas anak tampil setelah disetujui"}</strong><p className={p.small}>Ref. {e.reference} · {dateText(e.service_date)}</p></div>
          <Badge map={ENROLLMENT_STATUS} value={e.status} />
        </div>)}
        {!enrollments.loading && !assignments.loading && (isManager ? all : list(assignments.data)).length === 0 && <p className={p.muted}>Belum ada data.</p>}
      </div>
      <div className={p.row} style={{ marginTop: 16 }}>
        {isManager && <LinkButton secondary href="/pengelola/pendaftaran">Kelola pendaftaran</LinkButton>}
        <LinkButton secondary href="/pengelola/laporan-harian">Logbook harian</LinkButton>
        <LinkButton secondary href="/pengelola/insiden">Laporan insiden</LinkButton>
      </div>
    </Panel>
  </>;
}

// ------------------------------------------------------------- enrollments

function EnrollmentRow({ enrollment, staff, onChange }) {
  const [reason, setReason] = useState("");
  const [assign, setAssign] = useState({ caregiver_id: "", starts_at: `${enrollment.service_date}T07:00`, ends_at: "" });
  const [action, run] = useAction();
  const patch = (body, notice) => run(() => apiSend(`/api/enrollments/${enrollment.id}`, { method: "PATCH", body }), notice).then(ok => ok && onChange());
  const caregivers = staff.filter(m => m.role === "caregiver" && m.status === "active");
  return <Panel>
    <div className={p.between}>
      <div><h3 className={p.sectionTitle}>{enrollment.child?.full_name ?? "Identitas anak tampil setelah disetujui"}</h3>
        <p className={p.small}>Ref. {enrollment.reference} · {enrollment.offering?.name} · mulai {dateText(enrollment.service_date)}{enrollment.charge ? ` · tagihan ${rupiah(enrollment.charge.total_amount)}` : ""}</p></div>
      <Badge map={ENROLLMENT_STATUS} value={enrollment.status} />
    </div>
    {enrollment.status === "pending" && <div className={p.stack} style={{ gap: 8, marginTop: 12 }}>
      <input className={p.select} placeholder="Alasan keputusan (minimal 5 karakter)" value={reason} onChange={e => setReason(e.target.value)} aria-label="Alasan keputusan" />
      <div className={p.row}>
        <button type="button" className={`${p.button} ${p.mint}`} disabled={action.busy || reason.trim().length < 5} onClick={() => patch({ action: "decide", decision: "accepted", reason }, "Pengajuan diterima; Orang Tua diminta membayar.")}>Terima</button>
        <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy || reason.trim().length < 5} onClick={() => patch({ action: "decide", decision: "rejected", reason }, "Pengajuan ditolak.")}>Tolak</button>
      </div>
    </div>}
    {enrollment.status === "approved" && <div className={p.stack} style={{ gap: 8, marginTop: 12 }}>
      <div className={p.row}>
        <select className={p.select} value={assign.caregiver_id} onChange={e => setAssign(a => ({ ...a, caregiver_id: e.target.value }))} aria-label="Pengasuh" style={{ maxWidth: 240 }}>
          <option value="">Tugaskan pengasuh</option>{caregivers.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.email}</option>)}
        </select>
        <input type="datetime-local" className={p.select} value={assign.starts_at} onChange={e => setAssign(a => ({ ...a, starts_at: e.target.value }))} aria-label="Mulai" style={{ maxWidth: 220 }} />
        <input type="datetime-local" className={p.select} value={assign.ends_at} onChange={e => setAssign(a => ({ ...a, ends_at: e.target.value }))} aria-label="Selesai" style={{ maxWidth: 220 }} />
        <button type="button" className={p.button} disabled={action.busy || !assign.caregiver_id || !assign.ends_at}
          onClick={() => patch({ action: "assign_caregiver", caregiver_id: assign.caregiver_id, starts_at: new Date(assign.starts_at).toISOString(), ends_at: new Date(assign.ends_at).toISOString() }, "Pengasuh ditugaskan.")}>Tugaskan</button>
      </div>
      {caregivers.length === 0 && <p className={p.small}>Belum ada Pengasuh aktif. <Link className={p.link} href="/pengelola/staf">Undang Pengasuh</Link>.</p>}
      <div className={p.row}>
        {!enrollment.checked_in_at && <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={() => patch({ action: "check_in" }, "Anak tercatat hadir (check-in).")}>Check-in anak</button>}
        <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={() => window.confirm("Tandai pengasuhan selesai?") && patch({ action: "complete" }, "Pengasuhan ditandai selesai.")}>Selesaikan pengasuhan</button>
      </div>
    </div>}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </Panel>;
}

export function ManagerEnrollments() {
  const { daycare } = useDaycare();
  const enrollments = useApi(`/api/enrollments?daycare_id=${daycare.id}`);
  const staff = useApi(`/api/me/daycares/${daycare.id}/staff`);
  const [filter, setFilter] = useState("");
  const items = list(enrollments.data).filter(e => !filter || e.status === filter);
  return <ManagerOnly>
    <PageHeader eyebrow="KELOLA PENDAFTARAN" title="Pengajuan dari Orang Tua." description="Identitas anak tampil setelah pengajuan disetujui dan dibayar." />
    <select className={p.select} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter status" style={{ maxWidth: 260, marginBottom: 16 }}>
      <option value="">Semua status</option>{Object.entries(ENROLLMENT_STATUS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
    </select>
    {enrollments.loading ? <Loading /> : <ErrorNote error={enrollments.error} onRetry={enrollments.reload} />}
    <div className={p.stack}>
      {!enrollments.loading && items.length === 0 && <Empty title="Belum ada pengajuan" />}
      {items.map(e => <EnrollmentRow key={e.id} enrollment={e} staff={list(staff.data)} onChange={enrollments.reload} />)}
    </div>
  </ManagerOnly>;
}

// ----------------------------------------------------------------- logbook

function PhotoReview({ activity, canUpload, childId, onChange }) {
  const photos = useApi(`/api/activities/${activity.id}/photos`);
  const [action, run] = useAction();
  async function upload({ blob, polygon }) {
    const form = new FormData();
    form.append("file", blob, "foto.jpg");
    form.append("child_id", childId);
    form.append("target_polygon", JSON.stringify(polygon));
    if (await run(() => apiSend(`/api/activities/${activity.id}/photos`, { form }), "Foto diunggah. Tinjau versi fokus di bawah.")) { photos.reload(); onChange?.(); }
  }
  async function review(variantId, decision) {
    if (await run(() => apiSend(`/api/activities/${activity.id}/photos/${variantId}`, { method: "PATCH", body: { decision } }), decision === "ready" ? "Foto disetujui; foto asli dihapus." : "Foto ditandai gagal.")) { photos.reload(); onChange?.(); }
  }
  const variants = list(photos.data).flatMap(photo => (photo.variants ?? []).map(v => ({ ...v, photoId: photo.id })));
  return <div className={p.stack} style={{ gap: 10, marginTop: 10 }}>
    {photos.loading && <Loading label="Memuat foto…" />}
    {variants.length > 0 && <div className={p.row}>{variants.map(v => <figure key={v.id} style={{ margin: 0 }}>
      {v.url ? <img src={v.url} alt="Versi foto untuk Orang Tua" width={200} height={150} style={{ objectFit: "cover", borderRadius: 10 }} /> : <div className={p.empty} style={{ width: 200 }}>Tidak tersedia</div>}
      <figcaption className={p.small}>{v.status === "ready" ? "Disetujui" : v.status === "failed" ? "Ditolak" : "Menunggu tinjauan"}</figcaption>
      {v.status === "processing" && <div className={p.row}>
        <button type="button" className={p.button} disabled={action.busy} onClick={() => review(v.id, "ready")}><CheckCircle2 size={14} />Setujui</button>
        <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={() => review(v.id, "failed")}>Tolak</button>
      </div>}
    </figure>)}</div>}
    {canUpload && activity.status === "draft" && variants.length < 3 && <PhotoTargetPicker onReady={upload} disabled={action.busy} />}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </div>;
}

function ActivityItem({ activity, enrollment, canWrite, isManager, onChange }) {
  const [open, setOpen] = useState(false);
  const [action, run] = useAction();
  async function send() {
    const body = {
      report_date: activity.report_date, activity_type: activity.activity_type, title: activity.title, body: activity.body,
      occurred_at: activity.occurred_at, status: "sent", is_urgent: activity.is_urgent, urgent_reason: activity.urgent_reason ?? null,
      change_reason: "Dikirim setelah foto ditinjau",
    };
    if (await run(() => apiSend(`/api/enrollments/${enrollment.id}/activities/${activity.id}`, { method: "PATCH", body }), "Catatan terkirim ke Orang Tua.")) onChange();
  }
  async function remove() {
    if (window.confirm("Hapus draf ini?") && await run(() => apiSend(`/api/enrollments/${enrollment.id}/activities/${activity.id}`, { method: "DELETE" }))) onChange();
  }
  async function reviewed() {
    if (await run(() => apiSend(`/api/activities/${activity.id}/acknowledgements`, { body: { type: "manager_review" } }), "Ditandai sudah ditinjau.")) onChange();
  }
  return <Panel>
    <div className={p.between}>
      <div><span className={`${p.badge} ${activity.status === "draft" ? p.amber : ""}`}>{activity.status === "draft" ? "Draf" : "Terkirim"}</span>
        <span className={p.badge} style={{ marginLeft: 6 }}>{ACTIVITY_TYPES[activity.activity_type]}</span>
        {activity.is_urgent && <span className={`${p.badge} ${p.red}`} style={{ marginLeft: 6 }}>Penting</span>}
        <h3 className={p.sectionTitle} style={{ marginTop: 8 }}>{activity.title}</h3></div>
      <span className={p.small}>{dateTimeText(activity.occurred_at)}</span>
    </div>
    <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{activity.body}</p>
    <p className={p.small}>Oleh {activity.caregiver_name} · {activity.love_count ?? 0} love · {activity.comment_count ?? 0} komentar{activity.parent_read_at ? ` · dibaca Orang Tua ${dateTimeText(activity.parent_read_at)}` : ""}</p>
    <div className={p.row} style={{ marginTop: 10 }}>
      <button type="button" className={`${p.button} ${p.secondary}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>Foto</button>
      {canWrite && activity.status === "draft" && <>
        <button type="button" className={`${p.button} ${p.mint}`} disabled={action.busy} onClick={send}>Kirim ke Orang Tua</button>
        <button type="button" className={p.link} disabled={action.busy} onClick={remove}>Hapus draf</button>
      </>}
      {isManager && activity.status === "sent" && <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={reviewed}>Tandai sudah ditinjau</button>}
    </div>
    <p className={p.small}>Catatan biasa perlu 1–3 foto yang sudah disetujui sebelum dikirim; catatan penting boleh tanpa foto.</p>
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    {open && <PhotoReview activity={activity} canUpload={canWrite} childId={enrollment.child?.child_id} onChange={onChange} />}
  </Panel>;
}

export function StaffLogbook() {
  const { isManager } = useDaycare();
  const writable = useWritableEnrollments();
  const [chosen, setChosen] = useState("");
  const enrollmentId = chosen || writable.items[0]?.id || "";
  const enrollment = writable.items.find(e => e.id === enrollmentId);
  const activities = useApi(enrollmentId ? `/api/enrollments/${enrollmentId}/activities` : null);
  return <>
    <PageHeader eyebrow="LOGBOOK HARIAN ANAK" title="Setiap aktivitas, tercatat dengan baik." description="Draf hanya terlihat oleh staf. Orang Tua menerima catatan setelah dikirim.">
      {!isManager && <LinkButton href="/pengelola/laporan-harian/tambah"><Plus size={16} />Buat catatan</LinkButton>}
    </PageHeader>
    {writable.loading ? <Loading /> : <ErrorNote error={writable.error} onRetry={writable.reload} />}
    {!writable.loading && writable.items.length === 0 && <Empty title={isManager ? "Belum ada anak aktif" : "Belum ada anak yang ditugaskan kepada Anda"}>{isManager ? "Anak aktif muncul setelah pengajuan disetujui dan dibayar." : "Pengelola menugaskan Pengasuh dari halaman Kelola pendaftaran."}</Empty>}
    {writable.items.length > 0 && <div className={p.stack}>
      <EnrollmentSelect items={writable.items} value={enrollmentId} onChange={setChosen} />
      {activities.loading ? <Loading /> : <ErrorNote error={activities.error} onRetry={activities.reload} />}
      {!activities.loading && list(activities.data).length === 0 && <Empty title="Belum ada catatan" />}
      {list(activities.data).map(a => <ActivityItem key={a.id} activity={a} enrollment={enrollment} canWrite={!isManager} isManager={isManager} onChange={activities.reload} />)}
    </div>}
  </>;
}

const toIso = local => (local ? new Date(local).toISOString() : null);

// Meal/sleep facts for the AI draft (stored in the activity's details).
function activityDetails(type, meal, sleep) {
  if (type === "meal" && (meal.food || meal.portion_consumed || meal.observed_condition)) return { meal };
  if (type === "sleep" && sleep.started_at) {
    return { sleep: { started_at: toIso(sleep.started_at), ended_at: toIso(sleep.ended_at), condition_after: sleep.condition_after || null } };
  }
  return {};
}

function DetailFields({ type, meal, sleep, setMeal, setSleep }) {
  if (type === "meal") return <div className={p.row}>
    <input className={p.select} placeholder="Menu (mis. nasi, sup sayur)" value={meal.food} onChange={e => setMeal("food", e.target.value)} aria-label="Menu makanan" style={{ flex: 2, minWidth: 180 }} />
    <input className={p.select} placeholder="Porsi habis (mis. 1/2 porsi)" value={meal.portion_consumed} onChange={e => setMeal("portion_consumed", e.target.value)} aria-label="Porsi yang dimakan" style={{ flex: 1, minWidth: 150 }} />
    <input className={p.select} placeholder="Kondisi saat makan" value={meal.observed_condition} onChange={e => setMeal("observed_condition", e.target.value)} aria-label="Kondisi saat makan" style={{ flex: 2, minWidth: 180 }} />
  </div>;
  if (type === "sleep") return <div className={p.row}>
    <label className={p.small}>Mulai tidur<input type="datetime-local" className={p.select} value={sleep.started_at} max={nowLocalInput()} onChange={e => setSleep("started_at", e.target.value)} /></label>
    <label className={p.small}>Bangun<input type="datetime-local" className={p.select} value={sleep.ended_at} max={nowLocalInput()} onChange={e => setSleep("ended_at", e.target.value)} /></label>
    <input className={p.select} placeholder="Kondisi setelah bangun" value={sleep.condition_after} onChange={e => setSleep("condition_after", e.target.value)} aria-label="Kondisi setelah bangun" style={{ flex: 1, minWidth: 180, alignSelf: "flex-end" }} />
  </div>;
  return null;
}

function AiSuggestion({ draft, onUse, onDiscard, busy }) {
  const { result, meta } = draft;
  return <div className={p.notice} style={{ display: "block", marginTop: 4 }} aria-live="polite">
    <p className={p.small}><Sparkles size={13} /> <strong>Draf AI</strong> · hanya dari catatan Anda · periksa sebelum dikirim</p>
    <h3 className={p.sectionTitle} style={{ marginTop: 6 }}>{result.title}</h3>
    <p style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{result.body}</p>
    {result.missing_fields?.length > 0 && <p className={p.small} style={{ marginTop: 6 }}>Bisa ditambahkan: {result.missing_fields.join(", ")}.</p>}
    <div className={p.row} style={{ marginTop: 10 }}>
      <button type="button" className={`${p.button} ${p.mint}`} disabled={busy} onClick={onUse}>Pakai draf ini</button>
      <button type="button" className={p.link} disabled={busy} onClick={onDiscard}>Buang</button>
    </div>
    {meta?.provider === "fixture" && <p className={p.small}>Mode uji: contoh tetap dari kontrak, bukan model AI.</p>}
  </div>;
}

export function StaffLogbookForm() {
  const router = useRouter();
  const { isManager } = useDaycare();
  const writable = useWritableEnrollments();
  const [form, setForm] = useState({ enrollment_id: "", activity_type: "play", title: "", body: "", occurred_at: nowLocalInput(), is_urgent: false, urgent_reason: "" });
  const [meal, setMealState] = useState({ food: "", portion_consumed: "", observed_condition: "" });
  const [sleep, setSleepState] = useState({ started_at: "", ended_at: "", condition_after: "" });
  const [activityId, setActivityId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setMeal = (key, value) => setMealState(m => ({ ...m, [key]: value }));
  const setSleep = (key, value) => setSleepState(m => ({ ...m, [key]: value }));
  if (isManager) return <Empty title="Catatan ditulis oleh Pengasuh">Pengelola meninjau catatan dari halaman Logbook harian.</Empty>;

  // Creates the draft activity the first time, then updates it.
  async function persist(status, { title = form.title, body = form.body, reason } = {}) {
    const payload = {
      report_date: todayJakarta(), activity_type: form.activity_type, title, body,
      occurred_at: new Date(form.occurred_at).toISOString(), status, is_urgent: form.is_urgent, urgent_reason: form.is_urgent ? form.urgent_reason : null,
      details: activityDetails(form.activity_type, meal, sleep),
    };
    if (!activityId) {
      const { id } = await apiSend(`/api/enrollments/${form.enrollment_id}/activities`, { body: payload });
      setActivityId(id);
      return id;
    }
    await apiSend(`/api/enrollments/${form.enrollment_id}/activities/${activityId}`, {
      method: "PATCH",
      body: { ...payload, change_reason: reason ?? (aiUsed ? "Menerapkan draf AI yang sudah ditinjau Pengasuh" : "Diperbarui oleh Pengasuh sebelum dikirim") },
    });
    return activityId;
  }
  async function save(status) {
    if (await run(() => persist(status))) router.push("/pengelola/laporan-harian");
  }
  // Saves the notes as a draft, then asks for the AI draft of that activity.
  async function makeDraft() {
    const result = await run(async () => {
      const title = form.title.trim().length >= 3 ? form.title : ACTIVITY_TYPES[form.activity_type];
      const id = await persist("draft", { title, reason: "Catatan pengamatan diperbarui sebelum draf AI" });
      if (title !== form.title) set("title", title);
      return apiSend(`/api/enrollments/${form.enrollment_id}/activities/${id}/ai-draft`);
    });
    if (result?.result) setDraft(result);
  }
  function applyDraft() {
    setForm(f => ({ ...f, title: draft.result.title.slice(0, 100), body: draft.result.body }));
    setAiUsed(true);
    setDraft(null);
  }
  const blocked = action.busy || !form.enrollment_id;
  return <>
    <PageHeader eyebrow="CATATAN BARU" title="Abadikan cerita kecil hari ini." description="Tulis pengamatan singkat, minta draf AI bila perlu, tinjau, lalu tambahkan 1–3 foto sebelum dikirim ke Orang Tua.">
      <LinkButton secondary href="/pengelola/laporan-harian">Kembali ke daftar</LinkButton>
    </PageHeader>
    {writable.loading ? <Loading /> : <ErrorNote error={writable.error} />}
    <Panel><form className={p.form} onSubmit={event => { event.preventDefault(); save("draft"); }}>
      <EnrollmentSelect items={writable.items} value={form.enrollment_id} onChange={v => { if (!activityId) set("enrollment_id", v); }} />
      <div className={p.row}>
        <select className={p.select} value={form.activity_type} onChange={e => set("activity_type", e.target.value)} aria-label="Jenis kegiatan" style={{ maxWidth: 220 }}>
          {Object.entries(ACTIVITY_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="datetime-local" className={p.select} value={form.occurred_at} max={nowLocalInput()} onChange={e => set("occurred_at", e.target.value)} aria-label="Waktu kegiatan" style={{ maxWidth: 240 }} />
      </div>
      <DetailFields type={form.activity_type} meal={meal} sleep={sleep} setMeal={setMeal} setSleep={setSleep} />
      <input className={p.select} required minLength={3} maxLength={100} placeholder="Judul kegiatan (boleh kosong bila memakai draf AI)" value={form.title} onChange={e => set("title", e.target.value)} aria-label="Judul" />
      <textarea className={p.select} rows={6} required minLength={20} maxLength={2000}
        placeholder={"Tulis pengamatan faktual, satu per baris, misalnya:\n- Menyusun balok jadi menara\n- Bergantian mainan dengan teman"}
        value={form.body} onChange={e => set("body", e.target.value)} aria-label="Isi catatan" />
      {draft && <AiSuggestion draft={draft} busy={action.busy} onUse={applyDraft} onDiscard={() => setDraft(null)} />}
      <label className={p.check}><input type="checkbox" checked={form.is_urgent} onChange={e => set("is_urgent", e.target.checked)} />Catatan penting (boleh dikirim tanpa foto)</label>
      {form.is_urgent && <input className={p.select} required minLength={5} placeholder="Alasan catatan penting" value={form.urgent_reason} onChange={e => set("urgent_reason", e.target.value)} aria-label="Alasan penting" />}
      <ErrorNote error={action.error} />
      <div className={p.row}>
        <button className={`${p.button} ${p.secondary}`} type="button" disabled={blocked || form.body.trim().length < 20} onClick={makeDraft}>
          <Sparkles size={15} />{action.busy ? "Memproses…" : "Buat draf AI"}
        </button>
        <button className={`${p.button} ${p.secondary}`} type="submit" disabled={blocked}>Simpan draf</button>
        {form.is_urgent && <button className={`${p.button} ${p.mint}`} type="button" disabled={blocked} onClick={() => save("sent")}>Kirim sekarang</button>}
      </div>
      <p className={p.small}>Draf AI hanya menyusun ulang catatan Anda tanpa menambah fakta. Setelah draf tersimpan, buka catatan di daftar logbook lalu tekan <strong>Foto</strong> untuk menambahkan foto dengan Foto Fokus Anak.</p>
    </form></Panel>
  </>;
}

// ---------------------------------------------------------------- incidents

export function StaffIncidents() {
  const { daycare, isManager } = useDaycare();
  const writable = useWritableEnrollments();
  const incidents = useApi(isManager ? "/api/incidents" : null);
  const [form, setForm] = useState({ enrollment_id: "", occurred_at: nowLocalInput(), description: "", first_aid: "", urgency: "medium", urgency_reason: "" });
  const [statusReason, setStatusReason] = useState({});
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function create(event) {
    event.preventDefault();
    if (await run(() => apiSend("/api/incidents", { body: { ...form, occurred_at: new Date(form.occurred_at).toISOString() } }), "Laporan insiden terkirim; Orang Tua dan Pengelola diberi tahu.")) {
      setForm(f => ({ ...f, description: "", first_aid: "", urgency_reason: "" })); incidents.reload();
    }
  }
  async function setStatus(id, status) {
    if (await run(() => apiSend(`/api/incidents/${id}`, { method: "PATCH", body: { status, reason: statusReason[id] ?? "" } }), "Status laporan diperbarui.")) incidents.reload();
  }
  const own = list(incidents.data).filter(i => i.daycare?.id === daycare.id);
  return <>
    <PageHeader eyebrow="LAPORAN INSIDEN" title="Catat kejadian dengan jelas." description="Pilih tingkat urgensi sesuai kondisi; Orang Tua menerima notifikasi." />
    <Panel><form className={p.form} onSubmit={create}>
      <EnrollmentSelect items={writable.items} value={form.enrollment_id} onChange={v => set("enrollment_id", v)} />
      <input type="datetime-local" className={p.select} value={form.occurred_at} max={nowLocalInput()} onChange={e => set("occurred_at", e.target.value)} aria-label="Waktu kejadian" style={{ maxWidth: 240 }} />
      <textarea className={p.select} rows={4} required minLength={20} placeholder="Uraian kejadian (minimal 20 karakter)" value={form.description} onChange={e => set("description", e.target.value)} aria-label="Uraian" />
      <input className={p.select} required minLength={2} placeholder="Pertolongan pertama yang sudah dilakukan" value={form.first_aid} onChange={e => set("first_aid", e.target.value)} aria-label="Pertolongan pertama" />
      <div className={p.row}>
        <select className={p.select} value={form.urgency} onChange={e => set("urgency", e.target.value)} aria-label="Urgensi" style={{ maxWidth: 180 }}>
          {Object.entries(URGENCY).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className={p.select} required minLength={5} placeholder="Alasan urgensi" value={form.urgency_reason} onChange={e => set("urgency_reason", e.target.value)} aria-label="Alasan urgensi" style={{ flex: 1 }} />
      </div>
      <ErrorNote error={action.error} /><Notice text={action.notice} />
      <button className={p.button} type="submit" disabled={action.busy || !form.enrollment_id}>Kirim laporan</button>
    </form></Panel>
    {isManager && <div className={p.stack} style={{ marginTop: 24 }}>
      <h2 className={p.sectionTitle}>Laporan di daycare ini</h2>
      {incidents.loading ? <Loading /> : <ErrorNote error={incidents.error} onRetry={incidents.reload} />}
      {!incidents.loading && own.length === 0 && <Empty title="Belum ada laporan" />}
      {own.map(i => <Panel key={i.id}>
        <div className={p.between}><div><strong>{i.child_name ?? "Anak"}</strong><p className={p.small}>{dateTimeText(i.occurred_at)}</p></div>
          <div className={p.row}><Badge map={URGENCY} value={i.urgency} /><Badge map={INCIDENT_STATUS} value={i.status} /></div></div>
        <p style={{ marginTop: 6 }}>{i.description}</p><p className={p.small}>Pertolongan pertama: {i.first_aid}</p>
        {i.status !== "resolved" && <div className={p.row} style={{ marginTop: 10 }}>
          <input className={p.select} placeholder="Alasan perubahan status (minimal 10 karakter)" value={statusReason[i.id] ?? ""} onChange={e => setStatusReason(r => ({ ...r, [i.id]: e.target.value }))} aria-label="Alasan" style={{ flex: 1 }} />
          {i.status === "new" && <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={() => setStatus(i.id, "in_progress")}>Tangani</button>}
          <button type="button" className={p.button} disabled={action.busy} onClick={() => setStatus(i.id, "resolved")}>Selesai</button>
        </div>}
      </Panel>)}
    </div>}
  </>;
}

// ------------------------------------------------------------------ reviews

function ReplyForm({ review, onDone }) {
  const [text, setText] = useState("");
  const [action, run] = useAction();
  async function submit(event) {
    event.preventDefault();
    if (await run(() => apiSend(`/api/reviews/${review.id}/reply`, { body: { body: text } }), "Balasan terkirim dan menunggu moderasi.")) { setText(""); onDone(); }
  }
  return <form className={p.stack} style={{ gap: 8, marginTop: 10 }} onSubmit={submit}>
    <textarea className={p.select} rows={3} minLength={10} maxLength={2000} placeholder="Tulis balasan yang sopan (minimal 10 karakter)" value={text} onChange={e => setText(e.target.value)} aria-label="Balasan" />
    <button className={p.button} type="submit" disabled={action.busy || text.trim().length < 10} style={{ width: "fit-content" }}>Kirim balasan</button>
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </form>;
}

export function ManagerReviews() {
  const { daycare } = useDaycare();
  const reviews = useApi(`/api/daycares/${daycare.id}/reviews`);
  const items = reviews.data?.items ?? [];
  return <ManagerOnly>
    <PageHeader eyebrow="ULASAN & BALASAN" title="Dengarkan, pahami, tanggapi." description={`Rata-rata ${reviews.data?.average_rating ?? "—"} dari ${reviews.data?.count ?? 0} ulasan yang lolos moderasi.`} />
    {reviews.loading ? <Loading /> : <ErrorNote error={reviews.error} onRetry={reviews.reload} />}
    <div className={p.stack}>
      {!reviews.loading && items.length === 0 && <Empty title="Belum ada ulasan terbit" />}
      {items.map(r => <Panel key={r.id}>
        <div className={p.between}><strong>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</strong><span className={p.small}>{dateText(r.published_at)}</span></div>
        <p style={{ marginTop: 6 }}>{r.body}</p>
        {r.reply ? <p className={p.notice} style={{ marginTop: 8 }}>Balasan Anda: {typeof r.reply === "string" ? r.reply : r.reply.body}</p> : <ReplyForm review={r} onDone={reviews.reload} />}
      </Panel>)}
    </div>
  </ManagerOnly>;
}

// -------------------------------------------------------------------- staff

export function ManagerStaff() {
  const { daycare } = useDaycare();
  const staff = useApi(`/api/me/daycares/${daycare.id}/staff`);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [action, run] = useAction();
  async function invite(event) {
    event.preventDefault();
    const result = await run(() => apiSend(`/api/me/daycares/${daycare.id}/staff/invitations`, { body: { email } }), "Undangan dibuat. Bagikan tautan di bawah ke Pengasuh.");
    if (result?.invitation_token) { setLink(invitationUrl(window.location.origin, result.invitation_token)); setEmail(""); staff.reload(); }
  }
  async function end(memberId) {
    const reason = window.prompt("Alasan menonaktifkan Pengasuh (minimal 5 karakter):");
    if (reason && await run(() => apiSend(`/api/me/daycares/${daycare.id}/staff/${memberId}`, { method: "DELETE", body: { reason } }), "Pengasuh dinonaktifkan.")) staff.reload();
  }
  return <ManagerOnly>
    <PageHeader eyebrow="STAF & UNDANGAN" title="Tim pengasuh Anda." description="Pengasuh baru aktif setelah menerima undangan dan diverifikasi Admin." />
    <Panel><form className={p.row} onSubmit={invite}>
      <input type="email" className={p.select} required placeholder="Email Pengasuh" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email Pengasuh" style={{ flex: 1 }} />
      <button className={p.button} type="submit" disabled={action.busy}>Buat undangan</button>
    </form>
      {link && <div className={p.notice} style={{ display: "block", marginTop: 12 }}><p className={p.small}>Tautan hanya ditampilkan sekali dan berlaku 7 hari:</p>
        <code style={{ wordBreak: "break-all" }}>{link}</code>
        <button type="button" className={p.link} onClick={() => navigator.clipboard?.writeText(link)} style={{ marginLeft: 8 }}><Copy size={13} />Salin</button></div>}
      <ErrorNote error={action.error} /><Notice text={action.notice} />
    </Panel>
    <div className={c.tableWrap} style={{ marginTop: 20 }}>
      {staff.loading ? <Loading /> : <ErrorNote error={staff.error} onRetry={staff.reload} />}
      <table className={c.table}><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th></th></tr></thead><tbody>
        {list(staff.data).map(m => <tr key={m.member_id}><td>{m.full_name ?? "—"}</td><td>{m.email}</td><td>{m.role === "manager" ? "Pengelola" : "Pengasuh"}</td><td>{m.status}</td>
          <td>{m.role === "caregiver" && m.status !== "inactive" && <button type="button" className={p.link} onClick={() => end(m.member_id)}>Nonaktifkan</button>}</td></tr>)}
      </tbody></table>
    </div>
  </ManagerOnly>;
}

// ---------------------------------------------------------------- documents

const DOCUMENT_TYPES = [["operational_license", "Izin operasional"], ["business_license", "Izin usaha (NIB)"], ["tax_document", "Dokumen pajak"], ["insurance", "Asuransi"], ["other", "Lainnya"]];

export function ManagerDocuments() {
  const { daycare } = useDaycare();
  const documents = useApi(`/api/me/daycares/${daycare.id}/documents`);
  const [action, run] = useAction();
  async function upload(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await run(() => apiSend(`/api/me/daycares/${daycare.id}/documents`, { form }), "Dokumen terkirim untuk diverifikasi Admin.")) { event.target.reset?.(); documents.reload(); }
  }
  async function view(id) {
    const result = await run(() => apiSend(`/api/daycare-documents/${id}/file`, { method: "GET" }));
    if (result?.url) window.open(result.url, "_blank", "noopener");
  }
  return <ManagerOnly>
    <PageHeader eyebrow="DOKUMEN LEGALITAS" title="Dokumen untuk verifikasi." description="Berkas disimpan privat; hanya Anda dan Admin yang dapat membukanya." />
    <Panel><form className={p.form} onSubmit={upload}>
      <select name="document_type" className={p.select} required aria-label="Jenis dokumen">{DOCUMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <div className={p.row}>
        <input name="document_number" className={p.select} placeholder="Nomor dokumen" aria-label="Nomor dokumen" />
        <input name="issuer" className={p.select} placeholder="Penerbit" aria-label="Penerbit" />
      </div>
      <div className={p.row}>
        <label className={p.small}>Tanggal terbit <input name="valid_from" type="date" className={p.select} /></label>
        <label className={p.small}>Berlaku sampai <input name="expires_on" type="date" className={p.select} /></label>
      </div>
      <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png" aria-label="Berkas" />
      <ErrorNote error={action.error} /><Notice text={action.notice} />
      <button className={p.button} type="submit" disabled={action.busy}><FileText size={16} />Unggah dokumen</button>
    </form></Panel>
    <div className={p.stack} style={{ marginTop: 20 }}>
      {documents.loading ? <Loading /> : <ErrorNote error={documents.error} onRetry={documents.reload} />}
      {list(documents.data).map(d => <Panel key={d.id}><div className={p.between}>
        <div><strong>{DOCUMENT_TYPES.find(([v]) => v === d.document_type)?.[1] ?? d.document_type} · v{d.version}</strong>
          <p className={p.small}>{d.document_number ?? "—"} · {d.issuer ?? "—"} · berlaku sampai {dateText(d.expires_on)}</p>
          {d.reason && <p className={p.small}>Catatan Admin: {d.reason}</p>}</div>
        <div className={p.row}><span className={p.badge}>{d.status}</span><button type="button" className={p.link} onClick={() => view(d.id)}>Lihat berkas</button></div>
      </div></Panel>)}
    </div>
  </ManagerOnly>;
}

// ------------------------------------------------------------------ photos

const PHOTO_STATUS = {
  pending: ["Menunggu tinjauan Admin", p.amber],
  approved: ["Tampil di halaman publik", ""],
  rejected: ["Ditolak", p.neutral],
};
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 20;

// Public gallery photos: uploaded to the private bucket "daycare-gallery",
// shown on the public page only after Admin approval (048/049).
export function ManagerPhotos() {
  const { daycare } = useDaycare();
  const photos = useApi(`/api/me/daycares/${daycare.id}/photos`);
  const [action, run] = useAction();
  const items = list(photos.data);
  const used = items.filter(photo => photo.status === "pending" || photo.status === "approved").length;
  async function upload(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > MAX_PHOTO_BYTES) { await run(() => Promise.reject(new Error("Ukuran foto maksimal 8 MB."))); return; }
    if (!form.get("caption")) form.delete("caption");
    if (await run(() => apiSend(`/api/me/daycares/${daycare.id}/photos`, { form }), "Foto terkirim. Foto tampil di halaman publik setelah disetujui Admin.")) { formElement.reset(); photos.reload(); }
  }
  return <ManagerOnly>
    <PageHeader eyebrow="FOTO DAYCARE" title="Foto untuk halaman publik." description="Foto ditinjau Admin dulu, lalu tampil di halaman daycare menggantikan gambar ilustrasi." />
    <Panel>
      <ul className={p.small} style={{ margin: "0 0 14px", paddingLeft: 18, lineHeight: 1.8 }}>
        <li>Foto ruangan, fasilitas, atau tampak depan. <strong>Jangan ada wajah anak yang terlihat.</strong></li>
        <li>Tidak ada data pribadi yang terbaca, misalnya nama anak di loker atau nomor telepon.</li>
        <li>JPG, PNG, atau WEBP, maksimal 8 MB. Foto mendatar (landscape) paling pas.</li>
      </ul>
      {daycare.status !== "active" && <p className={p.small} style={{ marginBottom: 12 }}>Status daycare Anda {daycare.status}. Foto yang disetujui baru tampil setelah daycare aktif.</p>}
      <form className={p.form} onSubmit={upload}>
        <input name="file" type="file" required accept="image/jpeg,image/png,image/webp" aria-label="Foto daycare" />
        <input name="caption" className={p.select} maxLength={160} placeholder="Keterangan (opsional), mis. Ruang bermain" aria-label="Keterangan foto" />
        <ErrorNote error={action.error} /><Notice text={action.notice} />
        <button className={p.button} type="submit" disabled={action.busy || used >= MAX_PHOTOS}><ImagePlus size={16} />{action.busy ? "Mengunggah..." : "Unggah foto"}</button>
        <p className={p.small}>{used} dari {MAX_PHOTOS} foto terpakai (menunggu + tampil).</p>
      </form>
    </Panel>
    <div style={{ marginTop: 20 }}>
      {photos.loading ? <Loading /> : <ErrorNote error={photos.error} onRetry={photos.reload} />}
      {!photos.loading && !photos.error && items.length === 0 && <Empty title="Belum ada foto">Unggah foto pertama daycare Anda di atas.</Empty>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        {items.map(photo => {
          const [label, tone] = PHOTO_STATUS[photo.status] ?? [photo.status, p.neutral];
          return <Panel key={photo.id}>
            <img src={photo.url} alt={photo.caption || `Foto ${daycare.name}`} style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: 10, display: "block" }} />
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <span className={`${p.badge} ${tone}`} style={{ alignSelf: "flex-start" }}>{label}</span>
              {photo.caption && <p className={p.small}>{photo.caption}</p>}
              {photo.status === "rejected" && photo.decision_reason && <p className={p.small}>Alasan: {photo.decision_reason}</p>}
              <p className={p.small}>{dateText(photo.created_at)}</p>
            </div>
          </Panel>;
        })}
      </div>
    </div>
  </ManagerOnly>;
}

// ------------------------------------------------------------------ profile

function OfferingForm({ daycareId, onDone }) {
  const [form, setForm] = useState({ name: "", service_type: "monthly", description: "", min_age_months: 12, max_age_months: 72, service_amount: "", is_active: true });
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    const body = { ...form, min_age_months: Number(form.min_age_months), max_age_months: Number(form.max_age_months), service_amount: Number(form.service_amount), late_pickup_terms: {} };
    if (await run(() => apiSend(`/api/me/daycares/${daycareId}/offerings`, { body }), "Layanan tersimpan; harga menunggu persetujuan Admin.")) onDone();
  }
  return <form className={p.form} onSubmit={submit}>
    <div className={p.row}>
      <input className={p.select} required minLength={2} placeholder="Nama layanan" value={form.name} onChange={e => set("name", e.target.value)} aria-label="Nama layanan" />
      <select className={p.select} value={form.service_type} onChange={e => set("service_type", e.target.value)} aria-label="Jenis"><option value="monthly">Bulanan</option><option value="daily">Harian</option></select>
    </div>
    <textarea className={p.select} rows={2} required minLength={10} placeholder="Deskripsi (minimal 10 karakter)" value={form.description} onChange={e => set("description", e.target.value)} aria-label="Deskripsi" />
    <div className={p.row}>
      <label className={p.small}>Usia min (bulan)<input type="number" min={0} max={84} className={p.select} value={form.min_age_months} onChange={e => set("min_age_months", e.target.value)} /></label>
      <label className={p.small}>Usia maks (bulan)<input type="number" min={0} max={84} className={p.select} value={form.max_age_months} onChange={e => set("max_age_months", e.target.value)} /></label>
      <label className={p.small}>Harga (Rp)<input type="number" min={1} required className={p.select} value={form.service_amount} onChange={e => set("service_amount", e.target.value)} /></label>
    </div>
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <button className={p.button} type="submit" disabled={action.busy}><Plus size={16} />Simpan layanan</button>
  </form>;
}

function ProfileForm({ profile, daycareId, onDone }) {
  const [form, setForm] = useState({
    name: profile.name ?? "", description: profile.description ?? "", address: profile.address ?? "", contact_phone: profile.contact_phone ?? "",
    facilities: (profile.facilities ?? []).join(", "), opening_hours: JSON.stringify(profile.opening_hours ?? {}, null, 1), daily_capacity: profile.daily_capacity ?? 10,
  });
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    let hours;
    try { hours = JSON.parse(form.opening_hours || "{}"); } catch { await run(() => Promise.reject(new Error("Jam operasional harus berformat JSON, contoh {\"senin-jumat\": \"07.00-17.00\"}."))); return; }
    const body = { ...form, facilities: form.facilities.split(",").map(x => x.trim()).filter(Boolean), opening_hours: hours, daily_capacity: Number(form.daily_capacity) };
    if (await run(() => apiSend(`/api/me/daycares/${daycareId}/profile`, { method: "PATCH", body }), "Profil tersimpan.")) onDone();
  }
  return <form className={p.form} onSubmit={submit}>
    <input className={p.select} required placeholder="Nama daycare" value={form.name} onChange={e => set("name", e.target.value)} aria-label="Nama" />
    <textarea className={p.select} rows={3} placeholder="Deskripsi" value={form.description} onChange={e => set("description", e.target.value)} aria-label="Deskripsi" />
    <input className={p.select} placeholder="Alamat" value={form.address} onChange={e => set("address", e.target.value)} aria-label="Alamat" />
    <div className={p.row}>
      <input className={p.select} placeholder="Nomor kontak" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} aria-label="Kontak" />
      <input type="number" min={1} className={p.select} value={form.daily_capacity} onChange={e => set("daily_capacity", e.target.value)} aria-label="Kapasitas harian" />
    </div>
    <input className={p.select} placeholder="Fasilitas, pisahkan dengan koma" value={form.facilities} onChange={e => set("facilities", e.target.value)} aria-label="Fasilitas" />
    <textarea className={p.select} rows={3} value={form.opening_hours} onChange={e => set("opening_hours", e.target.value)} aria-label="Jam operasional (JSON)" />
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <button className={p.button} type="submit" disabled={action.busy}>Simpan profil</button>
  </form>;
}

export function ManagerProfile({ editing = false }) {
  const { daycare } = useDaycare();
  const onboarding = useApi(`/api/me/daycares/${daycare.id}/onboarding`);
  const data = onboarding.data ?? {};
  const profile = data.daycare ?? data.profile ?? data;
  const offerings = data.offerings ?? [];
  return <ManagerOnly>
    <PageHeader eyebrow="PROFIL BISNIS" title={profile.name ?? daycare.name} description={`Status daycare: ${profile.status ?? daycare.status}`}>
      {!editing && <LinkButton secondary href="/pengelola/profil/edit">Ubah profil</LinkButton>}
    </PageHeader>
    {onboarding.loading ? <Loading /> : <ErrorNote error={onboarding.error} onRetry={onboarding.reload} />}
    {!onboarding.loading && !onboarding.error && <div className={p.stack}>
      <Panel>{editing
        ? <ProfileForm profile={profile} daycareId={daycare.id} onDone={onboarding.reload} />
        : <dl className={p.detailList}>
          <dt>Alamat</dt><dd>{profile.address ?? "—"}</dd>
          <dt>Kontak</dt><dd>{profile.contact_phone ?? "—"}</dd>
          <dt>Kapasitas harian</dt><dd>{profile.daily_capacity ?? "—"} anak</dd>
          <dt>Fasilitas</dt><dd>{(profile.facilities ?? []).join(", ") || "—"}</dd>
          <dt>Deskripsi</dt><dd>{profile.description ?? "—"}</dd>
        </dl>}</Panel>
      <Panel>
        <h2 className={p.sectionTitle}>Layanan & harga</h2>
        <div className={p.stack} style={{ gap: 8, margin: "12px 0" }}>
          {offerings.length === 0 && <p className={p.muted}>Belum ada layanan.</p>}
          {offerings.map(o => <div key={o.id} className={p.between}><div><strong>{o.name}</strong><p className={p.small}>{o.service_type === "monthly" ? "Bulanan" : "Harian"} · usia {o.min_age_months}–{o.max_age_months} bln</p></div>
            <div className={p.small}>{(o.prices ?? []).map(pr => <div key={pr.id}>{rupiah(pr.service_amount)} · {pr.status ?? pr.decision ?? "menunggu"}</div>)}</div></div>)}
        </div>
        <OfferingForm daycareId={daycare.id} onDone={onboarding.reload} />
      </Panel>
    </div>}
  </ManagerOnly>;
}
