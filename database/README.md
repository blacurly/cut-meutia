# Menjalankan database Ayomi — tahap 1

> **Arsip rancangan.** Folder ini berisi rancangan awal (SQL 60 tabel) yang dirujuk dokumen di `docs/`. Skema yang benar-benar berjalan di Supabase ada di [`supabase/`](../supabase/README.md): snapshot `supabase/schema/live_schema_snapshot.sql` dan migrasi `supabase/migrations/030–043`. Jangan jalankan file di folder ini ke project yang sudah berjalan.

Tahap ini menyiapkan **6 dari 60 tabel aplikasi**. Tabel bawaan Supabase tidak dihitung. Sisa 54 tabel diterapkan pada tahap berikutnya; total rancangan tidak dikurangi.

## Urutan di Supabase

1. Selesaikan pembuatan project development: Data API ON, Automatically expose new tables OFF, automatic RLS ON, Postgres default.
2. Gunakan project baru yang belum memiliki tabel Ayomi atau akun Auth. Jika sudah ada akun/tabel, jangan hapus untuk memaksakan skrip ini; diperlukan pemeriksaan/backfill terpisah.
3. Buka **SQL Editor → New query**.
4. Buka [001_foundation.sql](./001_foundation.sql), salin **seluruh isi**, tempel pada query, kemudian tekan **Run** sebagai role database `postgres` bawaan SQL Editor.
5. Hasil akhir harus berisi enam nama tabel dengan `rowsecurity = true`. Lihat juga **Table Editor → schema public**.
6. Pada query baru, jalankan [001_verify.sql](./001_verify.sql). Ini memeriksa schema, grants, serta isolasi Parent memakai akun uji sementara; seluruh fixture dibatalkan dengan ROLLBACK. Jalankan hanya di project development.
7. Setelah kedua langkah berhasil, barulah buat akun percobaan melalui **Authentication → Users → Add user**. Pilih email uji milik tim dan auto-confirm untuk pengujian. Akun akan mempunyai profil `public.users` dengan role Parent.

Skrip migration dijalankan **sekali**, bukan setiap refresh website. Tidak menggunakan DROP TABLE dan tidak menimpa objek lama. Jika ada error saat transaksi belum selesai, jalankan `ROLLBACK;` pada sesi SQL yang sama bila diperlukan, lalu simpan pesan error sebelum mencoba ulang. Jangan menjalankan potongan file untuk melewati error. Setelah migration sudah berhasil, jangan mengulang file 001; perubahan selanjutnya memakai migration baru.

## Yang dibuat

| Tabel | Kegunaan |
| --- | --- |
| users | Profil akun dan role aplikasi; UUID merujuk auth.users |
| daycares | Identitas/profil daycare; default belum aktif |
| daycare_members | Keanggotaan Manager/Caregiver pada daycare |
| children | Data umum anak milik Parent |
| child_health_profiles | Data kesehatan terpisah, dibuat otomatis saat anak dibuat |
| child_health_change_logs | Snapshot awal dan riwayat perubahan kesehatan otomatis |

Role/status tidak dapat dinaikkan melalui update profil browser. Trigger signup mengabaikan role di user_metadata. Akses data aplikasi memerlukan akun aktif, identitas Auth terkonfirmasi, dan tidak diblokir di Auth. Akun yang belum terkonfirmasi hanya dapat membaca profilnya sendiri; bukan data anak.

Parent dapat membaca/mengubah profil sendiri, membuat anak sendiri, mengubah data umum anak aktif, dan memperbarui kesehatan anak aktif. ID pemilik, status, timestamp, versi, serta identitas aktor diisi/dilindungi server. Parent tidak dapat melihat anak Parent lain. Admin yang diprovisioning server boleh membaca data untuk pengawasan. Staf belum diberi akses data anak sampai enrollment dan assignment tersedia.

**Batas tahap ini:** undangan staf, provisioning Admin melalui aplikasi, katalog publik dari database, publikasi harga, soft delete melalui API, enrollment, notifikasi perubahan kesehatan, Storage, pembayaran, dan AI belum dibuat. Data daycare/membership awal hanya disediakan melalui operasi server/SQL yang berwenang. Jangan menyimpulkan UI website sudah terhubung karena tabel berhasil dibuat; frontend masih demo lokal sampai integrasi Auth/API dikerjakan.

Tidak ada password disimpan pada public.users. FK ke auth.users memakai RESTRICT untuk mempertahankan identitas historis; akun aplikasi dinonaktifkan, bukan dihapus langsung melalui Auth. Perubahan role Parent yang sudah memiliki anak tidak diizinkan. Menonaktifkan Manager daycare aktif harus disertai perpindahan Manager atau perubahan status daycare dalam transaksi yang sama.

Fungsi internal berada dalam schema `ayomi_private`; **jangan tambahkan schema tersebut ke Exposed schemas**. Postgres owner dapat melewati RLS, sehingga hasil SELECT biasa di SQL Editor bukan bukti bahwa izin Parent benar. Skrip verifikasi memakai role `authenticated` dan klaim akun uji untuk memeriksa batas akses.

## Status verifikasi

Skrip disediakan untuk dijalankan di project Supabase Anda; belum diterapkan ke project remote. Pemeriksaan statis tidak menggantikan pengujian PostgreSQL/RLS. Hasil [001_verify.sql](./001_verify.sql) harus lulus pada project development sebelum backend menggunakan schema ini. Skrip verifikasi menulis fixture Auth secara langsung hanya di dalam transaksi yang dibatalkan; ini bukan cara membuat akun produksi atau pengujian pengiriman email Supabase Auth.

## Tahap berikutnya

Setelah fondasi lulus: undangan/provisioning staf, layanan/harga dan proyeksi katalog publik, lalu enrollment/consent/assignment. Relasi tahap berikutnya tetap mengikuti [spesifikasi 60 tabel](../docs/alur-bisnis-dan-database-ayomi.md). Hak SELECT staf atas data anak baru diberikan setelah syarat enrollment/assignment dapat diuji.

Sumber teknis: [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), dan [grants Data API](https://supabase.com/docs/guides/api/securing-your-api). Pilihan RESTRICT pada identitas historis adalah keputusan Ayomi, bukan menyalin cascade dari contoh profil sederhana.
