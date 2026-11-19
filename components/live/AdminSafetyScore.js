"use client";

// Admin review of one daycare's Safety Score: pick a status, a reason and the
// approved documents for each component; the database checks the evidence and
// stores the score (migration 20261118100000).
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { apiSend, useApi } from "@/lib/client-api";
import { DAYCARE_DOCUMENT_TYPES, documentTypeLabel } from "@/lib/document-types";
import { SAFETY_CRITERIA, SAFETY_STATUSES, safetyStatusLabel, scoreFromCriteria } from "@/lib/safety-score";
import { PageHeader, Panel } from "@/components/features/ParentUI";
import { ErrorNote, Loading, dateText, dateTimeText } from "./ui";
import p from "@/components/features/Parent.module.css";

const SCORE_STATUS = { published: ["Dipublikasikan", ""], pending_review: ["Draf", p.amber], superseded: ["Diganti / ditarik", p.neutral], rejected: ["Ditolak", p.red] };
const STATUS_TONE = { pass: "", partial: p.amber, fail: p.red, unknown: p.neutral };
const ICON_LINK = { display: "inline-flex", alignItems: "center", gap: 4 };
const DAYCARE_STATUS = { active: "aktif", inactive: "nonaktif", suspended: "ditangguhkan" };
const list = data => (Array.isArray(data) ? data : []);
const scoreText = value => Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });

// Evidence a status may use: pass/partial need approved, unexpired documents;
// a fail may cite an expired one (e.g. the expired licence itself).
const usable = (doc, status) => doc.status === "approved" && !(doc.expired && ["pass", "partial"].includes(status));

function initialForm(documents, latest) {
  const previous = Object.fromEntries(list(latest?.explanation?.criteria).map(item => [item.id, item]));
  return Object.fromEntries(SAFETY_CRITERIA.map(({ id }) => {
    const status = previous[id]?.status ?? "unknown";
    const docs = documents.filter(doc => doc.criterion === id && usable(doc, status));
    return [id, { status, reason: previous[id]?.reason ?? "", documentIds: docs.map(doc => doc.id) }];
  }));
}

function useAction() {
  const [state, setState] = useState({ busy: false, error: null, notice: "" });
  async function run(fn, notice) {
    setState({ busy: true, error: null, notice: "" });
    try { const result = await fn(); setState({ busy: false, error: null, notice }); return result ?? true; }
    catch (error) { setState({ busy: false, error, notice: "" }); return null; }
  }
  return [state, run];
}

function Criterion({ criterion, value, documents, onChange, onView }) {
  const docs = documents.filter(doc => doc.criterion === criterion.id);
  const types = DAYCARE_DOCUMENT_TYPES.filter(type => type.criterion === criterion.id).map(type => type.label).join(" atau ");
  const setStatus = status => onChange({
    ...value, status,
    documentIds: value.documentIds.filter(id => usable(docs.find(doc => doc.id === id), status)),
  });
  const toggle = id => onChange({ ...value, documentIds: value.documentIds.includes(id) ? value.documentIds.filter(item => item !== id) : [...value.documentIds, id] });
  const needsEvidence = ["pass", "partial"].includes(value.status) && value.documentIds.length === 0;
  return <Panel>
    <div className={p.between}>
      <h2 className={p.sectionTitle}>{criterion.label} <span className={p.small}>· bobot {criterion.weight}</span></h2>
      <span className={`${p.badge} ${STATUS_TONE[value.status]}`}>{safetyStatusLabel(value.status)}</span>
    </div>
    <p className={p.small}>Lulus jika: {criterion.rule}</p>

    <fieldset style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
      <legend className={p.small} style={{ fontWeight: 600 }}>Dokumen bukti</legend>
      {docs.length === 0 && <p className={p.muted}>Belum ada dokumen. Minta Pengelola mengunggah {types}.</p>}
      {docs.map(doc => {
        const allowed = usable(doc, value.status);
        return <div key={doc.id} className={p.between} style={{ borderTop: "1px solid #eef2f5", paddingTop: 8, marginTop: 8 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: allowed ? "pointer" : "not-allowed", opacity: allowed ? 1 : 0.65 }}>
            <input type="checkbox" checked={value.documentIds.includes(doc.id)} disabled={!allowed} onChange={() => toggle(doc.id)} style={{ marginTop: 3 }} />
            <span>
              <strong style={{ fontSize: 13 }}>{documentTypeLabel(doc.document_type)} v{doc.version}</strong>
              {doc.status === "pending" && <span className={`${p.badge} ${p.amber}`} style={{ marginLeft: 6 }}>Belum diverifikasi</span>}
              {doc.expired && <span className={`${p.badge} ${p.red}`} style={{ marginLeft: 6 }}>Kedaluwarsa</span>}
              <span className={p.small} style={{ display: "block" }}>{doc.document_number ?? "Tanpa nomor"} · {doc.issuer ?? "penerbit tidak diisi"} · berlaku sampai {doc.expires_on ? dateText(doc.expires_on) : "tidak dibatasi"}</span>
            </span>
          </label>
          <button type="button" className={p.link} style={ICON_LINK} onClick={() => onView(doc.id)}><FileText size={13} />Lihat berkas</button>
        </div>;
      })}
    </fieldset>

    <div className={p.row} style={{ marginTop: 14 }} role="radiogroup" aria-label={`Status ${criterion.label}`}>
      {SAFETY_STATUSES.map(status => <button key={status.value} type="button" role="radio" aria-checked={value.status === status.value}
        className={`${p.button} ${value.status === status.value ? "" : p.secondary}`} onClick={() => setStatus(status.value)}>{status.label}</button>)}
    </div>
    {needsEvidence && <p className={p.error} style={{ marginTop: 10 }}>Pilih minimal satu dokumen bukti untuk status {safetyStatusLabel(value.status)}.</p>}
    <textarea className={p.select} style={{ marginTop: 12, minHeight: 72, width: "100%" }} maxLength={500} value={value.reason}
      onChange={event => onChange({ ...value, reason: event.target.value })} aria-label={`Alasan ${criterion.label}`}
      placeholder="Alasan singkat, mis. &quot;Izin berlaku sampai 9 Maret 2028; nama dan alamat cocok.&quot; Tampil di halaman publik: jangan tulis nama staf atau data pribadi." />
  </Panel>;
}

