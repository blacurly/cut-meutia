"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Circle, Eye, EyeOff, Info, KeyRound, Lock, Mail, MailCheck, MapPin, Phone, RotateCw, UserRound } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Tabs from "@/components/ui/Tabs";
import { AUTH_ROLES, authHref, hasPendingInvite, normalizePhone, passwordCriteria, validateAuthForm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { authCopy } from "./auth-copy";
import styles from "./AuthForm.module.css";

const roleIcons = { parent: UserRound, caregiver: Building2, admin: KeyRound };
const emptyValues = { name: "", email: "", phone: "", password: "", daycare: "", city: "", terms: false };
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const INFO_MESSAGES = new Set(["emailConfirmed"]);
const RESEND_SECONDS = 60;
const confirmRedirect = () => `${window.location.origin}/auth/callback?next=${hasPendingInvite() ? "/undangan" : "/beranda"}`;

function GoogleMark() {
  return <span aria-hidden="true" className={styles.googleMark}>G</span>;
}

export default function AuthForm({ mode, role, language, initialAuthMessage = null }) {
  const copy = authCopy[language];
  const registering = mode === "register";
  const adminRegistration = registering && role === "admin";
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const [isNavigating, startTransition] = useTransition();
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(() => initialAuthMessage
    ? { kind: INFO_MESSAGES.has(initialAuthMessage) ? "info" : "error", message: copy[initialAuthMessage] } : null);
  // Email the confirmation link went to; replaces the form with the next steps.
  const [sentTo, setSentTo] = useState("");
  const [resend, setResend] = useState({ wait: 0, busy: false, message: "", failed: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const closeDialog = useCallback(() => setDialog(null), []);
  const criteria = passwordCriteria(values.password);

  useEffect(() => {
    if (!resend.wait) return undefined;
    const timer = setTimeout(() => setResend((state) => ({ ...state, wait: state.wait - 1 })), 1000);
    return () => clearTimeout(timer);
  }, [resend.wait]);

  async function resendConfirmation(email) {
    if (!email || resend.wait || resend.busy) return;
    setResend({ wait: 0, busy: true, message: "", failed: false });
    try {
      const { error } = await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: confirmRedirect() } });
      if (error) throw error;
      setResend({ wait: RESEND_SECONDS, busy: false, message: copy.resendSent, failed: false });
    } catch (error) {
      const message = error.code === "over_email_send_rate_limit" ? copy.emailRateLimited
        : error.code === "email_address_not_authorized" ? copy.resetEmailNotAuthorized
          : error.code === "over_request_rate_limit" ? copy.emailRateLimited : copy.resendFailed;
      setResend({ wait: error.code?.startsWith("over_") ? RESEND_SECONDS : 0, busy: false, message, failed: true });
    }
  }

  function backToForm() {
    setSentTo("");
    setFeedback(null);
    setResend({ wait: 0, busy: false, message: "", failed: false });
  }

  function changeRole(nextRole) {
    if (role === nextRole) return;
    setErrors({});
    setFeedback(null);
    setShowPassword(false);
    startTransition(() => router.replace(authHref(mode, nextRole, language), { scroll: false }));
  }

  function changeField(event) {
    const { name, value, type, checked } = event.target;
    setValues((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
    setErrors((previous) => { const next = { ...previous }; delete next[name]; return next; });
    setFeedback(null);
  }

  function blurField(event) {
    const name = event.target.name;
    const next = validateAuthForm(values, { mode, role });
    setErrors((previous) => ({ ...previous, [name]: next[name] }));
    if (name === "phone" && !next.phone) setValues((previous) => ({ ...previous, phone: normalizePhone(previous.phone) }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateAuthForm(values, { mode, role });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFeedback({ kind: "error", message: copy.errorSummary });
      event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    if (registering && role !== "parent") {
      setFeedback({ kind: "error", message: copy.staffInviteOnly });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      if (registering) {
        const { data, error } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: {
            emailRedirectTo: confirmRedirect(),
            data: { full_name: values.name.trim(), phone: normalizePhone(values.phone) },
          },
        });
        if (error) throw error;

        if (!data.session) {
          // Supabase answers the same way for an email that already exists
          // (no email is sent then), so the next-steps view mentions both.
          setSentTo(values.email.trim());
          setValues((previous) => ({ ...previous, password: "" }));
          setResend({ wait: RESEND_SECONDS, busy: false, message: "", failed: false });
          return;
        }
        startTransition(() => router.replace(hasPendingInvite() ? "/undangan" : "/beranda"));
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });
      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("role, status")
        .eq("id", data.user.id)
        .single();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error("profile");
      }
      const allowedRole = role === "caregiver"
        ? ["manager", "caregiver"].includes(profile.role)
        : profile.role === role;
      if (!allowedRole || profile.status !== "active") {
        await supabase.auth.signOut();
        throw new Error("role");
      }
      const destination = profile.role === "parent" ? "/beranda" : profile.role === "admin" ? "/admin" : "/pengelola";
      startTransition(() => router.replace(hasPendingInvite() ? "/undangan" : destination));
    } catch (error) {
      const key = error.message === "profile"
        ? "profileUnavailable"
        : error.message === "role"
          ? "roleMismatch"
          : error.code === "invalid_credentials"
            ? "invalidCredentials"
            : error.code === "email_not_confirmed"
              ? "emailNotConfirmed"
              : error.code === "user_already_exists" || error.code === "email_exists"
                ? "userExists"
              : error.code === "over_email_send_rate_limit"
                ? "emailRateLimited"
              : error.code === "email_address_not_authorized"
                ? "resetEmailNotAuthorized"
              : error.status === 400 && !registering
                ? "invalidCredentials"
              : error.name === "AuthRetryableFetchError" || error.name === "AbortError"
                ? "authUnavailable"
              : "authFailed";
      setFeedback({ kind: "error", message: copy[key], resendTo: key === "emailNotConfirmed" ? values.email.trim() : "" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function openRecovery() {
    setResetEmail(values.email);
    setResetError("");
    setResetNotice("");
    setDialog("reset");
  }

  async function submitRecovery(event) {
    event.preventDefault();
    const next = validateAuthForm({ email: resetEmail, password: "present" });
    if (next.email) {
      setResetError(copy.errors.email);
      event.currentTarget.elements.namedItem("recoveryEmail")?.focus();
      return;
    }
    setResetError("");
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/atur-ulang-sandi`,
      });
      if (error) throw error;
      setResetNotice(copy.resetSent);
    } catch (error) {
      const message = error.code === "over_email_send_rate_limit"
        ? copy.resetRateLimited
        : error.code === "email_address_not_authorized"
          ? copy.resetEmailNotAuthorized
          : error.name === "AuthRetryableFetchError" || error.name === "AbortError"
            ? copy.authUnavailable
            : copy.resetFailed;
      setResetError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function field(name, Icon, options = {}) {
    const id = `auth-${name}`;
    const { labelAction, ...inputOptions } = options;
    return (
      <div className={styles.field}>
        <div className={styles.labelRow}><label htmlFor={id}>{copy.fields[name]}</label>{labelAction}</div>
        <Input
          id={id}
          name={name}
          value={values[name]}
          onChange={changeField}
          onBlur={blurField}
          error={copy.errors[errors[name]]}
          icon={<Icon size={17} aria-hidden="true" />}
          placeholder={copy.placeholders[name]}
          className={styles.control}
          required
          {...inputOptions}
        />
      </div>
    );
  }

  return (
    <div className={styles.auth}>
      <p className={styles.eyebrow}>{registering ? copy.registerEyebrow : copy.loginEyebrow}</p>
      <h1 id="auth-heading">{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>
      <noscript><p className={styles.feedback}>{copy.javascriptRequired}</p></noscript>
      <div className={styles.roleSelector}>
        <Tabs
          tabs={AUTH_ROLES.map((id) => { const Icon = roleIcons[id]; return { id, label: copy.roles[id], icon: <Icon size={16} className="shrink-0" aria-hidden="true" /> }; })}
          activeTab={role}
          onChange={changeRole}
          variant="pills"
          label={copy.roleLabel}
          idPrefix="auth-role"
          panelId="auth-form-panel"
        />
      </div>
      <div id="auth-form-panel" role="tabpanel" aria-labelledby={`auth-role-${role}`} aria-busy={isNavigating}>
        <p className={styles.roleDescription}>{copy.roleDescriptions[role]}</p>
        {adminRegistration ? (
          <div className={styles.adminCard}>
            <span className={styles.adminIcon}><KeyRound size={24} aria-hidden="true" /></span>
            <h2>{copy.adminTitle}</h2>
            <p>{copy.adminDescription}</p>
            <Link href={authHref("login", "admin", language)} className={styles.adminLink}>{copy.adminLogin}<ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        ) : sentTo ? (
          <section className={styles.sentCard} role="status" aria-labelledby="auth-sent-title">
            <span className={styles.sentIcon}><MailCheck size={26} aria-hidden="true" /></span>
            <h2 id="auth-sent-title">{copy.checkEmailTitle}</h2>
            <p>{copy.checkEmailBody} <strong className={styles.sentEmail}>{sentTo}</strong></p>
            <ol className={styles.sentSteps}>{copy.checkEmailSteps.map((step) => <li key={step}>{step}</li>)}</ol>
            <p className={styles.sentNote}>{copy.checkEmailExisting}</p>
            <Link href={authHref("login", role, language)} className={styles.adminLink}>{copy.goToLogin}<ArrowRight size={17} aria-hidden="true" /></Link>
            <div className={styles.resendRow}>
              <button type="button" className={styles.resendButton} onClick={() => resendConfirmation(sentTo)} disabled={Boolean(resend.wait) || resend.busy}><RotateCw size={14} aria-hidden="true" />{resend.busy ? copy.submitting : resend.wait ? copy.resendWait.replace("{s}", resend.wait) : copy.resendConfirmation}</button>
              <button type="button" className={styles.textButton} onClick={backToForm}>{copy.changeEmail}</button>
            </div>
            {resend.message && <p className={resend.failed ? styles.inlineError : styles.resendNote}>{resend.message}</p>}
          </section>
        ) : (
          <>
            <form method="post" onSubmit={submit} noValidate aria-label={registering ? copy.register : copy.login}>
              <fieldset disabled={!hydrated || isNavigating || isSubmitting} className={styles.fields}>
                {registering && field("name", UserRound, { autoComplete: "name", maxLength: 100 })}
                {field("email", Mail, { type: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false, maxLength: 254 })}
                {registering && field("phone", Phone, { type: "tel", inputMode: "tel", autoComplete: "tel-national", prefix: "+62", "aria-label": `${copy.fields.phone} (+62)`, maxLength: 24 })}
                <div>
                  {field("password", Lock, {
                    type: showPassword ? "text" : "password",
                    autoComplete: registering ? "new-password" : "current-password",
                    maxLength: registering ? 128 : undefined,
                    placeholder: registering ? copy.placeholders.newPassword : copy.placeholders.password,
                    "aria-describedby": registering ? "password-requirements" : undefined,
                    labelAction: !registering && <button type="button" onClick={openRecovery} className={styles.textButton}>{copy.forgot}</button>,
                    endAdornment: <button type="button" className={styles.eyeButton} aria-label={showPassword ? copy.hidePassword : copy.showPassword} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>,
                  })}
                  {registering && <ul id="password-requirements" aria-label={copy.passwordHelp} className={styles.requirements}>{Object.entries(criteria).map(([key, met]) => <li key={key} data-met={met}>{met ? <CheckCircle2 size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{copy.passwordRules[key]}</li>)}</ul>}
                </div>
                {registering && role === "caregiver" && <div className={styles.businessFields}>{field("daycare", Building2, { autoComplete: "organization", maxLength: 150 })}{field("city", MapPin, { autoComplete: "address-level2", maxLength: 100 })}</div>}
                {registering && <div>
                  <div className={styles.consent}>
                    <input id="auth-terms" name="terms" type="checkbox" checked={values.terms} onChange={changeField} required aria-labelledby="auth-consent-label" aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "auth-terms-error" : undefined} />
                    <div id="auth-consent-label"><label htmlFor="auth-terms">{copy.consent} </label><button type="button" onClick={() => setDialog("terms")} className={styles.legalLink}>{copy.terms}</button> {copy.and} <button type="button" onClick={() => setDialog("privacy")} className={styles.legalLink}>{copy.privacy}</button>.</div>
                  </div>
                  {errors.terms && <p id="auth-terms-error" className={styles.inlineError}>{copy.errors.terms}</p>}
                </div>}
                {feedback && <div className={`${styles.feedback} ${feedback.kind === "error" ? styles.error : ""}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.kind === "error" ? <AlertCircle size={17} aria-hidden="true" /> : <Info size={17} aria-hidden="true" />}<span>{feedback.message}</span></div>}
                {feedback?.resendTo && <div className={styles.resendRow}>
                  <button type="button" className={styles.resendButton} onClick={() => resendConfirmation(feedback.resendTo)} disabled={Boolean(resend.wait) || resend.busy}><RotateCw size={14} aria-hidden="true" />{resend.busy ? copy.submitting : resend.wait ? copy.resendWait.replace("{s}", resend.wait) : copy.resendConfirmation}</button>
                  {resend.message && <p className={resend.failed ? styles.inlineError : styles.resendNote} role="status">{resend.message}</p>}
                </div>}
                <Button type="submit" variant="accent" fullWidth icon={<ArrowRight size={18} aria-hidden="true" />} iconPosition="right" className={styles.submit} disabled={!hydrated || isNavigating || isSubmitting}>{isSubmitting ? copy.submitting : isNavigating ? copy.loading : registering ? copy.register : copy.login}</Button>
              </fieldset>
            </form>
            {role !== "admin" && <>
              <div className={styles.divider}><span>{copy.divider}</span></div>
              <Button variant="secondary" fullWidth icon={<GoogleMark />} className={styles.googleButton} disabled={!hydrated || isNavigating} onClick={() => { setErrors({}); setFeedback({ kind: "info", message: copy.googleUnavailable }); }}>{copy.google}</Button>
            </>}
          </>
        )}
      </div>
      {!adminRegistration && role !== "admin" && <p className={styles.switchMode}>{registering ? copy.haveAccount : copy.noAccount} <Link href={authHref(registering ? "login" : "register", role, language)}>{registering ? copy.loginLink : copy.registerLink}</Link></p>}

      <Modal open={Boolean(dialog)} onClose={closeDialog} title={dialog === "reset" ? copy.resetTitle : dialog === "privacy" ? copy.privacy : copy.terms} closeLabel={copy.close} size="sm">
        {dialog === "reset" ? <form method="post" onSubmit={submitRecovery} className={styles.recoveryForm} noValidate>
          <p>{copy.resetDescription}</p>
          <label htmlFor="recovery-email">{copy.fields.email}</label>
          <Input id="recovery-email" name="recoveryEmail" type="email" autoComplete="email" icon={<Mail size={17} aria-hidden="true" />} placeholder={copy.placeholders.email} value={resetEmail} onChange={(event) => { setResetEmail(event.target.value); setResetError(""); setResetNotice(""); }} error={resetError} required />
          {resetNotice && <p className={styles.feedback} role="status">{resetNotice}</p>}
          <Button type="submit" variant="accent" fullWidth disabled={isSubmitting}>{isSubmitting ? copy.submitting : copy.resetButton}</Button>
        </form> : <div className={styles.legalContent}><p>{dialog === "privacy" ? copy.privacyBody : copy.termsBody}</p><Button onClick={closeDialog} fullWidth>{copy.understood}</Button></div>}
      </Modal>
    </div>
  );
}
