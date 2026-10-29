import Link from "next/link";
import { Activity, ArrowLeft, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import { authCopy } from "@/components/features/auth-copy";
import { authHref } from "@/lib/auth";
import styles from "./AuthLayout.module.css";

const metricIcons = [ShieldCheck, Sparkles, Activity];

export default function AuthLayout({ language, mode, role, children }) {
  const copy = authCopy[language];

  return (
    <main className={styles.layout} lang={language}>
      <aside className={styles.showcase} aria-labelledby="auth-brand-heading">
        <AyomiLogo href={`/welcome?lang=${language}`} label={copy.homeLabel} />
        <div className={styles.brandContent}>
          <p className={styles.eyebrow}><ShieldCheck size={16} aria-hidden="true" />{copy.brandBadge}</p>
          <h2 id="auth-brand-heading">{copy.brandTitle}</h2>
          <p className={styles.description}>{copy.brandDescription}</p>
          <ul className={styles.metrics}>
            {copy.metrics.map((metric, index) => {
              const Icon = metricIcons[index];
              return (
                <li key={metric.title}>
                  <span className={`${styles.metricIcon} ${index === 1 ? styles.amber : ""}`}><Icon size={23} aria-hidden="true" /></span>
                  <div><h3>{metric.title}</h3><p>{metric.description}</p></div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className={styles.brandFooter}><HeartHandshake size={18} aria-hidden="true" />{copy.brandFooter}</p>
      </aside>
      <section className={styles.workspace} aria-labelledby="auth-heading">
        <header className={styles.topbar}>
          <Link href={`/welcome?lang=${language}`} className={styles.back}><ArrowLeft size={16} aria-hidden="true" />{copy.home}</Link>
          <nav className={styles.language} aria-label={copy.language}>
            <Link href={authHref(mode, role, "id")} lang="id" aria-label="Bahasa Indonesia" aria-current={language === "id" ? "page" : undefined}>ID</Link>
            <span aria-hidden="true">/</span>
            <Link href={authHref(mode, role, "en")} lang="en" aria-label="English" aria-current={language === "en" ? "page" : undefined}>EN</Link>
          </nav>
        </header>
        <div className={styles.formArea}>{children}</div>
        <p className={styles.footer}><ShieldCheck size={15} aria-hidden="true" />{copy.footer}</p>
      </section>
    </main>
  );
}
