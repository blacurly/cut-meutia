"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import UniversalNavbar from "./UniversalNavbar";
import AdminSidebar from "./AdminNavigation";
import { useParentDemo } from "@/components/features/ParentDemoProvider";
import { EmptyState, LinkButton } from "@/components/features/ParentUI";
import c from "@/components/features/Caregiver.module.css";
import p from "@/components/features/Parent.module.css";

export default function AdminShell({children}){const {state,update,hydrated,persistent}=useParentDemo();const pathname=usePathname();return <div className={c.shell}><a className={c.skip} href="#konten-admin">Langsung ke konten</a><UniversalNavbar key={pathname} role="admin"/><AdminSidebar/><div className={c.workspace}><div className={c.banner}><span>Simulasi administrator · data contoh · tanpa tindakan pada layanan nyata{!persistent?" · Penyimpanan hanya di memori tab":""}</span><Link href="/pengelola">Portal Pengelola</Link></div><main className={c.page} id="konten-admin" tabIndex={-1}>{!hydrated?<p role="status">Menyiapkan portal administrator…</p>:!state.admin.enabled?<div className={c.gate}><EmptyState title="Pusat kendali administrator" description="Tinjau dokumen, jelajahi penanganan insiden, dan kelola status administrasi contoh. Mode ini terbuka untuk mencoba frontend; akun administrator produksi tetap memerlukan otorisasi server."><div className={p.row} style={{justifyContent:"center"}}><button className={`${p.button} ${p.mint}`} onClick={()=>update(s=>({...s,admin:{...s.admin,enabled:true}}))}><ShieldCheck size={16}/>Coba mode demo Administrator</button><LinkButton secondary href="/masuk?role=admin&lang=id">Masuk administrator</LinkButton></div></EmptyState></div>:children}</main></div></div>;}
