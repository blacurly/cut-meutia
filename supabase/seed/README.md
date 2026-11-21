# Katalog daycare 3 provinsi

Data katalog publik (DKI Jakarta, Jawa Barat, Jawa Timur) untuk halaman `/`, `/pencarian`, `/detail/{slug}`, dan `/bandingkan`.
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

Skrip menulis ulang seed SQL dan laporan `docs/04-database/dataset-daycare-3-provinsi.md`. Koreksi manual
(wilayah salah, baris di luar provinsi, catatan legalitas) ada di `CORRECTIONS` pada
`lib/daycare-dataset.js`, masing-masing dengan alasannya. Jangan mengedit file seed secara manual.

## Foto daycare

Kolom `cover_image_path` dan `gallery_paths` menyimpan path objek di bucket Storage
`daycare-public-media`. Foto asli ini selalu diutamakan. Selama kosong, detail dan kartu daycare
memakai tiga ilustrasi AI bawaan (`/public/images`) dari `daycare_listing_profiles.gallery_images`,
dengan label "Ilustrasi AI" agar tidak dikira foto daycare tersebut.

## Profil operasional sintetis (041)

Dataset publik tidak memuat biaya, rasio pengasuh, kapasitas, usia yang diterima, jam operasional,
dan paket. Untuk pengembangan dan demo, nilai ini **dibuat** oleh `lib/daycare-synthetic.js` lalu
disimpan di `daycare_listing_profiles` dengan `data_origin = 'synthetic'`:

- Biaya bulanan mengikuti rentang per provinsi (DKI Rp2,5–5 jt, Jabar Rp1,5–3,5 jt, Jatim Rp1,2–3 jt),
  lebih tinggi di kota besar dan untuk fasilitas premium (Montessori, bilingual, AC, CCTV, spa).
- Rasio 1:3–1:4 bila menerima bayi, 1:4–1:6 untuk lainnya; usia dan jam mengikuti penanda fasilitas
  (`infant`, `preschool`, `extended_hours`).
- Hasilnya deterministik per slug: menjalankan ulang tidak mengacak angka.

Semua API dan UI menandai nilai ini sebagai **estimasi**. Jangan menampilkannya sebagai harga resmi.

Urutan menjalankan:

1. `supabase/migrations/041_daycare_listing_profiles.sql`
2. `node scripts/build-synthetic-profiles.mjs` (membaca katalog lewat Data API, menulis seed)
3. `supabase/seed/daycare_listing_profiles_seed.sql` di SQL Editor

Seed hanya memperbarui baris yang masih `synthetic`. Data yang sudah diisi pengelola
(`data_origin = 'manager'`) tidak tertimpa.
