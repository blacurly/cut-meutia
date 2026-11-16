"use client";

// Navbar and sidebar for the staff portals (Pengelola/Pengasuh and Admin).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import AyomiLogo from "@/components/ui/AyomiLogo";
import { ROLE_LABEL, useSession } from "@/components/session/SessionProvider";
import c from "@/components/features/Caregiver.module.css";
import p from "@/components/features/Parent.module.css";

function isCurrent(pathname, href, root) {
  return pathname === href || (href !== root && pathname.startsWith(`${href}/`));
}

export function StaffNavbar({ home, badge }) {
  const session = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  async function logout() {
    setOpen(false);
    await session.signOut();
    router.push("/masuk");
  }
  return <header className={c.navbar} ref={root}><div className={c.navInner}>
    <AyomiLogo href={home} />
    {badge && <span className={`${p.badge} ${c.verified}`}><ShieldCheck size={13} />{badge}</span>}
    <div className={c.actions}>
      {session.status === "signed-in" && <button className={c.profileButton} aria-expanded={open} aria-controls="staff-account" onClick={() => setOpen(v => !v)}>
        <span className={c.avatar}>{(session.name || "?").slice(0, 1).toUpperCase()}</span>
        <span>{session.name} · {ROLE_LABEL[session.profile?.role] ?? "Akun"}</span><ChevronDown size={14} />
      </button>}
      {open && <div id="staff-account" className={c.dropdown}>
        <Link href={home} onClick={() => setOpen(false)}>Beranda portal</Link>
        <Link href="/pencarian" onClick={() => setOpen(false)}>Katalog daycare</Link>
        <button type="button" onClick={logout}><LogOut size={15} />Keluar</button>
      </div>}
    </div>
  </div></header>;
}

export function StaffSidebar({ label, title, subtitle, menu, root }) {
  const pathname = usePathname();
  const session = useSession();
  return <aside className={c.sidebar}>
    <div>
      <p className={c.sidebarLabel}>{label}</p>
      <div className={c.daycareWidget}><strong>{title}</strong>{subtitle && <p style={{ fontSize: 11, color: "#b7d1d4", marginTop: 9 }}>{subtitle}</p>}</div>
    </div>
    <nav aria-label={`Navigasi ${label}`}>
      {menu.map(([text, href, Icon]) => <Link key={href} className={c.navLink} href={href} aria-current={isCurrent(pathname, href, root) ? "page" : undefined}><Icon size={17} />{text}</Link>)}
    </nav>
    <div className={c.sidebarFooter}><strong>{session.name}</strong><br /><small>{ROLE_LABEL[session.profile?.role] ?? ""}</small></div>
  </aside>;
}
