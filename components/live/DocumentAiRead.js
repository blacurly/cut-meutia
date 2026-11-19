"use client";

// "Baca dengan AI" for one document in Admin > Verifikasi legalitas: OCR +
// language model propose the fields with quotes, the server checks them
// (lib/api/legal-read.js). A proposal only; the Admin still decides.
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, ScanText } from "lucide-react";
import { apiSend, useApi } from "@/lib/client-api";
import { ErrorNote, dateText, dateTimeText } from "./ui";
import p from "@/components/features/Parent.module.css";

const LEVEL = {
  ok: [CheckCircle2, "#237e73"],
  info: [Info, "#52606d"],
  warning: [AlertTriangle, "#b14731"],
};
const FIELD_LABEL = { document_type: "jenis dokumen", institution_name: "nama lembaga", document_number: "nomor", issuer: "penerbit", issued_on: "tanggal terbit", expires_on: "berlaku sampai", address: "alamat" };
const VALIDITY = { dated: "Ada tanggal berakhir", permanent: "Berlaku tanpa batas waktu", unknown: "Tidak disebutkan" };
const FAILED = {
  document_unreadable: "Dokumen tidak bisa dibaca. Minta Pengelola mengunggah scan yang lebih jelas.",
  SOURCE_CHANGED: "Isi file berbeda dengan saat diunggah. Jangan setujui sebelum diperiksa.",
  EVIDENCE_MISMATCH: "Jawaban AI tidak didukung kutipan dari dokumen, jadi tidak dipakai. Coba baca ulang.",
  OUTPUT_INVALID: "Jawaban AI tidak sesuai format, jadi tidak dipakai. Coba baca ulang.",
  MODEL_UNAVAILABLE: "Layanan AI atau OCR belum diatur di server.",
  PROVIDER_TIMEOUT: "Layanan AI terlalu lama merespons. Coba lagi.",
  PROVIDER_UNAVAILABLE: "Layanan AI atau OCR sedang tidak tersedia. Coba lagi.",
  RATE_LIMITED: "Batas permintaan AI tercapai. Coba lagi sebentar lagi.",
};

function Value({ value, quote }) {
  if (value == null) return <span className={p.small}>Tidak terbaca</span>;
  return <>
    <span>{value}</span>
    {quote && <span className={p.small} style={{ display: "block" }}>hal. {quote.page}: “{quote.quote}”</span>}
  </>;
}

