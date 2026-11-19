"use client";
/* eslint-disable @next/next/no-img-element -- short-lived signed URLs */

// Admin portal pages backed by the API: overview with moderation and payment
// confirmation, partner daycares, verification queues, incidents/complaints.
import { useState } from "react";
import Link from "next/link";
import { Copy, Plus, ShieldCheck } from "lucide-react";
import { apiSend, useApi } from "@/lib/client-api";
import { invitationUrl } from "@/lib/auth";
import { documentTypeLabel } from "@/lib/document-types";
import { PageHeader, Panel } from "@/components/features/ParentUI";
import { Badge, COMPLAINT_STATUS, Empty, ErrorNote, INCIDENT_STATUS, Loading, URGENCY, dateText, dateTimeText, rupiah } from "./ui";
import p from "@/components/features/Parent.module.css";
import c from "@/components/features/Caregiver.module.css";

const list = data => (Array.isArray(data) ? data : []);

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

// A decision with a mandatory reason (min 5 characters).
function Decide({ options, onDecide, busy, placeholder = "Alasan keputusan (minimal 5 karakter)" }) {
  const [reason, setReason] = useState("");
  return <div className={p.row} style={{ marginTop: 10 }}>
    <input className={p.select} placeholder={placeholder} value={reason} onChange={e => setReason(e.target.value)} aria-label="Alasan" style={{ flex: 1, minWidth: 200 }} />
    {options.map(([value, label, primary]) => <button key={value} type="button" className={`${p.button} ${primary ? "" : p.secondary}`} disabled={busy || reason.trim().length < 5} onClick={() => onDecide(value, reason)}>{label}</button>)}
  </div>;
}

// ----------------------------------------------------------------- overview

