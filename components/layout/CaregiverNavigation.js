"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, Building2, ChevronDown, ClipboardList, FileCheck2, LayoutDashboard, Menu, MessageSquare, ShieldAlert, ShieldCheck, X } from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import { useParentDemo } from "@/components/features/ParentDemoProvider";
import { managedDaycare, managedEnrollments } from "@/lib/caregiver";
import c from "@/components/features/Caregiver.module.css";
import p from "@/components/features/Parent.module.css";

const menu = [
  ["Dashboard", "/pengelola", LayoutDashboard],
  ["Kelola pendaftaran", "/pengelola/pendaftaran", ClipboardList],
  ["Logbook harian", "/pengelola/laporan-harian", BookOpen],
  ["Ulasan & balasan", "/pengelola/ulasan", MessageSquare],
  ["Dokumen legalitas", "/pengelola/dokumen", FileCheck2],
  ["Profil bisnis", "/pengelola/profil", Building2],
  ["Tindak lanjut laporan", "/pengelola#laporan", ShieldAlert],
];
function NavigationLinks() { const pathname = usePathname(); const { state } = useParentDemo(); const count = managedEnrollments(state).filter(e => e.status === "pending").length; return menu.map(([label, href, Icon]) => <Link className={c.navLink} key={href} href={href} aria-current={!href.includes("#") && (pathname === href || (href !== "/pengelola" && pathname.startsWith(`${href}/`))) ? "page" : undefined}><Icon size={17} />{label}{href === "/pengelola/pendaftaran" && count > 0 && <span className={c.navCount}>{count}</span>}</Link>); }

export function CaregiverNavbar() {
  const { state, update } = useParentDemo(); const router = useRouter(); const pathname = usePathname();
  const [open, setOpen] = useState(null); const root = useRef(null); const trigger = useRef(null);
  const pending = managedEnrollments(state).filter(e => e.status === "pending").length;
  const incidents = state.incidents.filter(r => r.daycareId === managedDaycare.id && r.status !== "closed").length;
  useEffect(() => { const click = event => { if (!root.current?.contains(event.target) || event.target instanceof Element && event.target.closest("a")) setOpen(null); }; const key = event => { if (event.key === "Escape") { setOpen(null); trigger.current?.focus(); } }; document.addEventListener("click", click); document.addEventListener("keydown", key); return () => { document.removeEventListener("click", click); document.removeEventListener("keydown", key); }; }, []);
  function toggle(event, value) { trigger.current = event.currentTarget; setOpen(v => v === value ? null : value); }
  function exit() { update(s => ({ ...s, caregiver: { ...s.caregiver, enabled: false } })); router.push("/welcome"); }
  return <header className={c.navbar} ref={root}><div className={c.navInner}><AyomiLogo href="/pengelola" /><nav aria-label="Navigasi utama pengelola" className={c.topLinks}>{menu.slice(0, 4).map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav><div className={c.actions}><span className={`${p.badge} ${c.verified}`}><ShieldCheck size={13} />Terverifikasi · contoh</span>{state.caregiver.enabled && <><button className={c.iconButton} aria-label={`Perlu ditinjau: ${pending} pengajuan dan ${incidents} laporan`} aria-expanded={open === "notifications"} aria-controls="caregiver-notifications" onClick={e => toggle(e, "notifications")}><Bell size={18} />{pending + incidents > 0 && <span className={c.count}>{pending + incidents}</span>}</button><button className={c.profileButton} aria-label="Menu akun pengelola" aria-expanded={open === "profile"} aria-controls="caregiver-profile-menu" onClick={e => toggle(e, "profile")}><span className={c.avatar}>MS</span><span className={c.profileLabel}>Mbak Siti · demo</span><ChevronDown size={14} /></button></>}<button className={`${c.iconButton} ${c.mobileToggle}`} aria-label={open === "mobile" ? "Tutup navigasi pengelola" : "Buka navigasi pengelola"} aria-expanded={open === "mobile"} aria-controls="caregiver-mobile-menu" onClick={e => toggle(e, "mobile")}>{open === "mobile" ? <X size={19} /> : <Menu size={19} />}</button></div>{open === "notifications" && <div className={c.dropdown} id="caregiver-notifications"><strong>Perlu ditinjau · demo lokal</strong><Link href="/pengelola/pendaftaran">{pending} pengajuan menunggu keputusan</Link><Link href="/pengelola#laporan">{incidents} laporan belum selesai</Link></div>}{open === "profile" && <div className={c.dropdown} id="caregiver-profile-menu"><strong>Mbak Siti · Pengelola demo</strong><Link href="/pengelola/profil">Profil bisnis</Link><Link href="/beranda" onClick={() => update(s => ({ ...s, member: true }))}>Lihat demo Orang Tua</Link><Link href="/">Katalog publik</Link><button onClick={exit}>Keluar demo pengelola</button></div>}</div><div id="caregiver-mobile-menu" className={`${c.mobileMenu} ${open === "mobile" ? c.mobileOpen : ""}`} inert={open !== "mobile"}><div><nav aria-label="Navigasi seluler pengelola"><NavigationLinks /><Link className={c.navLink} href="/beranda" onClick={() => update(s => ({ ...s, member: true }))}>Lihat demo Orang Tua</Link>{state.caregiver.enabled && <button className={c.navLink} onClick={exit}>Keluar demo pengelola</button>}</nav></div></div></header>;
}

export default function CaregiverSidebar() { return <aside className={c.sidebar}><div><p className={c.sidebarLabel}>Ruang pengelola</p><div className={c.daycareWidget}><strong>{managedDaycare.name}</strong><span className={p.badge} style={{ background: "#2a9d8f25", color: "#a5e1cc" }}><ShieldCheck size={12} />Profil contoh terverifikasi</span><p style={{ fontSize: 11, color: "#b7d1d4", marginTop: 9 }}>Kebomas, Gresik</p></div></div><nav aria-label="Navigasi samping pengelola"><NavigationLinks /></nav><div className={c.sidebarFooter}><strong>Mbak Siti</strong><br /><small>Pengelola · mode demo</small><p style={{ marginTop: 12 }}>Pengasuhan yang tertata.<br />Keluarga yang lebih tenang.</p></div></aside>; }
