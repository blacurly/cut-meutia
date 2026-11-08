"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { ArrowLeftRight, ArrowRight, Check, CheckCircle2, MapPin, Search, ShieldCheck, Star, Users } from "lucide-react";
import { useParentDemo } from "./ParentDemoProvider";
import { availableSlots, rupiah, toggleCompare } from "@/lib/parent";
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
export function DaycareCard({ daycare }) {
  const { state } = useParentDemo();
  const [detailOpen, setDetailOpen] = useState(false);
  const closeDetail = useCallback(() => setDetailOpen(false), []);
  const live = daycare.source === "supabase";
  const slots = live ? null : availableSlots(daycare, state);
  const detailHref = `/detail/${daycare.id}`;
  const photo = <DemoPhoto src={daycare.image || "/images/daycare-room.webp"} name={daycare.name} />;
  const verificationLabel = live ? (daycare.status === "active" ? "Daycare aktif" : daycare.status) : daycare.verified ? "Terverifikasi · demo" : "Dalam tinjauan";

  return <>
    <article className={p.card}>
      <div style={{ position: "relative" }}>
        {live ? <button type="button" onClick={() => setDetailOpen(true)} aria-label={`Lihat detail ${daycare.name}`} style={{ display: "block", width: "100%", padding: 0, border: 0, cursor: "pointer" }}>{photo}</button> : <Link href={detailHref} aria-label={`Lihat detail ${daycare.name}`}>{photo}</Link>}
        <div className={p.photoBadges} style={{ pointerEvents: "none" }}>
          <span className={`${p.badge} ${!daycare.verified ? p.neutral : ""}`}><CheckCircle2 size={12} />{verificationLabel}</span>
          {!live && <span className={`${p.badge} ${p.amber}`}><ShieldCheck size={12} />{daycare.score ?? "Belum dinilai"}</span>}
        </div>
      </div>
      <div className={p.cardBody}>
        <h2>{live ? <button type="button" onClick={() => setDetailOpen(true)} style={{ font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}>{daycare.name}</button> : <Link href={detailHref}>{daycare.name}</Link>}</h2>
        <p className={p.small}><MapPin size={12} style={{ display: "inline", marginRight: 4 }} />{[daycare.district, daycare.city].filter(Boolean).join(", ")}</p>
        {live ? <><p className={p.small}>{daycare.address}</p><div className={p.cardMetrics}>
          {daycare.capacity != null && <span><Users size={14} />Kapasitas {daycare.capacity} anak / hari</span>}
          {daycare.facilityLabels?.map(label => <span key={label}><Check size={14} />{label}</span>)}
        </div></> : <><div className={p.cardMetrics}>
          <span><Users size={14} />{daycare.ratio == null ? "Rasio belum tersedia" : `Rasio 1:${daycare.ratio}`}</span>
          <span><Star size={14} />{daycare.rating == null ? "Belum ada rating" : `${daycare.rating} (${daycare.reviewCount ?? 0})`}</span>
          <span>{live ? "Slot belum tersedia" : slots > 0 ? `Sisa ${slots} slot contoh` : "Slot contoh penuh"}</span>
          <span>{daycare.distance == null ? "Jarak belum tersedia" : `${daycare.distance} km${live ? "" : " · contoh"}`}</span>
        </div>
        <strong className={p.price}>{daycare.price == null ? "Biaya belum tersedia" : rupiah(daycare.price)}</strong>
        {daycare.price != null && <span className={p.small}> / bulan</span>}</>}
        <div className={p.cardActions}>
          {live ? <button type="button" disabled className={`${p.button} ${p.secondary} ${p.full}`} title="Perbandingan daycare terdaftar belum tersedia"><ArrowLeftRight size={15} />Bandingkan</button> : <CompareButton daycare={daycare} />}
          {live ? <button type="button" className={p.button} onClick={() => setDetailOpen(true)}>Lihat detail<ArrowRight size={14} /></button> : <LinkButton href={detailHref}>Lihat detail<ArrowRight size={14} /></LinkButton>}
        </div>
      </div>
    </article>
    {live && <Modal open={detailOpen} onClose={closeDetail} title={daycare.name}>
      <div className={p.stack}>
        <p><MapPin size={14} style={{ display: "inline" }} /> {[daycare.address, daycare.district, daycare.city, daycare.province].filter(Boolean).join(", ")}</p>
        <p>{daycare.description || "Deskripsi belum tersedia."}</p>
        {daycare.facilityLabels?.length > 0 && <p>{daycare.facilityLabels.join(" · ")}</p>}
        {daycare.capacity != null && <p>Kapasitas harian: {daycare.capacity} anak</p>}
      </div>
    </Modal>}
  </>;
}
