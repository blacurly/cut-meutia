# Panduan foto tim dan foto daycare

Foto mentah disimpan di folder `foto-mentah/`. Satu perintah lalu mengecilkan foto, menghapus metadata (termasuk lokasi GPS), dan mendaftarkannya ke website. Folder `foto-mentah/` tidak ikut ter-commit; yang di-commit hanya hasil olahannya.

```text
foto-mentah/
├── tim/
│   ├── 1.jpg            ← anggota id 1 di lib/team.js
│   ├── 2.jpg
│   ├── 3.jpg
│   └── 4.jpg
└── daycare/
    ├── 01.jpg                        ← gambar contoh untuk SEMUA daycare
    ├── 02.jpg                          (langsung di folder daycare/)
    ├── aamillah-daycare-bekasi/      ← nama folder = slug daycare
    │   ├── 01-depan.jpg              ← urutan nama file = urutan tampil;
    │   ├── 02-ruang-bermain.jpg        foto pertama jadi foto sampul
    │   └── 03-area-tidur.jpg
    └── abc-educare-jakarta-selatan/
        └── 01.jpg
```

## 1. Foto tim (4 anggota)

1. Buka [lib/team.js](../lib/team.js). Isi `name`, `role`, dan `focus` (satu-dua kalimat kontribusi) untuk tiap anggota. `links.linkedin` dan `links.github` boleh diisi URL `https://...` atau dikosongkan.
2. Simpan foto tiap anggota sebagai `foto-mentah/tim/<id>.jpg`. Nomor file = `id` anggota di `lib/team.js`.
3. Jalankan `npm run foto`.

Foto tim dipotong menjadi persegi 800×800 dengan wajah di tengah. Pakai foto setengah badan dengan latar polos, minimal 800×800 piksel. Format JPG, PNG, atau WebP.

Bila wajah terpotong atau terlalu kecil (biasanya pada foto seluruh badan), tambahkan `photoCrop` pada anggota itu di `lib/team.js`, lalu jalankan `npm run foto` lagi:

```js
photoCrop: { x: 0.5, y: 0.3, size: 0.6 },
```

- `x`, `y`: titik tengah potongan, dihitung dari lebar dan tinggi foto (0 = kiri/atas, 1 = kanan/bawah). Wajah di sepertiga atas foto → `y: 0.3`.
- `size`: sisi kotak potongan dibanding sisi terpendek foto. Makin kecil, makin dekat (zoom). `0.6` cocok untuk foto seluruh badan.

Anggota dengan `name` kosong tidak ditampilkan. Bagian tim baru muncul di beranda setelah minimal satu nama terisi. Tanpa foto, kartu menampilkan inisial nama.

## 2. Foto daycare

1. Cari **slug** daycare. Slug adalah bagian akhir alamat halaman detail. Contoh: `/detail/aamillah-daycare-bekasi` → slug `aamillah-daycare-bekasi`.
2. Buat folder `foto-mentah/daycare/<slug>/` dan masukkan maksimal 6 foto. Beri nama `01-...`, `02-...` agar urutannya jelas. Foto pertama menjadi foto sampul di kartu daycare.
3. Jalankan `npm run foto`.

Foto daycare dikecilkan maksimal 1600×1000 piksel (WebP). Di website, foto ditampilkan dengan rasio 16:10, jadi foto mendatar (landscape) paling pas. Bila slug salah ketik, perintah melewati folder itu dan menyarankan slug yang mirip.

Begitu daycare punya foto, gambar ilustrasi dan labelnya tidak lagi muncul untuk daycare tersebut.

Urutan foto yang dipakai di halaman daycare:

1. Foto yang diunggah Pengelola di menu **Foto daycare** (`/pengelola/foto`) dan sudah disetujui Admin di **Verifikasi legal** → bagian **Foto fasilitas**. Foto disimpan di bucket Supabase privat `daycare-gallery` (tabel `daycare_photos`) dan hanya tampil bila daycare berstatus aktif.
2. Foto di `cover_image_path`/`gallery_paths` pada `daycare_listings` (bucket `daycare-public-media`).
3. Foto dari folder `foto-mentah/daycare/<slug>/` ini.
4. Gambar contoh (label **Ilustrasi**).

### Gambar contoh untuk semua daycare

Gambar yang ditaruh langsung di `foto-mentah/daycare/` (bukan di folder slug) menjadi gambar contoh. Gambar ini dipakai untuk setiap daycare yang belum punya foto sendiri. Urutannya diputar per daycare agar sampul di daftar daycare tidak sama semua. Hasilnya disimpan di `public/images/daycares/ilustrasi/` (maksimal 12 gambar).

Gambar contoh selalu diberi label **Ilustrasi**, dan halaman detail menulis "Gambar adalah ilustrasi, bukan foto ...". Label ini wajib karena gambarnya bukan foto daycare tersebut.

### Foto yang boleh dipakai

- Foto diambil sendiri oleh tim saat berkunjung dengan izin pengelola, atau diberikan langsung oleh pengelola daycare.
- **Jangan** mengambil foto dari Google Maps, Instagram, atau website daycare tanpa izin tertulis. Foto itu milik pemotretnya.
- **Tidak ada wajah anak yang terlihat.** Pilih foto ruangan kosong, fasilitas, atau tampak depan. Bila ada anak, wajahnya harus tidak dapat dikenali.
- Tidak ada data pribadi yang terbaca (nama anak di loker, papan jadwal, nomor telepon pribadi).

## 3. Cek lalu commit

1. `npm run dev`, lalu buka beranda (bagian **Tentang Ayomi**) dan halaman detail daycare yang diberi foto.
2. Commit file berikut:
   - `public/images/tim/`
   - `public/images/daycares/`
   - `lib/site-photos.json`
   - `lib/team.js`

Setelah di-push ke `main`, Vercel menampilkan foto pada deploy berikutnya.

## Menghapus atau mengganti foto

- **Mengganti:** taruh foto baru di `foto-mentah/...` dengan nama yang sama, lalu jalankan `npm run foto` lagi. Untuk daycare, semua foto di folder slug itu dibuat ulang.
- **Menghapus foto daycare:** hapus folder `public/images/daycares/<slug>/` (dan folder mentahnya), lalu jalankan `npm run foto`.
- **Menghapus foto tim:** hapus `public/images/tim/anggota-<id>.webp` dan `foto-mentah/tim/<id>.jpg`, lalu jalankan `npm run foto`.