function Result({ read, document }) {
  const { extraction, checks = [], ocr } = read.output;
  const fields = extraction.fields;
  const quote = field => extraction.evidence.find(item => item.field === field);
  const rows = [
    ["Jenis dokumen", "document_type", null],
    ["Nama lembaga", "institution_name", null],
    ["Nomor", "document_number", document.document_number],
    ["Penerbit", "issuer", document.issuer],
    ["Tanggal terbit", "issued_on", document.valid_from ? dateText(document.valid_from) : null],
    ["Berlaku sampai", "expires_on", document.expires_on ? dateText(document.expires_on) : null],
    ["Alamat", "address", null],
  ];
  const shown = (field, value) => (value != null && (field === "issued_on" || field === "expires_on") ? dateText(value) : value);
  const aiIssues = extraction.issues.filter(issue => issue.code !== "evidence_not_found");
  const emptied = extraction.issues.filter(issue => issue.code === "evidence_not_found").map(issue => issue.field);
  return <div className={p.stack} style={{ gap: 12, marginTop: 10 }}>
    <ul className={p.stack} style={{ gap: 6 }}>
      {checks.map(check => {
        const [Icon, color] = LEVEL[check.level] ?? LEVEL.info;
        return <li key={check.code} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 2 }} aria-label={check.level} /><span>{check.message}</span>
        </li>;
      })}
    </ul>
    <div className={p.tableWrap} tabIndex={0} aria-label="Usulan AI dibandingkan isian Pengelola, geser untuk melihat semua kolom">
      <table className={p.table}>
        <thead><tr><th scope="col">Isian</th><th scope="col">Usulan AI dari dokumen</th><th scope="col">Diisi Pengelola</th></tr></thead>
        <tbody>
          {rows.map(([label, field, typed]) => <tr key={field}>
            <th scope="row">{label}</th>
            <td><Value value={shown(field, fields[field])} quote={quote(field)} /></td>
            <td>{typed ?? <span className={p.small}>—</span>}</td>
          </tr>)}
          <tr><th scope="row">Masa berlaku</th><td>{VALIDITY[fields.validity_type] ?? fields.validity_type}</td><td><span className={p.small}>—</span></td></tr>
        </tbody>
      </table>
    </div>
    {emptied.length > 0 && <p className={p.small}>Dikosongkan karena nilainya tidak ditemukan di teks dokumen: {emptied.map(field => FIELD_LABEL[field] ?? field).join(", ")}.</p>}
    {aiIssues.length > 0 && <div><p className={p.small} style={{ fontWeight: 600 }}>Catatan AI</p>
      <ul className={`${p.detailList} ${p.small}`}>{aiIssues.map((issue, index) => <li key={index}>{issue.detail}</li>)}</ul></div>}
    <details>
      <summary className={p.small} style={{ cursor: "pointer" }}>Teks hasil OCR ({ocr.pages.length} halaman)</summary>
      {ocr.pages.map(page => <div key={page.page} style={{ marginTop: 8 }}>
        <p className={p.small}>Halaman {page.page} · {page.source === "text_layer" ? "teks bawaan PDF" : `OCR${page.confidence != null ? `, keyakinan ${Math.round(page.confidence * 100)}%` : ""}`}</p>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, background: "#f6f8f9", padding: 10, borderRadius: 8, maxHeight: 260, overflow: "auto" }}>{page.text || "(kosong)"}</pre>
      </div>)}
    </details>
    <p className={p.small}>Dibaca {dateTimeText(read.finished_at)} · OCR {ocr.engine?.recognizer ?? "—"} · model {read.model}. Usulan AI hanya membantu membaca. Cocokkan dengan berkas asli sebelum memutuskan.</p>
  </div>;
}

export default function DocumentAiRead({ document }) {
  const latest = useApi(`/api/admin/daycare-documents/${document.id}/ai-read`);
  const [state, setState] = useState({ busy: false, error: null, read: null });
  const read = state.read ?? latest.data;
  async function start() {
    setState(current => ({ ...current, busy: true, error: null }));
    try {
      const result = await apiSend(`/api/admin/daycare-documents/${document.id}/ai-read`, { method: "POST" });
      setState({ busy: false, error: null, read: result });
    } catch (error) {
      setState(current => ({ ...current, busy: false, error }));
      latest.reload();
    }
  }
  const failed = read?.status === "failed" && !state.busy;
  return <section style={{ marginTop: 10, padding: 12, border: "1px solid #e2e8f0", borderRadius: 10, background: "#fbfcfd" }} aria-label="Usulan AI">
    <div className={p.between}>
      <p className={p.eyebrow} style={{ display: "flex", gap: 6, alignItems: "center" }}><ScanText size={14} />USULAN AI</p>
      <button type="button" className={`${p.button} ${p.secondary}`} disabled={state.busy || latest.loading} onClick={start}>
        {state.busy ? "Membaca dokumen…" : read ? "Baca ulang" : "Baca dengan AI"}
      </button>
    </div>
    {state.busy && <p className={p.small} role="status">OCR dan model bahasa sedang membaca dokumen. Biasanya 5–60 detik, tergantung jumlah halaman.</p>}
    {!read && !state.busy && !latest.loading && !state.error && <p className={p.small}>AI membaca berkas, mengusulkan isian beserta kutipannya, lalu membandingkannya dengan isian Pengelola dan data daycare.</p>}
    <ErrorNote error={state.error} />
    {failed && !state.error && <p className={p.error}>Pembacaan terakhir gagal: {FAILED[read.error_code] ?? read.error_code}</p>}
    {read?.status === "succeeded" && read.output && <Result read={read} document={document} />}
  </section>;
}
