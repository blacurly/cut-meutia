"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, EyeOff, FileCheck2, Search, ShieldCheck, Users } from "lucide-react";
import { roomImage } from "@/data/daycares";
import { filterDirectoryDaycares, parseDirectoryFilters } from "@/lib/daycare-directory";
import { requestApi } from "@/lib/api-client";
import { DaycareCard, DemoPhoto, LinkButton, Panel } from "./ParentUI";
import p from "./Parent.module.css";

// Public catalog from /api/daycare/list (no login needed).
function useDirectory() {
  const [state, setState] = useState({ daycares: [], loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    requestApi("/api/daycare/list", { signal: controller.signal })
      .then(daycares => setState({ daycares: Array.isArray(daycares) ? daycares : [], loading: false, error: "" }))
      .catch(error => { if (error.name !== "AbortError") setState({ daycares: [], loading: false, error: error.message || "Data daycare tidak dapat dimuat." }); });
    return () => controller.abort();
  }, []);
  return state;
}

function FeaturedDaycares({ directory }) {
  if (directory.loading) return <p className={p.notice} role="status">Memuat daycare…</p>;
  if (directory.error) return <p className={p.error} role="alert">Daycare belum dapat dimuat: {directory.error}</p>;
  const featured = filterDirectoryDaycares(parseDirectoryFilters(), directory.daycares).slice(0, 3);
  if (!featured.length) return <p className={p.muted}>Belum ada daycare di katalog.</p>;
  return <div className={p.grid}>{featured.map(daycare => <DaycareCard key={daycare.id} daycare={daycare} />)}</div>;
}

export default function PublicCatalog() {
  const [query, setQuery] = useState(""); const router = useRouter(); const directory = useDirectory();
  const provinceCount = new Set(directory.daycares.map(daycare => daycare.province).filter(Boolean)).size;
  return <div className={p.page}><section className={p.hero}><div><p className={p.eyebrow}><ShieldCheck size={16} />PENGASUHAN YANG BISA ANDA KENALI</p><h1>Tempat tumbuh yang tepat.<span>Hati yang lebih tenang.</span></h1><p className={p.subtitle}>Kenali daycare, bandingkan kualitas pengasuhannya, dan ikuti setiap langkah kecil si buah hati. Semua dimulai dari informasi yang transparan.</p><form className={p.quickSearch} onSubmit={e => { e.preventDefault(); router.push(`/pencarian?${new URLSearchParams({ q: query })}`); }}><label className="sr-only" htmlFor="catalog-search">Cari nama daycare atau kota</label><input id="catalog-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari daycare atau kota, mis. Gresik" maxLength={100} /><button className={`${p.button} ${p.mint}`} type="submit"><Search size={16} />Cari daycare</button></form><div className={p.trustRow}><span><CheckCircle2 size={15} />Legalitas transparan</span><span><ShieldCheck size={15} />Safety Score</span><span><EyeOff size={15} />Privasi anak</span></div></div><div className={p.heroVisual}><DemoPhoto src={roomImage} name="ruang bermain daycare" priority /><div className={p.heroCard}><p className={p.eyebrow}>KENALI SEBELUM MEMILIH</p><strong>Ruang aman untuk cerita besar mereka.</strong><p className={p.small}>{directory.daycares.length ? `${directory.daycares.length} daycare · ${provinceCount} provinsi · satu perjalanan pengasuhan` : "Satu perjalanan pengasuhan"}</p></div></div></section>
    <section><div className={p.header}><div><p className={p.eyebrow}>MULAI DARI PILIHAN TERDEKAT</p><h2 className={p.sectionTitle}>Kenali pilihan daycare</h2><p className={p.muted}>Daycare dengan informasi paling lengkap dari DKI Jakarta, Jawa Barat, dan Jawa Timur. Data berasal dari sumber publik dan belum diverifikasi tim Ayomi.</p></div><LinkButton secondary href="/pencarian">Lihat semua daycare<ArrowRight size={15} /></LinkButton></div><FeaturedDaycares directory={directory} /></section>
    <section id="fitur-keamanan" className={p.section}><p className={p.eyebrow}>INFORMASI UNTUK KEPUTUSAN YANG LEBIH TENANG</p><h2 className={p.sectionTitle}>Rasa aman, dibangun dari transparansi.</h2><div className={p.grid}>{[[FileCheck2, "Legalitas yang bisa ditinjau", "Lihat status dan contoh dokumen perizinan pada profil daycare."], [ShieldCheck, "AI Safety Score yang terurai", "Pahami contoh kontribusi legalitas, rasio pengasuh, dan fasilitas keselamatan."], [EyeOff, "Privasi dalam setiap cerita", "Logbook demo memakai ilustrasi tanpa identitas anak. Integrasi AI masking masih disiapkan."]].map(([Icon, title, description]) => <Panel key={title}><span className={p.featureIcon}><Icon size={22} /></span><h3 className={p.sectionTitle}>{title}</h3><p className={p.muted}>{description}</p></Panel>)}</div></section>
    <section id="cara-kerja" className={p.section}><div className={p.header}><div><p className={p.eyebrow}>LANGKAH SEDERHANA BERSAMA AYOMI</p><h2 className={p.sectionTitle}>Dari pencarian hingga cerita harian.</h2></div><LinkButton href="/beranda">Coba alur Orang Tua<ArrowRight size={16} /></LinkButton></div><div className={p.metrics}>{[["01", "Cari & bandingkan", "Pilih wilayah, fasilitas, dan anggaran."], ["02", "Ajukan pendaftaran", "Isi data anak dan pilih paket layanan."], ["03", "Pantau status", "Ikuti simulasi persetujuan pengelola."], ["04", "Ikuti tumbuh kembang", "Buka dashboard, logbook, dan pusat laporan."]].map(([step, title, text]) => <Panel key={step}><span className={p.eyebrow}>{step}</span><h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{title}</h3><p className={p.muted}>{text}</p></Panel>)}</div></section>
    <section id="tentang" className={p.section}><Panel><div className={p.scoreRow}><span className={p.featureIcon}><Users size={24} /></span><div><h2 className={p.sectionTitle}>Ayomi, teman perjalanan pengasuhan.</h2><p className={p.muted}>Ayomi dikembangkan untuk menghubungkan orang tua dan pengelola daycare melalui informasi yang jelas, pendaftaran yang terstruktur, dan catatan pengasuhan yang dapat ditinjau. Katalog daycare memakai data dari sumber publik; fitur lain masih berupa pratinjau dengan data contoh.</p></div></div></Panel></section>
  </div>;
}