function ReviewForm({ daycareId, data, onSaved }) {
  const documents = list(data.documents);
  const latest = list(data.scores).find(score => ["published", "pending_review"].includes(score.status));
  const [form, setForm] = useState(() => initialForm(documents, latest));
  const [action, run] = useAction();
  const criteria = SAFETY_CRITERIA.map(({ id }) => ({ id, status: form[id].status }));
  const preview = scoreFromCriteria(criteria);
  const missing = SAFETY_CRITERIA.filter(({ id }) => form[id].reason.trim().length < 5
    || (["pass", "partial"].includes(form[id].status) && form[id].documentIds.length === 0));
  const legalPassed = form.legal.status === "pass";
  const ready = preview.score != null && missing.length === 0;

  async function view(id) {
    const result = await run(() => apiSend(`/api/daycare-documents/${id}/file`, { method: "GET" }), "");
    if (result?.url) window.open(result.url, "_blank", "noopener");
  }
  async function save(publish) {
    const body = { publish, criteria: SAFETY_CRITERIA.map(({ id }) => ({ id, status: form[id].status, reason: form[id].reason.trim(), document_ids: form[id].documentIds })) };
    const saved = await run(() => apiSend(`/api/admin/daycares/${encodeURIComponent(daycareId)}/safety-score`, { body }),
      publish ? "Safety Score dipublikasikan." : "Draf Safety Score tersimpan.");
    if (saved) onSaved();
  }

  return <div className={p.twoColumns}>
    <div className={p.stack}>
      {SAFETY_CRITERIA.map(criterion => <Criterion key={criterion.id} criterion={criterion} value={form[criterion.id]} documents={documents}
        onChange={value => setForm(current => ({ ...current, [criterion.id]: value }))} onView={view} />)}
    </div>
    <Panel className={p.sideCard}>
      <p className={p.eyebrow}>PRATINJAU SKOR</p>
      {preview.score == null
        ? <p className={p.muted}>Belum bisa dihitung. Nilai keempat komponen dulu (tidak boleh &quot;Belum diketahui&quot;).</p>
        : <><strong className={p.price} style={{ fontSize: 34 }}>{scoreText(preview.score)}</strong><span className={p.small}> / 100</span></>}
      <ul className={`${p.detailList} ${p.small}`} style={{ marginTop: 12 }}>
        {SAFETY_CRITERIA.map(({ id, label, weight }) => <li key={id}>{label}: {safetyStatusLabel(form[id].status)} ({weight})</li>)}
      </ul>
      {!legalPassed && preview.score != null && <p className={p.notice} style={{ marginTop: 12 }}>Legalitas belum lulus, jadi skor hanya bisa disimpan sebagai draf dan tidak tampil di halaman publik.</p>}
      {missing.length > 0 && <p className={p.small} style={{ marginTop: 12 }}>Lengkapi alasan (min. 5 karakter) dan bukti untuk: {missing.map(item => item.label).join(", ")}.</p>}
      <ErrorNote error={action.error} />
      {action.notice && <p role="status" className={p.feedback}>{action.notice}</p>}
      <div className={p.stack} style={{ marginTop: 16, gap: 10 }}>
        <button type="button" className={`${p.button} ${p.full}`} disabled={action.busy || !ready || !legalPassed} onClick={() => save(true)}><ShieldCheck size={16} />Publikasikan</button>
        <button type="button" className={`${p.button} ${p.secondary} ${p.full}`} disabled={action.busy || !ready} onClick={() => save(false)}>Simpan sebagai draf</button>
      </div>
      <p className={p.small} style={{ marginTop: 14 }}>Skor dihitung ulang oleh server. Rumus: 40 legalitas + 25 SOP + 20 staf + 15 fasilitas; Lulus = penuh, Sebagian = setengah, Tidak lulus = 0.</p>
    </Panel>
  </div>;
}

