"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { ArrowLeftRight, ArrowRight, Check, CheckCircle2, FileCheck2, MapPin, Search, ShieldCheck, Star, Users } from "lucide-react";
import { useParentDemo } from "./ParentDemoProvider";
import { availableSlots, rupiah, toggleCompare } from "@/lib/parent";
import { LEGAL_STATUS } from "@/lib/daycare-directory";
import p from "./Parent.module.css";

export function PageHeader({ eyebrow, title, description, children }) { return <header className={p.header}><div>{eyebrow && <p className={p.eyebrow}>{eyebrow}</p>}<h1 className={p.title}>{title}</h1>{description && <p className={p.subtitle}>{description}</p>}</div>{children}</header>; }
export function Panel({ children, className = "", ...props }) { return <section className={`${p.panel} ${className}`} {...props}>{children}</section>; }
export function LinkButton({ href, children, secondary = false, className = "", ...props }) { return <Link href={href} className={`${p.button} ${secondary ? p.secondary : ""} ${className}`} {...props}>{children}</Link>; }
export function EmptyState({ title, description, href = "/pencarian", action = "Cari daycare", children }) { return <div className={p.empty}><Search size={32} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>{children || <LinkButton href={href}>{action}<ArrowRight size={16} aria-hidden="true" /></LinkButton>}</div>; }
export function DemoGate({ children }) {
  const { state, update, hydrated } = useParentDemo();
  if (!hydrated) return <div className={p.empty} role="status">Menyiapkan halaman…</div>;
  if (state.member) return children;
  return <EmptyState title="Ruang untuk Orang Tua" description="Masuk menggunakan akun Ayomi saat layanan tersedia, atau jelajahi alur dengan data contoh dalam mode demo."><div className={`${p.row}`} style={{ justifyContent: "center" }}><LinkButton secondary href="/masuk?role=parent&lang=id">Masuk / daftar</LinkButton><button className={p.button} onClick={() => update(s => ({ ...s, member: true }))}>Coba mode demo Orang Tua</button></div></EmptyState>;
}
export function DemoPhoto({ src, name = "ruangan daycare", priority = false }) { return <div className={p.photo}><Image src={src} alt={`Ilustrasi AI ${name}, bukan foto daycare nyata.`} fill sizes="(max-width:600px) 100vw, (max-width:1100px) 50vw, 40vw" preload={priority} /><span className={p.photoCredit}>Ilustrasi AI</span></div>; }
export function CompareButton({ daycare }) {
  const { state, update, hydrated } = useParentDemo(); const [error, setError] = useState(""); const selected = state.compare.includes(daycare.id);
  function toggle() { setError(""); try { update(s => toggleCompare(s, daycare.id)); } catch (error) { setError(error.message); } }
  return <div><button disabled={!hydrated} className={`${p.button} ${p.secondary} ${p.full}`} aria-pressed={selected} onClick={toggle}>{selected ? <Check size={15} /> : <ArrowLeftRight size={15} />} {selected ? "Dipilih" : "Bandingkan"}</button>{error && <p role="alert" className={p.error}>{error}</p>}</div>;
}
// Real photo when an approved cover exists, otherwise a neutral placeholder.
// Never substitutes an illustration that could be mistaken for the daycare.
export function DaycarePhoto({ url, name }) {
  if (url) return <div className={p.photo}><Image src={url} alt={`Foto ${name}`} fill sizes="(max-width:600px) 100vw, (max-width:1100px) 50vw, 33vw" /></div>;
  const initials = name.split(/\s+/).filter(word => /^[\p{L}\p{N}]/u.test(word)).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <div className={p.photo}><div className={p.photoPlaceholder}><span className={p.photoInitials} aria-hidden="true">{initials}</span><span className={p.small}>Foto daycare menyusul</span></div></div>;
}

const ratingLabel = rating => rating.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function ListingBadge({ daycare }) {
  if (daycare.kind === "partner") return <span className={p.badge}><CheckCircle2 size={12} />Mitra Ayomi</span>;
  const legal = LEGAL_STATUS[daycare.legalStatus] || LEGAL_STATUS.not_available;
  const tone = { green: "", amber: p.amber, neutral: p.neutral }[legal.tone];
  return <span className={`${p.badge} ${tone}`}><FileCheck2 size={12} />{legal.label}</span>;
}

function DirectoryDetail({ daycare }) {
  const listing = daycare.kind === "listing";
  return <div className={p.stack}>
    <p><MapPin size={14} style={{ display: "inline" }} /> {[daycare.address, daycare.district, daycare.city, daycare.province].filter(Boolean).join(", ")}</p>
    <div className={p.listingMeta}><ListingBadge daycare={daycare} />{listing && <span className={`${p.badge} ${p.neutral}`}>Belum bergabung dengan Ayomi</span>}</div>
    {listing && <p className={p.small}>
      {daycare.rating == null ? "Belum ada rating publik." : <><Star size={13} style={{ display: "inline" }} /> {ratingLabel(daycare.rating)} / 5 · rating ulasan publik daring, bukan ulasan Ayomi.</>}
    </p>}
    <section><h3 className={p.filterLabel}>Fasilitas & program</h3><p>{daycare.description || "Deskripsi belum tersedia."}</p></section>
    {daycare.facilityLabels?.length > 0 && <div className={p.chips}>{daycare.facilityLabels.map(label => <span className={p.chip} key={label}>{label}</span>)}</div>}
    {daycare.capacity != null && <p>Kapasitas harian: {daycare.capacity} anak</p>}
    {listing && <section><h3 className={p.filterLabel}>Legalitas</h3>
      <p className={p.small}>{daycare.legalReference || "Nomor izin atau NPSN belum tercantum di sumber data."}</p>
      {daycare.legalReferenceUrl && <a className={p.link} href={daycare.legalReferenceUrl} target="_blank" rel="noopener noreferrer">Cek di sumber resmi<ArrowRight size={13} /></a>}
    </section>}
    {listing && daycare.dataNotes.length > 0 && <section><h3 className={p.filterLabel}>Catatan data</h3><ul className={`${p.detailList} ${p.small}`}>{daycare.dataNotes.map(note => <li key={note}>{note}</li>)}</ul></section>}
    {listing && <p className={p.notice}>Informasi berasal dari sumber publik dan belum diverifikasi tim Ayomi. Pendaftaran online tersedia setelah daycare bergabung sebagai mitra.</p>}
  </div>;
}

