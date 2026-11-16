"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import { CaregiverNavbar } from "./CaregiverNavigation";
import { AdminNavbar } from "./AdminNavigation";
import { ROLE_LABEL, homeFor, useSession } from "@/components/session/SessionProvider";
import { apiSend, useApi } from "@/lib/client-api";
import s from "./ParentShell.module.css";

export const navigationByRole = {
  public: [["Direktori Daycare", "/pencarian"], ["Keselamatan AI", "/#fitur-keamanan"], ["Cara Kerja", "/#cara-kerja"], ["Tentang Ayomi", "/#tentang"]],
  parent: [["Beranda", "/beranda"], ["Cari Daycare", "/pencarian"], ["Anak Saya", "/profil#anak"], ["Logbook Harian", "/catatan-harian"], ["Pusat Laporan", "/laporan"]],
};

export default function UniversalNavbar({ role }) {
  return role === "caregiver" ? <CaregiverNavbar /> : role === "admin" ? <AdminNavbar /> : <ParentNavbar />;
}

function ParentNavbar() {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isParent = session.role === "parent";
  const staffHome = session.role && !isParent ? homeFor(session.role) : null;
  const notifications = useApi(isParent ? "/api/notifications?limit=5" : null);
  const [open, setOpen] = useState(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    const outside = event => { if (root.current && !root.current.contains(event.target)) { setOpen(null); setMobile(false); } };
    const escape = event => { if (event.key === "Escape") { setOpen(null); setMobile(false); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  async function logout() {
    setOpen(null); setMobile(false);
    await session.signOut();
    router.push("/");
  }
  async function openNotification(item) {
    setOpen(null);
    if (!item.read_at) await apiSend(`/api/notifications/${item.id}`, { method: "PATCH", body: { read: true } }).catch(() => {});
    notifications.reload();
    router.push("/notifikasi");
  }

  const links = isParent ? navigationByRole.parent : navigationByRole.public;
  const items = notifications.data?.items ?? [];
  const unread = notifications.data?.unread_count ?? 0;
  const signedIn = session.status === "signed-in";

  return <header className={s.navbar} ref={root}>
    <div className={s.navInner}>
      <div className={s.brand}><AyomiLogo href="/" /><span className={s.tagline}><i />Pengasuhan tepercaya</span></div>
      <nav className={s.desktopLinks} aria-label="Navigasi utama">
        {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href.split("#")[0] && !href.includes("#") ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className={s.actions}>
        {isParent && <button className={s.iconButton} aria-label={`Notifikasi, ${unread} belum dibaca`} aria-expanded={open === "notifications"} aria-controls="navbar-notifications" onClick={() => { setOpen(v => (v === "notifications" ? null : "notifications")); setMobile(false); }}>
          <Bell size={18} />{unread > 0 && <span className={s.count}>{unread}</span>}
        </button>}
        {!signedIn
          ? <div className={s.authActions}><Link href="/masuk?role=parent&lang=id">Masuk</Link><Link href="/daftar?role=parent&lang=id">Daftar</Link></div>
          : <button className={s.profileButton} aria-expanded={open === "profile"} aria-controls="navbar-profile" onClick={() => { setOpen(v => (v === "profile" ? null : "profile")); setMobile(false); }}>
            <span className={s.avatar}>{(session.name || "?").slice(0, 1).toUpperCase()}</span>
            <span className={s.profileLabel}>{ROLE_LABEL[session.profile?.role] ?? "Akun"}</span><ChevronDown size={14} />
          </button>}
        <button className={`${s.iconButton} ${s.hamburger}`} aria-label={mobile ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={mobile} aria-controls="mobile-navigation" onClick={() => { setMobile(v => !v); setOpen(null); }}>
          {mobile ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      {open === "notifications" && <div id="navbar-notifications" className={s.dropdown}>
        <div className={s.dropdownHeading}><strong>Notifikasi</strong><Link href="/notifikasi" onClick={() => setOpen(null)}>Lihat semua</Link></div>
        {items.length === 0
          ? <p className={s.menuText}>Belum ada notifikasi.</p>
          : items.map(item => <button key={item.id} className={s.notificationLink} onClick={() => openNotification(item)}>
            <Bell size={15} /><span>{item.title}{!item.read_at && <small>Belum dibaca</small>}</span>
          </button>)}
      </div>}
      {open === "profile" && <div id="navbar-profile" className={s.dropdown}>
        <div className={s.dropdownHeading}><strong>{session.name}</strong><span>{ROLE_LABEL[session.profile?.role] ?? ""}</span></div>
        {isParent && <>
          <Link href="/profil" onClick={() => setOpen(null)}><UserRound size={16} />Profil & anak saya</Link>
          <Link href="/status-pendaftaran" onClick={() => setOpen(null)}>Status pendaftaran</Link>
          <Link href="/ulasan" onClick={() => setOpen(null)}>Ulasan saya</Link>
        </>}
        {staffHome && <Link href={staffHome} onClick={() => setOpen(null)}>Buka portal {ROLE_LABEL[session.role]}</Link>}
        <button onClick={logout}><LogOut size={15} />Keluar</button>
      </div>}
    </div>
    <div id="mobile-navigation" className={`${s.mobileMenu} ${mobile ? s.mobileOpen : ""}`} inert={!mobile}>
      <div><nav aria-label="Navigasi seluler">
        {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setMobile(false)}>{label}</Link>)}
        {isParent && <Link href="/status-pendaftaran" onClick={() => setMobile(false)}>Status pendaftaran</Link>}
        {staffHome && <Link href={staffHome} onClick={() => setMobile(false)}>Buka portal {ROLE_LABEL[session.role]}</Link>}
        {signedIn
          ? <button className={s.mobileAction} onClick={logout}>Keluar</button>
          : <><Link href="/masuk?role=parent&lang=id">Masuk</Link><Link href="/daftar?role=parent&lang=id">Daftar akun</Link></>}
      </nav></div>
    </div>
  </header>;
}
