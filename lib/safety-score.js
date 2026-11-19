// Safety Score formula shared by the server, the Admin review page and the
// public daycare page. The database function app_admin_save_safety_score
// repeats the same formula and is the one whose result gets stored.
//   score = 40×legal + 25×sop + 20×staff + 15×facility
//   pass = 1, partial = 0.5, fail = 0; any "unknown" -> no score.
export const SAFETY_FORMULA_VERSION = "safety-v1-draft";

export const SAFETY_WEIGHTS = { legal: 40, sop: 25, staff: 20, facility: 15 };

export const SAFETY_CRITERIA = [
  { id: "legal", label: "Legalitas", weight: 40, rule: "Izin operasional dan registrasi usaha ada, masih berlaku, dan identitasnya cocok." },
  { id: "sop", label: "SOP keselamatan & penjemputan", weight: 25, rule: "Memuat penjemputan, keadaan darurat, kesehatan, pengawasan tidur, dan pelaporan insiden; belum lewat jadwal tinjauan." },
  { id: "staff", label: "Kesiapan staf", weight: 20, rule: "Semua pengasuh memiliki sertifikat pertolongan pertama yang masih berlaku." },
  { id: "facility", label: "Pemeriksaan fasilitas", weight: 15, rule: "Semua butir pemeriksaan sesuai dan hasil pemeriksaan masih berlaku." },
];

export const SAFETY_STATUSES = [
  { value: "pass", label: "Lulus" },
  { value: "partial", label: "Sebagian" },
  { value: "fail", label: "Tidak lulus" },
  { value: "unknown", label: "Belum diketahui" },
];

const STATUS_VALUE = { pass: 1, partial: 0.5, fail: 0 };

export const safetyStatusLabel = value => SAFETY_STATUSES.find(status => status.value === value)?.label ?? value;

// criteria: [{ id, status }] with every id once. Returns score (null when a
// component is unknown), coverage 0–1, and the blockers that hold publication.
export function scoreFromCriteria(criteria) {
  let score = 0;
  let coverage = 0;
  for (const item of criteria) {
    if (item.status === "unknown" || !(item.id in SAFETY_WEIGHTS)) continue;
    coverage += SAFETY_WEIGHTS[item.id];
    score += SAFETY_WEIGHTS[item.id] * (STATUS_VALUE[item.status] ?? 0);
  }
  const unknown = criteria.some(item => item.status === "unknown");
  const legal = criteria.find(item => item.id === "legal");
  const blockers = [
    ...(unknown ? ["INSUFFICIENT_VERIFIED_EVIDENCE"] : []),
    ...(legal?.status === "fail" || legal?.status === "partial" ? ["LEGAL_NOT_PASSED"] : []),
  ];
  return { score: unknown ? null : Math.round(score * 100) / 100, coverage: coverage / 100, blockers };
}
