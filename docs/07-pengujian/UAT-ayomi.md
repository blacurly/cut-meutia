# UAT Ayomi: Semua Fitur dan Peran

**Versi aplikasi:** `main` @ `6503bbe`, ditambah perapian 20 November 2026.

**Acuan kebutuhan:** PRD Ayomi v1.2 (Skala Nasional), 26 Oktober 2026. Pemetaan setiap kebutuhan fungsional (FR) ke skenario uji ada di [bagian 12](#12-keterlacakan-ke-prd-v12).

**Status:** selesai. **113 dari 113 skenario LULUS**; rekap di [bagian 14](#14-rekap). Masukan peserta UAT ada di [bagian 13](#13-masukan-peserta-uat).

**Lingkungan:**
- Production: `https://project-ayomi-cut-meutia.vercel.app`;
- lokal: `npm run dev`.

**Keterangan kolom Hasil:**
- `LULUS`: hasil sesuai kolom "Hasil yang diharapkan".
- `GAGAL`: hasil tidak sesuai; kolom Catatan berisi kejadian, tangkapan layar, dan jam kejadian (untuk mencari log di Vercel).
- `DILEWATI`: tidak diuji.
- Baris bertanda 📱 diuji di **laptop** dan **HP** (atau DevTools dengan lebar 390 px).

---

## 0. Persiapan

| # | Persiapan | Cek |
| --- | --- | --- |
| 0.1 | Migrasi Supabase sudah berjalan sampai `20261120100000_incident_triage.sql` (sudah dicek 19 November) | ☑ |
| 0.2 | Vercel dan `.env.local` sudah terisi: `NEXT_PUBLIC_SUPABASE_*`, `AI_*`, `CV_API_*`, `OCR_API_*`, `TRIAGE_API_*` | ☑ |
| 0.3 | Layanan menyala, cek `/health` masing-masing: OCR (`ayomi-ocr-api.neoartd.my.id`), triage (`ayomi-triage-api.neoartd.my.id`), dan CV (Foto Fokus) | ☑ |
| 0.4 | Akun **Admin** milikmu sendiri | ☑ |
| 0.5 | Akun demo daycare dari `Akun_Demo_Daycare_Sederhana.csv`: 1 **Pengelola** dan 2 **Pengasuh** per daycare | ☑ |
| 0.6 | Dua email yang bisa dibuka untuk **Orang Tua baru** (OT-1, OT-2) dan satu email untuk **calon Pengelola** daycare uji | ☑ |
| 0.7 | Berkas spesimen fiktif di `docs/06-fitur-ai/spesimen-dokumen/` (A = Pelangi Biru, B, C) dan kuncinya di `kunci-jawaban.json` | ☑ |
| 0.8 | Satu foto kegiatan berisi anak dan orang dewasa (JPG/PNG, < 4 MB), satu PDF, dan satu berkas bukan gambar (misalnya `.txt`) untuk uji penolakan | ☑ |
| 0.9 | **Pengajuan dengan tanggal layanan = hari uji.** Check-in hanya bisa pada tanggal layanan. Catatan harian hanya bisa ditulis selama jam penugasan (Mulai ≤ sekarang < Selesai) dan untuk tanggal layanan. Saat **Tugaskan**, isi **Selesai** (wajib; tanpa itu tombol abu-abu) dan set **Mulai** sebelum jam uji | ☑ |
| 0.10 | Pengasuh yang diundang harus **diverifikasi Admin** dulu (`/admin/verifikasi-legal` → Pengasuh menunggu verifikasi). Setelah itu baru muncul di pilihan **Tugaskan** | ☑ |

**Akun pada tabel di bawah:**
- **ADM:** Admin.
- **PL:** Pengelola daycare demo.
- **PG1** dan **PG2:** Pengasuh daycare yang sama.
- **OT1** dan **OT2:** Orang Tua yang dibuat saat uji.
- **TAMU:** belum login.

**Padanan istilah PRD:** peran *Caregiver* di PRD dipecah menjadi dua peran di aplikasi. **Pengelola** mengurus daycare: pendaftaran, staf, dokumen, dan profil. **Pengasuh** menulis catatan harian dan melapor insiden untuk anak yang ditugaskan kepadanya.

---

## 1. Pengunjung (belum login)

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| TM-01 📱 | Halaman awal | Buka `/welcome` lalu `/` | Halaman tampil tanpa error, logo dan menu terbaca, tidak ada scroll ke samping di HP | LULUS | |
| TM-02 📱 | Katalog dan pencarian | Buka `/pencarian`, ketik nama kota (misalnya "Bekasi") | Daftar daycare muncul dan hasilnya sesuai kata kunci | LULUS | |
| TM-03 | Filter wilayah | Pilih Provinsi → Kota/Kabupaten → Kecamatan | Pilihan kota mengikuti provinsi, dan hasil menyempit | LULUS | |
| TM-04 | Filter biaya dan rating | Isi "Biaya bulanan maksimal" dan "Rating publik minimal", lalu **Reset filter** | Hasil terfilter, dan Reset mengembalikan semua | LULUS | |
| TM-05 | Pencarian kosong | Cari "zzzzqqq" | Pesan "Belum ada pilihan yang cocok", bukan halaman error | LULUS | |
| TM-06 | Halaman hasil | Pindah ke halaman berikutnya lalu "Sebelumnya" | Penomoran halaman berfungsi | LULUS | |
| TM-07 📱 | Detail daycare | Klik satu daycare, buka tab Ringkasan, Biaya & Paket, dan Fasilitas & Legalitas | Semua tab tampil. Daycare katalog (bukan mitra) menampilkan label data publik/sintetis | LULUS | |
| TM-08 | Safety Score di detail | Buka daycare yang skornya sudah dipublikasikan (setelah AD-16) | Skor, 4 komponen, dan alasannya tampil. Daycare yang belum dinilai menampilkan "Belum dinilai" | LULUS | |
| TM-09 | Bandingkan | Pilih 2–3 daycare untuk dibandingkan, buka `/bandingkan/hasil` | Tabel perbandingan tampil | LULUS | |
| TM-10 | Halaman terlindungi | Buka `/beranda`, `/pengelola`, `/admin`, `/catatan-harian` tanpa login | Muncul ajakan masuk atau dialihkan ke `/masuk`. Data pribadi tidak tampil | LULUS | |
| TM-11 | API tanpa login | Buka `/api/incidents` di browser | JSON `401` "Sesi login berakhir" | LULUS | |

## 2. Akun dan autentikasi

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| AU-01 📱 | Daftar Orang Tua (OT1) | Buka `/daftar`, isi nama, email, WhatsApp `08xx`, sandi minimal 8 karakter (huruf dan angka), centang syarat | Muncul langkah "cek email Anda", ada tombol kirim ulang | LULUS | |
| AU-02 | Validasi daftar | Coba: nama 1 huruf, email salah, nomor bukan `08`, sandi tanpa angka, syarat tidak dicentang | Setiap kesalahan memunculkan pesan yang jelas, akun tidak dibuat | LULUS | |
| AU-03 | Konfirmasi email | Klik tautan di email | Diarahkan ke `/beranda`, atau `/masuk?auth=email-confirmed` kalau dibuka di perangkat lain | LULUS | |
| AU-04 | Kirim ulang konfirmasi | Di langkah cek email, tekan kirim ulang | Pesan "email konfirmasi dikirim lagi". Kalau terlalu sering: pesan batas percobaan | LULUS | |
| AU-05 | Daftar dengan email yang sudah ada | Daftar ulang memakai email OT1 | Pesan yang tidak membocorkan apakah email terdaftar (atau "Email sudah terdaftar" sesuai Supabase) | LULUS | |
| AU-06 | Masuk Orang Tua | Buka `/masuk`, pilih peran Orang Tua, masuk dengan OT1 | Masuk ke `/beranda`, nama tampil di navbar | LULUS | |
| AU-07 | Masuk dengan peran salah | Pilih peran Pengasuh/Pengelola tetapi masuk dengan akun OT1 | Ditolak dengan "Akun ini tidak memiliki peran yang dipilih…", dan tidak tetap login | LULUS | |
| AU-08 | Sandi salah | Masuk dengan sandi keliru | "Email atau kata sandi salah" | LULUS | |
| AU-09 | Masuk staf | Masuk sebagai PL lalu PG1 lewat peran Pengasuh/Pengelola | Masuk ke `/pengelola`. Menu PL berbeda dari menu PG | LULUS | |
| AU-10 | Masuk Admin | Masuk sebagai ADM lewat peran Admin | Masuk ke `/admin`. Pendaftaran Admin publik tidak tersedia | LULUS | |
| AU-11 | Lupa sandi | Tekan "Atur ulang kata sandi", buka email, buat sandi baru | Sandi berubah, lalu bisa masuk dengan sandi baru | LULUS | |
| AU-12 | Tautan pemulihan kedaluwarsa | Buka tautan pemulihan yang sama untuk kedua kalinya | Pesan tautan kedaluwarsa, tidak error | LULUS | |
| AU-13 | Keluar | Tekan keluar, lalu tekan Back di browser | Kembali menjadi tamu, data pribadi tidak tampil | LULUS | |

## 3. Orang Tua (OT1)

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| OT-01 | Profil | Buka `/profil`, ubah nama dan nomor WhatsApp, simpan | "Profil berhasil disimpan…", data bertahan setelah refresh | LULUS | |
| OT-02 | Tambah anak | Tambah anak (nama 2–80 karakter, tanggal lahir tidak di masa depan) | "Profil anak berhasil disimpan…" | LULUS | |
| OT-03 | Validasi anak | Tanggal lahir besok, nama 1 huruf | Pesan validasi, data tidak tersimpan | LULUS | |
| OT-04 | Data kesehatan | Buka Data kesehatan, isi alergi/catatan obat/kebutuhan khusus dan alasan perubahan, simpan | "Data kesehatan tersimpan…", **Riwayat kesehatan** mencatat perubahan | LULUS | |
| OT-05 📱 | Daftarkan anak | Dari detail daycare mitra, buka `/pendaftaran-anak?daycare=…`, pilih anak, layanan, tanggal, centang persetujuan, kirim | Pengajuan tercipta dengan status **Menunggu keputusan** | LULUS | |
| OT-06 | Persetujuan wajib | Kirim pengajuan tanpa mencentang persetujuan | Ditolak dengan pesan | LULUS | |
| OT-07 | Batalkan pengajuan | Di `/status-pendaftaran`, tekan **Batalkan pengajuan** pada pengajuan kedua | Status **Dibatalkan** | LULUS | |
| OT-08 | Pembayaran QR | Setelah PL menyetujui (PL-02), status **Menunggu pembayaran**, buka QR | QR QRIS dengan nominal tagihan tampil (QR demo kalau `QRIS_STATIC_PAYLOAD` kosong) | LULUS | |
| OT-09 | Status aktif | Setelah ADM menandai berhasil (AD-03) | Status **Aktif**, ada notifikasi | LULUS | |
| OT-10 | Logbook | Setelah PG mengirim catatan (PG-07), buka `/catatan-harian` | Catatan tampil. **Hanya foto versi fokus anak**, foto asli tidak ada | LULUS | |
| OT-11 | Love dan komentar | Beri love, tulis komentar, lalu hapus komentar sendiri | Hitungan love berubah, komentar muncul lalu hilang | LULUS | |
| OT-12 | Tandai dibaca | Tekan **Tandai sudah dibaca** | Tanda dibaca tersimpan | LULUS | |
| OT-13 | Laporan insiden | Setelah PG melapor (PG-10), buka `/laporan` | Insiden anak sendiri tampil dengan urgensi. Tekan **Saya sudah membaca laporan ini** | LULUS | |
| OT-14 | Ajukan komplain | Di `/laporan` → **Ajukan komplain**, pilih kategori (misalnya Layanan daycare), isi, kirim | Komplain muncul di **Komplain saya** dengan status **Baru** | LULUS | |
| OT-15 | Menjawab permintaan informasi | Setelah ADM memilih **Minta informasi** (AD-21), isi jawaban → **Kirim jawaban** | Status pindah dari **Menunggu jawaban Anda** | LULUS | |
| OT-16 | Konfirmasi penyelesaian | Setelah ADM mengusulkan penyelesaian (status **Menunggu konfirmasi**), tekan **Terima penyelesaian**. Di komplain lain, tekan **Tolak** dengan alasan | Terima → **Selesai**. Tolak (alasan wajib) → **Ditangani** lagi. Tanpa konfirmasi dalam 72 jam → otomatis **Ditutup** | LULUS | |
| OT-17 | Notifikasi | Buka `/notifikasi`, **Tandai dibaca** dan **Tandai semua dibaca** | Penanda di navbar berkurang | LULUS | |
| OT-18 | Ulasan | Setelah pengasuhan **Selesai** (PL-05), buka `/ulasan`, beri rating 1–5 dan ulasan 20–2.000 karakter | Ulasan terkirim dan menunggu moderasi Admin. Sebelum selesai: "Belum ada pengasuhan yang selesai" | LULUS | |
| OT-19 | Akses portal lain | Buka `/pengelola` dan `/admin` | Pesan "bukan untuk akun Anda", tidak ada data staf | LULUS | |
| OT-20 | Data orang tua lain | Masuk sebagai OT2, buka `/catatan-harian` dan `/laporan` | Tidak ada data anak OT1 sama sekali | LULUS | |

## 4. Pengasuh (PG1, yang ditugaskan; PG2, yang tidak ditugaskan)

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| PG-01 | Dashboard | Masuk PG1 → `/pengelola` | Daftar tugas anak yang ditugaskan (setelah PL-03) | LULUS | |
| PG-02 📱 | Tulis catatan | `/pengelola/laporan-harian/tambah`: pilih anak dan jenis (Bermain/Belajar/Makan/Tidur/…), tulis 2–3 baris catatan → **Simpan draf** | Draf tersimpan | LULUS | |
| PG-03 | Buat draf AI | Pada draf, tekan **Buat draf AI** | Muncul usulan teks berlabel AI. Isinya hanya berdasarkan catatan, tanpa menambah fakta | LULUS | |
| PG-04 | Pakai atau buang draf AI | Tekan **Pakai draf ini**, edit, simpan. Ulangi lalu tekan **Buang** | "Pakai" mengisi formulir dan masih bisa diedit. "Buang" tidak mengubah catatan | LULUS | |
| PG-05 📱 | Foto Fokus Anak | Di catatan, tekan **Foto** → **Ambil foto** atau pilih berkas → ketuk siluet anak (hijau) → **Unggah & buat versi fokus** | Versi fokus jadi: hanya anak yang tajam, orang dewasa dan latar diburamkan | LULUS | |
| PG-06 | Tolak berkas salah | Unggah `.txt` atau gambar lebih dari 4 MB | Ditolak dengan pesan tipe/ukuran | LULUS | |
| PG-07 | Kirim ke Orang Tua | Tinjau versi fokus (**Tandai sudah ditinjau**), lalu **Kirim ke Orang Tua** | Status terkirim, catatan tampil di OT-10 | LULUS | |
| PG-08 | Hapus draf | Buat draf lain → **Hapus draf** | Draf hilang | LULUS | |
| PG-09 | Pengasuh tidak ditugaskan | Masuk PG2, coba menulis catatan untuk anak OT1 | Anak tidak tersedia, atau aksi ditolak | LULUS | |
| PG-10 | Lapor insiden | `/pengelola/insiden` → pilih anak, isi uraian, pertolongan pertama, urgensi **Rendah** → **Kirim laporan**. Uraian: *"Anak tersedak potongan apel, bibirnya kebiruan dan tidak bisa batuk."* | Laporan tersimpan dengan urgensi Rendah. Beberapa detik kemudian (refresh) AI menaikkannya (lihat PL-08) | LULUS | |
| PG-11 | Halaman uji Foto Fokus | `/pengelola/foto-fokus` | Bisa dicoba tanpa menyimpan ke catatan | LULUS | |
| PG-12 | Menu khusus Pengelola | Buka `/pengelola/pendaftaran`, `/pengelola/staf`, `/pengelola/dokumen` | "Khusus Pengelola", tanpa data | LULUS | |

## 5. Pengelola (PL)

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| PL-01 | Daftar pengajuan | `/pengelola/pendaftaran` | Pengajuan OT1 (OT-05) tampil | LULUS | |
| PL-02 | Setujui/tolak | **Setujui** pengajuan OT1, **Tolak** pengajuan lain dengan alasan | Pengajuan disetujui → **Menunggu pembayaran**. Pengajuan ditolak → **Ditolak**, OT mendapat notifikasi | LULUS | |
| PL-03 | Tugaskan pengasuh | Setelah status Aktif → **Tugaskan** PG1 | PG1 melihat anak di dashboard | LULUS | |
| PL-04 | Check-in | **Check-in anak** pada hari layanan | Tercatat. Check-in sebelum hari layanan ditolak | LULUS | |
| PL-05 | Selesaikan | **Selesaikan pengasuhan** | Status **Selesai**, OT bisa memberi ulasan | LULUS | |
| PL-06 | Logbook | `/pengelola/laporan-harian` | Melihat catatan yang sudah dikirim pengasuh di daycare ini | LULUS | |
| PL-07 | Status insiden | `/pengelola/insiden` → laporan PG-10 → **Tangani** (alasan minimal 10 karakter) → **Selesai** | Status berubah dan tercatat | LULUS | |
| PL-08 | **Penilaian urgensi (AI)** | Pada laporan PG-10, buka panel **PENILAIAN URGENSI** | Tampil "pelapor: Rendah → dipakai: Darurat (dinaikkan AI)", kutipan kalimat laporan, mesin "aturan rubrik draf-1", dan peringatan perlu ditinjau. Ada notifikasi kedua tentang kenaikan urgensi | LULUS | |
| PL-09 | Nilai ulang | Tekan **Nilai (ulang) dengan AI** | Hasil baru masuk ke riwayat. Lebih dari 10 kali per menit → pesan batas | LULUS | |
| PL-10 | Tetapkan urgensi | Isi form override: pilih **Tinggi**, alasan minimal 10 karakter → **Tetapkan urgensi**. Lalu **Nilai ulang** | Urgensi menjadi Tinggi dengan sumber "ditetapkan Pengelola". Nilai ulang setelah itu **tidak** mengubah urgensi | LULUS | |
| PL-11 | Laporan tanpa tanda bahaya | PG1 melapor *"Anak bermain balok lalu menangis sebentar karena rebutan mainan"* (Rendah) | AI tidak menaikkan, urgensi tetap Rendah | LULUS | |
| PL-12 | Ulasan dan balasan | `/pengelola/ulasan` → balas ulasan yang sudah terbit → **Kirim balasan** | Balasan menunggu moderasi Admin | LULUS | |
| PL-13 | Undang staf | `/pengelola/staf` → **Buat undangan** (email baru) → **Salin** | Tautan `/undangan#…` tersalin (uji di ST-01) | LULUS | |
| PL-14 | Nonaktifkan pengasuh | **Nonaktifkan** pengasuh uji | Pengasuh itu kehilangan akses ke data daycare | LULUS | |
| PL-15 | Unggah dokumen | `/pengelola/dokumen` → **Unggah dokumen**: unggah 5 PDF spesimen A dengan jenis, nomor, dan tanggal sesuai isi PDF | Kelimanya berstatus menunggu verifikasi. **Lihat berkas** membuka PDF | LULUS | |
| PL-16 | Tolak berkas salah | Unggah `.txt` atau PDF lebih dari 15 MB | Ditolak | LULUS | |
| PL-17 | Foto galeri | `/pengelola/foto` → unggah foto fasilitas | Status menunggu, belum tampil di halaman publik | LULUS | |
| PL-18 | Profil dan layanan | `/pengelola/profil/edit` → ubah deskripsi → **Simpan profil**. Ubah harga layanan → **Simpan layanan** | Profil tersimpan. Harga baru menunggu persetujuan Admin | LULUS | |

## 6. Calon staf (undangan)

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| ST-01 | Terima undangan, akun baru | Buka tautan dari PL-13 → **Buat akun baru** dengan email yang diundang → konfirmasi email → **Terima undangan** | Menjadi Pengasuh daycare itu dan bisa masuk ke `/pengelola` | LULUS | |
| ST-02 | Email tidak cocok | Buka tautan saat login dengan email lain → **Terima undangan** | Ditolak (email tidak sesuai undangan) | LULUS | |
| ST-03 | Tautan dipakai ulang | Buka tautan yang sama setelah diterima | "Undangan sudah dipakai" | LULUS | |
| ST-04 | Tautan rusak | Hapus sebagian token di URL | "Tautan undangan tidak lengkap" / token tidak valid | LULUS | |

## 7. Admin (ADM)

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| AD-01 | Overview | `/admin` | Pusat kendali tampil: antrean pembayaran, moderasi, dan ringkasan | LULUS | |
| AD-02 | Moderasi ulasan | Ulasan OT1 (OT-18) → **Terbitkan**. Balasan PL (PL-12) → **Terbitkan**. Ulasan lain → **Tolak** | Yang diterbitkan muncul di halaman daycare, yang ditolak tidak | LULUS | |
| AD-03 | Konfirmasi pembayaran | Pembayaran OT1 → **Tandai berhasil**. Uji juga **Gagal** dan **Kedaluwarsa** pada transaksi lain | Berhasil → pendaftaran Aktif. Gagal/kedaluwarsa → status sesuai, dan OT mendapat notifikasi | LULUS | |
| AD-04 | Buat daycare mitra uji | `/admin/daycare` → **Buat daycare mitra**: "Taman Asuh Pelangi Biru" (data fiktif A dari kunci jawaban) + email calon Pengelola → **Salin** undangan | Mitra baru berstatus **nonaktif** dan **tidak** muncul di katalog | LULUS | |
| AD-05 | Undangan Pengelola | Calon Pengelola menerima undangan (seperti ST-01) | Menjadi Pengelola daycare uji | LULUS | |
| AD-06 | Status mitra | **Aktifkan** → cek katalog → **Nonaktifkan** lagi. Uji juga **Tangguhkan** | Aktif → tampil di katalog. Nonaktif/ditangguhkan → hilang | LULUS | |
| AD-07 | Verifikasi dokumen | `/admin/verifikasi-legal` → **Lihat berkas** | PDF yang benar terbuka | LULUS | |
| AD-08 | **Baca dengan AI** (OCR) | Pada dokumen spesimen A, tekan **Baca dengan AI** | Dalam 2–60 detik muncul isian usulan (nomor, penerbit, tanggal) dengan kutipan halaman. Isian yang tidak terbaca dikosongkan, tidak dikarang | LULUS | |
| AD-09 | AI mendeteksi nomor salah | Unggah ulang satu dokumen dengan nomor yang sengaja salah ketik, lalu **Baca dengan AI** | Ada peringatan bahwa nomor berbeda dengan isian Pengelola | LULUS | |
| AD-10 | Keputusan dokumen | **Setujui** dokumen A (dengan alasan), **Minta revisi** satu dokumen B, **Tolak** satu dokumen lain | Status berubah, Pengelola melihat keputusan dan alasannya | LULUS | |
| AD-11 | Dokumen kedaluwarsa | Dokumen izin operasional spesimen C (kedaluwarsa) | AI/pemeriksaan menandai kedaluwarsa | LULUS | |
| AD-12 | Verifikasi harga | Harga dari PL-18 → **Setujui** atau **Tolak** | Harga publik berubah hanya bila disetujui | LULUS | |
| AD-13 | Verifikasi foto | Foto dari PL-17 → **Tampilkan** atau **Tolak** | Hanya foto yang ditampilkan muncul di detail daycare | LULUS | |
| AD-14 | Verifikasi pengasuh | Pengasuh baru → **Verifikasi** atau **Tolak** | Status pengasuh berubah | LULUS | |
| AD-15 | Halaman Safety Score | `/admin/daycare` → **Safety Score** pada daycare uji | Form 4 komponen (Legalitas 40, SOP 25, Staf 20, Fasilitas 15) | LULUS | |
| AD-16 | Nilai A = 100 | Semua komponen **Lulus**, alasan, centang dokumen bukti yang sudah disetujui → **Publikasikan** | Pratinjau 100, skor terbit. Setelah mitra diaktifkan, skor tampil di detail daycare (TM-08) | LULUS | |
| AD-17 | Bukti tidak sah | Pilih **Lulus** tanpa dokumen bukti, atau dengan dokumen yang belum disetujui | Ditolak: "butuh dokumen bukti yang sudah disetujui…" | LULUS | |
| AD-18 | Belum diketahui | Biarkan satu komponen **Belum diketahui** → simpan | Ditolak, skor tidak disimpan | LULUS | |
| AD-19 | Legalitas belum lulus (C = 60) | Daycare C: Legalitas **Tidak lulus** → **Publikasikan** | Ditolak; hanya **Simpan sebagai draf** yang bisa (skor 60) | LULUS | |
| AD-20 | Insiden | `/admin/insiden` → insiden PG-10 → panel **Penilaian urgensi** sama seperti PL-08 → **Tangani** → **Selesai** | Sama seperti di sisi Pengelola. Admin juga bisa override | LULUS | |
| AD-21 | Komplain | Komplain OT1 → **Mulai tangani** → **Minta informasi** → (OT-15) → **Usulkan penyelesaian** → (OT-16) | Status mengikuti alur sampai **Selesai** atau kembali ditangani | LULUS | |
| AD-22 | Akses API Admin | Masuk sebagai PL, buka `/api/admin/transactions` | `403`, data tidak tampil | LULUS | |

## 8. Skenario ujung ke ujung lintas peran

| ID | Alur | Urutan uji | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| E2E-1 | Daycare mitra baru sampai tampil di katalog dengan Safety Score | AD-04 → AD-05 → PL-15 → AD-08 → AD-10 → AD-16 → AD-06 (aktifkan) → TM-08 → nonaktifkan lagi | LULUS | |
| E2E-2 | Pendaftaran sampai ulasan | AU-01 → OT-02 → OT-05 → PL-02 → OT-08 → AD-03 → PL-03 → PL-04 → PG-02…PG-07 → OT-10 → PL-05 → OT-18 → AD-02 | LULUS | |
| E2E-3 | Insiden darurat | PG-10 → (AI menaikkan) → notifikasi PL dan ADM → PL-08 → PL-10 → OT-13 → PL-07 | LULUS | |
| E2E-4 | Komplain | OT-14 → AD-21 → OT-15 → OT-16 | LULUS | |

## 9. Keamanan dan hak akses

| ID | Skenario | Langkah | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| SC-01 | Foto asli logbook | OT1 mencoba membuka URL foto asli (jika terlihat di DevTools) | Tidak bisa diakses. Foto asli terhapus setelah versi fokus disetujui | LULUS | |
| SC-02 | Data antar daycare | PL daycare A membuka ID pendaftaran atau insiden daycare B lewat URL/API | `404`/`403` | LULUS | |
| SC-03 | Sesi kedaluwarsa | Hapus cookie situs, lalu lakukan aksi | Diminta masuk kembali, tidak ada error 500 | LULUS | |
| SC-04 | Kiriman dari situs lain | (Opsional, dengan DevTools) `fetch` POST ke API dari tab situs lain | `403 invalid_origin` | LULUS | |
| SC-05 | Layanan AI tanpa token | Buka `https://ayomi-triage-api.neoartd.my.id/triage` dengan POST tanpa token | `401` | LULUS | |

## 10. Non-fungsional

| ID | Skenario | Hasil yang diharapkan | Hasil | Catatan |
| --- | --- | --- | --- | --- |
| NF-01 📱 | Semua halaman utama di lebar 390 px | Tidak ada scroll ke samping, tombol bisa disentuh, teks tidak terpotong | LULUS | |
| NF-02 | Jaringan lambat (DevTools "Slow 4G") | Ada indikator memuat, tidak ada klik ganda yang membuat data ganda | LULUS | |
| NF-03 | Layanan AI mati (matikan sementara atau kosongkan env lokal) | Laporan insiden tetap tersimpan dengan urgensi pelapor; fitur AI menampilkan pesan "belum tersedia", bukan error 500 | LULUS | |
| NF-04 | Refresh di tengah alur | Data tetap konsisten, tidak ada duplikat | LULUS | |

## 11. Di luar cakupan UAT (belum dibuat)

Fitur berikut **belum punya UI**. API-nya sudah ada, tetapi tidak diuji di UAT ini:
- delegasi Pengelola ke Pengasuh;
- penjemputan anak (`/pickup`) dan izin penjemput dari Orang Tua;
- investigasi dan sanksi oleh Admin;
- lampiran bukti untuk insiden dan komplain;
- Smart Reply, ringkasan ulasan, dan moderasi AI;
- notifikasi email/WhatsApp (yang ada baru notifikasi di aplikasi).

Dua di antaranya, **AI Summary Ulasan** dan **AI Smart Reply**, termasuk empat Fitur Utama AI di PRD v1.2. Statusnya dicatat di bagian 12.

## 12. Keterlacakan ke PRD v1.2

**Arti status:**
- **Terpenuhi:** sesuai PRD dan diuji di skenario yang disebut.
- **Terpenuhi, disesuaikan:** kebutuhannya ada, tetapi cara kerjanya berbeda dari teks PRD; perbedaannya dijelaskan.
- **Sebagian:** sebagian isi FR belum dibuat.
- **Belum:** belum dibuat di MVP ini.

### 12.1 Kebutuhan fungsional

| FR | Kebutuhan PRD (ringkas) | Skenario UAT | Status | Keterangan |
| --- | --- | --- | --- | --- |
| FR-01 | Daftar dan masuk dengan email + sandi (Supabase Auth, JWT) | AU-01 – AU-13 | Terpenuhi | |
| FR-02 | Peran awal *parent*; peran staf dan admin ditetapkan | AU-01, AU-07, AU-10, ST-01, AD-05, AD-14 | Terpenuhi, disesuaikan | Staf masuk lewat undangan Pengelola lalu diverifikasi Admin; Pengelola lewat undangan Admin. Pendaftaran Admin publik tidak ada |
| FR-03 | Ubah nama, nomor telepon, foto profil | OT-01 | Sebagian | Nama dan WhatsApp bisa diubah. Foto profil belum; yang tampil inisial nama |
| FR-04 | Akun terhubung ke Supabase Auth untuk RLS | OT-20, SC-02, AD-22 | Terpenuhi | |
| FR-05 | Daftar dan detail daycare: alamat, wilayah, harga, Safety Score, status izin, kuota | TM-02, TM-07, TM-08 | Terpenuhi, disesuaikan | Detail menampilkan kapasitas daycare, bukan sisa slot per hari; sisa kuota diperiksa saat pengajuan (FR-14). Daycare katalog non-mitra diberi label data publik/sintetis |
| FR-06 | Filter wilayah, GPS, harga, Safety Score, sisa slot | TM-02 – TM-06 | Sebagian | Ada: kata kunci, Provinsi → Kota/Kabupaten → Kecamatan, biaya maksimal, rating minimal, rasio pengasuh, usia anak, urutan. Belum: pencarian GPS, filter Safety Score dan sisa slot |
| FR-07 | Pengelola ubah profil daycare-nya; Admin ubah semua | PL-18, AD-04, AD-06 | Terpenuhi | Perubahan harga harus disetujui Admin (AD-12) |
| FR-08 | Status awal "Menunggu Verifikasi"; hanya Admin yang memverifikasi | AD-04, AD-06, AD-10, PL-15 | Terpenuhi | Mitra baru nonaktif dan tidak tampil di katalog sampai diaktifkan Admin |
| FR-09 | Daycare dengan riwayat pendaftaran tidak bisa dihapus | – | Terpenuhi (skema) | Diatur `ON DELETE RESTRICT` di basis data; tidak diuji lewat UI |
| FR-10 | CRUD profil anak, termasuk catatan kesehatan/alergi | OT-02 – OT-04 | Sebagian | Tambah anak dan ubah data kesehatan (beserta riwayat) ada. Ubah/hapus profil anak dan foto anak belum ada di UI |
| FR-11 | Catatan kesehatan hanya untuk Orang Tua, staf terkait, Admin | OT-04, OT-20, PG-09 | Terpenuhi | |
| FR-12 | Hapus akun Orang Tua menghapus data anak | – | Tidak diuji | Belum ada fitur hapus akun di UI |
| FR-13 | Pengajuan pendaftaran online, status awal *Pending* | OT-05, OT-06 | Terpenuhi | Label di aplikasi: "Menunggu keputusan" |
| FR-14 | Validasi anak milik Orang Tua dan slot tersedia | OT-05, OT-20 | Terpenuhi | Divalidasi di server; kuota dihitung per hari layanan |
| FR-15 | Cegah pengajuan aktif ganda | OT-05 | Terpenuhi | Satu anak hanya boleh punya satu pengasuhan aktif |
| FR-16 | Pengelola/Admin menyetujui atau menolak | PL-01, PL-02 | Terpenuhi | Penolakan wajib beralasan |
| FR-17 | Kuota berkurang secara atomik saat disetujui | PL-02, NF-02, NF-04 | Terpenuhi | Transaksi basis data dengan penguncian baris |
| FR-18 | Orang Tua memantau status pengajuan | OT-05, OT-07 – OT-09 | Terpenuhi | Alur: Menunggu keputusan → Menunggu pembayaran → Aktif → Selesai |
| FR-30 | Satu ulasan per daycare dari Orang Tua terdaftar | OT-18, AD-02 | Terpenuhi, disesuaikan | Ulasan baru bisa ditulis setelah pengasuhan selesai dan terbit setelah dimoderasi Admin |
| FR-31 | Safety Score dari OCR izin, rasio pengasuh, fasilitas; tercatat di log | AD-07 – AD-11, AD-15 – AD-19, TM-08 | Terpenuhi, disesuaikan | Komponen: Legalitas 40, SOP 25, Staf 20, Fasilitas 15. Admin menilai dari dokumen bukti yang sudah disetujui; OCR + AI hanya mengusulkan isian dokumen. Skor tidak dihitung otomatis oleh AI |
| FR-34 | Pilih hingga 3 daycare untuk dibandingkan | TM-09 | Terpenuhi | |
| FR-35 | Tabel perbandingan *side-by-side* | TM-09 | Terpenuhi | |
| FR-36 | Pengasuh mengunggah catatan harian (makan, tidur, mood, suhu, foto) | PG-01, PG-02, PG-05, PL-06 | Sebagian | Jenis catatan: Bermain, Belajar, Interaksi, Makan, Tidur, Lainnya; data makan dan tidur terisi terstruktur; foto lewat Foto Fokus. Kolom mood dan suhu tubuh belum (lihat masukan 13.1) |
| FR-37 | AI memburamkan wajah anak lain di foto (Privacy Masking) | PG-05, PG-06, OT-10, SC-01 | Terpenuhi, disesuaikan | **Foto Fokus Anak** (YOLO11 segmentasi): pengasuh memilih anak, lalu semua orang lain dan latar diburamkan, bukan hanya wajah. Foto asli tidak dikirim ke Orang Tua dan dihapus setelah ditinjau |
| FR-38 | AI menyusun draf narasi dari foto dan *timestamp* | PG-03, PG-04 | Terpenuhi, disesuaikan | Draf disusun dari catatan singkat pengasuh beserta data makan/tidur, bukan dari analisis foto. Draf berlabel AI dan wajib ditinjau sebelum dikirim |
| FR-39 | Orang Tua melapor insiden dengan kronologi dan bukti foto/video | PG-10, OT-13, OT-14 | Terpenuhi, disesuaikan | Insiden dilaporkan pengasuh dan dibaca Orang Tua. Orang Tua menyampaikan keluhan lewat **komplain**. Lampiran bukti belum ada (bagian 11) |
| FR-40 | AI mengklasifikasikan urgensi Rendah/Sedang/Tinggi/Darurat | PG-10, PL-08 – PL-11, AD-20, NF-03 | Terpenuhi, disesuaikan | AI hanya bisa menaikkan urgensi pelapor, menunjukkan kalimat buktinya, dan bisa ditetapkan ulang manusia dengan alasan |
| FR-41 | AI Smart Reply untuk membalas ulasan | PL-12 | Belum | Balasan ditulis manual oleh Pengelola, lalu dimoderasi Admin |
| FR-42 | Notifikasi perubahan status pendaftaran | PL-02, OT-09, OT-17 | Terpenuhi | |
| FR-43 | Notifikasi catatan harian baru dan tanggapan insiden | OT-10, OT-13, OT-17, PL-08 | Terpenuhi | Baru notifikasi di aplikasi; email/WhatsApp belum |

### 12.2 Fitur Utama AI

| Fitur Utama AI (PRD) | Status | Skenario UAT |
| --- | --- | --- |
| AI Safety Score & Legal Verification (OCR) | Terpenuhi, disesuaikan (lihat FR-31) | AD-07 – AD-19, TM-08 |
| AI Summary Ulasan & Smart Reply | Belum | – |
| AI Instant Logbook Drafter & Privacy Masking | Terpenuhi, disesuaikan (lihat FR-37, FR-38) | PG-03 – PG-07, OT-10, SC-01 |
| AI Incident Urgency Triage | Terpenuhi, disesuaikan (lihat FR-40) | PG-10, PL-08 – PL-11, AD-20 |

### 12.3 Kebutuhan non-fungsional dan batasan

| Kebutuhan PRD | Skenario UAT | Keterangan |
| --- | --- | --- |
| Keamanan: JWT dan RLS, kunci API AI hanya di server | SC-01 – SC-05, AD-22, OT-19, OT-20 | Terpenuhi |
| Privasi: data kesehatan dan foto tidak publik | OT-10, OT-20, SC-01 | Terpenuhi |
| Reliabilitas: transaksi atomik kuota | NF-02, NF-04 | Terpenuhi |
| Pembatasan laju panggilan AI | PL-09 | Terpenuhi |
| Dukungan perangkat (HP dan desktop) | NF-01, baris 📱 | Terpenuhi |
| Kinerja AI < 3 detik | AD-08, PL-08 | Belum memenuhi untuk OCR: pembacaan dokumen butuh 2–60 detik tergantung jumlah halaman. Waktu triage dan draf AI belum diukur terpisah |
| Aksesibilitas WCAG 2.1 AA | – | Tidak diuji di UAT ini |
| Batasan versi: tanpa *payment gateway* | OT-08, AD-03 | Sesuai. Orang Tua membayar lewat QRIS statis dan Admin mengonfirmasi secara manual |

## 13. Masukan peserta UAT

Masukan ini dicatat apa adanya dari sesi UAT bersama calon pengguna, lalu dikelompokkan. Semuanya **di luar cakupan MVP** dan tidak mengubah hasil uji di atas. Kolom "Kaitan" menunjukkan fitur yang sudah ada dan bisa dikembangkan.

### 13.1 Catatan rutinitas harian anak

Pengasuh ingin mencentang rutinitas berikut setiap hari, bukan menulisnya sebagai catatan bebas:

| No | Rutinitas | Kaitan dengan aplikasi sekarang |
| --- | --- | --- |
| 1 | Popok sudah diganti atau belum, setiap 3 jam sekali | Belum ada. Perlu jenis catatan baru dengan pengingat per 3 jam |
| 2 | Susu sudah diberikan | Bisa dicatat sebagai jenis **Makan**; belum ada isian khusus susu |
| 3 | Snack ringan | Bisa dicatat sebagai jenis **Makan** |
| 4 | Mandi sore | Belum ada jenis catatan khusus |
| 5 | Tidur siang | Sudah ada jenis **Tidur** dengan data tidur terstruktur |
| 6 | Kegiatan pagi hari | Bisa dicatat sebagai **Bermain** atau **Belajar** |
| 7 | BAB atau tidak | Belum ada |

Usulan tindak lanjut: daftar centang rutinitas per anak per hari. Hasilnya bisa masuk draf AI catatan harian, dan sekaligus melengkapi FR-36 (mood dan suhu tubuh).

### 13.2 Buku rapor perkembangan anak

Selain catatan harian, peserta meminta **buku rapor** berkala yang merangkum perkembangan anak, misalnya:
- aktivitas bersama;
- *sensory play*.

Usulan tindak lanjut: rapor mingguan atau bulanan yang disusun dari catatan harian, dengan draf AI yang tetap ditinjau pengasuh, sama seperti draf catatan harian sekarang.

### 13.3 Dokumentasi per anak dan pencarian anak dari foto

- **Dokumentasi per individu:** setiap anak punya kumpulan foto dan catatannya sendiri. Foto Fokus Anak sudah membuat versi foto untuk satu anak; yang belum ada adalah galeri per anak.
- **Mencari anak dari foto atau CCTV:** model YOLO mendeteksi keberadaan anak tertentu di tengah keramaian, misalnya saat bermain bersama. Model YOLO11 untuk Foto Fokus sudah ada. Untuk mengenali anak *tertentu* dibutuhkan pengenalan identitas. Karena menyangkut data biometrik anak, fitur ini butuh persetujuan tertulis Orang Tua dan kajian privasi sebelum dibuat.

### 13.4 Anak sakit dan kesehatan harian

Peserta menyoroti beberapa hal:
- Ada orang tua yang sadar dan mengabari ketika anaknya sakit, tetapi ada juga yang tidak peduli.
- Perlu kejelasan apakah anak yang sakit tetap diterima, dan perlakuan khususnya, misalnya ruangan dipisah.
- Perlu deteksi suhu tubuh anak, dan apakah anak sedang flu atau batuk pilek.

Usulan tindak lanjut:
- **Cek kesehatan saat check-in:** suhu tubuh dan gejala (batuk, pilek, demam) dicatat saat anak datang.
- **Kebijakan anak sakit per daycare:** ditampilkan di halaman detail, misalnya "anak demam di atas 37,5 °C tidak diterima" atau "ada ruang isolasi".
- **Pernyataan kesehatan dari Orang Tua** sebelum pengantaran, sehingga daycare tidak bergantung pada kepedulian masing-masing orang tua.
- Kalau suhu tinggi tercatat di siang hari, Orang Tua mendapat notifikasi, seperti catatan mendesak yang sudah ada.

## 14. Rekap

| Bagian | Jumlah uji | Lulus | Gagal | Dilewati |
| --- | --- | --- | --- | --- |
| 1 Pengunjung | 11 | 11 | 0 | 0 |
| 2 Autentikasi | 13 | 13 | 0 | 0 |
| 3 Orang Tua | 20 | 20 | 0 | 0 |
| 4 Pengasuh | 12 | 12 | 0 | 0 |
| 5 Pengelola | 18 | 18 | 0 | 0 |
| 6 Calon staf | 4 | 4 | 0 | 0 |
| 7 Admin | 22 | 22 | 0 | 0 |
| 8 Ujung ke ujung | 4 | 4 | 0 | 0 |
| 9 Keamanan | 5 | 5 | 0 | 0 |
| 10 Non-fungsional | 4 | 4 | 0 | 0 |
| **Total** | **113** | **113** | **0** | **0** |

**Kesimpulan:** semua 113 skenario lulus. Kebutuhan PRD v1.2 yang belum dibuat atau berjalan dengan penyesuaian tercatat di bagian 12, dan masukan peserta untuk pengembangan berikutnya tercatat di bagian 13.
