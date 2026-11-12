# Halaman masuk dan pendaftaran — Hallmark 3.2

Implementasi ini mengikuti [Hallmark](./brief/hallmark.md) dan memakai folder yang sudah disediakan. Tidak ada folder baru untuk autentikasi.

## Penempatan

| Bagian | Berkas |
| --- | --- |
| Route masuk | [app/(auth)/masuk/page.js](../app/(auth)/masuk/page.js) |
| Route daftar | [app/(auth)/daftar/page.js](../app/(auth)/daftar/page.js) |
| Perakitan halaman server | [components/features/AuthPage.js](../components/features/AuthPage.js) |
| Form interaktif | [components/features/AuthForm.js](../components/features/AuthForm.js) |
| Gaya form | [components/features/AuthForm.module.css](../components/features/AuthForm.module.css) |
| Teks ID/EN | [components/features/auth-copy.js](../components/features/auth-copy.js) |
| Layout bersama | [components/layout/AuthLayout.js](../components/layout/AuthLayout.js) dan [CSS](../components/layout/AuthLayout.module.css) |
| Validasi frontend | [lib/auth.js](../lib/auth.js) |
| Pengujian validasi | [lib/auth.test.mjs](../lib/auth.test.mjs) |

Komponen Input, Button, Tabs, Modal, dan logo pengguna digunakan kembali dari folder UI yang sudah ada.

## Perilaku halaman

- Desktop: dua panel 50/50, panel merek teal, tiga kartu informasi putih, dan panel form putih lembut. Pada layar kecil, branding diringkas agar form mudah dijangkau.
- Pilihan Orang Tua, Pengelola Daycare, dan Admin tersimpan di parameter `role`. Parameter `lang` menentukan ID/EN. Tautan masuk/daftar mempertahankan kedua pilihan tersebut.
- Form masuk meminta email dan kata sandi. Form daftar meminta nama, email, WhatsApp, kata sandi, dan persetujuan. Pengelola wajib menambahkan nama daycare dan kota operasional.
- Format WhatsApp lokal, +62, dan 62 diterima lalu dinormalisasi. Daftar memerlukan 8–128 karakter kata sandi, termasuk huruf dan angka. Aturan kata sandi baru tidak diterapkan ke login akun lama.
- Validasi berjalan saat meninggalkan kolom dan saat submit. Kolom salah diberi keterangan dan fokus berpindah ke kesalahan pertama.
- Tombol mata mengubah visibilitas kata sandi. Kriteria kata sandi diperbarui saat mengetik.
- Pilihan Admin pada daftar menampilkan penjelasan dan tautan masuk khusus. Tidak ada pendaftaran Admin publik.
- Modal pemulihan kata sandi, Syarat & Ketentuan, serta Kebijakan Privasi dapat dibuka dan ditutup. Fokus tetap berada dalam modal; Escape menutup dan mengembalikan fokus ke pemicu.
- Tabs mendukung tombol panah, Home/End, indikator fokus, serta relasi ARIA dengan panel form.
- Aturan pewarisan font kontrol dipindahkan ke layer CSS `base`, sehingga ukuran teks dan ketebalan font komponen Tailwind dapat bekerja sesuai desain.
- Form dinonaktifkan sebelum JavaScript siap, dan memakai metode POST sebagai perlindungan tambahan agar kata sandi tidak masuk ke URL melalui submit bawaan browser.

## Batas integrasi

Ini tahap frontend. Folder API autentikasi, layanan, dan Supabase belum memiliki implementasi. Submit yang lolos validasi, tombol Google, dan pemulihan kata sandi menampilkan status belum tersedia. Tidak ada akun/sesi palsu, pengiriman email palsu, penyimpanan kredensial lokal, atau pengalihan ke dashboard seolah-olah login berhasil.

Dokumen legal resmi belum tersedia, sehingga modal menjelaskan status tersebut dan tidak menampilkan kebijakan rekaan. Data dan persetujuan form belum dikirim ke server. Angka dan klaim pada kartu merek mengikuti contoh desain Hallmark dan belum terhubung ke data operasional.

Integrasi berikutnya memakai [services](../services), [lib/supabase](../lib/supabase), dan [app/api/auth](../app/api/auth) yang sudah tersedia. Server perlu memvalidasi input dan menentukan izin akun secara independen dari pilihan role pada URL. Terbitkan dokumen legal resmi sebelum mengaktifkan pendaftaran.

## Pemeriksaan

```sh
node --test lib/auth.test.mjs
npm run lint
npm run build
```

Enam kelompok pengujian mencakup normalisasi query, persetujuan dan kata sandi, format telepon, kolom khusus caregiver, pembatasan Admin, serta validasi login akun lama. Node dapat memberi peringatan deteksi modul ESM untuk berkas JavaScript; ini tidak memengaruhi hasil pengujian atau build Next.js.

Pemeriksaan tambahan yang sudah dilakukan:

- Lint pada route, komponen bersama, form, dan helper autentikasi; build produksi Next.js.
- Respons HTTP untuk 12 kombinasi masuk/daftar × tiga peran × ID/EN.
- Interaksi browser melalui keyboard: fokus error, normalisasi WhatsApp, tampil/sembunyikan kata sandi, modal dan pengembalian fokus, submit, tombol Google, perpindahan peran, pembatasan Admin, pemulihan kata sandi, dan navigasi bahasa/route. Tidak ada request POST berisi kredensial selama skenario frontend tersebut.
- Pengukuran layout browser pada lebar 320, 390, 768, 1024, dan 1440 px dalam ID dan EN: tidak ada overflow horizontal; desktop memakai dua kolom; ukuran teks tab mengikuti breakpoint.

Pratinjau: `/masuk?role=parent&lang=id`, `/daftar?role=caregiver&lang=id`, `/daftar?role=admin&lang=id`, dan varian `lang=en`.
