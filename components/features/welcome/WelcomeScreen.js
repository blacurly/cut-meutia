import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building,
  Building2,
  CheckCircle2,
  HeartHandshake,
  Lock,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import daycareImage from "@/public/images/ayomi-daycare.webp";
import { welcomeCopy } from "./copy";
import styles from "./WelcomeScreen.module.css";

const trustIcons = [CheckCircle2, Lock, Building];

export default function WelcomeScreen({ language = "id" }) {
  const copy = welcomeCopy[language];
  const entryHref = (role) => `/masuk?role=${role}&lang=${language}`;

  return (
    <div className={styles.screen} lang={language}>
      <a href="#pilihan-akses" className={styles.skipLink}>{copy.skip}</a>
      <main className={styles.hero}>
        <section className={styles.panel} aria-labelledby="welcome-heading">
          <header className={styles.header}>
            <AyomiLogo href={`/?lang=${language}`} label={copy.homeLabel} />
            <nav className={styles.language} aria-label={copy.languageLabel}>
              <Link href="?lang=id" lang="id" aria-label="Bahasa Indonesia" aria-current={language === "id" ? "page" : undefined}>ID</Link>
              <span aria-hidden="true" />
              <Link href="?lang=en" lang="en" aria-label="English" aria-current={language === "en" ? "page" : undefined}>EN</Link>
            </nav>
          </header>
          <div className={styles.content}>
            <div className={styles.badge}>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{copy.badge}</span>
            </div>
            <h1 id="welcome-heading" className={styles.headline}>
              {copy.headline.map((line) => <span key={line}>{line}</span>)}
            </h1>
            <p className={styles.description}>{copy.description}</p>
            <nav id="pilihan-akses" className={styles.entries} aria-label={copy.entryLabel} tabIndex={-1}>
              <p className={styles.eyebrow}>{copy.entryLabel}</p>
              <Link href={entryHref("parent")} className={`${styles.entry} ${styles.primary}`}>
                <span>{copy.parent}</span>
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
              <Link href={entryHref("caregiver")} className={`${styles.entry} ${styles.secondary}`}>
                <span>{copy.caregiver}</span>
                <Building2 size={20} aria-hidden="true" />
              </Link>
              <Link href={entryHref("admin")} className={styles.adminLink}>{copy.admin}</Link>
              <Link href="/" className={styles.adminLink} style={{color:"#e9c46a"}}>{language==="en"?"Explore the public daycare directory":"Jelajahi katalog daycare tanpa masuk"}</Link>
            </nav>
          </div>
          <div className={styles.panelFooter}>
            <span className={styles.footerRule} aria-hidden="true" />
            <HeartHandshake size={17} aria-hidden="true" />
            <span>{copy.promise}</span>
          </div>
        </section>
        <figure className={styles.visual}>
          <Image
            src={daycareImage}
            alt={copy.photoAlt}
            fill
            preload
            placeholder="blur"
            sizes="(max-width: 900px) 100vw, 50vw"
            className={styles.photo}
          />
          <div className={styles.photoOverlay} aria-hidden="true" />
          <div className={styles.photoTag}>
            <Sprout size={17} aria-hidden="true" />
            <span>{copy.photoTag}</span>
          </div>
          <figcaption className={styles.caption}>
            <div className={styles.captionCard}>
              <div className={styles.captionHeading}>
                <span className={styles.captionIcon}><ShieldCheck size={24} aria-hidden="true" /></span>
                <p className={styles.captionEyebrow}>{copy.photoEyebrow}</p>
              </div>
              <h2>{copy.photoTitle}</h2>
              <p className={styles.captionDescription}>{copy.photoDescription}</p>
            </div>
            <p className={styles.imageCredit}>{copy.photoCaption}</p>
          </figcaption>
        </figure>
      </main>
      <footer className={styles.trustBar}>
        <p className={styles.trustLabel}>{copy.trustLabel}</p>
        <ul className={styles.trustItems}>
          {copy.trust.map((label, index) => {
            const Icon = trustIcons[index];
            return <li key={label}><Icon size={18} aria-hidden="true" /><span>{label}</span></li>;
          })}
        </ul>
        <p className={styles.copyright}>{copy.copyright}</p>
      </footer>
    </div>
  );
}
