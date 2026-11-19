"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileCheck2, Info, MapPin, ShieldCheck, Star, Users, Wallet } from "lucide-react";
import { SAFETY_CRITERIA, safetyStatusLabel } from "@/lib/safety-score";
import Tabs from "@/components/ui/Tabs";
import Modal from "@/components/ui/Modal";
import { FACILITY_TAGS } from "@/lib/daycare-facilities";
import { ageText, rupiah } from "@/lib/daycare-directory";
import { CompareButton, DaycarePhoto, LinkButton, ListingBadge, Panel } from "./ParentUI";
import p from "./Parent.module.css";

const STATUS_TONE = { pass: "", partial: p.amber, fail: p.red };
const dateId = value => (value ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
  .format(new Date(String(value).length === 10 ? `${value}T00:00:00+07:00` : value)) : null);

// Safety Score published by Ayomi Admin from verified documents. Hidden while
// any evidence has expired; catalog-only daycares are never scored.
function SafetyScorePanel({ safety, partner }) {
  const title = <h2 className={p.sectionTitle}><ShieldCheck size={17} style={{ display: "inline", marginRight: 6 }} />Safety Score</h2>;
  if (!safety?.current) {
    return <Panel>
      {title}
      <p className={p.muted}>{safety
        ? "Sedang ditinjau ulang karena sebagian dokumen bukti sudah kedaluwarsa atau diperbarui."
        : partner ? "Belum dinilai. Skor muncul setelah tim Ayomi memverifikasi dokumen legalitas, SOP, sertifikat staf, dan pemeriksaan fasilitas daycare ini."
          : "Belum dinilai. Safety Score hanya diberikan kepada daycare mitra Ayomi yang dokumennya sudah diverifikasi."}</p>
    </Panel>;
  }
  const score = Number(safety.score).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return <Panel>
    <div className={p.between}>
      {title}
      <span><strong className={p.price} style={{ fontSize: 30 }}>{score}</strong><span className={p.small}> / 100</span></span>
    </div>
    <ul className={p.stack} style={{ gap: 10, marginTop: 12 }}>
      {SAFETY_CRITERIA.map(criterion => {
        const item = safety.criteria?.find(entry => entry.id === criterion.id);
        return <li key={criterion.id}>
          <div className={p.between}><strong style={{ fontSize: 13 }}>{criterion.label} <span className={p.small}>· bobot {criterion.weight}</span></strong>
            {item && <span className={`${p.badge} ${STATUS_TONE[item.status] ?? p.neutral}`}>{safetyStatusLabel(item.status)}</span>}</div>
          {item?.reason && <p className={p.small}>{item.reason}</p>}
        </li>;
      })}
    </ul>
    <p className={p.notice} style={{ marginTop: 16 }}>
      Dinilai tim Ayomi dari dokumen yang sudah diverifikasi per {dateId(safety.as_of)}{safety.valid_until ? `; berlaku sampai ${dateId(safety.valid_until)}` : ""}.
      Skor menilai bukti pada tanggal tersebut, bukan sertifikasi keselamatan. Rubrik penilaian masih versi uji coba.
    </p>
  </Panel>;
}

const TABS = [
  { id: "summary", label: "Ringkasan" },
  { id: "facilities", label: "Fasilitas & Legalitas" },
  { id: "prices", label: "Biaya & Paket" },
];

function Estimate({ show }) {
  if (!show) return null;
  return <span className={`${p.badge} ${p.amber}`} title="Data sintetis untuk pengembangan, bukan informasi resmi daycare.">Estimasi</span>;
}

