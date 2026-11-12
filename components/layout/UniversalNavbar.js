"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, UserRound, X } from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import { CaregiverNavbar } from "./CaregiverNavigation";
import { AdminNavbar } from "./AdminNavigation";
import { useParentDemo } from "@/components/features/ParentDemoProvider";
import { activeEnrollments, emptyDemo } from "@/lib/parent";
import s from "./ParentShell.module.css";
import p from "@/components/features/Parent.module.css";

export const navigationByRole = {
  public: [["Direktori Daycare", "/pencarian"], ["Keselamatan AI", "/#fitur-keamanan"], ["Cara Kerja", "/#cara-kerja"], ["Tentang Ayomi", "/#tentang"]],
  parent: [["Beranda", "/beranda"], ["Cari Daycare", "/pencarian"], ["Anak Saya", "/profil#anak"], ["Logbook Harian", "/catatan-harian"], ["Pusat Laporan", "/laporan"]],
  caregiver: [["Dashboard", "/pengelola"], ["Pengajuan Slot", "/pengelola/pendaftaran"], ["Input Logbook AI", "/pengelola/laporan-harian"], ["Respon Ulasan", "/pengelola/ulasan"]],
  admin: [["Overview Platform", "/admin"], ["Verifikasi OCR Izin", "/admin/verifikasi-izin"], ["Eskalasi Insiden", "/admin/eskalasi-insiden"], ["Manajemen Daycare", "/admin/daycare"]],
};

export default function UniversalNavbar({ role }) {
  return role === "caregiver" ? <CaregiverNavbar /> : role === "admin" ? <AdminNavbar /> : <ParentNavbar role={role} />;
}

function ParentNavbar({ role: requestedRole }) {
  const { state, update } = useParentDemo(); const pathname = usePathname(); const router = useRouter();
  const role = requestedRole || (state.member ? "parent" : "public");
  const [open, setOpen] = useState(null); const [mobile, setMobile] = useState(false);
  const root = useRef(null); const trigger = useRef(null);
  const unread = state.notifications.filter(n => !n.read); const urgent = unread.some(n => n.urgent);
  const children = state.children.filter(c => activeEnrollments(state).some(e => e.childId === c.id));
  useEffect(() => {
    const outside = event => { if (root.current && !root.current.contains(event.target)) { setOpen(null); setMobile(false); } };
    const escape = event => { if (event.key === "Escape") { setOpen(null); setMobile(false); trigger.current?.focus(); } };
    const navigation = event => { if (root.current?.contains(event.target) && event.target instanceof Element && event.target.closest("a")) { setOpen(null); setMobile(false); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); document.addEventListener("click", navigation);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); document.removeEventListener("click", navigation); };
  }, []);
  function toggle(event, panel) { trigger.current = event.currentTarget; setOpen(current => current === panel ? null : panel); setMobile(false); }
  function exitDemo() { update(s => ({ ...emptyDemo, compare: s.compare, location: s.location })); setOpen(null); setMobile(false); router.push("/"); }
  const links = navigationByRole[role] || navigationByRole.public;
  return <><header className={s.navbar} ref={root}><div className={s.navInner}><div className={s.brand}><AyomiLogo href="/" /><span className={s.tagline}><i />Pengasuhan tepercaya</span></div><nav className={s.desktopLinks} aria-label="Navigasi utama">{links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href.split("#")[0] && !href.includes("#") ? "page" : undefined}>{label}</Link>)}</nav><div className={s.actions}>{state.member && <button className={s.iconButton} aria-label={`Notifikasi, ${unread.length} belum dibaca`} aria-expanded={open === "notifications"} aria-controls="navbar-notifications" onClick={event => toggle(event, "notifications")}><Bell size={18} />{unread.length > 0 && <span className={`${s.count} ${urgent ? s.urgent : ""}`}>{unread.length}</span>}</button>}{role === "public" ? <div className={s.authActions}><Link href="/masuk?role=parent&lang=id">Masuk</Link><Link href="/daftar?role=parent&lang=id">Daftar</Link></div> : <button className={s.profileButton} aria-expanded={open === "profile"} aria-controls="navbar-profile" onClick={event => toggle(event, "profile")}><span className={s.avatar}>{state.profile.name.slice(0, 1)}</span><span className={s.profileLabel}>{role === "parent" ? "Orang Tua · Demo" : role === "caregiver" ? "Pengelola" : "Administrator"}</span><ChevronDown size={14} /></button>}<button className={`${s.iconButton} ${s.hamburger}`} aria-label={mobile ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={mobile} aria-controls="mobile-navigation" onClick={event => { trigger.current = event.currentTarget; setMobile(v => !v); setOpen(null); }}>{mobile ? <X size={21} /> : <Menu size={21} />}</button></div>
    {open === "notifications" && <div id="navbar-notifications" className={s.dropdown}><div className={s.dropdownHeading}><strong>Notifikasi demo</strong><Link href="/notifikasi" onClick={() => setOpen(null)}>Lihat semua</Link></div>{state.notifications.length === 0 ? <p className={s.menuText}>Belum ada notifikasi. Pembaruan alur demo akan tampil di sini.</p> : state.notifications.slice(0, 4).map(n => <Link className={s.notificationLink} key={n.id} href={n.href} onClick={() => { update(s => ({ ...s, notifications: s.notifications.map(item => item.id === n.id ? { ...item, read: true } : item) })); setOpen(null); }}><Bell size={15} /><span>{n.title}{!n.read && <small>Belum dibaca</small>}</span></Link>)}</div>}
    {open === "profile" && <div id="navbar-profile" className={s.dropdown}><div className={s.dropdownHeading}><strong>{state.profile.name}</strong><span>Demo lokal</span></div>{children.length > 0 && <div className={s.menuText}><label htmlFor="nav-child">Anak aktif</label><select id="nav-child" className={p.select} value={children.some(c => c.id === state.selectedChild) ? state.selectedChild : children[0].id} onChange={e => update(s => ({ ...s, selectedChild: e.target.value }))}>{children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}<Link href="/profil"><UserRound size={16} />Profil & anak saya</Link><Link href="/status-pendaftaran">Status pendaftaran</Link><Link href="/ulasan">Ulasan saya</Link><Link href="/pengelola">Portal Pengelola · Demo</Link><Link href="/admin">Portal Administrator · Demo</Link><button onClick={exitDemo}>Keluar & hapus sesi demo</button></div>}
  </div><div id="mobile-navigation" className={`${s.mobileMenu} ${mobile ? s.mobileOpen : ""}`} inert={!mobile}><div><nav aria-label="Navigasi seluler">{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setMobile(false)}>{label}</Link>)}<Link href="/status-pendaftaran">Status pendaftaran</Link>{state.member ? <><Link href="/profil">Pengaturan akun demo</Link><button className={s.mobileAction} onClick={exitDemo}>Keluar & hapus sesi demo</button></> : <div className={p.row}><Link href="/masuk?role=parent&lang=id">Masuk</Link><Link href="/daftar?role=parent&lang=id">Daftar akun</Link></div>}</nav></div></div></header></>;
}
