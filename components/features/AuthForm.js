"use client";

import { useCallback, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Circle, Eye, EyeOff, Info, KeyRound, Lock, Mail, MapPin, Phone, UserRound } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Tabs from "@/components/ui/Tabs";
import { AUTH_ROLES, authHref, normalizePhone, passwordCriteria, validateAuthForm } from "@/lib/auth";
import { authCopy } from "./auth-copy";
import styles from "./AuthForm.module.css";

const roleIcons = { parent: UserRound, caregiver: Building2, admin: KeyRound };
const emptyValues = { name: "", email: "", phone: "", password: "", daycare: "", city: "", terms: false };
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function GoogleMark() {
  return <span aria-hidden="true" className={styles.googleMark}>G</span>;
}

export default function AuthForm({ mode, role, language }) {
  const copy = authCopy[language];
  const registering = mode === "register";
  const adminRegistration = registering && role === "admin";
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const [isNavigating, startTransition] = useTransition();
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const closeDialog = useCallback(() => setDialog(null), []);
  const criteria = passwordCriteria(values.password);

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

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateAuthForm(values, { mode, role });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFeedback({ kind: "error", message: copy.errorSummary });
      event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    // No auth provider is configured yet. Never persist credentials, fabricate
    // a session, or grant access based on the selected presentation role.
    setFeedback({ kind: "info", message: registering ? copy.registerUnavailable : copy.loginUnavailable });
  }

  function openRecovery() {
    setResetEmail(values.email);
    setResetError("");
    setResetNotice("");
    setDialog("reset");
  }

  function submitRecovery(event) {
    event.preventDefault();
    const next = validateAuthForm({ email: resetEmail, password: "present" });
    if (next.email) {
      setResetError(copy.errors.email);
      event.currentTarget.elements.namedItem("recoveryEmail")?.focus();
      return;
    }
    setResetError("");
    setResetNotice(copy.resetUnavailable);
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
        ) : (
          <>
            <form method="post" onSubmit={submit} noValidate aria-label={registering ? copy.register : copy.login}>
              <fieldset disabled={!hydrated || isNavigating} className={styles.fields}>
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
                <Button type="submit" variant="accent" fullWidth icon={<ArrowRight size={18} aria-hidden="true" />} iconPosition="right" className={styles.submit} disabled={!hydrated || isNavigating}>{isNavigating ? copy.loading : registering ? copy.register : copy.login}</Button>
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
          <Button type="submit" variant="accent" fullWidth>{copy.resetButton}</Button>
        </form> : <div className={styles.legalContent}><p>{dialog === "privacy" ? copy.privacyBody : copy.termsBody}</p><Button onClick={closeDialog} fullWidth>{copy.understood}</Button></div>}
      </Modal>
    </div>
  );
}
