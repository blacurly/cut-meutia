"use client";

// Parent pages backed by the API: dashboard, enrollment form and status
// (with QRIS payment), daily logbook, reports (incidents + complaints),
// notifications and reviews.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, CheckCheck, ClipboardList, Heart, MessageCircle, QrCode, ShieldAlert, Users } from "lucide-react";
import StarRating from "@/components/ui/StarRating";
import { useSession } from "@/components/session/SessionProvider";
import { apiSend, useApi } from "@/lib/client-api";
import { ENROLLMENT_CONSENT } from "@/lib/enrollment-consent";
import { EmptyState, LinkButton, PageHeader, Panel } from "@/components/features/ParentUI";
import {
  ACTIVITY_TYPES, Badge, COMPLAINT_STATUS, ENROLLMENT_STATUS, Empty, ErrorNote, INCIDENT_STATUS, Loading, RequireRole, URGENCY,
  dateText, dateTimeText, nowLocalInput, rupiah, todayJakarta,
} from "./ui";
import p from "@/components/features/Parent.module.css";

const ACTIVE = ["approved", "completed"];
const Page = ({ eyebrow, title, description, children }) => <div className={p.page}>
  <PageHeader eyebrow={eyebrow} title={title} description={description} />
  <RequireRole roles={["parent"]}>{children}</RequireRole>
</div>;

function useAction() {
  const [state, setState] = useState({ busy: false, error: null, notice: "" });
  async function run(fn, notice = "") {
    setState({ busy: true, error: null, notice: "" });
    try { const result = await fn(); setState({ busy: false, error: null, notice }); return result; }
    catch (error) { setState({ busy: false, error, notice: "" }); return null; }
  }
  return [state, run];
}
const Notice = ({ text }) => (text ? <p role="status" className={p.feedback}>{text}</p> : null);

// ------------------------------------------------------------- dashboard

function Home() {
  const session = useSession();
  const enrollments = useApi("/api/enrollments");
  const notifications = useApi("/api/notifications?limit=5");
  const list = Array.isArray(enrollments.data) ? enrollments.data : [];
  const active = list.filter(e => e.status === "approved");
  const pending = list.filter(e => ["pending", "pending_payment"].includes(e.status));
  return <>
    <PageHeader eyebrow={`DASHBOARD ORANG TUA · ${dateText(todayJakarta())}`} title={`Selamat datang, ${session.name}.`} description="Ringkasan pengasuhan, pengajuan, dan kabar terbaru anak Anda." />
    <div className={p.metrics}>
      {[[Users, active.length, "Pengasuhan aktif"], [ClipboardList, pending.length, "Pengajuan berjalan"], [Bell, notifications.data?.unread_count ?? 0, "Notifikasi belum dibaca"]]
        .map(([Icon, value, label]) => <Panel key={label}><Icon size={19} color="#2a9d8f" /><strong>{value}</strong><p className={p.small}>{label}</p></Panel>)}
    </div>
    <div className={p.twoColumns}>
      <Panel>
        <div className={p.between}><h2 className={p.sectionTitle}>Pengajuan & pengasuhan</h2><LinkButton secondary href="/status-pendaftaran">Lihat semua</LinkButton></div>
        {enrollments.loading ? <Loading /> : <ErrorNote error={enrollments.error} onRetry={enrollments.reload} />}
        {!enrollments.loading && !enrollments.error && (list.length === 0
          ? <EmptyState title="Belum ada pengajuan" description="Mulai dengan mencari daycare yang cocok." href="/pencarian" action="Cari daycare" />
          : <div className={p.stack} style={{ marginTop: 14 }}>{list.slice(0, 5).map(e => <div key={e.id} className={p.between}>
            <div><strong>{e.child?.full_name ?? "Anak"}</strong><p className={p.small}>{e.daycare?.name} · {dateText(e.service_date)}</p></div>
            <Badge map={ENROLLMENT_STATUS} value={e.status} />
          </div>)}</div>)}
      </Panel>
      <Panel>
        <h2 className={p.sectionTitle}>Akses cepat</h2>
        <div className={p.stack} style={{ gap: 10, marginTop: 14 }}>
          <LinkButton secondary href="/catatan-harian"><BookOpen size={16} />Logbook harian</LinkButton>
          <LinkButton secondary href="/laporan"><ShieldAlert size={16} />Pusat laporan</LinkButton>
          <LinkButton secondary href="/notifikasi"><Bell size={16} />Notifikasi</LinkButton>
          <LinkButton secondary href="/pencarian">Cari daycare</LinkButton>
        </div>
      </Panel>
    </div>
  </>;
}
export function ParentHome() {
  return <div className={p.page}><RequireRole roles={["parent"]}><Home /></RequireRole></div>;
}

