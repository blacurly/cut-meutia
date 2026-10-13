import { ArrowRight, HeartHandshake, ShieldCheck, Search } from "lucide-react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProgressBarWithCard from "@/components/ui/ProgressBarWithCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8faf9]">
      <header className="border-b border-[#e2ebe8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-[#173b3f]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a9d8f] text-white"><HeartHandshake size={20} /></span>
            Ayomi
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#60706d] sm:flex">
            <a href="#cara-kerja" className="hover:text-[#264653]">Cara kerja</a>
            <a href="#keamanan" className="hover:text-[#264653]">Keamanan</a>
            <Button variant="secondary" size="sm">Masuk</Button>
          </nav>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.1fr_.9fr] md:items-center md:py-24">
        <div>
          <Badge variant="green">Pengasuhan aman dimulai dari sini</Badge>
          <h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight tracking-tight text-[#173b3f] md:text-6xl">
            Temukan daycare yang membuat hati lebih tenang.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#60706d]">
            Ayomi membantu orang tua memeriksa legalitas, keamanan, dan kualitas daycare secara transparan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button icon={<Search size={18} />}>Cari daycare</Button>
            <Button variant="ghost" icon={<ArrowRight size={18} />} iconPosition="right">Pelajari cara kerja</Button>
          </div>
        </div>
        <Card color="yellow" className="relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#f4c95d]/40" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#806000]">Contoh profil terverifikasi</p>
              <ShieldCheck className="text-[#2a9d8f]" />
            </div>
            <h2 className="mt-8 text-2xl font-bold text-[#173b3f]">Taman Ceria Gresik</h2>
            <p className="mt-1 text-sm text-[#60706d]">Gresik, Jawa Timur · 1,2 km</p>
            <div className="mt-6"><ProgressBarWithCard label="AI Safety Score" value={92} subtitle="Berdasarkan legalitas, rasio pengasuh, dan ulasan terverifikasi." /></div>
          </div>
        </Card>
      </section>
      <section id="keamanan" className="mx-auto max-w-6xl px-6 pb-16">
        <Banner type="ai" title="Dibangun untuk rasa aman" description="Setiap informasi dirancang agar orang tua dapat mengambil keputusan dengan data yang jelas dan dapat dipertanggungjawabkan." ctaText="Lihat standar keamanan" />
      </section>
    </main>
  );
}
