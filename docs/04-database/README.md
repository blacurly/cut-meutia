# Script SQL dan Seed Data

Database Ayomi memakai **PostgreSQL di Supabase**: 66 tabel, semuanya dengan **Row Level Security**. Browser tidak menulis ke tabel secara langsung. Semua perubahan data lewat fungsi database (`app_*`) yang memeriksa peran, kepemilikan, dan status.

Diagram tabelnya ada di [`../03-erd/`](../03-erd/erd.md).

## Isi repository

| Lokasi | Isi | Dijalankan? |
| --- | --- | --- |
| [`supabase/schema/live_schema_snapshot.sql`](../../supabase/schema/live_schema_snapshot.sql) | Snapshot skema yang diambil langsung dari database Supabase production (10 November 2026): 65 tabel, constraint, index, policy RLS, fungsi, dan hak akses | Referensi. Jangan dijalankan ke database yang sudah berjalan |
| [`supabase/migrations/`](../../supabase/migrations/) | 37 migrasi (`030`–`060` dan `20261114…`–`20261120…`): RLS, fungsi bisnis, katalog, Storage, dan fitur AI | Ya, berurutan menurut nama berkas |
| [`supabase/setup-auth-profile.sql`](../../supabase/setup-auth-profile.sql) | Trigger yang membuat profil Orang Tua setiap kali akun baru mendaftar | Ya, sekali |
| [`supabase/seed/`](../../supabase/seed/README.md) | Seed katalog **104 daycare** dari dataset publik DKI Jakarta, Jawa Barat, dan Jawa Timur | Ya, setelah migrasi `039` dan `041` |
| [`scripts/import-demo-daycare-accounts.mjs`](../../scripts/import-demo-daycare-accounts.mjs) | Membuat akun demo daycare (1 Pengelola dan 2 Pengasuh per daycare) dari CSV tim. Mode pratinjau kecuali diberi `--apply` | Opsional |
| [`supabase/tests/e2e_non_ai_flow.sql`](../../supabase/tests/e2e_non_ai_flow.sql) | Uji alur lengkap dengan akun sementara, lalu `ROLLBACK`. Hasil sukses diakhiri `E2E OK` | Opsional, untuk verifikasi |
| [`supabase/audits/`](../../supabase/audits/) | Skrip verifikasi baca-saja per migrasi | Opsional |
| [`database/`](../../database/README.md) | Rancangan awal 60 tabel. **Arsip**; skema yang berjalan sudah berbeda di beberapa bagian | Tidak |

## Urutan menjalankan di project Supabase

Jalankan di **Supabase Dashboard → SQL Editor**, masing-masing satu kali:

1. **Skema dasar:** `supabase/schema/live_schema_snapshot.sql`. Migrasi 001–029 dibuat langsung di Supabase dan tidak tersimpan; snapshot ini yang menggantikannya.
2. **Profil akun:** `supabase/setup-auth-profile.sql`.
3. **Migrasi:** semua berkas di `supabase/migrations/` yang belum tercakup snapshot, urut nama berkas. Migrasi `035`–`038` dan `040` hanya berisi `CREATE OR REPLACE FUNCTION`, jadi aman diulang. Migrasi yang membuat tabel (`039`, `041`, `042`, `048`) cukup sekali.
4. **Seed katalog:** `supabase/seed/daycare_listings_seed.sql`, lalu `supabase/seed/daycare_listing_profiles_seed.sql`. Keduanya aman diulang; baris yang sama diperbarui, tidak digandakan.
5. **Verifikasi:** `supabase/audits/verify_migration_039.sql` (jumlah data per provinsi dan RLS), lalu `supabase/tests/e2e_non_ai_flow.sql`.
6. **Jadwal:** di Supabase Cron, jalankan `SELECT public.app_expire_overdue_enrollments();` setiap 10 menit, agar checkout yang lewat batas bayar berubah menjadi `expired`.

Database production sudah dibangun dengan urutan ini. Urutan di atas belum pernah diuji ulang dari project yang benar-benar kosong; kalau ada langkah yang gagal, simpan pesan error-nya sebelum mencoba lagi dan jangan menjalankan potongan berkas.

Detail per migrasi ada di [`supabase/README.md`](../../supabase/README.md).

## Seed data

| Data | Sumber | Jumlah | Keterangan |
| --- | --- | --- | --- |
| Katalog daycare | Dataset publik daycare DKI Jakarta, Jawa Barat, Jawa Timur | 104 daycare | Nama, alamat, fasilitas, rating, dan referensi legalitas dari sumber publik. Rincian dan statistiknya di [`dataset-daycare-3-provinsi.md`](dataset-daycare-3-provinsi.md) |
| Profil operasional katalog | Disintesis (`lib/daycare-synthetic.js`) | 104 profil | Biaya, rasio pengasuh, kapasitas, usia, dan jam buka **tidak tersedia di sumber publik**, sehingga dibuat sintetis. Aplikasi menandainya sebagai **estimasi** |
| Akun demo daycare | CSV tim (tidak di-commit) | 1 Pengelola + 2 Pengasuh per daycare | Dibuat lewat `scripts/import-demo-daycare-accounts.mjs --apply`. Skrip tidak pernah mencetak kata sandi |
| Dokumen legal spesimen | Dibuat tim, **fiktif** | 3 daycare × 5 dokumen | Untuk menguji OCR dan Safety Score. Lihat [`../06-fitur-ai/spesimen-dokumen/`](../06-fitur-ai/spesimen-dokumen/README.md) |

Untuk membuat ulang seed katalog dari CSV: `node scripts/build-daycare-seed.mjs --dki <csv> --jabar <csv> --jatim <csv>` (CSV mentah tidak di-commit).

## Keamanan

- RLS aktif di **66 dari 66 tabel**. Pengunjung anonim hanya bisa membaca katalog yang dipublikasikan.
- Penulisan data hanya lewat fungsi `SECURITY DEFINER` dengan `search_path` kosong, yang memeriksa peran dan cakupan daycare.
- Fungsi internal ada di skema `ayomi_private` dan tidak diekspos lewat Data API.
- Riwayat tidak dihapus: foreign key memakai `ON DELETE RESTRICT`, dan perubahan penting tercatat di tabel `*_logs` dan `audit_logs`.
- Berkas privat (dokumen legal, foto logbook asli, bukti insiden) disimpan di bucket Storage privat dan hanya dibuka lewat tautan bertanda tangan 5 menit.
