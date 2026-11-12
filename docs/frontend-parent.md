# Navbar Universal dan alur Orang Tua

Implementasi mengikuti [Hallmark](./brief/hallmark.md), terutama bagian Navbar Universal dan halaman 3.3–3.7. Semua berkas kode ditambahkan di folder yang sudah tersedia.

## Peta halaman

| Tahap | URL | Komponen |
| --- | --- | --- |
| Katalog publik | / | [PublicCatalog](../components/features/PublicCatalog.js) |
| Pencarian multi-wilayah | /pencarian | [DaycareSearch](../components/features/DaycareSearch.js) |
| Detail, skor, ulasan, fasilitas, paket | /detail/[id] | [DaycareDetail](../components/features/DaycareDetail.js) |
| Pilih komparasi | /bandingkan | [DaycareComparison](../components/features/DaycareComparison.js) |
| Matriks komparasi | /bandingkan/hasil | Komponen komparasi yang sama |
| Pendaftaran anak | /pendaftaran-anak?daycare=kasih-bunda | [EnrollmentForm](../components/features/EnrollmentForm.js) |
| Status pendaftaran | /status-pendaftaran | [EnrollmentStatus](../components/features/EnrollmentStatus.js) |
| Dashboard Orang Tua | /beranda | [ParentDashboard](../components/features/ParentDashboard.js) |
| Timeline harian | /catatan-harian | [ParentLogbook](../components/features/ParentLogbook.js) |
| Pusat laporan | /laporan | [ParentIncidents](../components/features/ParentIncidents.js) |
| Profil & anak | /profil | [ParentAccount](../components/features/ParentAccount.js) |
| Notifikasi | /notifikasi | Komponen akun yang sama |
| Ulasan | /ulasan | Komponen akun yang sama |

Splash tetap berada di [/welcome](../app/welcome/page.js), sedangkan halaman masuk dan daftar yang sudah ada tetap tersedia. Rute /laporan/tambah diarahkan ke /laporan agar memakai folder laporan yang disediakan. /detail tanpa ID diarahkan ke direktori; ID yang tidak dikenal menampilkan halaman 404 khusus.

## Navbar

[UniversalNavbar](../components/layout/UniversalNavbar.js) dan [ParentShell](../components/layout/ParentShell.js) memakai header putih, tinggi 64 px, posisi sticky, logo pengguna, tautan aktif, pilihan wilayah, komparasi, indikator notifikasi, profil, dan pilihan anak aktif. Menu seluler dapat dibuka/ditutup, menutup setelah navigasi, mendukung Escape dan klik di luar, serta menghormati reduced motion.

Mode publik dan Orang Tua demo sudah terhubung. Portal Pengelola dan Administrator kini juga tersedia dalam mode demo; lihat [panduan portal](./frontend-portals.md). Menu akun mengarah ke portal demo sesuai peran. Backend dan autentikasi produksi belum terhubung.

## Alur demo yang dapat dijalankan

1. Mulai dari katalog atau pencarian. Provinsi mengatur pilihan kota; kota mengatur kecamatan. Mengubah induk mengosongkan pilihan anak.
2. Filter harga, skor, rasio, fasilitas, status verifikasi, pencarian teks, pengurutan dan halaman hasil bekerja pada 10 profil fiktif. Filter tercermin di URL.
3. Buka detail, ganti empat tab informasi, lihat galeri ilustrasi, atau simpan maksimal tiga pilihan komparasi.
4. Tekan Daftarkan anak. Pilih mode demo secara eksplisit, pilih/tambahkan profil anak, paket dan tanggal mulai, lalu konfirmasi penggunaan data contoh.
5. Simpan pengajuan. Status dimulai dari pending. Tombol simulasi dapat mengubah pending menjadi approved atau rejected. Approved dapat dikonfirmasi menjadi active, tanpa transaksi. Pending/approved juga dapat dibatalkan.
6. Persetujuan memesan slot demo; aktivasi tidak mengurangi slot dua kali. Pembatalan melepas reservasi. Duplikasi anak/daycare dan dua pengasuhan aktif untuk anak yang sama dicegah.
7. Dashboard dan logbook hanya menampilkan anak dengan pengasuhan aktif. Logbook memiliki pilihan anak, tanggal dan kategori; contoh aktivitas tidak ditampilkan sebelum tanggal mulai atau sesudah hari ini.
8. Reaksi, komentar, laporan, ulasan, dan status baca notifikasi tersimpan pada demo lokal. Ulasan hanya dapat dibuat untuk daycare yang terhubung dengan anak aktif.
9. Profil memungkinkan perubahan identitas contoh, penambahan anak, serta reset seluruh data demo dengan konfirmasi.

