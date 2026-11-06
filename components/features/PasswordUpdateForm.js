"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound, Lock, Mail } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { passwordCriteria } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { authCopy } from "./auth-copy";
import styles from "./AuthForm.module.css";

export default function PasswordUpdateForm({ language = "id" }) {
  const copy = authCopy[language];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const criteria = passwordCriteria(password);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setHasSession(!error && Boolean(data.session));
        setCheckingSession(false);
      }
    }).catch(() => {
      if (active) setCheckingSession(false);
    });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!Object.values(criteria).every(Boolean) || password.length > 128) {
      setFeedback({ kind: "error", message: copy.errors.password });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setFeedback({ kind: "error", message: copy.errors.email });
          return;
        }
        if (!/^\d{6,12}$/.test(token.trim())) {
          setFeedback({ kind: "error", message: copy.invalidRecoveryCode });
          return;
        }
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: "recovery",
        });
        if (verifyError) throw verifyError;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setFeedback({ kind: "success", message: copy.passwordUpdated });
      window.setTimeout(() => router.replace("/masuk"), 1200);
    } catch {
      setFeedback({ kind: "error", message: copy.passwordUpdateFailed });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.auth}>
      <p className={styles.eyebrow}>AYOMI · KEAMANAN AKUN</p>
      <h1 id="auth-heading">{copy.passwordUpdateTitle}</h1>
      <p className={styles.subtitle}>{copy.passwordUpdateSubtitle}</p>
      {checkingSession ? <p className={styles.feedback} role="status">{copy.checkingRecoverySession}</p> : !hasSession && <p className={styles.feedback} role="status">{copy.recoveryCodeHelp}</p>}
      <form onSubmit={submit} className={styles.recoveryForm}>
        {!hasSession && !checkingSession && <>
          <label htmlFor="recovery-account-email" className={styles.labelRow}>{copy.fields.email}</label>
          <Input
            id="recovery-account-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            icon={<Mail size={17} aria-hidden="true" />}
            required
            maxLength={254}
          />
          <label htmlFor="recovery-code" className={styles.labelRow}>{copy.recoveryCodeLabel}</label>
          <Input
            id="recovery-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))}
            icon={<KeyRound size={17} aria-hidden="true" />}
            required
            maxLength={12}
          />
        </>}
        <label htmlFor="new-password" className={styles.labelRow}>{copy.fields.password}</label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          icon={<Lock size={17} aria-hidden="true" />}
          required
          minLength={8}
          maxLength={128}
        />
        <ul className={styles.requirements} aria-label={copy.passwordHelp}>
          {Object.entries(criteria).map(([key, met]) => (
            <li key={key} data-met={met}>
              <CheckCircle2 size={12} aria-hidden="true" />{copy.passwordRules[key]}
            </li>
          ))}
        </ul>
        {feedback && (
          <div className={`${styles.feedback} ${feedback.kind === "error" ? styles.error : ""}`} role={feedback.kind === "error" ? "alert" : "status"}>
            {feedback.kind === "error" ? <AlertCircle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
            <span>{feedback.message}</span>
          </div>
        )}
        <Button type="submit" variant="accent" fullWidth disabled={saving || checkingSession}>
          {saving ? copy.submitting : copy.passwordUpdateButton}
        </Button>
      </form>
      <p className={styles.switchMode}><Link href="/masuk">{copy.loginLink}</Link></p>
    </div>
  );
}
