# Frontend Ayomi — audit awal dan splash screen

## Kondisi proyek

- Next.js 16.3.8 App Router, React 19.2.8, JavaScript/JSX, Tailwind CSS v4, dan Lucide.
- [PRD](./brief/prd-ayomi.md) menetapkan alur direktori, perbandingan, pendaftaran anak, catatan harian, insiden, dan pengelolaan daycare.
- [Hallmark](./brief/hallmark.md) menjadi acuan visual: teal #264653, mint #2A9D8F, amber #E9C46A, coral #E76F51, dan Plus Jakarta Sans.
- Komponen UI dasar sudah tersedia di [components/ui](../components/ui). Folder fitur orang tua, caregiver, API, layanan, dan database masih berupa kerangka .gitkeep; integrasi Supabase belum tersedia.
- Sebelum implementasi splash, halaman utama berisi landing page awal dengan beberapa tombol yang belum mempunyai aksi.

## Implementasi tahap pertama

- [Halaman utama](../app/page.js) kini menjadi katalog publik. Splash tetap menggunakan [WelcomeScreen](../components/features/welcome/WelcomeScreen.js) di [/welcome](../app/welcome/page.js). Lihat [alur Orang Tua](./frontend-parent.md) untuk pengembangan berikutnya.
- Tampilan dua panel untuk desktop; panel konten dan foto disusun vertikal pada tablet/ponsel. Tinggi halaman dapat bertambah untuk menjaga teks tetap terbaca pada layar pendek.
- [Teks ID/EN](../components/features/welcome/copy.js) dipilih melalui parameter lang. Pilihan bertahan saat refresh dan diteruskan ke portal serta tautan kembali.
- [Logo](../components/ui/AyomiLogo.js) memakai [gambar asli yang diberikan pengguna](../public/images/ayomi-logo.png) dan wordmark Ayomi. Gambar yang sama digunakan pada ikon tab browser. Ikon antarmuka memakai Lucide.
- [Gaya splash](../components/features/welcome/WelcomeScreen.module.css) terisolasi melalui CSS Modules; font dan token merek dasar ada pada layout dan CSS global.
- Gambar lokal WebP dengan next/image, preload, ukuran responsif, dan placeholder blur.
- Plus Jakarta Sans disimpan sebagai [font variabel lokal](../public/fonts/PlusJakartaSans-Variable.ttf), disertai [lisensi OFL](../public/fonts/OFL.txt) dari repositori Google Fonts; build tidak membutuhkan unduhan Google Fonts.
- Navigasi keyboard, skip link, indikator fokus, atribut bahasa, teks alternatif, serta dukungan prefers-reduced-motion.
- [Tujuan tombol masuk](../app/(auth)/masuk/page.js) menerima role parent, caregiver, atau admin. Halaman masuk dan [pendaftaran](../app/(auth)/daftar/page.js) sekarang memiliki form interaktif sesuai Hallmark 3.2; lihat [catatan autentikasi frontend](./frontend-auth.md). Parameter role hanya memilih tampilan, bukan memberi otorisasi.
- Teks pemasaran 34+ provinsi, OCR, dan AI Privacy mengikuti brief; belum merupakan hasil pengukuran atau integrasi backend.

## Tahap frontend berikutnya

1. Hubungkan form /masuk dan /daftar yang sudah tersedia ke autentikasi dan otorisasi server.
2. Buat shell navigasi orang tua, caregiver, dan administrator sebelum halaman dashboard.
3. Samakan token warna komponen UI lama secara bertahap; beberapa komponen masih memakai variasi warna landing page awal.
   Modal sudah mendukung pengelolaan fokus dan Tabs sudah mendukung tombol panah. Lengkapi label aksesibel pada Dropdown dan ToggleSwitch sebelum menggunakannya pada alur utama.
4. Implementasikan direktori dan detail daycare, kemudian pendaftaran anak dan catatan harian.
5. Sepakati perbedaan dokumen sebelum integrasi AI: PRD menentukan Safety Score 40/30/30 sedangkan contoh Hallmark 30/35/35. PRD mewajibkan persetujuan pengasuh sebelum publikasi logbook, sedangkan Hallmark menyebut auto-release 15 menit.

## Asal aset visual

- Aset: [ayomi-daycare.webp](../public/images/ayomi-daycare.webp), 1122 × 1402 px, sekitar 160 KiB.
- Dibuat menggunakan tool bawaan image_gen, lalu dikonversi menjadi WebP menggunakan Sharp.
- Ini ilustrasi fotorealistis AI, bukan dokumentasi daycare mitra. Keterangan ini juga tampil pada halaman dan alt text.
- Ganti dengan foto mitra berizin ketika tersedia; tidak perlu mengubah struktur komponen.

Prompt final:

```text
Use case: photorealistic-natural
Asset type: editorial website welcome hero photograph, portrait 4:5 composition, high resolution.
Primary request: An authentic-feeling, clean contemporary Indonesian daycare environment, warm and reassuring, for Ayomi child safety platform. A candid scene of one Indonesian female caregiver in a modest cream blouse and sage green hijab sitting at a low light-wood children's table with three Indonesian toddlers, patiently helping them arrange large wooden building blocks. Natural relaxed interactions, children focused on playing rather than posing. Subjects centered in the middle third so top and bottom remain usable for the website overlay.
Scene: airy bright daycare room in Indonesia, off-white walls, low natural wood Montessori shelves, muted wooden toys, a plant near large windows, soft cream rug, a simple arch-shaped bookshelf. Clean, realistic lived-in setting, no extravagant luxury.
Style: high-end editorial lifestyle photography, realistic skin and fabric texture, gentle warm daylight from the right, calm desaturated cream, sage and light wood palette. Camera at seated adult height, 35mm lens, generous view of room, medium depth of field, natural proportions.
Constraints: no text, no logos, no watermark, no UI, no graphic overlays, no frames. Realistic safe play with large toddler-safe wooden toys, uncluttered, no excessive decoration.
```