function Published({ daycareId, score, onChanged }) {
  const [reason, setReason] = useState("");
  const [action, run] = useAction();
  async function withdraw() {
    if (await run(() => apiSend(`/api/admin/daycares/${encodeURIComponent(daycareId)}/safety-score`, { method: "DELETE", body: { reason } }), "Safety Score ditarik dari halaman publik.")) onChanged();
  }
  return <Panel>
    <div className={p.between}>
      <div><p className={p.eyebrow}>SKOR PUBLIK SAAT INI</p><strong className={p.price}>{scoreText(score.score)}</strong><span className={p.small}> / 100 · dipublikasikan {dateTimeText(score.published_at)}</span></div>
    </div>
    <div className={p.row} style={{ marginTop: 12 }}>
      <input className={p.select} value={reason} onChange={event => setReason(event.target.value)} placeholder="Alasan menarik skor (min. 5 karakter)" aria-label="Alasan menarik skor" style={{ flex: 1, minWidth: 200 }} />
      <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy || reason.trim().length < 5} onClick={withdraw}>Tarik dari halaman publik</button>
    </div>
    <ErrorNote error={action.error} />
  </Panel>;
}

export default function AdminSafetyScore({ daycareId }) {
  const review = useApi(`/api/admin/daycares/${encodeURIComponent(daycareId)}/safety-score`);
  const data = review.data;
  const scores = list(data?.scores);
  const published = scores.find(score => score.status === "published");
  return <>
    <Link href="/admin/daycare" className={p.link} style={ICON_LINK}><ArrowLeft size={14} />Kembali ke manajemen daycare</Link>
    <PageHeader eyebrow="SAFETY SCORE" title={data?.daycare?.name ?? "Safety Score"}
      description="Nilai setiap komponen dari dokumen yang sudah disetujui di Verifikasi legalitas. Skor menilai bukti pada tanggal tertentu, bukan sertifikasi keselamatan." />
    {review.loading && <Loading />}
    <ErrorNote error={review.error} onRetry={review.reload} />
    {data && <div className={p.stack}>
      {data.daycare.status !== "active" && <p className={p.notice}>Daycare ini berstatus {DAYCARE_STATUS[data.daycare.status] ?? data.daycare.status}, jadi tidak tampil di katalog. Skor yang dipublikasikan baru terlihat publik setelah daycare diaktifkan.</p>}
      {published && <Published daycareId={daycareId} score={published} onChanged={review.reload} />}
      <ReviewForm key={scores[0]?.id ?? "new"} daycareId={daycareId} data={data} onSaved={review.reload} />
      {scores.length > 0 && <Panel>
        <h2 className={p.sectionTitle}>Riwayat versi</h2>
        {scores.map(score => <div key={score.id} className={p.between} style={{ borderTop: "1px solid #eef2f5", paddingTop: 10, marginTop: 10 }}>
          <span><strong>{scoreText(score.score)}</strong><span className={p.small}> / 100 · {dateTimeText(score.created_at)} · {score.source === "ai" ? "AI" : "Admin"}</span></span>
          <span className={`${p.badge} ${SCORE_STATUS[score.status]?.[1] ?? p.neutral}`}>{SCORE_STATUS[score.status]?.[0] ?? score.status}</span>
        </div>)}
      </Panel>}
    </div>}
  </>;
}
