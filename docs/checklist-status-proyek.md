# Checklist status proyek Ayomi

Status per **12 November 2026**, dari branch `feature/non-ai-api-routes` setelah disinkronkan dengan commit Annisa `6e305e1` (*add non-AI backend APIs and workflows*).

Legenda:
- ✅ **Selesai**: berjalan dengan data nyata (Supabase/API) dan sudah diuji.
- 🟡 **Sebagian**: sudah ada, tetapi masih demo, belum tersambung, atau belum diterapkan.
- ⬜ **Belum**: belum dibuat.

## 1. Ringkasan

| Area | ✅ | 🟡 | ⬜ | Keterangan |
| --- | --- | --- | --- | --- |
| Backend non-AI (API + RPC) | 19 | 0 | 0 | Termasuk lampiran foto logbook dan bukti insiden (migrasi 20261114, aktif di database live) |
| Frontend Orang Tua | 6 | 7 | 0 | Navbar, katalog, detail, dan akun sudah nyata. Pendaftaran, logbook, laporan, dan ulasan masih demo |
| Frontend Pengelola/Pengasuh | 1 | 7 | 2 | Halaman `/undangan` sudah nyata. Halaman lain masih memakai data demo |
| Frontend Admin | 0 | 4 | 3 | Seluruh halaman masih memakai data demo |
| AI | 3 | 3 | 4 | Kerangka API siap; Foto Fokus Anak sudah bisa dicoba di aplikasi; Incident Triage memakai data sintetis |

**Kesimpulan:** backend non-AI sudah lengkap. Pekerjaan terbesar yang tersisa adalah **menyambungkan frontend ke API yang sudah ada** dan **menyelesaikan fitur AI utama (Laporan Harian Instan)**.

## 2. Status branch

Semua branch remote sudah tercakup di `feature/non-ai-api-routes`.

| Branch (remote) | Isi | Masuk `feature/non-ai-api-routes`? | Masuk `main`? |
| --- | --- | --- | --- |
| `main` / `development` | UI awal (demo) + PR #1 (auth dan profil Orang Tua ke Supabase) | ✅ | — |
| `ayomi-db-backend`, `…-review-fix` | Data Orang Tua lewat API route, pencarian lewat API direktori | ✅ | Sebagian |
| `fix/parent-api-children-id` | Perbaikan primary key `children.id` | ✅ | ⬜ |
| `feature/daycare-dataset-3-provinsi` | Katalog publik DKI Jakarta, Jawa Barat, Jawa Timur | ✅ | ⬜ |
| `fix/non-ai-enrollment-guards` | RPC pendaftaran, logbook, insiden, moderasi + perbaikan guard | ✅ | ⬜ |
| `feature/non-ai-api-routes` | Semua di atas, REST API non-AI, katalog, love/komentar, **commit Annisa 6e305e1** (onboarding mitra, kasus, penjemputan), kerangka AI, Foto Fokus Anak | (branch ini) | ⬜ |

**Keputusan 12 November:** onboarding mitra memakai **versi Annisa**, karena sudah aktif di database live. Versi kita (`043_partner_onboarding.sql`, yang belum pernah diterapkan) tidak dipakai. Versi kita tetap tersimpan di branch lokal `backup/wip-20261112`.

**Yang perlu dilakukan:**
- Push `feature/non-ai-api-routes`, lalu buka satu PR ke `main`.
- Jalankan `git pull` di `main` lokal (tertinggal dari `origin/main`) sebelum merge.
- Setelah PR digabung, bersihkan worktree sementara (`AppData/Local/Temp/vscode-agent-codex-sandbox-*`) dengan `git worktree prune`, lalu hapus branch lokal lama.

## 3. Backend non-AI

Detail endpoint ada di [api.md](./api.md).