// Detail page for public catalog entries (daycare_listings) and partner
// daycares. Without approved photos the gallery shows shared example
// pictures, always labelled as illustrations.
export default function ListingDetail({ daycare }) {
  const [tab, setTab] = useState("summary");
  const [gallery, setGallery] = useState(null);
  const closeGallery = useCallback(() => setGallery(null), []);
  const estimated = Boolean(daycare.profile?.estimated);
  const images = daycare.gallery?.length ? daycare.gallery : [{ url: null, illustration: false }];
  const place = [daycare.address, daycare.district, daycare.city, daycare.province].filter(Boolean).join(", ");
  const listing = daycare.kind === "listing";
  const startingFee = daycare.monthlyFee ?? daycare.profile?.dailyFee ?? null;

  return <div className={p.page}>
    <nav className={p.breadcrumbs} aria-label="Breadcrumb"><Link href="/pencarian"><ArrowLeft size={13} style={{ display: "inline" }} /> Direktori daycare</Link><span>/</span><span>{daycare.name}</span></nav>
    <div className={p.gallery}>{images.slice(0, 2).map((image, index) => image.url
      ? <button key={image.url} onClick={() => setGallery(index)} aria-label={`Buka gambar ${index + 1} ${daycare.name}`}><DaycarePhoto url={image.url} illustration={image.illustration} name={daycare.name} priority={index === 0} /></button>
      : <DaycarePhoto key="placeholder" url={null} name={daycare.name} />)}</div>
    {images[0]?.illustration && <p className={p.small} style={{ marginTop: 8 }}><Info size={12} style={{ display: "inline", marginRight: 4 }} />Gambar adalah ilustrasi, bukan foto {daycare.name}. Foto asli ditampilkan setelah pengelola mengunggah dan disetujui Admin.</p>}

    <div className={p.header}>
      <div>
        <div className={p.row} style={{ marginBottom: 12 }}>{daycare.acceptsEnrollment && <span className={p.badge}><CheckCircle2 size={12} />Mitra Ayomi</span>}<ListingBadge daycare={daycare} />{listing && !daycare.acceptsEnrollment && <span className={`${p.badge} ${p.neutral}`}>Belum bergabung dengan Ayomi</span>}</div>
        <h1 className={p.title}>{daycare.name}</h1>
        <p className={p.subtitle}><MapPin size={15} style={{ display: "inline" }} /> {place}</p>
      </div>
      <CompareButton daycare={daycare} />
    </div>

    <div className={p.twoColumns}>
      <section>
        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} label="Informasi daycare" idPrefix="listing-tab" panelId="listing-content" />
        <div id="listing-content" role="tabpanel" aria-labelledby={`listing-tab-${tab}`} className={p.tabContent}>
          {tab === "summary" && <div className={p.stack}>
            <SafetyScorePanel safety={daycare.safetyScore} partner={!listing || daycare.acceptsEnrollment} />
            <Panel>
              <h2 className={p.sectionTitle}>Tentang daycare</h2>
              <p className={p.muted}>{daycare.description || "Deskripsi belum tersedia."}</p>
              {daycare.ageMinMonths != null && <div className={p.row} style={{ marginTop: 18 }}>
                <span className={`${p.badge} ${p.neutral}`}>Usia {ageText(daycare.ageMinMonths)} – {ageText(daycare.ageMaxMonths)}</span>
                {daycare.profile && <span className={`${p.badge} ${p.neutral}`}><Clock size={12} />{daycare.profile.operatingDays}, {daycare.profile.hours}</span>}
                <Estimate show={estimated} />
              </div>}
            </Panel>
            <Panel>
              <h2 className={p.sectionTitle}>Pengasuhan</h2>
              <div className={p.two}>
                <p className={p.muted}><Users size={15} style={{ display: "inline" }} /> {daycare.ratio == null ? "Rasio pengasuh belum tersedia" : `1 pengasuh : ${daycare.ratio} anak`}</p>
                <p className={p.muted}>{daycare.capacity == null ? "Kapasitas belum tersedia" : `Kapasitas ${daycare.capacity} anak per hari`}</p>
                {daycare.profile?.caregiverCount != null && <p className={p.muted}>{daycare.profile.caregiverCount} pengasuh</p>}
                {listing && <p className={p.muted}><Star size={15} style={{ display: "inline" }} /> {daycare.rating == null ? "Belum ada rating publik" : `${daycare.rating.toLocaleString("id-ID", { minimumFractionDigits: 1 })} / 5 · rating publik daring`}</p>}
              </div>
              {estimated && <p className={p.notice} style={{ marginTop: 16 }}>Rasio, kapasitas, usia, dan jam operasional adalah estimasi dari data sintetis untuk pengembangan. Konfirmasi langsung ke daycare sebelum memutuskan.</p>}
            </Panel>
          </div>}

          {tab === "facilities" && <div className={p.stack}>
            <Panel>
              <h2 className={p.sectionTitle}>Fasilitas yang tercatat</h2>
              <div className={p.two}>{Object.entries(FACILITY_TAGS).map(([key, label]) => <p key={key} className={p.row} style={{ fontSize: 12, color: daycare.facilities.includes(key) ? "#237e73" : "#94a3b8" }}><CheckCircle2 size={16} />{label}{!daycare.facilities.includes(key) && " · tidak tercatat"}</p>)}</div>
              {daycare.facilitiesText && <p className={p.small} style={{ marginTop: 16 }}>Dari sumber publik: {daycare.facilitiesText}</p>}
            </Panel>
            {listing && <Panel>
              <h2 className={p.sectionTitle}><FileCheck2 size={17} style={{ display: "inline", marginRight: 6 }} />Legalitas</h2>
              <p className={p.muted}>{daycare.legalReference || "Nomor izin atau NPSN belum tercantum di sumber data."}</p>
              {daycare.legalReferenceUrl && <a className={p.link} href={daycare.legalReferenceUrl} target="_blank" rel="noopener noreferrer">Cek di sumber resmi<ArrowRight size={13} /></a>}
              {daycare.dataNotes?.length > 0 && <ul className={`${p.detailList} ${p.small}`} style={{ marginTop: 12 }}>{daycare.dataNotes.map(note => <li key={note}>{note}</li>)}</ul>}
              <p className={p.notice} style={{ marginTop: 16 }}>Status ini menggambarkan bukti di sumber data publik, bukan hasil verifikasi tim Ayomi.</p>
            </Panel>}
          </div>}

          {tab === "prices" && <div className={p.stack}>
            {daycare.profile?.packages?.length ? daycare.profile.packages.map(pack => <Panel key={pack.code || pack.name}>
              <div className={p.between}>
                <div><h2 className={p.sectionTitle}>{pack.name}</h2>{pack.hours && <p className={p.muted}>{pack.hours} WIB</p>}</div>
                <div><strong className={p.price}>{rupiah(pack.price)}</strong><span className={p.small}> / {pack.unit}</span></div>
              </div>
            </Panel>) : <Panel><p className={p.muted}>Biaya belum tersedia.</p></Panel>}
            {daycare.profile?.registrationFee != null && <Panel><p className={p.muted}>Biaya pendaftaran: <strong>{rupiah(daycare.profile.registrationFee)}</strong></p></Panel>}
            {estimated && <p className={p.notice}>Semua harga di halaman ini adalah estimasi dari data sintetis, bukan tarif resmi daycare.</p>}
          </div>}
        </div>
      </section>

      <Panel className={p.sideCard}>
        <p className={p.eyebrow}>RINGKASAN BIAYA</p>
        {startingFee == null ? <p className={p.muted}>Biaya belum tersedia.</p> : <>
          <p className={p.small}>Mulai dari</p>
          <strong className={p.price} style={{ fontSize: 28 }}>{rupiah(startingFee)}</strong><span className={p.small}> / {daycare.monthlyFee == null ? "hari" : "bulan"}</span>
          <div style={{ marginTop: 8 }}><Estimate show={estimated} /></div>
        </>}
        <div className={p.stack} style={{ marginBlock: 22, gap: 12 }}>
          {daycare.ratio != null && <p className={p.muted}><Users size={15} style={{ display: "inline" }} /> 1 pengasuh : {daycare.ratio} anak</p>}
          {daycare.profile?.dailyFee != null && <p className={p.muted}><Wallet size={15} style={{ display: "inline" }} /> Harian {rupiah(daycare.profile.dailyFee)}</p>}
        </div>
        {listing && !daycare.acceptsEnrollment
          ? <button disabled className={`${p.button} ${p.full}`}>Belum menerima pendaftaran online</button>
          : <LinkButton className={`${p.mint} ${p.full}`} href={`/pendaftaran-anak?daycare=${listing ? daycare.claimedDaycareId : daycare.id}`}>Daftarkan anak<ArrowRight size={16} /></LinkButton>}
        <p className={p.small} style={{ marginTop: 14 }}>{listing && !daycare.acceptsEnrollment ? "Pendaftaran online tersedia setelah daycare bergabung sebagai mitra Ayomi." : "Pengajuan diproses oleh pengelola daycare."}</p>
        <LinkButton secondary className={p.full} href="/bandingkan" style={{ marginTop: 12 }}>Lihat perbandingan</LinkButton>
      </Panel>
    </div>

    <Modal open={gallery !== null} onClose={closeGallery} title={`Galeri ${daycare.name}`} size="lg">
      {gallery !== null && images[gallery]?.url && <DaycarePhoto url={images[gallery].url} illustration={images[gallery].illustration} name={daycare.name} />}
      <div className={p.row} style={{ marginTop: 15 }}>{images.filter(image => image.url).map((image, index) => <button key={image.url} className={`${p.button} ${index === gallery ? "" : p.secondary}`} onClick={() => setGallery(index)}>{image.illustration ? "Ilustrasi" : "Foto"} {index + 1}</button>)}</div>
    </Modal>
  </div>;
}
