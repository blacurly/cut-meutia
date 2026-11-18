"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Check, CheckCircle2, FileCheck2, MapPin, Search, ShieldCheck, Star, Users, Wallet } from "lucide-react";
import { useParentDemo } from "./ParentDemoProvider";
import { availableSlots, rupiah, toggleCompare } from "@/lib/parent";
import { LEGAL_STATUS } from "@/lib/daycare-directory";
import p from "./Parent.module.css";

export function PageHeader({ eyebrow, title, description, children }) { return <header className={p.header}><div>{eyebrow && <p className={p.eyebrow}>{eyebrow}</p>}<h1 className={p.title}>{title}</h1>{description && <p className={p.subtitle}>{description}</p>}</div>{children}</header>; }
export function Panel({ children, className = "", ...props }) { return <section className={`${p.panel} ${className}`} {...props}>{children}</section>; }
export function LinkButton({ href, children, secondary = false, className = "", ...props }) { return <Link href={href} className={`${p.button} ${secondary ? p.secondary : ""} ${className}`} {...props}>{children}</Link>; }
export function EmptyState({ title, description, href = "/pencarian", action = "Cari daycare", children }) { return <div className={p.empty}><Search size={32} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{children || <LinkButton href={href}>{action}<ArrowRight size={16} aria-hidden="true" /></LinkButton>}</div>; }
export function IllustrationPhoto({ src, name = "ruangan daycare", priority = false, label = "Ilustrasi AI" }) { return <div className={p.photo}><Image src={src} alt={`${label} ${name}, bukan foto daycare nyata.`} fill sizes="(max-width:600px) 100vw, (max-width:1100px) 50vw, 40vw" preload={priority} /><span className={p.photoCredit}>{label}</span></div>; }
export function CompareButton({ daycare }) {
  const { state, update, hydrated } = useParentDemo(); const [error, setError] = useState(""); const selected = state.compare.includes(daycare.id);
  function toggle() { setError(""); try { update(s => toggleCompare(s, daycare.id, daycare.name)); } catch (error) { setError(error.message); } }
  return <div><button disabled={!hydrated} className={`${p.button} ${p.secondary} ${p.full}`} aria-pressed={selected} onClick={toggle}>{selected ? <Check size={15} /> : <ArrowLeftRight size={15} />} {selected ? "Dipilih" : "Bandingkan"}</button>{selected && state.compare.length > 1 && <Link href="/bandingkan" className={p.link} style={{ display: "block", marginTop: 6, textAlign: "center" }}>Lihat perbandingan ({state.compare.length})</Link>}{error && <p role="alert" className={p.error}>{error}</p>}</div>;
}
// Real photo when an approved cover exists, otherwise a neutral placeholder.
// Never substitutes an illustration that could be mistaken for the daycare.
export function DaycarePhoto({ url, name, illustration = false, priority = false }) {
  if (url && illustration) return <IllustrationPhoto src={url} name={name} priority={priority} label="Ilustrasi" />;
  if (url) return <div className={p.photo}><Image src={url} alt={`Foto ${name}`} fill sizes="(max-width:600px) 100vw, (max-width:1100px) 50vw, 33vw" /></div>;
  const initials = name.split(/\s+/).filter(word => /^[\p{L}\p{N}]/u.test(word)).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <div className={p.photo}><div className={p.photoPlaceholder}><span className={p.photoInitials} aria-hidden="true">{initials}</span><span className={p.small}>Foto daycare menyusul</span></div></div>;
}

const ratingLabel = rating => rating.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ListingBadge({ daycare }) {
  if (daycare.kind === "partner") return <span className={p.badge}><CheckCircle2 size={12} />Mitra Ayomi</span>;
  const legal = LEGAL_STATUS[daycare.legalStatus] || LEGAL_STATUS.not_available;
  const tone = { green: "", amber: p.amber, neutral: p.neutral }[legal.tone];
  return <span className={`${p.badge} ${tone}`}><FileCheck2 size={12} />{legal.label}</span>;
}

export const detailHref = daycare => `/detail/${daycare.slug || daycare.id}`;

// Catalog card. Fees, ratio and capacity of catalog entries are synthetic
// estimates (data_origin = 'synthetic'), so they carry an "estimasi" marker.
function DirectoryDaycareCard({ daycare }) {
  const href = detailHref(daycare);
  const estimated = daycare.profile?.estimated;
  return <article className={p.card}>
    <div style={{ position: "relative" }}>
      <Link href={href} aria-label={`Lihat detail ${daycare.name}`} style={{ display: "block" }}><DaycarePhoto url={daycare.coverImageUrl} illustration={daycare.coverIsIllustration} name={daycare.name} /></Link>
      <div className={p.photoBadges} style={{ pointerEvents: "none" }}><ListingBadge daycare={daycare} /></div>
    </div>
    <div className={p.cardBody}>
      <h2><Link href={href}>{daycare.name}</Link></h2>
      <p className={p.small}><MapPin size={12} style={{ display: "inline", marginRight: 4 }} />{[daycare.district, daycare.city, daycare.province].filter(Boolean).join(", ")}</p>
      <div className={p.cardMetrics}>
        {(daycare.kind === "listing" || daycare.rating != null) && <span><Star size={14} />{daycare.rating == null ? "Belum ada rating" : `${ratingLabel(daycare.rating)} · rating publik`}</span>}
        {daycare.ratio != null && <span><Users size={14} />Rasio 1:{daycare.ratio}{estimated && "*"}</span>}
        {daycare.capacity != null && <span><Check size={14} />Kapasitas {daycare.capacity} anak{estimated && "*"}</span>}
        {daycare.facilityLabels?.slice(0, 2).map(label => <span key={label}><Check size={14} />{label}</span>)}
      </div>
      {daycare.monthlyFee != null && <p><Wallet size={14} style={{ display: "inline", marginRight: 6 }} /><strong className={p.price}>{rupiah(daycare.monthlyFee)}</strong><span className={p.small}> / bulan{estimated && "*"}</span></p>}
      {estimated && <p className={p.small}>*Estimasi dari data sintetis, bukan harga resmi daycare.</p>}
      <div className={p.cardActions}>
        <CompareButton daycare={daycare} />
        <LinkButton href={href}>Lihat detail<ArrowRight size={14} /></LinkButton>
      </div>
    </div>
  </article>;
}

export function DaycareCard({ daycare }) {
  return <DirectoryDaycareCard daycare={daycare} />;
}