| Modul | Endpoint utama | Status |
| --- | --- | --- |
| Autentikasi & akun | `/api/auth/*`, `/auth/callback`, `/api/me`, `/api/me/daycares` | ✅ |
| Katalog publik | `/api/daycares`, `/{id}`, `/compare`, `/{id}/photos`. Mitra aktif dibaca lewat RPC publik (`app_list_public_daycares`) | ✅ |
| Anak, kesehatan, izin penjemput | `/api/children/*`, `/api/children/{id}/pickup-authorizations` | ✅ |
| Pendaftaran & pembayaran manual | `/api/enrollments/*`, `/payments`, `/pickup`, `/api/admin/transactions/{id}` | ✅ |
| Logbook, love, komentar, foto | `/api/enrollments/{id}/activities`, `/api/activities/{id}/*` termasuk `/photos` | ✅ |
| Insiden dan lampiran bukti | `/api/incidents/*` termasuk `/api/incidents/{id}/evidence` | ✅ |
| Ulasan & moderasi manual | `/api/reviews/*`, `/api/admin/moderation` | ✅ |
| Notifikasi | `/api/notifications/*` | ✅ |
| Onboarding mitra (Annisa) | `/api/admin/partners`, `/api/me/daycares/{id}/{onboarding,profile,offerings,documents,photos,staff,delegations}`, `/api/admin/{prices,documents,daycare-documents,photos,staff}` | ✅ |
| Undangan staf | `POST /api/invitations/accept` + halaman `/undangan#<token>` | ✅ |
| Komplain, investigasi, sanksi (Annisa) | `/api/complaints/*`, `/api/admin/{complaints,investigations,sanctions}/*` | ✅ |

### Perlu perbaikan di backend

| # | Masalah | Tindakan |
| --- | --- | --- |
| B1 | Snapshot skema (`supabase/schema/live_schema_snapshot.sql`) belum memuat migrasi 043–060 | Dump ulang snapshot dari database live |
| B2 | Policy `daycares_specific_user_read` di database live | ✅ Sudah tidak ada saat dicek 14 November; katalog memakai RPC publik |
| B3 | Password database pernah dibagikan | Ganti password database di dashboard Supabase |
| B4 | Rate limit AI disimpan per instance server | Pindahkan ke tabel database atau KV saat AI dipakai di produksi |

## 4. Frontend Orang Tua

| Halaman | Rute | Status | Yang perlu dikerjakan |
| --- | --- | --- | --- |
| Navbar Orang Tua | semua halaman Orang Tua | ✅ | Tombol lokasi dan bandingkan dihapus (12 Nov). Komparasi lewat tombol **Bandingkan** di kartu/detail, lalu tautan **Lihat perbandingan** |
| Welcome, masuk, daftar, atur ulang sandi | `/welcome`, `/masuk`, `/daftar`, `/atur-ulang-sandi` | ✅ | — |
| Katalog & pencarian | `/`, `/pencarian` | ✅ | — |
| Detail daycare | `/detail/[id]` | ✅ | Tombol "Daftarkan anak" hanya muncul untuk mitra aktif |
| Komparasi | `/bandingkan`, `/bandingkan/hasil` | ✅ | — |
| Profil & anak | `/profil` | 🟡 | Hapus anak lewat `DELETE /api/children/{id}`; izin penjemput |
| Dashboard | `/beranda` | 🟡 | `/api/enrollments`, `/activities`, `/notifications` |
| Form pendaftaran anak | `/pendaftaran-anak` | 🟡 | `POST /api/enrollments` |
| Status pendaftaran | `/status-pendaftaran` | 🟡 | `GET/DELETE /api/enrollments`, `POST .../payments` |
| Catatan harian | `/catatan-harian` | 🟡 | `GET .../activities`, acknowledgements, love, komentar |
| Laporan insiden & komplain | `/laporan` | 🟡 | `/api/incidents`, `/api/complaints` |
| Notifikasi & ulasan | `/notifikasi`, `/ulasan` | 🟡 | `/api/notifications`, `/api/reviews` |

## 5. Frontend Pengelola/Pengasuh dan Admin

