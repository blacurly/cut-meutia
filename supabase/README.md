# Database Supabase Ayomi

Project: `uitkyzjezowynbedjkbw`. Semua tabel memakai RLS. Penulisan data dari browser hanya lewat fungsi database (`app_*`) yang memeriksa peran dan cakupan.

## Struktur

| Folder | Isi |
| --- | --- |
| `schema/live_schema_snapshot.sql` | Snapshot skema yang berjalan: 65 tabel, constraint, index, policy, fungsi, dan hak akses. Ini dokumen referensi, **bukan** untuk dijalankan ulang. |
| `migrations/` | Perubahan sejak 030. Migrasi 001–029 dibuat langsung di Supabase dan tidak tersimpan; snapshot di atas menggantikannya. |
| `seed/` | Katalog 104 daycare (lihat `seed/README.md`). |
| `audits/` | Skrip verifikasi baca-saja per migrasi. |
| `tests/e2e_non_ai_flow.sql` | Uji alur lengkap dengan akun sementara, otomatis ROLLBACK. |

## Status migrasi (diterapkan 2026-11-10)

| Migrasi | Isi | Status |
| --- | --- | --- |
| 030–034 | Penguatan RLS, profil Orang Tua, anak, kesehatan anak | Sudah ada di database; 032/034 disamakan dengan definisi yang berjalan |
| 035 | Pendaftaran, keputusan, pembayaran manual, penugasan, kedaluwarsa | Diterapkan |
| 036 | Catatan harian dan notifikasi | Diterapkan |
| 037 | Check-in, penyelesaian, insiden | Diterapkan |
| 038 | Ulasan dan moderasi manual | Diterapkan |
| 039 + seed | Katalog daycare publik | Diterapkan |
| 040 | Fungsi pendukung API (CRUD anak, hapus draf, fungsi baca per peran) | Diterapkan |
| 041 + seed | Profil operasional katalog (biaya, rasio, kapasitas, usia, jam, galeri); berisi data **sintetis** | Diterapkan 2026-11-10 |
| 042 | Love dan komentar logbook, beserta jumlahnya di daftar catatan harian | Diterapkan 2026-11-10 |

Migrasi 035–038 dan 040 hanya berisi `CREATE OR REPLACE FUNCTION` dan pengaturan hak akses, jadi aman dijalankan ulang setelah diubah. Migrasi 039, 041, dan 042 membuat tabel, jadi masing-masing dijalankan sekali.

## Hal yang perlu diingat

- Kunci tabel `children` adalah **`child_id`** (bukan `id`), dan `child_health_profiles` juga memakai `child_id`. Spesifikasi lama di `database/001_create_tables.sql` tidak sesuai di bagian ini.
- PL/pgSQL tidak memeriksa nama kolom saat fungsi dibuat. Jalankan `node --test lib/supabase-schema.test.mjs` sebelum menerapkan migrasi baru; test ini membandingkan setiap `INSERT`/`UPDATE` dengan snapshot.
- Jadwalkan `SELECT public.app_expire_overdue_enrollments();` di Supabase Cron (misalnya setiap 10 menit) agar checkout yang lewat batas bayar berubah menjadi `expired`.
- Setelah mengubah skema, buat ulang snapshot agar tetap menjadi sumber kebenaran.

## Update 2026-11-14

Migrasi `20261114093328_logbook_incident_media.sql` menambah upload foto logbook dan bukti insiden, aturan Storage privat, metadata lampiran, tinjauan varian Foto Fokus Anak, dan syarat 1–3 varian `ready` sebelum catatan normal dikirim. Migrasi `20261114101228_delete_reviewed_logbook_originals.sql` menghapus foto asli setelah review berhasil. Keduanya diterapkan ke database live pada 2026-11-14. Snapshot `schema/live_schema_snapshot.sql` belum diperbarui; buat ulang dari database live sebelum merilis perubahan terkait schema, jangan edit snapshot secara manual.