function DirectoryDaycareCard({ daycare }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const closeDetail = useCallback(() => setDetailOpen(false), []);
  const open = () => setDetailOpen(true);
  return <>
    <article className={p.card}>
      <div style={{ position: "relative" }}>
        <button type="button" onClick={open} aria-label={`Lihat detail ${daycare.name}`} style={{ display: "block", width: "100%", padding: 0, border: 0, cursor: "pointer" }}><DaycarePhoto url={daycare.coverImageUrl} name={daycare.name} /></button>
        <div className={p.photoBadges} style={{ pointerEvents: "none" }}><ListingBadge daycare={daycare} /></div>
      </div>
      <div className={p.cardBody}>
        <h2><button type="button" onClick={open} style={{ font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}>{daycare.name}</button></h2>
        <p className={p.small}><MapPin size={12} style={{ display: "inline", marginRight: 4 }} />{[daycare.district, daycare.city, daycare.province].filter(Boolean).join(", ")}</p>
        <div className={p.cardMetrics}>
          {daycare.kind === "listing" && <span><Star size={14} />{daycare.rating == null ? "Belum ada rating" : `${ratingLabel(daycare.rating)} · rating publik`}</span>}
          {daycare.capacity != null && <span><Users size={14} />Kapasitas {daycare.capacity} anak / hari</span>}
          {daycare.facilityLabels?.slice(0, 3).map(label => <span key={label}><Check size={14} />{label}</span>)}
        </div>
        <div className={p.cardActions}>
          <button type="button" disabled className={`${p.button} ${p.secondary} ${p.full}`} title="Perbandingan untuk daycare dari katalog belum tersedia"><ArrowLeftRight size={15} />Bandingkan</button>
          <button type="button" className={p.button} onClick={open}>Lihat detail<ArrowRight size={14} /></button>
        </div>
      </div>
    </article>
    <Modal open={detailOpen} onClose={closeDetail} title={daycare.name}><DirectoryDetail daycare={daycare} /></Modal>
  </>;
}

export function DaycareCard({ daycare }) {
  if (daycare.source === "supabase") return <DirectoryDaycareCard daycare={daycare} />;
  return <DemoDaycareCard daycare={daycare} />;
}

function DemoDaycareCard({ daycare }) {
  const { state } = useParentDemo();
  const slots = availableSlots(daycare, state);
  const detailHref = `/detail/${daycare.id}`;
  return <article className={p.card}>
    <div style={{ position: "relative" }}>
      <Link href={detailHref} aria-label={`Lihat detail ${daycare.name}`}><DemoPhoto src={daycare.image || "/images/daycare-room.webp"} name={daycare.name} /></Link>
      <div className={p.photoBadges} style={{ pointerEvents: "none" }}>
        <span className={`${p.badge} ${!daycare.verified ? p.neutral : ""}`}><CheckCircle2 size={12} />{daycare.verified ? "Terverifikasi · demo" : "Dalam tinjauan"}</span>
        <span className={`${p.badge} ${p.amber}`}><ShieldCheck size={12} />{daycare.score ?? "Belum dinilai"}</span>
      </div>
    </div>
    <div className={p.cardBody}>
      <h2><Link href={detailHref}>{daycare.name}</Link></h2>
      <p className={p.small}><MapPin size={12} style={{ display: "inline", marginRight: 4 }} />{[daycare.district, daycare.city].filter(Boolean).join(", ")}</p>
      <div className={p.cardMetrics}>
        <span><Users size={14} />{daycare.ratio == null ? "Rasio belum tersedia" : `Rasio 1:${daycare.ratio}`}</span>
        <span><Star size={14} />{daycare.rating == null ? "Belum ada rating" : `${daycare.rating} (${daycare.reviewCount ?? 0})`}</span>
        <span>{slots > 0 ? `Sisa ${slots} slot contoh` : "Slot contoh penuh"}</span>
        <span>{daycare.distance == null ? "Jarak belum tersedia" : `${daycare.distance} km · contoh`}</span>
      </div>
      <strong className={p.price}>{daycare.price == null ? "Biaya belum tersedia" : rupiah(daycare.price)}</strong>
      {daycare.price != null && <span className={p.small}> / bulan</span>}
      <div className={p.cardActions}>
        <CompareButton daycare={daycare} />
        <LinkButton href={detailHref}>Lihat detail<ArrowRight size={14} /></LinkButton>
      </div>
    </div>
  </article>;
}
