# Checklist status proyek Ayomi

Status per **16 November 2026**. `main` = `feature/non-ai-api-routes` = `cb29b56`, berisi semua commit Annisa sampai `35cce50` (*seed active demo daycare accounts*) ditambah perbaikan pemetaan error.

Legenda:
- ✅ **Selesai**: berjalan dengan data nyata (Supabase/API) dan sudah diuji.
- 🟡 **Sebagian**: sudah ada, tetapi masih demo, belum tersambung, atau belum diterapkan.
- ⬜ **Belum**: belum dibuat.

## 1. Ringkasan

| Area | ✅ | 🟡 | ⬜ | Keterangan |
| --- | --- | --- | --- | --- |
| Backend non-AI (API + RPC) | 21 | 0 | 0 | Ditambah 17 Nov: daftar tugas Pengasuh (`/api/me/assignments`), antrean pembayaran Admin (`/api/admin/transactions`), QR pembayaran QRIS. **Migrasi `20261116100000` belum diterapkan** |
| Frontend Orang Tua | 13 | 0 | 0 | Semua halaman memakai API (17 Nov): dashboard, pendaftaran, status + pembayaran QR, logbook (foto, love, komentar), laporan + komplain, notifikasi, ulasan, profil |
| Frontend Pengelola/Pengasuh | 11 | 0 | 0 | Semua halaman memakai API (17 Nov): dashboard, pendaftaran, logbook + foto & tinjauan, insiden, ulasan, staf & undangan, dokumen, profil & layanan |
| Frontend Admin | 4 | 0 | 0 | Semua halaman memakai API (17 Nov): overview + konfirmasi pembayaran + moderasi, mitra, verifikasi, insiden & komplain |
| AI | 3 | 3 | 4 | Kerangka API siap; Foto Fokus Anak sudah bisa dicoba di aplikasi; Incident Triage memakai data sintetis |

**Kesimpulan (17 Nov):** mode demo sudah dihapus. Semua portal (Orang Tua, Pengelola, Pengasuh, Admin) membaca dan menulis data lewat API dan Supabase, dengan akses berdasarkan peran akun. Yang perlu dilakukan sebelum dipakai:
1. Jalankan migrasi `20261116100000_caregiver_assignments_payment_queue.sql` di Supabase SQL Editor.
2. Uji alur lengkap dengan akun sungguhan (bagian "Uji sebelum deadline").
3. Lanjutkan fitur AI utama (Logbook Drafter) dan perbaikan model Foto Fokus Anak.

## 2. Status branch

Dicek 16 November 2026. Semua branch remote sudah tercakup di `main`.

| Branch (remote) | Commit terakhir | Status |
| --- | --- | --- |
| `main` | `cb29b56` (16 Nov) | ✅ Sama dengan `feature/non-ai-api-routes`. Vercel men-deploy dari sini |
| `feature/non-ai-api-routes` | `cb29b56` (16 Nov) | ✅ Branch kerja bersama (Annisa + taworld-star) |
| `development`, `ayomi-db-backend`, `ayomi-db-backend-review-fix`, `fix/parent-api-children-id`, `fix/non-ai-enrollment-guards`, `feature/daycare-dataset-3-provinsi` | 7–10 Nov | Sudah tercakup di `main`; boleh dihapus setelah tim setuju |

**Riwayat keputusan:**
- **12 Nov:** onboarding mitra memakai versi Annisa (migrasi 043–060, aktif di live). Versi lama kita ada di branch lokal `backup/wip-20261112`.
- **16 Nov:** lampiran foto logbook dan bukti insiden memakai versi Annisa (`20261114093328_logbook_incident_media`, aktif di live). Draf kita (migrasi 061) ada di branch lokal `feature/laporan-harian-instan`. **Migrasi 061 jangan dijalankan**, karena menimpa fungsi dengan nama yang sama.

**Commit 16 Nov (`cb29b56`):**
- 7 kode error dari migrasi yang sebelumnya keluar sebagai 500 umum kini dipetakan (`delegation_not_found`, `admin_action_audit_missing`, `invalid_activity_photo`, `invalid_photo_review`, `photo_variant_not_found`, `photo_review_scope_required`, `invalid_incident_evidence`).
- Test pemetaan error kini juga membaca penulisan `MESSAGE='...'` tanpa spasi.
- `supabase/.temp/` (state lokal Supabase CLI) tidak lagi ikut di git.

