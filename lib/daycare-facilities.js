// Canonical facility tags for the public daycare directory.
// The source dataset describes facilities as free text, so tags are derived
// with keyword rules. Shared by the seed builder (scripts/) and the UI.

export const FACILITY_TAGS = {
  cctv: "CCTV",
  ac: "Ruangan ber-AC",
  meals: "Makan & snack",
  daily_report: "Laporan harian",
  outdoor: "Area outdoor",
  infant: "Menerima bayi",
  health: "Pemantauan kesehatan",
  spa: "Baby spa / pijat",
  montessori: "Montessori",
  islamic: "Pembelajaran Islami",
  preschool: "Program prasekolah",
  bilingual: "Bilingual",
  extended_hours: "Layanan 24 jam",
};

const RULES = [
  ["cctv", /\bcctv\b/i],
  ["ac", /\bac\b|ber-ac|full ac/i],
  ["meals", /makan|katering|catering|snack|menu|asi perah/i],
  ["daily_report", /laporan|report|buku penghubung|dokumentasi foto|foto kegiatan|foto\/video/i],
  ["outdoor", /outdoor|halaman|garden|playground|lahan|tadabbur alam|field trip|outing/i],
  ["infant", /bayi|baby|infant|\b[23] bulan\b|3–12 bulan/i],
  ["health", /pemeriksaan|dokter|posyandu|penimbangan|berat (dan|&) tinggi|pemantauan berat|pengukuran (fisik|tumbuh)|ruang isolasi/i],
  ["spa", /\bspa\b|massage|pijat/i],
  ["montessori", /montessori/i],
  ["islamic", /islam|tahfidz|mengaji|iqra|ibadah|sholat|salat|keislaman|nilai-nilai islam/i],
  ["preschool", /preschool|playgroup|kelompok bermain|\btk\b|kindergarten|prasekolah|taman kanak/i],
  ["bilingual", /bilingual|english/i],
  ["extended_hours", /24 jam/i],
];

// "CCTV 24 Jam" means round-the-clock monitoring, not 24-hour care.
const NOT_EXTENDED_HOURS = /cctv\s*24 jam/gi;

export function deriveFacilityTags(text = "") {
  const source = String(text);
  return RULES.filter(([key, pattern]) => {
    if (key === "extended_hours") return pattern.test(source.replace(NOT_EXTENDED_HOURS, ""));
    return pattern.test(source);
  }).map(([key]) => key);
}

// Codes stored by partner daycares that are not catalog filter tags.
const EXTRA_LABELS = {
  play_while_learning: "Bermain sambil belajar",
  pembelajaran_awal: "Pembelajaran awal",
  aktivitas_kreatif: "Aktivitas kreatif",
};

export function facilityLabel(key) {
  if (FACILITY_TAGS[key] || EXTRA_LABELS[key]) return FACILITY_TAGS[key] || EXTRA_LABELS[key];
  // Unknown code (e.g. "snack_time") -> "Snack time"; free text stays as is.
  const text = String(key ?? "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