// ------------------------------------------------------------ enrollment

function EnrollmentForm({ daycareKey }) {
  const router = useRouter();
  const daycare = useApi(daycareKey ? `/api/daycares/${encodeURIComponent(daycareKey)}` : null);
  const offerings = useApi(daycareKey ? `/api/daycares/${encodeURIComponent(daycareKey)}/offerings` : null);
  const children = useApi("/api/children");
  const [form, setForm] = useState({ child_id: "", offering_id: "", service_date: todayJakarta(1), consents: {} });
  const [action, run] = useAction();
  if (!daycareKey) return <EmptyState title="Pilih daycare dulu" description="Buka detail daycare mitra dari katalog, lalu tekan Daftarkan anak." href="/pencarian" action="Cari daycare" />;
  const offeringList = Array.isArray(offerings.data) ? offerings.data : [];
  const childList = Array.isArray(children.data) ? children.data.filter(c => c.status !== "archived") : [];
  const consentOk = Object.keys(ENROLLMENT_CONSENT.items).every(key => form.consents[key]);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    const created = await run(() => apiSend("/api/enrollments", { body: form }));
    if (created) router.push("/status-pendaftaran");
  }
  if (daycare.loading || offerings.loading || children.loading) return <Loading />;
  return <form className={p.stack} onSubmit={submit}>
    <ErrorNote error={daycare.error || offerings.error || children.error} />
    <Panel>
      <h2 className={p.sectionTitle}>{daycare.data?.name ?? "Daycare"}</h2>
      {offeringList.length === 0 && <p className={p.notice}>Daycare ini belum menerima pendaftaran online (belum ada layanan dengan harga yang disetujui).</p>}
      <div className={p.form} style={{ marginTop: 14 }}>
        <div className={p.field}><label htmlFor="child">Anak</label>
          <select id="child" className={p.select} required value={form.child_id} onChange={e => set("child_id", e.target.value)}>
            <option value="">Pilih anak</option>{childList.map(c => <option key={c.child_id} value={c.child_id}>{c.full_name} · lahir {dateText(c.birth_date)}</option>)}
          </select>
          {childList.length === 0 && <p className={p.small}>Belum ada data anak. <Link className={p.link} href="/profil#anak">Tambahkan anak</Link> terlebih dahulu.</p>}
        </div>
        <div className={p.field}><label htmlFor="offering">Layanan</label>
          <select id="offering" className={p.select} required value={form.offering_id} onChange={e => set("offering_id", e.target.value)}>
            <option value="">Pilih layanan</option>
            {offeringList.map(o => <option key={o.id} value={o.id}>{o.name} · {rupiah(o.price?.amount)} · usia {o.min_age_months}–{o.max_age_months} bln</option>)}
          </select>
        </div>
        <div className={p.field}><label htmlFor="date">Tanggal mulai</label>
          <input id="date" type="date" className={p.select} required min={todayJakarta(1)} value={form.service_date} onChange={e => set("service_date", e.target.value)} />
        </div>
        <fieldset className={p.stack} style={{ gap: 8 }}><legend className={p.fieldLabel}>Persetujuan ({ENROLLMENT_CONSENT.version})</legend>
          {Object.entries(ENROLLMENT_CONSENT.items).map(([key, text]) => <label key={key} className={p.check}>
            <input type="checkbox" checked={Boolean(form.consents[key])} onChange={e => set("consents", { ...form.consents, [key]: e.target.checked })} />{text}
          </label>)}
        </fieldset>
        <ErrorNote error={action.error} />
        <button className={`${p.button} ${p.mint}`} type="submit" disabled={action.busy || !consentOk || !form.child_id || !form.offering_id}>{action.busy ? "Mengirim…" : "Kirim pengajuan"}</button>
        <p className={p.small}>Pengajuan diputuskan oleh Pengelola daycare. Setelah diterima, Anda membayar tagihan sebelum batas waktu.</p>
      </div>
    </Panel>
  </form>;
}
export function EnrollmentNew({ daycareKey }) {
  return <Page eyebrow="PENDAFTARAN ANAK" title="Daftarkan anak ke daycare." description="Pilih anak, layanan, dan tanggal mulai."><EnrollmentForm daycareKey={daycareKey} /></Page>;
}

