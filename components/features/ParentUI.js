"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  const { state } = useParentDemo(); const slots = availableSlots(daycare, state);
  return <article className={p.card}><div style={{ position: "relative" }}><Link href={`/detail/${daycare.id}`} aria-label={`Lihat detail ${daycare.name}`}><DemoPhoto src={daycare.image} name={daycare.name} /></Link><div className={p.photoBadges}><span className={`${p.badge} ${!daycare.verified ? p.neutral : ""}`}><CheckCircle2 size={12} />{daycare.verified ? "Terverifikasi · demo" : "Dalam tinjauan"}</span><span className={`${p.badge} ${p.amber}`}><ShieldCheck size={12} />{daycare.score}</span></div></div><div className={p.cardBody}><h2><Link href={`/detail/${daycare.id}`}>{daycare.name}</Link></h2><p className={p.small}><MapPin size={12} style={{ display: "inline", marginRight: 4 }} />{daycare.district}, {daycare.city}</p><div className={p.cardMetrics}><span><Users size={14} />Rasio 1:{daycare.ratio}</span><span><Star size={14} />{daycare.rating} ({daycare.reviewCount})</span><span>{slots > 0 ? `Sisa ${slots} slot contoh` : "Slot contoh penuh"}</span><span>{daycare.distance} km · contoh</span></div><strong className={p.price}>{rupiah(daycare.price)}</strong><span className={p.small}> / bulan</span><div className={p.cardActions}><CompareButton daycare={daycare} /><LinkButton href={`/detail/${daycare.id}`}>Lihat detail<ArrowRight size={14} /></LinkButton></div></div></article>;
}
