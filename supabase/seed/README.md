# Katalog daycare 3 provinsi

Data katalog publik (DKI Jakarta, Jawa Barat, Jawa Timur) untuk halaman `/` dan `/pencarian`.
Daycare di katalog belum bergabung dengan Ayomi, jadi tidak disimpan di tabel `daycares`
(yang mewajibkan pengelola, kontak, dan kapasitas). Status legalitas dan rating berasal dari
sumber publik, bukan hasil verifikasi tim Ayomi.

## Menjalankan di Supabase

Jalankan di **SQL Editor**, berurutan, masing-masing satu kali:

1. `supabase/migrations/039_daycare_listings.sql` — membuat tabel `daycare_listings` dengan RLS
   (pengunjung hanya bisa membaca data yang dipublikasikan).
2. `supabase/seed/daycare_listings_seed.sql` — memuat 104 daycare. Aman dijalankan ulang;
   baris yang sama diperbarui, tidak digandakan.
3. `supabase/audits/verify_migration_039.sql` — memeriksa RLS, hak akses, dan jumlah data per provinsi.

## Memperbarui data

CSV mentah tidak di-commit. Simpan file dari tim di komputer Anda, lalu jalankan:

```bash
node scripts/build-daycare-seed.mjs \
  --dki   "path/DATASET DAYCARE - DKI JAKARTA.csv" \
  --jabar "path/DATASET DAYCARE - JAWA BARAT.csv" \
  --jatim "path/DATASET DAYCARE - JAWA TIMUR.csv"
```

Skrip menulis ulang seed SQL dan laporan `docs/dataset-daycare-3-provinsi.md`. Koreksi manual
(wilayah salah, baris di luar provinsi, catatan legalitas) ada di `CORRECTIONS` pada
`lib/daycare-dataset.js`, masing-masing dengan alasannya. Jangan mengedit file seed secara manual.

## Foto daycare

Kolom `cover_image_path` dan `gallery_paths` menyimpan path objek di bucket Storage
`daycare-public-media`. Selama kosong, UI menampilkan placeholder "Foto daycare menyusul".
