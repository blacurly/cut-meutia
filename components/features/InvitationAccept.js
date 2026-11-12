"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { ApiRequestError, requestApi } from "@/lib/api-client";
import { INVITE_STORAGE_KEY as INVITE_KEY, INVITE_TOKEN } from "@/lib/auth";
import styles from "./AuthForm.module.css";

// Staff invitation link: /undangan#<invitation_token>. The token travels in the
// URL fragment so it is never sent to a server in a URL. It is kept in
// sessionStorage while the invitee signs in or creates an account, and removed
// once the invitation is accepted (POST /api/invitations/accept).
const ROLE_LABEL = { manager: "pengelola", caregiver: "pengasuh" };
// The token itself can no longer be used; other errors (wrong account) can be
// fixed by signing in with the invited email.
const FINAL_ERRORS = new Set(["invitation_not_found", "invitation_revoked", "invitation_already_used", "invitation_expired", "invitation_daycare_not_found", "invalid_invitation_token"]);

function storage(action, value) {
  try {
    if (action === "get") return window.sessionStorage.getItem(INVITE_KEY);
    if (action === "set") window.sessionStorage.setItem(INVITE_KEY, value);
    if (action === "remove") window.sessionStorage.removeItem(INVITE_KEY);
  } catch { /* storage unavailable: the link still works in this tab */ }
  return null;
}

function readToken() {
  const fromHash = window.location.hash.slice(1);
  if (INVITE_TOKEN.test(fromHash)) {
    storage("set", fromHash);
    window.history.replaceState(null, "", window.location.pathname);
    return fromHash;
  }
  const saved = storage("get");
  return INVITE_TOKEN.test(saved || "") ? saved : null;
}

export default function InvitationAccept() {
  const router = useRouter();
  const [state, setState] = useState({ step: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      const token = readToken();
      if (!token) {
        if (active) setState({ step: "invalid", message: "Tautan undangan tidak lengkap. Buka kembali tautan dari pesan undangan." });
        return;
      }
      let signedIn = true;
      try { await requestApi("/api/me"); } catch (error) { signedIn = !(error instanceof ApiRequestError && error.status === 401); }
      if (active) setState({ step: "ready", token, signedIn });
    })();
    return () => { active = false; };
  }, []);

  async function accept() {
    setBusy(true);
    try {
      const result = await requestApi("/api/invitations/accept", { method: "POST", body: { token: state.token } });
      storage("remove");
      setState({ step: "done", result });
    } catch (error) {
      const final = error instanceof ApiRequestError && FINAL_ERRORS.has(error.code);
      if (final) storage("remove");
      setState(previous => ({ ...previous, error: error.message, final }));
    } finally {
      setBusy(false);
    }
  }

  if (state.step === "loading") return <p className={styles.subtitle}>Memeriksa undangan…</p>;
  if (state.step === "invalid") {
    return <div className={styles.auth}>
      <h1>Undangan tidak dapat dibuka</h1>
      <p className={`${styles.feedback} ${styles.error}`} role="alert"><AlertCircle size={16} />{state.message}</p>
    </div>;
  }
  if (state.step === "done") {
    const { result } = state;
    const role = ROLE_LABEL[result.role] ?? "staf";
    return <div className={styles.auth}>
      <h1>Selamat bergabung</h1>
      <p className={styles.feedback} role="status"><CheckCircle2 size={16} />
        {result.membership_status === "active"
          ? `Anda kini terdaftar sebagai ${role}. Lengkapi profil, layanan, harga, dan dokumen legal agar daycare dapat diaktifkan.`
          : `Anda terdaftar sebagai ${role}. Akses dibuka setelah akun Anda diverifikasi.`}
      </p>
      <Button className={styles.submit} fullWidth style={{ marginTop: 20 }} onClick={() => router.replace("/pengelola")}>Buka portal pengelola</Button>
    </div>;
  }

  return <div className={styles.auth}>
    <p className={styles.eyebrow}>UNDANGAN STAF</p>
    <h1>Bergabung dengan daycare di Ayomi</h1>
    <p className={styles.subtitle}>Undangan berlaku 7 hari dan hanya dapat dipakai sekali oleh akun dengan email yang diundang.</p>
    {state.signedIn
      ? <div style={{ marginTop: 24 }}>
        {state.error && <p className={`${styles.feedback} ${styles.error}`} role="alert" style={{ marginBottom: 14 }}><AlertCircle size={16} />{state.error}</p>}
        {!state.final && <Button className={styles.submit} fullWidth disabled={busy} onClick={accept} icon={<MailCheck size={18} />}>{busy ? "Memproses…" : "Terima undangan"}</Button>}
        <p className={styles.subtitle}>Akun Orang Tua yang sudah memiliki data anak tidak dapat dijadikan akun staf.</p>
      </div>
      : <div style={{ marginTop: 24 }}>
        <p className={styles.feedback}><MailCheck size={16} />Masuk atau buat akun dengan email undangan, lalu Anda akan kembali ke halaman ini.</p>
        <div className={styles.businessFields} style={{ marginTop: 16 }}>
          <Link className={styles.legalLink} href="/masuk?role=parent">Masuk</Link>
          <Link className={styles.legalLink} href="/daftar?role=parent">Buat akun baru</Link>
        </div>
      </div>}
  </div>;
}