function Moderation() {
  const queue = useApi("/api/admin/moderation");
  const [action, run] = useAction();
  const decide = (kind, versionId) => (decision, reason) => run(() => apiSend(`/api/admin/moderation/${kind}/${versionId}`, { method: "PATCH", body: { decision, reason } }), "Keputusan moderasi tersimpan.").then(ok => ok && queue.reload());
  const reviews = queue.data?.reviews ?? [];
  const replies = queue.data?.replies ?? [];
  return <Panel>
    <h2 className={p.sectionTitle}>Moderasi ulasan & balasan</h2>
    {queue.loading ? <Loading /> : <ErrorNote error={queue.error} onRetry={queue.reload} />}
    {!queue.loading && reviews.length + replies.length === 0 && <p className={p.muted}>Tidak ada antrean.</p>}
    {reviews.map(r => <div key={r.version_id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
      <strong>{r.daycare?.name} · {"★".repeat(r.rating ?? 0)}</strong><p>{r.body}</p><p className={p.small}>{dateTimeText(r.submitted_at)}</p>
      <Decide busy={action.busy} onDecide={decide("reviews", r.version_id)} options={[["approved", "Terbitkan", true], ["rejected", "Tolak"]]} />
    </div>)}
    {replies.map(r => <div key={r.version_id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
      <strong>Balasan · {r.daycare?.name}</strong><p>{r.body}</p>
      <Decide busy={action.busy} onDecide={decide("replies", r.version_id)} options={[["approved", "Terbitkan", true], ["rejected", "Tolak"]]} />
    </div>)}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </Panel>;
}

function Payments() {
  const payments = useApi("/api/admin/transactions");
  const [action, run] = useAction();
  const decide = id => (status, reason) => run(() => apiSend(`/api/admin/transactions/${id}`, { method: "PATCH", body: { status, provider: "manual", reason } }), "Hasil pembayaran tercatat.").then(ok => ok && payments.reload());
  const items = list(payments.data);
  return <Panel>
    <h2 className={p.sectionTitle}>Konfirmasi pembayaran</h2>
    <p className={p.small}>Cocokkan dengan mutasi rekening/QRIS sebelum menandai berhasil.</p>
    {payments.loading ? <Loading /> : <ErrorNote error={payments.error} onRetry={payments.reload} />}
    {!payments.loading && !payments.error && items.length === 0 && <p className={p.muted}>Tidak ada pembayaran yang menunggu.</p>}
    {items.map(t => <div key={t.id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
      <div className={p.between}><strong>{rupiah(t.amount)} · {t.method?.toUpperCase()}</strong><span className={p.badge}>{t.status}</span></div>
      <p className={p.small}>{t.parent?.full_name} · {t.enrollment?.child_name} · {t.daycare?.name} · Ref. {t.enrollment?.reference}</p>
      <p className={p.small}>Dibuat {dateTimeText(t.created_at)} · berlaku sampai {dateTimeText(t.expires_at)} · ID {t.id}</p>
      <Decide busy={action.busy} onDecide={decide(t.id)} placeholder="Catatan verifikasi (minimal 5 karakter)" options={[["succeeded", "Tandai berhasil", true], ["failed", "Gagal"], ["expired", "Kedaluwarsa"]]} />
    </div>)}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </Panel>;
}

export function AdminOverview() {
  const partners = useApi("/api/admin/partners");
  const prices = useApi("/api/admin/prices");
  const photos = useApi("/api/admin/photos");
  const staff = useApi("/api/admin/staff");
  const complaints = useApi("/api/admin/complaints");
  const metrics = [
    ["Daycare mitra", list(partners.data).length], ["Harga menunggu", list(prices.data).length],
    ["Foto menunggu", list(photos.data).length], ["Pengasuh menunggu verifikasi", list(staff.data).length],
    ["Komplain", list(complaints.data?.items ?? complaints.data).length],
  ];
  return <>
    <PageHeader eyebrow="OVERVIEW PLATFORM" title="Pusat kendali Ayomi." description="Antrean verifikasi, moderasi, dan pembayaran yang perlu ditindaklanjuti." />
    <div className={p.metrics}>{metrics.map(([label, value]) => <Panel key={label}><strong>{value}</strong><p className={p.small}>{label}</p></Panel>)}</div>
    <div className={p.stack}><Payments /><Moderation /></div>
  </>;
}

// ----------------------------------------------------------------- daycares

const EMPTY_PARTNER = { name: "", description: "", address: "", province_code: "", city_code: "", district_code: "", postal_code: "", timezone: "Asia/Jakarta", contact_phone: "", facilities: "", opening_hours: "{\"senin-jumat\": \"07.00-17.00\"}", daily_capacity: 20, manager_email: "" };

function PartnerForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY_PARTNER);
  const [link, setLink] = useState("");
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    let hours;
    try { hours = JSON.parse(form.opening_hours); } catch { await run(() => Promise.reject(new Error("Jam operasional harus JSON, contoh {\"senin-jumat\": \"07.00-17.00\"}."))); return; }
    const { manager_email, ...daycare } = form;
    const body = { manager_email, daycare: { ...daycare, postal_code: daycare.postal_code || null, facilities: daycare.facilities.split(",").map(x => x.trim()).filter(Boolean), opening_hours: hours, daily_capacity: Number(daycare.daily_capacity) } };
    const result = await run(() => apiSend("/api/admin/partners", { body }), "Daycare mitra dibuat (nonaktif). Bagikan tautan undangan ke calon Pengelola.");
    if (result?.invitation_token) { setLink(invitationUrl(window.location.origin, result.invitation_token)); setForm(EMPTY_PARTNER); onCreated(); }
  }
  const field = (key, placeholder, props = {}) => <input className={p.select} placeholder={placeholder} aria-label={placeholder} value={form[key]} onChange={e => set(key, e.target.value)} {...props} />;
  return <form className={p.form} onSubmit={submit}>
    {field("name", "Nama daycare", { required: true, minLength: 2 })}
    <textarea className={p.select} rows={2} required minLength={20} placeholder="Deskripsi (minimal 20 karakter)" aria-label="Deskripsi" value={form.description} onChange={e => set("description", e.target.value)} />
    {field("address", "Alamat lengkap", { required: true, minLength: 5 })}
    <div className={p.row}>{field("province_code", "Kode provinsi (2 angka)", { required: true, pattern: "\\d{2}" })}{field("city_code", "Kode kota", { required: true })}{field("district_code", "Kode kecamatan", { required: true })}{field("postal_code", "Kode pos")}</div>
    <div className={p.row}>{field("contact_phone", "Nomor kontak", { required: true })}{field("daily_capacity", "Kapasitas harian", { type: "number", min: 1, required: true })}</div>
    {field("facilities", "Fasilitas, pisahkan dengan koma")}
    <textarea className={p.select} rows={2} aria-label="Jam operasional (JSON)" value={form.opening_hours} onChange={e => set("opening_hours", e.target.value)} />
    {field("manager_email", "Email calon Pengelola", { type: "email", required: true })}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    {link && <div className={p.notice} style={{ display: "block" }}><p className={p.small}>Tautan undangan Pengelola (sekali tampil, berlaku 7 hari):</p><code style={{ wordBreak: "break-all" }}>{link}</code>
      <button type="button" className={p.link} onClick={() => navigator.clipboard?.writeText(link)} style={{ marginLeft: 8 }}><Copy size={13} />Salin</button></div>}
    <button className={p.button} type="submit" disabled={action.busy}><Plus size={16} />Buat daycare mitra</button>
  </form>;
}