**Verifikasi 16 Nov:** `node --test` 124/124 lulus, lint `app`/`components`/`lib` bersih, `next build` berhasil.

**Yang perlu dilakukan:**
- Annisa: jalankan `git pull` di `main` dan `feature/non-ai-api-routes`.
- Bersihkan worktree sementara (`AppData/Local/Temp/vscode-agent-codex-sandbox-*`) dengan `git worktree prune`, lalu hapus branch lokal lama yang tidak dipakai.

## 3. Backend non-AI

Detail endpoint ada di [api.md](./api.md).

| Modul | Endpoint utama | Status |
| --- | --- | --- |
| Autentikasi & akun | `/api/auth/*`, `/auth/callback`, `/api/me`, `/api/me/daycares` | ✅ |
| Katalog publik | `/api/daycares`, `/{id}`, `/compare`, `/{id}/photos`. Mitra aktif dibaca lewat RPC publik (`app_list_public_daycares`) | ✅ |
| Anak, kesehatan, izin penjemput | `/api/children/*`, `/api/children/{id}/pickup-authorizations` | ✅ |
| Pendaftaran & pembayaran manual | `/api/enrollments/*`, `/payments`, `/pickup`, `/api/admin/transactions/{id}` | ✅ |
| Logbook, love, komentar, foto | `/api/enrollments/{id}/activities`, `/api/activities/{id}/*`, `/api/activities/{id}/photos` (unggah + Foto Fokus Anak), `/photos/{variantId}` (tinjau) | ✅ (uji akun sungguhan belum) |
| Insiden dan lampiran bukti | `/api/incidents/*`, `/api/incidents/{id}/evidence` | ✅ (uji akun sungguhan belum) |
| Ulasan & moderasi manual | `/api/reviews/*`, `/api/admin/moderation` | ✅ |
| Notifikasi | `/api/notifications/*` | ✅ |
| Onboarding mitra (Annisa) | `/api/admin/partners`, `/api/me/daycares/{id}/{onboarding,profile,offerings,documents,photos,staff,delegations}`, `/api/admin/{prices,documents,daycare-documents,photos,staff}` | ✅ |
| Undangan staf | `POST /api/invitations/accept` + halaman `/undangan#<token>` | ✅ |
| Komplain, investigasi, sanksi (Annisa) | `/api/complaints/*`, `/api/admin/{complaints,investigations,sanctions}/*` | ✅ |

### Perlu perbaikan di backend

| # | Masalah | Tindakan |
| --- | --- | --- |
| B1 | Snapshot skema belum memuat migrasi 043–060 dan media 20261114 (sama dengan D3) | Dump ulang snapshot dari database live |
| B2 | Policy `daycares_specific_user_read` di database live | ✅ Sudah tidak ada saat dicek 14 November; katalog memakai RPC publik |
| B3 | Password database pernah dibagikan | Ganti password database di dashboard Supabase |
| B4 | Rate limit AI disimpan per instance server | Pindahkan ke tabel database atau KV saat AI dipakai di produksi |
| B5 | 7 kode error RPC tanpa pemetaan HTTP (keluar sebagai 500) | ✅ Diperbaiki 16 Nov (`cb29b56`) |

### Uji sebelum deadline backend (belum dilakukan)

Pakai akun demo dari `scripts/import-demo-daycare-accounts.mjs`. API Foto Fokus Anak harus menyala, dan `CV_API_URL`/`CV_API_TOKEN` harus terisi.

- [ ] Pengasuh: buat catatan draf → unggah foto → tinjau versi fokus (`ready`) → kirim catatan
- [ ] Orang Tua: buka catatan yang sudah dikirim. Hanya versi fokus anaknya yang tampil; foto asli tidak bisa dibuka
- [ ] Setelah versi fokus disetujui, foto asli terhapus dari `logbook-originals`
- [ ] Bukti insiden: unggah satu foto dan satu PDF, lalu buka dari akun Orang Tua dan Pengelola
- [ ] Vercel: `/pencarian` menampilkan daftar daycare (variabel Supabase benar)

## 4. Frontend Orang Tua

Semua halaman memakai sesi Supabase dan API. Halaman yang butuh login menampilkan ajakan masuk untuk pengunjung, dan pesan "bukan untuk akun Anda" untuk peran lain.