## Rekomendasi akses produksi — belum menjadi autentikasi server

Gunakan model hibrida: pengunjung dapat mengenali dan membandingkan daycare sebelum membuat akun; akun diperlukan sebelum memasukkan atau mengakses data anak. Aturan di bawah adalah rekomendasi produk, bukan klaim bahwa autentikasi dan otorisasi produksi sudah tersedia.

| Halaman / tindakan | Akses yang disarankan | Batas data |
| --- | --- | --- |
| Splash, katalog, pencarian | Publik | Informasi daycare yang disetujui untuk publikasi |
| Detail, harga, fasilitas, skor, ringkasan ulasan | Publik | Tidak menyertakan identitas anak, laporan pribadi, atau dokumen legal mentah yang memuat data pribadi |
| Komparasi maksimal tiga daycare | Publik | Pilihan sementara di browser; penyimpanan lintas perangkat dapat membutuhkan akun |
| Pendaftaran anak | Login Orang Tua | Tampilkan informasi paket bagi tamu; minta login sebelum mengisi data pribadi anak dan mengirim pengajuan |
| Status pendaftaran | Login Orang Tua | Hanya pengajuan milik akun tersebut |
| Dashboard, profil, notifikasi | Login Orang Tua | Hanya data milik akun; akun baru tetap dapat melihat status kosong atau pengajuan yang menunggu |
| Logbook, foto, komentar aktivitas | Login + hubungan pengasuhan yang sah | Hanya anak yang menjadi tanggung jawab pengguna; aturan akses setelah pengasuhan berakhir perlu ditetapkan |
| Laporan insiden dan tindak lanjut | Login + hubungan dengan anak/daycare | Identitas dan isi laporan tidak menjadi bagian katalog publik |
| Menulis ulasan | Login + riwayat pengasuhan terverifikasi | Demo saat ini mensyaratkan pengasuhan aktif; kelayakan setelah pengasuhan selesai perlu ditetapkan |
| Portal Caregiver / Administrator | Login sesuai peran | Pengelola hanya mengakses daycare yang ditugaskan; administrator tidak memakai pendaftaran publik |

Alur produksi yang disarankan:

```text
Katalog → Pencarian → Detail ↔ Komparasi
                         ↓
                  Pilih Daftarkan Anak
                         ↓
              Masuk / Daftar jika belum login
                         ↓
             Kembali ke daycare dan paket pilihan
                         ↓
            Formulir anak → Status pendaftaran
                         ↓
            Disetujui → Konfirmasi aktivasi
                         ↓
            Dashboard → Logbook / Laporan
```

Sesudah login, pertahankan pilihan daycare, paket, filter, dan komparasi. Tujuan kembali harus berupa rute internal yang divalidasi. Jangan menjadikan localStorage atau sekadar menyembunyikan menu sebagai pembatas akses produksi. Server harus memeriksa sesi, peran, dan hubungan pengguna dengan anak/daycare pada setiap permintaan data atau perubahan. Rujukan: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Navbar publik sebaiknya menonjolkan Cari Daycare, Bandingkan, Cara Kerja, dan Masuk/Daftar. Navbar akun orang tua menambahkan Beranda, Status Pendaftaran, Logbook, Laporan, Notifikasi, serta Profil. Akun yang belum memiliki anak aktif tetap memperoleh petunjuk langkah berikutnya.

### Keputusan produk sebelum integrasi backend

1. **Kapan pengasuhan aktif?** Rekomendasi awal: setelah pengelola menyetujui dan orang tua mengonfirmasi tanggal mulai. Jika pembayaran menjadi syarat, status pembayaran harus menjadi langkah tersendiri. Demo belum melakukan transaksi.
2. **Siapa yang boleh mengulas?** Rekomendasi: orang tua dengan pengasuhan aktif atau riwayat pengasuhan yang terverifikasi. Demo saat ini hanya mengizinkan hubungan aktif.
3. **Siapa yang boleh melapor?** Rekomendasi: laporan terkait anak hanya untuk orang tua yang berwenang. Jika aduan publik dibutuhkan, sediakan alur terpisah dengan proses verifikasi sendiri.
4. **Apa arti laporan anonim?** Rekomendasi: identitas disembunyikan dari pihak terlapor, sementara petugas berwenang tetap dapat menindaklanjuti. Kebijakan ini perlu dijelaskan sebelum laporan dikirim; sakelar demo belum menerapkan pemisahan identitas di server.
5. **Apa yang terjadi setelah keluar dari daycare?** Tetapkan masa akses arsip logbook, hak mengulas, dan jalur tindak lanjut laporan. Jangan menyamakan berhentinya pengasuhan dengan hilangnya seluruh riwayat.