export function AdminDaycares() {
  const partners = useApi("/api/admin/partners");
  const [action, run] = useAction();
  const decide = id => (status, reason) => run(() => apiSend(`/api/admin/partners/${id}`, { method: "PATCH", body: { status, reason } }), "Status daycare diperbarui.").then(ok => ok && partners.reload());
  return <>
    <PageHeader eyebrow="MANAJEMEN DAYCARE" title="Daycare mitra Ayomi." description="Buat mitra baru, undang Pengelola, dan atur status aktif." />
    <div className={p.stack}>
      <Panel><h2 className={p.sectionTitle}>Tambah daycare mitra</h2><PartnerForm onCreated={partners.reload} /></Panel>
      {partners.loading ? <Loading /> : <ErrorNote error={partners.error || action.error} onRetry={partners.reload} />}<Notice text={action.notice} />
      {list(partners.data).map(d => <Panel key={d.id}>
        <div className={p.between}><div><strong>{d.name}</strong><p className={p.small}>Pengelola: {d.manager?.full_name ?? "belum ada"} · dibuat {dateText(d.created_at)}</p></div><div className={p.row}><Link className={p.link} style={{ display: "inline-flex", alignItems: "center", gap: 4 }} href={`/admin/daycare/${d.id}/safety-score`}><ShieldCheck size={14} />Safety Score</Link><span className={p.badge}>{d.status}</span></div></div>
        <Decide busy={action.busy} onDecide={decide(d.id)} options={[["active", "Aktifkan", true], ["inactive", "Nonaktifkan"], ["suspended", "Tangguhkan"]]} />
      </Panel>)}
    </div>
  </>;
}

// ------------------------------------------------------------- verification