| Halaman | Rute | Status | Endpoint |
| --- | --- | --- | --- |
| Undangan staf | `/undangan` | ✅ | `POST /api/invitations/accept` |
| Uji Foto Fokus Anak | `/pengelola/foto-fokus` | ✅ (uji coba) | `/api/ai/focus/*` |
| Dashboard Pengelola | `/pengelola` | 🟡 | `/api/me/daycares`, `/api/enrollments?daycare_id=`, `/api/incidents` |
| Pendaftaran masuk | `/pengelola/pendaftaran` | 🟡 | `GET/PATCH /api/enrollments` |
| Laporan harian + tambah | `/pengelola/laporan-harian`, `/tambah` | 🟡 | `/api/enrollments/{id}/activities` + Foto Fokus Anak + Logbook Drafter |
| Profil daycare + edit | `/pengelola/profil`, `/profil/edit` | 🟡 | `/api/me/daycares/{id}/{onboarding,profile,offerings,photos}` |
| Dokumen legal | `/pengelola/dokumen` | 🟡 | `/api/me/daycares/{id}/documents`, `/api/daycare-documents/{id}/file` |
| Ulasan & balasan | `/pengelola/ulasan` | 🟡 | `/api/daycares/{id}/reviews`, `/api/reviews/{id}/reply` |
| Staf, undangan Pengasuh, delegasi | — | ⬜ | `/api/me/daycares/{id}/{staff,staff/invitations,delegations}` |
| Penjemputan anak | — | ⬜ | `/api/enrollments/{id}/pickup` |
| Dashboard Admin | `/admin` | 🟡 | `/api/admin/partners`, `/api/admin/moderation` |
| Daycare mitra | `/admin/daycare` | 🟡 | `/api/admin/partners/*`; tampilkan tautan `/undangan#<invitation_token>` |
| Verifikasi legal | `/admin/verifikasi-legal` | 🟡 | `/api/admin/{daycare-documents,documents,prices,photos,staff}` |
| Insiden | `/admin/insiden` | 🟡 | `GET/PATCH /api/incidents` |
| Komplain, investigasi, sanksi | — | ⬜ | `/api/admin/{complaints,investigations,sanctions}` |
| Moderasi ulasan & pembayaran | — | ⬜ | `/api/admin/moderation`, `/api/admin/transactions/{id}` |

## 6. AI

Prioritas bisnis: **(1) Laporan Harian Instan** (Foto Fokus Anak + Logbook Drafter), **(2) Safety Score + bantuan OCR**, **(3) Incident Triage**, **(4) ringkasan ulasan / Smart Reply**.

| Item | Status | Catatan |
| --- | --- | --- |
| Kerangka API AI (`lib/ai`, `/api/ai/features`, `/api/ai/sandbox/{feature}`) | ✅ | 8 fitur, validasi kontrak, retry, rate limit |
| Foto Fokus Anak: model tahap 1 + API | ✅ | Model `ayomi-focus-segmenter` (HF privat). API berjalan lokal; rencana hosting di Oracle Cloud |
| Foto Fokus Anak: route & halaman uji coba | ✅ | `/api/ai/focus/{segment,render}`, `/pengelola/foto-fokus` |
| Foto Fokus Anak: kualitas model | 🟡 | Kelas dewasa lemah dan ada label kembar di data; notebook sudah diperbaiki, perlu training ulang |
| Foto Fokus Anak di form logbook + varian per anak | ⬜ | Butuh penyimpanan `attachments`/`attachment_variants` |
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

## Status database per 14 November 2026

| Item | Status saat ini | Tindak lanjut |
| --- | --- | --- |
| D1 — lampiran foto logbook dan bukti insiden | ✅ API dan migration `20261114093328_logbook_incident_media` serta `20261114101228_delete_reviewed_logbook_originals` aktif di Supabase. Upload memakai bucket privat; foto asli dihapus setelah varian disetujui. | Audit struktur baca-saja `supabase/audits/verify_logbook_incident_media.sql` lulus pada 14 November. Pengujian upload dengan akun Parent/Pengelola/Pengasuh belum dilakukan. |
| D2 — email/WhatsApp | ⬜ Belum ada pilihan provider; in-app cukup untuk MVP. | Putuskan provider hanya jika notifikasi eksternal masuk scope. |
| D3/B1 — snapshot skema | ⬜ Snapshot masih tertinggal dari database live. | Buat ulang dengan Supabase CLI dan akses database; jangan edit snapshot manual. |
| D4 — migration 058 | ⬜ Tidak ada file lokal dan belum jelas apakah nomor itu dilewati. | Konfirmasi ke Annisa sebelum membuat atau mengubah migration. |
| B3 — password database | ⬜ Perlu rotasi di dashboard Supabase karena pernah dibagikan. | Pemilik proyek mengganti password dari dashboard; jangan taruh password di repo/chat. |
| B4 — rate limit AI | 🟡 Masih per instance dan belum dipakai untuk AI produksi. | Tunda sampai endpoint AI dipakai di produksi, lalu pindahkan ke penyimpanan bersama. |
