"use client";

// Small building blocks shared by the pages that read live data.
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { ROLE_LABEL, useSession } from "@/components/session/SessionProvider";
import { errorMessage } from "@/lib/client-api";
import p from "@/components/features/Parent.module.css";

export const rupiah = value => (value == null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value)));
export const dateText = value => (value ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(String(value).length === 10 ? `${value}T00:00:00+07:00` : value)) : "—");
export const dateTimeText = value => (value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "—");
export const todayJakarta = (offsetDays = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + offsetDays * 86_400_000));
export const nowLocalInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export const ENROLLMENT_STATUS = {
  pending: ["Menunggu keputusan", p.amber], pending_payment: ["Menunggu pembayaran", p.amber], approved: ["Aktif", ""],
  rejected: ["Ditolak", p.red], completed: ["Selesai", p.neutral], cancelled: ["Dibatalkan", p.neutral], expired: ["Kedaluwarsa", p.neutral],
};
export const URGENCY = { low: ["Rendah", p.neutral], medium: ["Sedang", p.amber], high: ["Tinggi", p.red], emergency: ["Darurat", p.red] };
export const INCIDENT_STATUS = { new: ["Baru", p.amber], in_progress: ["Ditangani", p.amber], resolved: ["Selesai", ""] };
export const COMPLAINT_STATUS = {
  new: ["Baru", p.amber], in_progress: ["Ditangani", p.amber], waiting_for_response: ["Menunggu jawaban Anda", p.amber],
  waiting_for_confirmation: ["Menunggu konfirmasi", p.amber], resolved: ["Selesai", ""], closed: ["Ditutup", p.neutral],
};
export const ACTIVITY_TYPES = { play: "Bermain", learning: "Belajar", interaction: "Interaksi", meal: "Makan", sleep: "Tidur", other: "Lainnya" };

export function Badge({ map, value }) {
  const [label, tone] = map[value] ?? [value ?? "—", p.neutral];
  return <span className={`${p.badge} ${tone}`}>{label}</span>;
}

export function Loading({ label = "Memuat data…" }) {
  return <p role="status" className={p.muted} style={{ display: "flex", gap: 8, alignItems: "center" }}><Loader2 size={16} className="animate-spin" />{label}</p>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return <div role="alert" className={p.error} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <AlertCircle size={16} />{typeof error === "string" ? error : errorMessage(error)}
    {onRetry && <button type="button" className={p.link} onClick={onRetry}>Coba lagi</button>}
  </div>;
}

export function Empty({ title, children }) {
  return <div className={p.empty}><strong>{title}</strong>{children && <div className={p.small} style={{ marginTop: 6 }}>{children}</div>}</div>;
}

// Shows children only to signed-in users with one of `roles`. `frame` is a
// class for the wrapper of the messages (e.g. the staff page padding).
export function RequireRole({ roles, children, frame }) {
  const session = useSession();
  const block = blocked(session, roles);
  if (!block) return children;
  return frame ? <div className={frame}>{block}</div> : block;
}

function blocked(session, roles) {
  if (session.status === "loading") return <Loading label="Memeriksa sesi…" />;
  if (session.status === "signed-out") {
    return <Empty title="Masuk untuk melanjutkan">
      <Link className={p.link} href={`/masuk?role=${roles[0] === "parent" ? "parent" : roles[0] === "admin" ? "admin" : "caregiver"}&lang=id`}>Masuk ke akun Ayomi</Link>
    </Empty>;
  }
  if (!session.role || !roles.includes(session.role)) {
    return <Empty title="Halaman ini bukan untuk akun Anda">
      Akun Anda masuk sebagai {ROLE_LABEL[session.profile?.role] ?? "pengguna"}{session.profile?.status && session.profile.status !== "active" ? " (belum aktif)" : ""}.
      Halaman ini khusus {roles.map(role => ROLE_LABEL[role]).join(" / ")}.
    </Empty>;
  }
  return null;
}