export function AdminVerification() {
  const documents = useApi("/api/admin/daycare-documents");
  const prices = useApi("/api/admin/prices");
  const photos = useApi("/api/admin/photos");
  const staff = useApi("/api/admin/staff");
  const [action, run] = useAction();
  const patch = (path, reload, notice) => (decision, reason) => run(() => apiSend(path, { method: "PATCH", body: { decision, reason } }), notice).then(ok => ok && reload());
  async function view(id) {
    const result = await run(() => apiSend(`/api/daycare-documents/${id}/file`, { method: "GET" }));
    if (result?.url) window.open(result.url, "_blank", "noopener");
  }
  const pendingDocs = list(documents.data).filter(d => !["approved", "rejected"].includes(d.status));
  return <>
    <PageHeader eyebrow="VERIFIKASI" title="Dokumen, harga, foto, dan pengasuh." description="Setiap keputusan wajib disertai alasan dan tercatat di log audit." />
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <div className={p.stack}>
      <Panel><h2 className={p.sectionTitle}>Dokumen legal ({pendingDocs.length})</h2>
        {documents.loading ? <Loading /> : <ErrorNote error={documents.error} onRetry={documents.reload} />}
        {pendingDocs.map(d => <div key={d.id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
          <div className={p.between}><strong>{d.daycare?.name} · {documentTypeLabel(d.document_type)} v{d.version}</strong><button type="button" className={p.link} onClick={() => view(d.id)}>Lihat berkas</button></div>
          <p className={p.small}>{d.document_number ?? "—"} · {d.issuer ?? "—"} · berlaku sampai {dateText(d.expires_on)} · status {d.status}</p>
          <Decide busy={action.busy} onDecide={patch(`/api/admin/daycare-documents/${d.id}`, documents.reload, "Keputusan dokumen tersimpan.")} options={[["approved", "Setujui", true], ["revision_required", "Minta revisi"], ["rejected", "Tolak"]]} />
        </div>)}
        {!documents.loading && pendingDocs.length === 0 && <p className={p.muted}>Tidak ada antrean.</p>}
      </Panel>
      <Panel><h2 className={p.sectionTitle}>Harga layanan ({list(prices.data).length})</h2>
        {prices.loading ? <Loading /> : <ErrorNote error={prices.error} onRetry={prices.reload} />}
        {list(prices.data).map(pr => <div key={pr.id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
          <strong>{pr.daycare_name} · {pr.offering?.name} · {rupiah(pr.service_amount)}</strong><p className={p.small}>Versi {pr.version} · diajukan {dateTimeText(pr.created_at)}</p>
          <Decide busy={action.busy} onDecide={patch(`/api/admin/prices/${pr.id}`, prices.reload, "Keputusan harga tersimpan.")} options={[["approved", "Setujui", true], ["rejected", "Tolak"]]} />
        </div>)}
        {!prices.loading && list(prices.data).length === 0 && <p className={p.muted}>Tidak ada antrean.</p>}
      </Panel>
      <Panel><h2 className={p.sectionTitle}>Foto fasilitas ({list(photos.data).length})</h2>
        {photos.loading ? <Loading /> : <ErrorNote error={photos.error} onRetry={photos.reload} />}
        {list(photos.data).map(ph => <div key={ph.id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
          <strong>{ph.daycare?.name}</strong>{ph.url && <img src={ph.url} alt={ph.caption || "Foto fasilitas"} width={260} height={180} style={{ display: "block", objectFit: "cover", borderRadius: 10, marginTop: 8 }} />}
          <p className={p.small}>{ph.caption}</p>
          <Decide busy={action.busy} onDecide={patch(`/api/admin/photos/${ph.id}`, photos.reload, "Keputusan foto tersimpan.")} options={[["approved", "Tampilkan", true], ["rejected", "Tolak"]]} />
        </div>)}
        {!photos.loading && list(photos.data).length === 0 && <p className={p.muted}>Tidak ada antrean.</p>}
      </Panel>
      <Panel><h2 className={p.sectionTitle}>Pengasuh menunggu verifikasi ({list(staff.data).length})</h2>
        {staff.loading ? <Loading /> : <ErrorNote error={staff.error} onRetry={staff.reload} />}
        {list(staff.data).map(m => <div key={m.member_id} style={{ borderTop: "1px solid #eef2f5", paddingTop: 12, marginTop: 12 }}>
          <strong>{m.full_name ?? m.email}</strong><p className={p.small}>{m.email} · {m.daycare?.name} · diundang {dateText(m.invited_at)}</p>
          <Decide busy={action.busy} onDecide={patch(`/api/admin/staff/${m.member_id}`, staff.reload, "Keputusan verifikasi tersimpan.")} options={[["approved", "Verifikasi", true], ["rejected", "Tolak"]]} />
        </div>)}
        {!staff.loading && list(staff.data).length === 0 && <p className={p.muted}>Tidak ada antrean.</p>}
      </Panel>
    </div>
  </>;
}

// --------------------------------------------------------------- incidents

const COMPLAINT_ACTIONS = [["start", "Mulai tangani", true], ["request_info", "Minta informasi"], ["propose_resolution", "Usulkan penyelesaian"]];

function ComplaintItem({ complaint, onDone }) {
  const [text, setText] = useState("");
  const [action, run] = useAction();
  const act = (name, reason) => run(() => apiSend(`/api/admin/complaints/${complaint.id}`, { method: "PATCH", body: { action: name, reason, response_text: name === "start" ? null : text || reason } }), "Komplain diperbarui.").then(ok => ok && onDone());
  return <Panel>
    <div className={p.between}><strong>{complaint.subject}</strong><div className={p.row}><Badge map={URGENCY} value={complaint.priority} /><Badge map={COMPLAINT_STATUS} value={complaint.status} /></div></div>
    <p className={p.small}>{complaint.submitter_name} · {complaint.daycare_name ?? "—"} · {dateTimeText(complaint.created_at)}</p>
    <p style={{ marginTop: 6 }}>{complaint.description}</p>
    {!["resolved", "closed"].includes(complaint.status) && <>
      <textarea className={p.select} rows={2} placeholder="Isi pesan ke pelapor / usulan penyelesaian (opsional)" value={text} onChange={e => setText(e.target.value)} aria-label="Pesan" style={{ marginTop: 8 }} />
      <Decide busy={action.busy} onDecide={(name, reason) => act(name, reason)} options={COMPLAINT_ACTIONS} />
    </>}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </Panel>;
}

export function AdminIncidents() {
  const incidents = useApi("/api/incidents");
  const complaints = useApi("/api/admin/complaints");
  const [action, run] = useAction();
  const setStatus = id => (status, reason) => run(() => apiSend(`/api/incidents/${id}`, { method: "PATCH", body: { status, reason } }), "Status insiden diperbarui.").then(ok => ok && incidents.reload());
  const complaintItems = list(complaints.data?.items ?? complaints.data);
  return <>
    <PageHeader eyebrow="INSIDEN & KOMPLAIN" title="Eskalasi keselamatan dan layanan." description="Laporan darurat dan tinggi ditampilkan lebih dulu." />
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <h2 className={p.sectionTitle}>Insiden</h2>
    {incidents.loading ? <Loading /> : <ErrorNote error={incidents.error} onRetry={incidents.reload} />}
    <div className={p.stack}>
      {!incidents.loading && list(incidents.data).length === 0 && <Empty title="Belum ada insiden" />}
      {list(incidents.data).map(i => <Panel key={i.id}>
        <div className={p.between}><div><strong>{i.daycare?.name} · {i.child_name ?? "Anak"}</strong><p className={p.small}>{dateTimeText(i.occurred_at)}</p></div>
          <div className={p.row}><Badge map={URGENCY} value={i.urgency} /><Badge map={INCIDENT_STATUS} value={i.status} /></div></div>
        <p style={{ marginTop: 6 }}>{i.description}</p><p className={p.small}>Pertolongan pertama: {i.first_aid}</p>
        {i.status !== "resolved" && <Decide busy={action.busy} placeholder="Alasan perubahan status (minimal 10 karakter)" onDecide={setStatus(i.id)} options={[["in_progress", "Tangani"], ["resolved", "Selesai", true]]} />}
      </Panel>)}
    </div>
    <h2 className={p.sectionTitle} style={{ marginTop: 28 }}>Komplain</h2>
    {complaints.loading ? <Loading /> : <ErrorNote error={complaints.error} onRetry={complaints.reload} />}
    <div className={p.stack}>
      {!complaints.loading && complaintItems.length === 0 && <Empty title="Belum ada komplain" />}
      {complaintItems.map(cm => <ComplaintItem key={cm.id} complaint={cm} onDone={complaints.reload} />)}
    </div>
    <div className={c.section} />
  </>;
}