| Halaman | Rute | Status | API |
| --- | --- | --- | --- |
| Navbar | semua halaman | ✅ | Sesi Supabase, `/api/notifications` |
| Welcome, masuk, daftar, atur ulang sandi | `/welcome`, `/masuk`, `/daftar`, `/atur-ulang-sandi` | ✅ | Supabase Auth |
| Katalog & pencarian | `/`, `/pencarian` | ✅ | `/api/daycares` |
| Detail daycare | `/detail/[id]` | ✅ | `/api/daycares/{id}`. Profil daycare fiktif dihapus |
| Komparasi | `/bandingkan`, `/bandingkan/hasil` | ✅ | `/api/daycares/compare` |
| Dashboard | `/beranda` | ✅ | `/api/enrollments`, `/api/notifications` |
| Form pendaftaran anak | `/pendaftaran-anak?daycare=` | ✅ | `/api/children`, `/api/daycares/{id}/offerings`, `POST /api/enrollments` |
| Status pendaftaran + pembayaran | `/status-pendaftaran` | ✅ | `/api/enrollments`, `DELETE` (batal), `POST …/payments` (QR QRIS) |
| Logbook harian | `/catatan-harian` | ✅ | `…/activities`, `/photos`, `/love`, `/comments`, `/acknowledgements` |
| Laporan insiden & komplain | `/laporan` | ✅ | `/api/incidents`, `/api/complaints` |
| Notifikasi | `/notifikasi` | ✅ | `/api/notifications` |
| Ulasan | `/ulasan` | ✅ | `POST /api/reviews` |
| Profil & anak | `/profil` | ✅ | `/api/me`, `/api/children`, `/health` |

## 5. Frontend Pengelola/Pengasuh dan Admin

Portal staf hanya terbuka untuk akun dengan peran yang sesuai. Daycare diambil dari `/api/me/daycares`. Menu Pengelola dan Pengasuh berbeda.

| Halaman | Rute | Peran | Status | API |
| --- | --- | --- | --- | --- |
| Dashboard | `/pengelola` | Pengelola, Pengasuh | ✅ | `/api/enrollments?daycare_id=`, `/api/incidents`, `/api/me/assignments` |
| Kelola pendaftaran | `/pengelola/pendaftaran` | Pengelola | ✅ | `PATCH /api/enrollments/{id}` (terima/tolak, tugaskan, check-in, selesai) |
| Logbook harian | `/pengelola/laporan-harian` | Keduanya | ✅ | `…/activities`, unggah foto + Foto Fokus Anak, tinjau varian, kirim |
| Tulis catatan | `/pengelola/laporan-harian/tambah` | Pengasuh | ✅ | `POST …/activities` |
| Laporan insiden | `/pengelola/insiden` (baru) | Keduanya | ✅ | `POST /api/incidents`; Pengelola juga mengubah status |
| Ulasan & balasan | `/pengelola/ulasan` | Pengelola | ✅ | `/api/daycares/{id}/reviews`, `/reply` |
| Staf & undangan | `/pengelola/staf` (baru) | Pengelola | ✅ | `/staff`, `/staff/invitations` (tautan `/undangan#token`) |
| Dokumen legalitas | `/pengelola/dokumen` | Pengelola | ✅ | `/documents`, `/api/daycare-documents/{id}/file` |
| Profil bisnis + layanan | `/pengelola/profil`, `/edit` | Pengelola | ✅ | `/onboarding`, `/profile`, `/offerings` |
| Uji Foto Fokus | `/pengelola/foto-fokus` | Keduanya | ✅ | `/api/ai/focus/*` |
| Undangan staf | `/undangan` | Calon staf | ✅ | `POST /api/invitations/accept` |
| Overview + pembayaran + moderasi | `/admin` | Admin | ✅ | `/api/admin/transactions`, `/api/admin/moderation`, antrean |
| Daycare mitra | `/admin/daycare` | Admin | ✅ | `/api/admin/partners` (buat + tautan undangan, ubah status) |
| Verifikasi | `/admin/verifikasi-legal` | Admin | ✅ | `/api/admin/{daycare-documents,prices,photos,staff}` |
| Insiden & komplain | `/admin/insiden` | Admin | ✅ | `/api/incidents`, `/api/admin/complaints` |

Belum ada UI untuk: delegasi Pengelola ke Pengasuh, penjemputan anak (`/pickup`), izin penjemput Orang Tua, investigasi dan sanksi Admin, serta lampiran bukti komplain/insiden. API untuk semuanya sudah tersedia.

