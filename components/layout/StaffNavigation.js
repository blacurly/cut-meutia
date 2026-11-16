"use client";

// Navbar and sidebar for the staff portals (Pengelola/Pengasuh and Admin).
// Below 1000 px the sidebar is hidden (Caregiver.module.css) and the same
// menu opens from the navbar toggle instead.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import { ROLE_LABEL, useSession } from "@/components/session/SessionProvider";
import c from "@/components/features/Caregiver.module.css";
import p from "@/components/features/Parent.module.css";

function isCurrent(pathname, href, root) {
  return pathname === href || (href !== root && pathname.startsWith(`${href}/`));
}

function MenuLinks({ menu, root, onNavigate }) {
  const pathname = usePathname();
  return menu.map(([text, href, Icon]) => <Link key={href} className={c.navLink} href={href} onClick={onNavigate}
    aria-current={isCurrent(pathname, href, root) ? "page" : undefined}><Icon size={17} />{text}</Link>);
}

export function StaffNavbar({ home, badge, menu = [] }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(null);
  const root = useRef(null);
  useEffect(() => {
    const close = event => { if (!root.current?.contains(event.target)) setOpen(null); };
    const escape = event => { if (event.key === "Escape") setOpen(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => { Promise.resolve().then(() => setOpen(null)); }, [pathname]);
  async function logout() {
    setOpen(null);
    await session.signOut();
    router.push("/masuk");
  }
  const signedIn = session.status === "signed-in";
  return <header className={c.navbar} ref={root}>
    <div className={c.navInner}>
      <AyomiLogo href={home} />
      {badge && <span className={`${p.badge} ${c.verified}`}><ShieldCheck size={13} />{badge}</span>}
      <div className={c.actions}>
        {signedIn && <button className={c.profileButton} aria-expanded={open === "account"} aria-controls="staff-account" onClick={() => setOpen(v => (v === "account" ? null : "account"))}>
          <span className={c.avatar}>{(session.name || "?").slice(0, 1).toUpperCase()}</span>
          <span className={c.profileLabel}>{session.name} · {ROLE_LABEL[session.profile?.role] ?? "Akun"}</span><ChevronDown size={14} />
        </button>}
        {signedIn && menu.length > 0 && <button className={`${c.iconButton} ${c.mobileToggle}`} aria-label={open === "menu" ? "Tutup menu" : "Buka menu"}
          aria-expanded={open === "menu"} aria-controls="staff-mobile-menu" onClick={() => setOpen(v => (v === "menu" ? null : "menu"))}>
          {open === "menu" ? <X size={20} /> : <Menu size={20} />}
        </button>}
      </div>
      {open === "account" && <div id="staff-account" className={c.dropdown}>
        <Link href={home} onClick={() => setOpen(null)}>Beranda portal</Link>
        <Link href="/pencarian" onClick={() => setOpen(null)}>Katalog daycare</Link>
        <button type="button" onClick={logout}><LogOut size={15} />Keluar</button>
      </div>}
    </div>
    {menu.length > 0 && <div id="staff-mobile-menu" className={`${c.mobileMenu} ${open === "menu" ? c.mobileOpen : ""}`} inert={open !== "menu"}>
      <div><nav aria-label="Menu portal"><MenuLinks menu={menu} root={home} onNavigate={() => setOpen(null)} /></nav></div>
    </div>}
  </header>;
}

export function StaffSidebar({ label, title, subtitle, menu, root }) {
  const session = useSession();
  return <aside className={c.sidebar}>
    <div>
      <p className={c.sidebarLabel}>{label}</p>
      <div className={c.daycareWidget}><strong>{title}</strong>{subtitle && <p style={{ fontSize: 11, color: "#b7d1d4", marginTop: 9 }}>{subtitle}</p>}</div>
    </div>
    <nav aria-label={`Navigasi ${label}`}><MenuLinks menu={menu} root={root} /></nav>
    <div className={c.sidebarFooter}><strong>{session.name}</strong><br /><small>{ROLE_LABEL[session.profile?.role] ?? ""}</small></div>
  </aside>;
}