## Integrasi portal demo

Pengajuan Kasih Bunda dapat ditinjau dari Pengelola; alasan keputusan tampil pada status pendaftaran. Narasi logbook yang disetujui pengasuh tampil untuk anak/tanggal yang sesuai, sedangkan draf tetap khusus Pengelola. Balasan ulasan dan tindak lanjut laporan Pengelola/Admin tampil pada sisi Orang Tua. Semua pertukaran ini lokal pada browser dan origin yang sama; belum ada komunikasi ke layanan eksternal. Lihat [cara mencoba tiga peran](./frontend-portals.md).

## Penyimpanan dan batas integrasi

[ParentDemoProvider](../components/features/ParentDemoProvider.js), [store demo](../services/parent-demo-store.js), [logika domain](../lib/parent.js), dan [fixture daycare](../data/daycares.js) terpisah agar adapter backend dapat ditambahkan kemudian.

- Kunci localStorage: `ayomi-parent-demo-v1`. Pembaruan tersinkron antartab pada browser dan origin yang sama melalui storage event.
- Jika penyimpanan diblokir atau kuota habis, perubahan tetap tersedia dalam memori tab dan pengguna diberi keterangan.
- Data tersimpan yang rusak dipulihkan menjadi keadaan demo kosong.
- Mode demo bukan sesi login. Tidak ada autentikasi produksi, reservasi nyata, pembayaran, email, atau pengiriman laporan ke pihak luar.
- Dokumen pendaftaran dan bukti laporan hanya divalidasi sebagai pilihan berkas. Isi berkas tidak dibaca, diunggah, atau dipersistenkan; pengajuan menyimpan jumlah lampiran saja.
- Skor, legalitas, kapasitas, jarak, rating, ringkasan ulasan, aktivitas, dan ringkasan kesehatan adalah contoh. Bobot tampilan skor mengikuti Hallmark (30/35/35), belum menetapkan algoritma produksi.
- AI Safety Score, OCR, review summary, dan face masking belum terhubung ke layanan AI. Logbook hanya menampilkan ilustrasi tanpa identitas/wajah anak.
- AI Urgency Triage ditandai belum aktif. Prioritas laporan dipilih manual, bukan hasil asesmen medis atau AI. Tidak ada klaim bahwa notifikasi darurat telah diteruskan.
- Halaman laporan menegaskan bahwa demo bukan kanal pertolongan untuk kejadian nyata.

## Verifikasi

```sh
node --test lib/auth.test.mjs lib/parent.test.mjs
npm run lint
npm run build
npm run dev
```

16 pengujian mencakup autentikasi frontend sebelumnya, filter wilayah dan sort, batas komparasi, tanggal/usia, transisi status, duplikasi, kapasitas slot, data lokal rusak, validasi lampiran, serta fallback memori saat localStorage tidak dapat ditulis.

## Aset ilustrasi

Dibuat memakai tool bawaan **imagegen**, kemudian dikonversi ke WebP dengan Sharp. Tidak ada orang pada kedua gambar ini; keduanya bukan foto fasilitas daycare nyata.

- [daycare-room.webp](../public/images/daycare-room.webp): 1536 × 1024 px.
- [daycare-garden.webp](../public/images/daycare-garden.webp): 1536 × 1024 px.

Prompt ruangan:

```text
Use case: photorealistic-natural. Asset type: wide 3:2 website daycare directory photograph. Primary request: bright clean contemporary Indonesian Montessori daycare playroom, NO people. Natural light through tall windows, low pale oak shelving, sage and warm cream walls, large wooden toddler blocks, low rounded wooden tables, soft cotton rug, indoor plant, small reading nook. Architectural editorial photography, natural texture, calm inviting atmosphere, eye-level wide angle. No text, logos, watermarks, graphic overlays, collage, or identifiable children. One coherent room.
```

Prompt taman:

```text
Use case: photorealistic-natural. Asset type: wide 3:2 website daycare directory photograph. Primary request: safe enclosed Indonesian daycare outdoor courtyard, NO people. Small rounded wooden playhouse and low toddler slide, green lawn and rubber safety surface, tropical potted plants, shaded play area with cream canopy, airy white building behind. Authentic modest clean preschool setting, warm daylight, natural sage green and terracotta details, editorial architectural photography. No text, logos, watermarks, graphic overlays, collage, or people. One coherent view.
```