function PaymentBox({ enrollment, onDone }) {
  const [method, setMethod] = useState("qris");
  const [payment, setPayment] = useState(null);
  const [action, run] = useAction();
  async function pay() {
    const result = await run(() => apiSend(`/api/enrollments/${enrollment.id}/payments`, { body: { method } }));
    if (result) { setPayment(result); onDone?.(); }
  }
  return <div className={p.notice} style={{ display: "block", marginTop: 14 }}>
    <strong>Tagihan {rupiah(enrollment.charge?.total_amount)}</strong>
    <p className={p.small}>Bayar sebelum {dateTimeText(enrollment.charge?.due_at ?? enrollment.payment_deadline)}. Pembayaran dikonfirmasi oleh Admin Ayomi.</p>
    {!payment && <div className={p.row} style={{ marginTop: 10 }}>
      <select className={p.select} value={method} onChange={e => setMethod(e.target.value)} aria-label="Metode pembayaran" style={{ maxWidth: 200 }}>
        <option value="qris">QRIS</option><option value="va">Virtual account</option><option value="ewallet">E-wallet</option>
      </select>
      <button className={p.button} type="button" onClick={pay} disabled={action.busy}><QrCode size={16} />{action.busy ? "Membuat…" : "Buat pembayaran"}</button>
    </div>}
    <ErrorNote error={action.error} />
    {payment && <div style={{ marginTop: 12 }}>
      {payment.qr
        ? <>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the API */}
          <img src={payment.qr.image_data_url} alt="QR pembayaran" width={220} height={220} style={{ background: "#fff", borderRadius: 12 }} />
          <p className={p.small}>{payment.qr.mode === "qris_dynamic" ? "Pindai dengan aplikasi bank atau e-wallet. Nominal sudah terisi." : "QR uji coba: QRIS merchant belum diatur, jadi QR ini tidak dapat dibayar."}</p>
        </>
        : <p className={p.small}>Transaksi {payment.method.toUpperCase()} dibuat. Instruksi pembayaran akan dikirim oleh Admin.</p>}
      <p className={p.small}>Kode transaksi: {payment.transaction_id} · berlaku sampai {dateTimeText(payment.expires_at)}</p>
    </div>}
  </div>;
}

function EnrollmentCards() {
  const enrollments = useApi("/api/enrollments");
  const [action, run] = useAction();
  if (enrollments.loading) return <Loading />;
  if (enrollments.error) return <ErrorNote error={enrollments.error} onRetry={enrollments.reload} />;
  const list = Array.isArray(enrollments.data) ? enrollments.data : [];
  if (list.length === 0) return <EmptyState title="Belum ada pengajuan" description="Cari daycare mitra lalu daftarkan anak Anda." href="/pencarian" action="Cari daycare" />;
  async function cancel(id) {
    if (!window.confirm("Batalkan pengajuan ini?")) return;
    if (await run(() => apiSend(`/api/enrollments/${id}`, { method: "DELETE" }), "Pengajuan dibatalkan.")) enrollments.reload();
  }
  return <div className={p.stack}>
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    {list.map(e => <Panel key={e.id}>
      <div className={p.between}>
        <div><h2 className={p.sectionTitle}>{e.child?.full_name ?? "Anak"} · {e.daycare?.name}</h2>
          <p className={p.small}>Ref. {e.reference} · {e.offering?.name} · mulai {dateText(e.service_date)}</p></div>
        <Badge map={ENROLLMENT_STATUS} value={e.status} />
      </div>
      {e.decision_reason && <p className={p.small} style={{ marginTop: 8 }}>Catatan Pengelola: {e.decision_reason}</p>}
      {e.status === "pending_payment" && <PaymentBox enrollment={e} />}
      <div className={p.row} style={{ marginTop: 12 }}>
        {e.status === "pending" && <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={() => cancel(e.id)}>Batalkan pengajuan</button>}
        {ACTIVE.includes(e.status) && <LinkButton secondary href={`/catatan-harian?enrollment=${e.id}`}>Logbook harian</LinkButton>}
        {e.status === "completed" && <LinkButton secondary href={`/ulasan?enrollment=${e.id}`}>Tulis ulasan</LinkButton>}
      </div>
    </Panel>)}
  </div>;
}
export function EnrollmentList() {
  return <Page eyebrow="STATUS PENDAFTARAN" title="Pantau setiap pengajuan." description="Keputusan Pengelola, pembayaran, dan status pengasuhan."><EnrollmentCards /></Page>;
}

