// Daycare document types a manager can upload for Admin verification.
// `criterion` is the Safety Score component a document is evidence for
// (legal 40, sop 25, staff 20, facility 15); null means it does not count.
// The database accepts any lowercase key, so adding a type here is enough.
export const DAYCARE_DOCUMENT_TYPES = [
  { value: "operational_license", label: "Izin operasional", criterion: "legal" },
  { value: "business_license", label: "Izin usaha (NIB) / registrasi usaha", criterion: "legal" },
  { value: "safety_sop", label: "SOP keselamatan & penjemputan", criterion: "sop" },
  { value: "staff_certificate", label: "Sertifikat pelatihan staf", criterion: "staff" },
  { value: "facility_inspection", label: "Laporan pemeriksaan fasilitas", criterion: "facility" },
  { value: "tax_document", label: "Dokumen pajak", criterion: null },
  { value: "insurance", label: "Asuransi", criterion: null },
  { value: "other", label: "Lainnya", criterion: null },
];

export const DAYCARE_DOCUMENT_TYPE_VALUES = DAYCARE_DOCUMENT_TYPES.map(type => type.value);

export function documentTypeLabel(value) {
  return DAYCARE_DOCUMENT_TYPES.find(type => type.value === value)?.label ?? value;
}