## 6. AI

Prioritas bisnis: **(1) Laporan Harian Instan** (Foto Fokus Anak + Logbook Drafter), **(2) Safety Score + bantuan OCR**, **(3) Incident Triage**, **(4) ringkasan ulasan / Smart Reply**.

| Item | Status | Catatan |
| --- | --- | --- |
| Kerangka API AI (`lib/ai`, `/api/ai/features`, `/api/ai/sandbox/{feature}`) | ✅ | 8 fitur, validasi kontrak, retry, rate limit |
| Foto Fokus Anak: model tahap 1 + API | ✅ | Model `ayomi-focus-segmenter` (HF privat). API berjalan lokal; hosting di Oracle Cloud belum (panduan sudah ada) |
| Foto Fokus Anak: route & halaman uji coba | ✅ | `/api/ai/focus/{segment,render}`, `/pengelola/foto-fokus` |
| Foto Fokus Anak: kualitas model | 🟡 | Kelas dewasa lemah dan ada label kembar di data; notebook sudah diperbaiki, perlu training ulang |
| Foto Fokus Anak di logbook: backend | ✅ | Unggah foto memanggil `/render`, menyimpan varian per anak, dan menunggu tinjauan staf (Annisa, 14 Nov) |
| Foto Fokus Anak di logbook: form Pengasuh | ⬜ | Form `/pengelola/laporan-harian/tambah` masih demo; sambungkan ke `/api/activities/{id}/photos` |
| Logbook Drafter | ⬜ | Model bahasa open source lewat adapter `openai-compatible` |
| Incident Urgency Triage | 🟡 | **Keputusan: data sintetis saja.** Notebook dan [panduan](./panduan-incident-triage.md) siap; integrasi ke alur insiden belum |
| Safety Score & Legal Verification | 🟡 | Notebook eksperimen ada; belum tersambung ke dokumen di onboarding Annisa |
| Persistensi `ai_jobs` dan endpoint produksi | ⬜ | Saat ini hanya sandbox Admin dan route Foto Fokus |
| Smart Reply, ringkasan ulasan, moderasi AI | ⬜ | Belakangan |

### Perlu perbaikan di AI

| # | Masalah | Tindakan |
| --- | --- | --- |
| A1 | Kontrak `privacy_masking` masih memakai kebijakan `all_faces` | Ganti ke `focus_target`: poligon, satu varian per anak |
| A2 | CHECK `ai_jobs` untuk `review_summary` tidak sesuai kontrak | Selaraskan lewat migrasi sebelum dipakai |
| A3 | Hugging Face Space Docker kini butuh PRO | API CV di-host di Oracle Cloud (Always Free) |
| A4 | Triage hanya diuji dengan data sintetis | Laporkan sebagai batasan; angka evaluasi bukan akurasi di dunia nyata |

## Status database per 16 November 2026

| Item | Status saat ini | Tindak lanjut |
| --- | --- | --- |
| D1 — lampiran foto logbook dan bukti insiden | ✅ API dan migration `20261114093328_logbook_incident_media` serta `20261114101228_delete_reviewed_logbook_originals` aktif di Supabase. Upload memakai bucket privat; foto asli dihapus setelah varian disetujui. | Audit struktur baca-saja `supabase/audits/verify_logbook_incident_media.sql` lulus pada 14 November. Pengujian upload dengan akun Parent/Pengelola/Pengasuh belum dilakukan. |
| D2 — email/WhatsApp | ⬜ Belum ada pilihan provider; in-app cukup untuk MVP. | Putuskan provider hanya jika notifikasi eksternal masuk scope. |
| D3/B1 — snapshot skema | ⬜ Snapshot masih tertinggal dari database live. | Buat ulang dengan Supabase CLI dan akses database; jangan edit snapshot manual. |
| D4 — migration 058 | ⬜ Tidak ada file lokal dan belum jelas apakah nomor itu dilewati. | Konfirmasi ke Annisa sebelum membuat atau mengubah migration. |
| B3 — password database | ⬜ Perlu rotasi di dashboard Supabase karena pernah dibagikan. | Pemilik proyek mengganti password dari dashboard; jangan taruh password di repo/chat. |
| B4 — rate limit AI | 🟡 Masih per instance dan belum dipakai untuk AI produksi. | Tunda sampai endpoint AI dipakai di produksi, lalu pindahkan ke penyimpanan bersama. |