// --------------------------------------------------------------- logbook

function EnrollmentPicker({ enrollments, value, onChange, filter = e => ACTIVE.includes(e.status) }) {
  const list = (Array.isArray(enrollments) ? enrollments : []).filter(filter);
  return <select className={p.select} value={value} onChange={e => onChange(e.target.value)} aria-label="Pilih pengasuhan" style={{ maxWidth: 420 }}>
    <option value="">Pilih anak & daycare</option>
    {list.map(e => <option key={e.id} value={e.id}>{e.child?.full_name ?? "Anak"} · {e.daycare?.name} · {dateText(e.service_date)}</option>)}
  </select>;
}

function Comments({ activityId }) {
  const comments = useApi(`/api/activities/${activityId}/comments`);
  const [text, setText] = useState("");
  const [action, run] = useAction();
  async function add(event) {
    event.preventDefault();
    if (await run(() => apiSend(`/api/activities/${activityId}/comments`, { body: { body: text } }))) { setText(""); comments.reload(); }
  }
  async function remove(id) {
    if (await run(() => apiSend(`/api/activities/${activityId}/comments/${id}`, { method: "DELETE" }))) comments.reload();
  }
  const list = Array.isArray(comments.data) ? comments.data : [];
  return <div className={p.stack} style={{ gap: 8, marginTop: 10 }}>
    {comments.loading ? <Loading /> : list.map(c => <div key={c.id} className={p.comment}>
      <strong>{c.author_name}</strong> <span className={p.small}>{dateTimeText(c.created_at)}</span><p>{c.body}</p>
      {c.is_mine && <button type="button" className={p.link} onClick={() => remove(c.id)}>Hapus</button>}
    </div>)}
    <form className={p.row} onSubmit={add}>
      <input className={p.select} value={text} maxLength={1000} onChange={e => setText(e.target.value)} placeholder="Tulis komentar" aria-label="Komentar" style={{ flex: 1 }} />
      <button className={p.button} type="submit" disabled={!text.trim() || action.busy}>Kirim</button>
    </form>
    <ErrorNote error={action.error} />
  </div>;
}

