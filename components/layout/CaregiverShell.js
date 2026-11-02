"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FlaskConical } from "lucide-react";
import UniversalNavbar from "./UniversalNavbar";
import CaregiverSidebar from "./CaregiverNavigation";
import { useParentDemo } from "@/components/features/ParentDemoProvider";
import { seedCaregiverDemo } from "@/lib/caregiver";
import { EmptyState, LinkButton } from "@/components/features/ParentUI";
import c from "@/components/features/Caregiver.module.css";
import p from "@/components/features/Parent.module.css";

export default function CaregiverShell({ children }) {
  const { state, update, hydrated, persistent } = useParentDemo(); const [error, setError] = useState(""); const pathname = usePathname();
  function seed() { try { update(s => seedCaregiverDemo(s)); setError(""); } catch (e) { setError(e.message); } }
  return <div className={c.shell}><a className={c.skip} href="#konten-pengelola">Langsung ke konten</a><UniversalNavbar key={pathname} role="caregiver" /><CaregiverSidebar /><div className={c.workspace}><div className={c.banner}><span><FlaskConical size={13} style={{ display: "inline", marginRight: 6 }} />Demo lokal · tanpa database{!persistent ? " · Penyimpanan tidak tersedia, data hanya bertahan di tab ini" : ""}</span><Link href="/beranda" onClick={() => update(s => ({ ...s, member: true }))}>Lihat dari sisi Orang Tua</Link></div><main id="konten-pengelola" tabIndex={-1} className={c.page}>{!hydrated ? <p role="status">Menyiapkan portal pengelola…</p> : !state.caregiver.enabled ? <div className={c.gate}><EmptyState title="Ruang pengelola daycare" description="Jelajahi pengajuan anak, catatan harian, ulasan, dan profil bisnis Kasih Bunda. Mode ini memakai data contoh di browser yang sama; tidak membuat akun nyata."><div className={p.row} style={{ justifyContent: "center" }}><button className={`${p.button} ${p.mint}`} onClick={() => update(s => ({ ...s, caregiver: { ...s.caregiver, enabled: true } }))}><Building2 size={17} />Coba mode demo Pengelola</button><LinkButton secondary href="/masuk?role=caregiver&lang=id">Masuk / daftar</LinkButton></div></EmptyState></div> : <>{!state.caregiver.seeded && <div className={p.notice} style={{ marginBottom: 24 }}><FlaskConical size={17} /><div><strong>Mulai dengan contoh pengasuhan</strong><p>Tambahkan satu anak aktif dan satu pengajuan menunggu, atau gunakan pengajuan Kasih Bunda dari demo Orang Tua.</p><button className={p.link} style={{ marginTop: 8 }} onClick={seed}>Tambahkan data contoh pengelola</button>{error && <p className={p.error} role="alert">{error}</p>}</div></div>}{children}</>}</main></div></div>;
}
