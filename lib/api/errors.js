import { ApiError } from "./http.js";

// Every error code raised by the Ayomi RPCs (supabase/migrations) mapped to an
// HTTP status and a user-facing Indonesian message. "*_not_owned" codes map to
// 404 so the API never confirms that someone else's record exists.
export const RPC_ERRORS = {
  // Auth & accounts
  not_authenticated: [401, "Sesi login berakhir. Masuk kembali lalu coba lagi."],
  parent_account_not_active: [403, "Fitur ini hanya tersedia untuk akun Orang Tua yang aktif."],
  role_not_allowed: [403, "Akun Anda tidak memiliki akses ke fitur ini."],
  invalid_parent_name: [400, "Nama harus terdiri dari 2 sampai 100 karakter."],
  invalid_parent_phone: [400, "Masukkan nomor WhatsApp Indonesia yang valid."],
  // Children
  child_not_owned: [404, "Profil anak tidak ditemukan."],
  invalid_child_name: [400, "Nama anak harus terdiri dari 2 sampai 80 karakter."],
  invalid_child_birth_date: [400, "Masukkan tanggal lahir yang valid dan tidak berada di masa depan."],
  invalid_child_fields: [400, "Data anak tidak valid."],
  child_has_enrollment_history: [409, "Profil anak yang sudah memiliki riwayat pendaftaran tidak dapat dihapus."],
  health_text_too_long: [400, "Setiap catatan kesehatan maksimal 4.000 karakter dan alasan maksimal 500 karakter."],
  health_history_not_recorded: [500, "Riwayat perubahan kesehatan gagal dicatat. Coba lagi beberapa saat."],
  invalid_expire_limit: [400, "Batas pemrosesan tidak valid."],
  // Enrollment & payment
  invalid_service_date: [400, "Tanggal layanan tidak boleh berada di masa lalu."],
  invalid_consent: [400, "Persetujuan pengasuhan wajib disetujui."],
  offering_not_available: [400, "Layanan daycare tidak tersedia."],
  daycare_not_available: [400, "Daycare belum menerima pendaftaran."],
  published_price_not_available: [409, "Harga layanan belum dipublikasikan."],
  child_age_out_of_range: [400, "Usia anak di luar rentang layanan ini."],
  duplicate_active_enrollment: [409, "Anak sudah memiliki pengajuan aktif pada tanggal tersebut."],
  child_has_active_enrollment: [409, "Anak masih memiliki pengasuhan atau pembayaran aktif lainnya."],
  invalid_enrollment_decision: [400, "Keputusan harus diterima atau ditolak."],
  decision_reason_required: [400, "Tuliskan alasan keputusan minimal 5 karakter."],
  manager_scope_required: [403, "Hanya pengelola daycare terkait yang dapat melakukan tindakan ini."],
  enrollment_already_decided: [409, "Pengajuan ini sudah diputuskan."],
  daycare_capacity_full: [409, "Kapasitas daycare pada tanggal tersebut sudah penuh."],
  enrollment_price_not_available: [409, "Harga pengajuan tidak lagi tersedia."],
  enrollment_not_owned: [404, "Pengajuan tidak ditemukan."],
  enrollment_not_found: [404, "Pengajuan tidak ditemukan."],
  enrollment_cannot_be_cancelled: [409, "Pengajuan hanya dapat dibatalkan selama menunggu keputusan."],
  enrollment_not_approved: [409, "Pengajuan belum aktif."],
  enrollment_cannot_check_in: [409, "Check-in hanya dapat dilakukan pada hari layanan untuk pengajuan aktif."],
  enrollment_cannot_complete: [409, "Pengasuhan belum dapat diselesaikan."],
  invalid_payment_request: [400, "Permintaan pembayaran tidak valid."],
  charge_not_payable: [409, "Tagihan tidak dapat dibayar."],
  charge_not_owned: [404, "Tagihan tidak ditemukan."],
  admin_payment_result_required: [403, "Hanya Admin yang dapat mencatat hasil pembayaran."],
  transaction_already_final: [409, "Transaksi sudah final."],
  payment_state_mismatch: [409, "Status pembayaran tidak sesuai; perlu peninjauan Admin."],
  invalid_assignment_period: [400, "Periode penugasan tidak valid."],
  caregiver_not_active_member: [400, "Pengasuh bukan anggota aktif daycare ini."],
  assignment_period_overlaps: [409, "Periode penugasan bertabrakan dengan penugasan lain."],
  // Logbook & notifications
  invalid_activity_type_or_status: [400, "Jenis atau status aktivitas tidak valid."],
  invalid_activity_time: [400, "Waktu aktivitas tidak valid."],
  invalid_activity_content: [400, "Judul 3–100 karakter dan isi 20–2.000 karakter."],
  urgent_reason_required: [400, "Catatan penting wajib disertai alasan."],
  active_caregiver_assignment_required: [403, "Hanya pengasuh yang sedang ditugaskan yang dapat menulis catatan."],
  report_date_outside_service: [400, "Tanggal catatan harus sama dengan tanggal layanan."],
  activity_not_owned: [404, "Catatan aktivitas tidak ditemukan."],
  activity_not_found: [404, "Catatan aktivitas tidak ditemukan."],
  sent_activity_is_immutable: [409, "Catatan yang sudah terkirim tidak dapat diubah atau dihapus."],
  change_reason_required: [400, "Tuliskan alasan perubahan minimal 5 karakter."],
  invalid_ack_type: [400, "Jenis konfirmasi tidak valid."],
  acknowledgement_not_allowed: [403, "Anda tidak dapat mengonfirmasi catatan ini."],
  notification_not_owned: [404, "Notifikasi tidak ditemukan."],
  // Logbook reactions & comments
  invalid_reaction_state: [400, "Status tanda suka harus true atau false."],
  reaction_not_allowed: [403, "Tanda suka hanya dapat diberikan oleh orang tua anak."],
  invalid_comment_body: [400, "Komentar harus 1–1.000 karakter."],
  invalid_request_id: [400, "Idempotency-Key tidak valid atau sudah dipakai untuk catatan lain."],
  comment_not_found: [404, "Komentar tidak ditemukan."],
  comment_delete_not_allowed: [403, "Hanya penulis komentar yang dapat menghapusnya."],
  // Incidents
  invalid_incident: [400, "Lengkapi deskripsi (20–4.000 karakter), pertolongan pertama, tingkat urgensi, dan alasannya."],
  incident_enrollment_not_active: [409, "Laporan hanya dapat dibuat untuk pengasuhan yang aktif atau selesai."],
  incident_scope_required: [403, "Anda tidak terkait dengan pengasuhan ini."],
  invalid_incident_status_update: [400, "Status tidak valid atau alasan kurang dari 10 karakter."],
  incident_not_found: [404, "Laporan insiden tidak ditemukan."],
  incident_review_scope_required: [403, "Hanya pengelola daycare terkait atau Admin yang dapat memperbarui status."],
  incident_transition_not_allowed: [409, "Perubahan status laporan tidak diizinkan."],
  incident_not_owned: [404, "Laporan insiden tidak ditemukan."],
  // Reviews
  invalid_review: [400, "Pilih rating 1–5 dan tulis ulasan 20–2.000 karakter."],
  completed_enrollment_required: [403, "Ulasan hanya dapat ditulis setelah pengasuhan selesai."],
  review_already_exists: [409, "Anda sudah menulis ulasan untuk daycare ini."],
  admin_review_decision_required: [403, "Hanya Admin yang dapat memoderasi ulasan."],
  review_version_not_pending: [409, "Ulasan ini sudah dimoderasi."],
  invalid_review_reply: [400, "Balasan harus 10–2.000 karakter."],
  manager_review_scope_required: [403, "Hanya pengelola daycare terkait yang dapat membalas ulasan yang sudah terbit."],
  admin_reply_decision_required: [403, "Hanya Admin yang dapat memoderasi balasan."],
  reply_version_not_pending: [409, "Balasan ini sudah dimoderasi."],
  review_not_owned_or_withdrawn: [404, "Ulasan tidak ditemukan atau sudah ditarik."],
  withdraw_reason_required: [400, "Tuliskan alasan penarikan minimal 5 karakter."],
};

export function reject(code) {
  const [status, message] = RPC_ERRORS[code];
  throw new ApiError(status, code, message);
}

// Unwraps a Supabase result. Known RPC codes become their HTTP error; anything
// else is a generic 500 so database details never reach the client.
export function databaseData({ data, error }) {
  if (error) {
    if (Object.hasOwn(RPC_ERRORS, error.message)) reject(error.message);
    throw new ApiError(500, "database_error", "Data belum dapat diproses. Coba lagi beberapa saat.");
  }
  return data;
}