function Photos({ activityId }) {
  const photos = useApi(`/api/activities/${activityId}/photos`);
  const urls = (Array.isArray(photos.data) ? photos.data : []).flatMap(photo => (photo.variants ?? []).filter(v => v.url).map(v => v.url));
  if (!urls.length) return null;
  return <div className={p.row} style={{ marginTop: 10 }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
    {urls.map(url => <img key={url} src={url} alt="Foto kegiatan anak" width={180} height={135} style={{ objectFit: "cover", borderRadius: 10 }} />)}
  </div>;
}

function ActivityCard({ activity, onChange }) {
  const [open, setOpen] = useState(false);
  const [action, run] = useAction();
  async function love() {
    if (await run(() => apiSend(`/api/activities/${activity.id}/love`, { method: activity.loved_by_me ? "DELETE" : "PUT" }))) onChange();
  }
  async function read() {
    if (await run(() => apiSend(`/api/activities/${activity.id}/acknowledgements`, { body: { type: "parent_read" } }))) onChange();
  }
  return <Panel>
    <div className={p.between}>
      <div><span className={p.badge}>{ACTIVITY_TYPES[activity.activity_type] ?? activity.activity_type}</span>
        {activity.is_urgent && <span className={`${p.badge} ${p.red}`} style={{ marginLeft: 6 }}>Penting</span>}
        <h3 className={p.sectionTitle} style={{ marginTop: 8 }}>{activity.title}</h3></div>
      <span className={p.small}>{dateTimeText(activity.occurred_at)}</span>
    </div>
    <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{activity.body}</p>
    {activity.urgent_reason && <p className={p.small}>Alasan penting: {activity.urgent_reason}</p>}
    <p className={p.small}>Ditulis {activity.caregiver_name}</p>
    <Photos activityId={activity.id} />
    <div className={p.row} style={{ marginTop: 10 }}>
      <button type="button" className={`${p.button} ${p.secondary}`} onClick={love} disabled={action.busy} aria-pressed={Boolean(activity.loved_by_me)}>
        <Heart size={15} fill={activity.loved_by_me ? "#e76f51" : "none"} />{activity.love_count ?? 0}
      </button>
      <button type="button" className={`${p.button} ${p.secondary}`} onClick={() => setOpen(v => !v)} aria-expanded={open}><MessageCircle size={15} />{activity.comment_count ?? 0} komentar</button>
      {!activity.parent_read_at
        ? <button type="button" className={`${p.button} ${p.secondary}`} onClick={read} disabled={action.busy}><CheckCheck size={15} />Tandai sudah dibaca</button>
        : <span className={p.small}>Dibaca {dateTimeText(activity.parent_read_at)}</span>}
    </div>
    <ErrorNote error={action.error} />
    {open && <Comments activityId={activity.id} />}
  </Panel>;
}

function LogbookView({ initial }) {
  const enrollments = useApi("/api/enrollments");
  const [chosen, setChosen] = useState(initial || "");
  const firstActive = (Array.isArray(enrollments.data) ? enrollments.data : []).find(e => ACTIVE.includes(e.status))?.id ?? "";
  const enrollmentId = chosen || firstActive;
  const activities = useApi(enrollmentId ? `/api/enrollments/${enrollmentId}/activities` : null);
  if (enrollments.loading) return <Loading />;
  if (enrollments.error) return <ErrorNote error={enrollments.error} onRetry={enrollments.reload} />;
  if (!firstActive) return <EmptyState title="Belum ada pengasuhan aktif" description="Logbook muncul setelah pengajuan disetujui dan dibayar." href="/status-pendaftaran" action="Lihat pengajuan" />;
  const list = (Array.isArray(activities.data) ? activities.data : []).filter(a => a.status === "sent");
  return <div className={p.stack}>
    <EnrollmentPicker enrollments={enrollments.data} value={enrollmentId} onChange={setChosen} />
    {activities.loading ? <Loading /> : <ErrorNote error={activities.error} onRetry={activities.reload} />}
    {!activities.loading && !activities.error && (list.length === 0
      ? <Empty title="Belum ada catatan">Catatan dari pengasuh akan muncul di sini.</Empty>
      : list.map(a => <ActivityCard key={a.id} activity={a} onChange={activities.reload} />))}
  </div>;
}
export function ParentLogbookPage({ enrollmentId }) {
  return <Page eyebrow="LOGBOOK HARIAN" title="Cerita kecil hari ini." description="Catatan kegiatan, foto, dan komentar dari pengasuh."><LogbookView initial={enrollmentId} /></Page>;
}

// --------------------------------------------------------------- reports

const URGENCY_OPTIONS = [["low", "Rendah"], ["medium", "Sedang"], ["high", "Tinggi"], ["emergency", "Darurat"]];
const CATEGORY_OPTIONS = [["daycare_service", "Layanan daycare"], ["caregiver_conduct", "Perilaku pengasuh"], ["child_safety", "Keselamatan anak"], ["payment", "Pembayaran"], ["account_access", "Akses akun"], ["other", "Lainnya"]];

function IncidentForm({ enrollments, onCreated }) {
  const [form, setForm] = useState({ enrollment_id: "", occurred_at: nowLocalInput(), description: "", first_aid: "", urgency: "medium", urgency_reason: "" });
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    const body = { ...form, occurred_at: new Date(form.occurred_at).toISOString() };
    if (await run(() => apiSend("/api/incidents", { body }), "Laporan terkirim ke Pengelola.")) {
      setForm(f => ({ ...f, description: "", first_aid: "", urgency_reason: "" })); onCreated();
    }
  }
  return <form className={p.form} onSubmit={submit}>
    <EnrollmentPicker enrollments={enrollments} value={form.enrollment_id} onChange={v => set("enrollment_id", v)} />
    <input type="datetime-local" className={p.select} value={form.occurred_at} max={nowLocalInput()} onChange={e => set("occurred_at", e.target.value)} aria-label="Waktu kejadian" required />
    <textarea className={p.select} rows={4} minLength={20} required placeholder="Ceritakan kejadiannya (minimal 20 karakter)" value={form.description} onChange={e => set("description", e.target.value)} aria-label="Deskripsi" />
    <input className={p.select} required minLength={2} placeholder="Pertolongan pertama yang sudah dilakukan" value={form.first_aid} onChange={e => set("first_aid", e.target.value)} aria-label="Pertolongan pertama" />
    <div className={p.row}>
      <select className={p.select} value={form.urgency} onChange={e => set("urgency", e.target.value)} aria-label="Urgensi" style={{ maxWidth: 180 }}>{URGENCY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input className={p.select} required minLength={5} placeholder="Alasan tingkat urgensi" value={form.urgency_reason} onChange={e => set("urgency_reason", e.target.value)} aria-label="Alasan urgensi" style={{ flex: 1 }} />
    </div>
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <button className={p.button} type="submit" disabled={action.busy || !form.enrollment_id}>{action.busy ? "Mengirim…" : "Kirim laporan insiden"}</button>
  </form>;
}

function ComplaintForm({ enrollments, onCreated }) {
  const [form, setForm] = useState({ category: "daycare_service", priority: "medium", subject: "", description: "", enrollment_id: "" });
  const [action, run] = useAction();
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    const body = { ...form, enrollment_id: form.enrollment_id || null };
    if (await run(() => apiSend("/api/complaints", { body }), "Komplain terkirim ke Admin Ayomi.")) {
      setForm(f => ({ ...f, subject: "", description: "" })); onCreated();
    }
  }
  return <form className={p.form} onSubmit={submit}>
    <div className={p.row}>
      <select className={p.select} value={form.category} onChange={e => set("category", e.target.value)} aria-label="Kategori">{CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select className={p.select} value={form.priority} onChange={e => set("priority", e.target.value)} aria-label="Prioritas">{URGENCY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
    <EnrollmentPicker enrollments={enrollments} value={form.enrollment_id} onChange={v => set("enrollment_id", v)} filter={() => true} />
    <input className={p.select} required minLength={5} maxLength={160} placeholder="Subjek" value={form.subject} onChange={e => set("subject", e.target.value)} aria-label="Subjek" />
    <textarea className={p.select} rows={4} required minLength={20} placeholder="Jelaskan masalahnya (minimal 20 karakter)" value={form.description} onChange={e => set("description", e.target.value)} aria-label="Deskripsi" />
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <button className={p.button} type="submit" disabled={action.busy}>{action.busy ? "Mengirim…" : "Kirim komplain"}</button>
  </form>;
}

function ComplaintActions({ complaint, onDone }) {
  const [reason, setReason] = useState("");
  const [action, run] = useAction();
  const act = name => run(() => apiSend(`/api/complaints/${complaint.id}`, { method: "PATCH", body: { action: name, reason, response_text: name === "respond" ? reason : null } }), "Tersimpan.").then(ok => ok && onDone());
  if (!["waiting_for_response", "waiting_for_confirmation"].includes(complaint.status)) return null;
  return <div className={p.stack} style={{ gap: 8, marginTop: 10 }}>
    <textarea className={p.select} rows={2} placeholder={complaint.status === "waiting_for_response" ? "Jawaban Anda" : "Alasan (minimal 5 karakter)"} value={reason} onChange={e => setReason(e.target.value)} aria-label="Respons" />
    <div className={p.row}>
      {complaint.status === "waiting_for_response" && <button type="button" className={p.button} disabled={action.busy || reason.trim().length < 5} onClick={() => act("respond")}>Kirim jawaban</button>}
      {complaint.status === "waiting_for_confirmation" && <>
        <button type="button" className={p.button} disabled={action.busy || reason.trim().length < 5} onClick={() => act("accept_resolution")}>Terima penyelesaian</button>
        <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy || reason.trim().length < 5} onClick={() => act("reject_resolution")}>Tolak</button>
      </>}
    </div>
    <ErrorNote error={action.error} />
  </div>;
}

function Reports() {
  const enrollments = useApi("/api/enrollments");
  const incidents = useApi("/api/incidents");
  const complaints = useApi("/api/complaints");
  const [action, run] = useAction();
  async function acknowledge(id) {
    if (await run(() => apiSend(`/api/incidents/${id}/acknowledgement`, { method: "POST" }))) incidents.reload();
  }
  const incidentList = Array.isArray(incidents.data) ? incidents.data : [];
  const complaintList = Array.isArray(complaints.data) ? complaints.data : [];
  return <div className={p.stack}>
    <div className={p.twoColumns}>
      <Panel><h2 className={p.sectionTitle}>Laporkan insiden</h2><p className={p.small}>Untuk kejadian pada anak selama pengasuhan. Pengelola daycare langsung diberi tahu.</p><IncidentForm enrollments={enrollments.data} onCreated={incidents.reload} /></Panel>
      <Panel><h2 className={p.sectionTitle}>Ajukan komplain</h2><p className={p.small}>Untuk masalah layanan, pembayaran, atau akun. Ditangani Admin Ayomi.</p><ComplaintForm enrollments={enrollments.data} onCreated={complaints.reload} /></Panel>
    </div>
    <h2 className={p.sectionTitle}>Laporan insiden</h2>
    {incidents.loading ? <Loading /> : <ErrorNote error={incidents.error || action.error} onRetry={incidents.reload} />}
    {!incidents.loading && incidentList.length === 0 && <Empty title="Belum ada laporan insiden" />}
    {incidentList.map(i => <Panel key={i.id}>
      <div className={p.between}><div><strong>{i.child_name ?? "Anak"} · {i.daycare?.name}</strong><p className={p.small}>{dateTimeText(i.occurred_at)}</p></div>
        <div className={p.row}><Badge map={URGENCY} value={i.urgency} /><Badge map={INCIDENT_STATUS} value={i.status} /></div></div>
      <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{i.description}</p>
      <p className={p.small}>Pertolongan pertama: {i.first_aid}</p>
      {!i.parent_acknowledged_at
        ? <button type="button" className={`${p.button} ${p.secondary}`} style={{ marginTop: 10 }} onClick={() => acknowledge(i.id)} disabled={action.busy}>Saya sudah membaca laporan ini</button>
        : <p className={p.small}>Dikonfirmasi dibaca {dateTimeText(i.parent_acknowledged_at)}</p>}
    </Panel>)}
    <h2 className={p.sectionTitle}>Komplain saya</h2>
    {complaints.loading ? <Loading /> : <ErrorNote error={complaints.error} onRetry={complaints.reload} />}
    {!complaints.loading && complaintList.length === 0 && <Empty title="Belum ada komplain" />}
    {complaintList.map(c => <Panel key={c.id}>
      <div className={p.between}><strong>{c.subject}</strong><div className={p.row}><Badge map={URGENCY} value={c.priority} /><Badge map={COMPLAINT_STATUS} value={c.status} /></div></div>
      <p style={{ marginTop: 8 }}>{c.description}</p>
      {c.resolution_text && <p className={p.notice} style={{ marginTop: 8 }}>Usulan penyelesaian: {c.resolution_text}</p>}
      <ComplaintActions complaint={c} onDone={complaints.reload} />
    </Panel>)}
  </div>;
}
export function ParentReportsPage() {
  return <Page eyebrow="PUSAT LAPORAN" title="Laporan insiden dan komplain." description="Laporkan kejadian dan pantau penanganannya."><Reports /></Page>;
}

// ---------------------------------------------------------- notifications

function NotificationList() {
  const notifications = useApi("/api/notifications?limit=50");
  const [action, run] = useAction();
  const items = notifications.data?.items ?? [];
  async function mark(ids) {
    if (await run(() => Promise.all(ids.map(id => apiSend(`/api/notifications/${id}`, { method: "PATCH", body: { read: true } }))))) notifications.reload();
  }
  if (notifications.loading) return <Loading />;
  if (notifications.error) return <ErrorNote error={notifications.error} onRetry={notifications.reload} />;
  const unread = items.filter(n => !n.read_at);
  return <div className={p.stack}>
    <div className={p.between}><span className={p.small}>{unread.length} belum dibaca</span>
      <button type="button" className={`${p.button} ${p.secondary}`} disabled={!unread.length || action.busy} onClick={() => mark(unread.map(n => n.id))}><CheckCheck size={15} />Tandai semua dibaca</button></div>
    <ErrorNote error={action.error} />
    {items.length === 0 ? <Empty title="Belum ada notifikasi" /> : <div className={p.card}>
      {items.map(n => <article key={n.id} className={`${p.notification} ${n.read_at ? "" : p.unread}`}>
        <Bell size={18} color={n.priority === "urgent" || n.priority === "high" ? "#e76f51" : "#2a9d8f"} style={{ flexShrink: 0, marginTop: 4 }} />
        <div style={{ flex: 1 }}><strong>{n.title}</strong><p className={p.small}>{n.body}</p><p className={p.small}>{dateTimeText(n.created_at)}</p></div>
        {!n.read_at && <button type="button" className={p.link} onClick={() => mark([n.id])}>Tandai dibaca</button>}
      </article>)}
    </div>}
  </div>;
}
export function NotificationsPage() {
  return <Page eyebrow="KABAR UNTUK ANDA" title="Notifikasi" description="Pembaruan pengajuan, pembayaran, logbook, dan laporan."><NotificationList /></Page>;
}

// ---------------------------------------------------------------- reviews

function ReviewForm({ initial }) {
  const enrollments = useApi("/api/enrollments");
  const [form, setForm] = useState({ enrollment_id: initial || "", rating: 0, body: "" });
  const [action, run] = useAction();
  if (enrollments.loading) return <Loading />;
  const completed = (Array.isArray(enrollments.data) ? enrollments.data : []).filter(e => e.status === "completed");
  if (!completed.length) return <EmptyState title="Belum ada pengasuhan yang selesai" description="Ulasan dapat ditulis setelah pengasuhan selesai." href="/status-pendaftaran" action="Lihat pengajuan" />;
  async function submit(event) {
    event.preventDefault();
    if (await run(() => apiSend("/api/reviews", { body: form }), "Ulasan terkirim dan menunggu moderasi Admin.")) setForm(f => ({ ...f, rating: 0, body: "" }));
  }
  return <Panel><form className={p.form} onSubmit={submit}>
    <EnrollmentPicker enrollments={completed} value={form.enrollment_id} onChange={v => setForm(f => ({ ...f, enrollment_id: v }))} filter={() => true} />
    <fieldset><legend className={p.fieldLabel}>Penilaian</legend><StarRating rating={form.rating} onChange={rating => setForm(f => ({ ...f, rating }))} /></fieldset>
    <textarea className={p.select} rows={5} minLength={20} maxLength={2000} required placeholder="Ceritakan pengalaman Anda (minimal 20 karakter)" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} aria-label="Ulasan" />
    <ErrorNote error={action.error} /><Notice text={action.notice} />
    <button className={p.button} type="submit" disabled={action.busy || !form.enrollment_id || !form.rating}>{action.busy ? "Mengirim…" : "Kirim ulasan"}</button>
  </form></Panel>;
}
export function ReviewsPage({ enrollmentId }) {
  return <Page eyebrow="ULASAN ORANG TUA" title="Pengalaman Anda membantu keluarga lain." description="Ulasan tampil di katalog setelah lolos moderasi Admin."><ReviewForm initial={enrollmentId} /></Page>;
}

