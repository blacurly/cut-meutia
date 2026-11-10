// Consent text shown before an enrollment is submitted. The server sends this
// exact version and wording to app_create_enrollment, so the browser cannot
// change what is recorded. Change the version whenever the wording changes.
export const ENROLLMENT_CONSENT = {
  version: "2026-11-v1",
  items: {
    service_terms: "Saya menyetujui ketentuan layanan daycare: harga, jadwal, pembatalan, dan penjemputan anak.",
    child_data_processing: "Saya mengizinkan daycare memproses identitas, kontak darurat, dan informasi kesehatan anak yang relevan selama pengasuhan berlangsung.",
  },
};

export const consentWording = () => Object.values(ENROLLMENT_CONSENT.items).join(" ");
