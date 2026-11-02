"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Info, X } from "lucide-react";
import UniversalNavbar from "./UniversalNavbar";
import CaregiverShell from "./CaregiverShell";
import AdminShell from "./AdminShell";
import { useParentDemo } from "@/components/features/ParentDemoProvider";
import { getDaycare } from "@/lib/parent";
import p from "@/components/features/Parent.module.css";
import s from "./ParentShell.module.css";

export default function ParentShell({children}) {
  const pathname=usePathname();const {state,update,persistent}=useParentDemo();
  if(pathname==="/admin"||pathname.startsWith("/admin/"))return <AdminShell>{children}</AdminShell>;
  if(pathname==="/pengelola"||pathname.startsWith("/pengelola/"))return <CaregiverShell>{children}</CaregiverShell>;
  if(["/welcome","/masuk","/daftar"].includes(pathname))return children;
  const hasTray=state.compare.length>0&&!pathname.startsWith("/bandingkan");
  return <><a className={s.skip} href="#konten-utama">Langsung ke konten</a><UniversalNavbar key={pathname}/><div className={s.demoBar}><Info size={13} aria-hidden="true"/><span>Pratinjau frontend · Data contoh, bukan layanan operasional{!persistent?" · Penyimpanan tidak tersedia; data hanya bertahan di tab ini":""}</span><Link href={state.member?"/profil":"/beranda"}>{state.member?"Kelola data demo":"Coba alur Orang Tua"}</Link></div><main id="konten-utama" tabIndex={-1} style={{minHeight:"70svh",paddingBottom:hasTray?95:0}}>{children}</main><footer className={s.footer}><div className={s.footerInner}><div><strong style={{color:"#264653"}}>Ayomi. Mengayomi sepenuh hati.</strong><p>Pengasuhan transparan, orang tua tenang.</p></div><div className={s.footerLinks}><Link href="/pencarian">Direktori</Link><Link href="/#cara-kerja">Cara kerja</Link><Link href="/#tentang">Tentang Ayomi</Link><Link href="/welcome">Pilihan portal</Link></div><span>Semua profil dan ilustrasi adalah contoh.</span></div></footer>{hasTray&&<aside className={s.tray} aria-label="Pilihan komparasi"><div><strong>{state.compare.length} dari 3 daycare dipilih</strong><div className={s.trayChips}>{state.compare.map(id=><button key={id} aria-label={`Hapus ${getDaycare(id)?.name} dari komparasi`} onClick={()=>update(v=>({...v,compare:v.compare.filter(key=>key!==id)}))}>{getDaycare(id)?.name}<X size={11}/></button>)}</div></div><Link href="/bandingkan/hasil" className={p.button}><ArrowLeftRight size={16}/>Bandingkan</Link></aside>}</>;
}
