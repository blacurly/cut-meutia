"use client";

// Urgency panel for one incident (Manager and Admin): reporter's urgency, the
// AI triage proposal with its quotes, the effective urgency and its history,
// and the override form. AI only proposes; the database applies
// max(reporter, AI) and the Manager/Admin decides (lib/api/incident-triage.js).
import { useState } from "react";
import { AlertTriangle, ScanText } from "lucide-react";
import { apiSend } from "@/lib/client-api";
import { Badge, ErrorNote, URGENCY, dateTimeText } from "./ui";
import p from "@/components/features/Parent.module.css";

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

const SOURCE = {
  caregiver: "sesuai penilaian pelapor",
  ai_max: "dinaikkan otomatis oleh AI",
  manager_override: "ditetapkan Pengelola/Admin",
};
const FAILED = {
  PROVIDER_TIMEOUT: "layanan triage terlalu lama merespons",
  PROVIDER_UNAVAILABLE: "layanan triage sedang tidak tersedia",
  MODEL_UNAVAILABLE: "layanan triage belum diatur di server",
  RATE_LIMITED: "terlalu banyak permintaan",
  OUTPUT_INVALID: "hasil AI tidak sesuai format",
  EVIDENCE_MISMATCH: "hasil AI tidak didukung isi laporan",
  PROVIDER_AUTH: "token layanan triage salah",
};

function engineLabel(triage) {
  if (!triage?.model) return null;
  if (triage.model === "rubric-rules") return "aturan rubrik draf-1 (sementara, sebelum model IndoBERT siap)";
  if (triage.model === "contract-v1-example") return "contoh kontrak (mode pengembangan, bukan AI sungguhan)";
  return `model ${triage.model} ${triage.model_version ?? ""}`.trim();
}

function Proposal({ triage }) {
  const result = triage.result ?? {};
  if (result.urgency == null) {
    return <div className={p.small}>
      <p>AI tidak menilai karena informasinya kurang. Urgensi dari pelapor tetap dipakai.</p>
      {result.missing_information?.length > 0 && <p>Yang perlu dilengkapi: {result.missing_information.join(", ")}.</p>}
    </div>;
  }
  return <div className={p.stack} style={{ gap: 6 }}>
    <div className={p.row} style={{ alignItems: "center" }}><span className={p.small}>Usulan AI</span><Badge map={URGENCY} value={result.urgency} /></div>
    <p className={p.small}>{result.reason}</p>
    {result.evidence_quotes?.length > 0 && <ul className={`${p.detailList} ${p.small}`}>
      {result.evidence_quotes.map(quote => <li key={quote}>“{quote}”</li>)}
    </ul>}
    {result.missing_information?.length > 0 && <p className={p.small}>Informasi yang belum ada: {result.missing_information.join(", ")}.</p>}
  </div>;
}

export default function IncidentTriage({ incident, onChanged }) {
  const [form, setForm] = useState({ urgency: incident.urgency, reason: "" });
  const [action, run] = useAction();
  const triage = incident.triage;
  const open = incident.status !== "resolved";

  async function retriage() {
    if (await run(() => apiSend(`/api/incidents/${incident.id}/triage`, { method: "POST" }), "Penilaian AI selesai.")) onChanged?.();
  }
  async function override(event) {
    event.preventDefault();
    if (await run(() => apiSend(`/api/incidents/${incident.id}/urgency`, { body: form }), "Urgensi ditetapkan.")) {
      setForm(f => ({ ...f, reason: "" }));
      onChanged?.();
    }
  }

  return <section style={{ marginTop: 10, padding: 12, border: "1px solid #e2e8f0", borderRadius: 10, background: "#fbfcfd" }} aria-label="Penilaian urgensi">
    <div className={p.between}>
      <p className={p.eyebrow} style={{ display: "flex", gap: 6, alignItems: "center" }}><ScanText size={14} />PENILAIAN URGENSI</p>
      {open && <button type="button" className={`${p.button} ${p.secondary}`} disabled={action.busy} onClick={retriage}>
        {action.busy ? "Menilai…" : triage ? "Nilai ulang dengan AI" : "Nilai dengan AI"}
      </button>}
    </div>
    <div className={p.row} style={{ alignItems: "center", marginTop: 6 }}>
      <span className={p.small}>Pelapor</span><Badge map={URGENCY} value={incident.caregiver_urgency} />
      <span className={p.small}>→ Dipakai</span><Badge map={URGENCY} value={incident.urgency} />
      <span className={p.small}>({SOURCE[incident.urgency_source] ?? incident.urgency_source})</span>
    </div>
    {incident.needs_urgency_review && <p className={p.small} role="status" style={{ display: "flex", gap: 6, alignItems: "flex-start", color: "#b14731", marginTop: 6 }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />AI menilai laporan ini lebih mendesak dari pelapor. Tinjau, lalu konfirmasi atau ubah urgensinya di bawah.
    </p>}

    <div style={{ marginTop: 10 }}>
      {!triage && <p className={p.small}>Belum ada penilaian AI untuk laporan ini.</p>}
      {triage?.status === "failed" && <p className={p.error}>Penilaian AI terakhir gagal: {FAILED[triage.error_code] ?? triage.error_code}. Urgensi pelapor tetap dipakai.</p>}
      {triage?.status === "succeeded" && <Proposal triage={triage} />}
      {triage?.status === "succeeded" && <p className={p.small} style={{ marginTop: 6 }}>
        Dibuat AI · {engineLabel(triage)} · {dateTimeText(triage.finished_at)}. Ini usulan, bukan diagnosis; ikuti SOP daycare dan arahan tenaga kesehatan.
      </p>}
    </div>

    {incident.urgency_changes?.length > 0 && <details style={{ marginTop: 8 }}>
      <summary className={p.small} style={{ cursor: "pointer" }}>Riwayat urgensi ({incident.urgency_changes.length})</summary>
      <ul className={`${p.detailList} ${p.small}`}>
        {incident.urgency_changes.map((change, index) => <li key={index}>
          {dateTimeText(change.created_at)}: {URGENCY[change.old_urgency]?.[0] ?? change.old_urgency} → {URGENCY[change.new_urgency]?.[0] ?? change.new_urgency}
          {" "}({change.source === "ai_max" ? "AI" : "Pengelola/Admin"}): {change.reason}
        </li>)}
      </ul>
    </details>}

    {open && <form className={p.row} style={{ marginTop: 10 }} onSubmit={override}>
      <select className={p.select} value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} aria-label="Urgensi yang dipakai" style={{ maxWidth: 160 }}>
        {Object.entries(URGENCY).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <input className={p.select} required minLength={10} maxLength={1000} placeholder="Alasan (minimal 10 karakter)" value={form.reason}
        onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} aria-label="Alasan menetapkan urgensi" style={{ flex: 1, minWidth: 180 }} />
      <button type="submit" className={p.button} disabled={action.busy || form.reason.trim().length < 10}>
        {incident.needs_urgency_review && form.urgency === incident.urgency ? "Konfirmasi" : "Tetapkan urgensi"}
      </button>
    </form>}
    <ErrorNote error={action.error} /><Notice text={action.notice} />
  </section>;
}
