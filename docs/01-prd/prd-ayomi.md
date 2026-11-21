# PRD Ayomi (Aplikasi Web Day Care)

**Product Requirements Document**

| Field | Isi Deskripsi |
| --- | --- |
| Product Name | Ayomi (Aplikasi Web Day Care & Child Safety Platform) |
| Version | 1.3 (Skala Nasional, disesuaikan dengan implementasi MVP) |
| Date | 26 Oktober 2026 |
| Author(s) | Lia Mulyani, Sustri Elina Simamora |
| Status | In Review |
| Last Updated | 21 November 2026 |

Dokumen ini merupakan pembaruan resmi PRD Ayomi Skala Nasional yang memuat ekspansi jangkauan wilayah seluruh Indonesia (Multi-Kota & Multi-Provinsi), arsitektur database `db_ayomi` (10 tabel utama), breakdown task sprint CM001–CM044, serta 4 Fitur Utama AI terintegrasi.

> **Catatan v1.3:** Bagian 1–11 adalah isi PRD v1.2 tanpa perubahan, sebagai rencana awal produk. Perbedaan antara rencana itu dan aplikasi MVP yang dibangun, beserta alasannya, dicatat di [bagian 12](#12-perubahan-saat-implementasi-v13). Jika keduanya berbeda, bagian 12 yang menggambarkan sistem saat ini.

## 1. Executive Summary

Ayomi adalah platform aplikasi web pengasuhan dan keselamatan anak berskala nasional di Indonesia yang mempertemukan orang tua dengan lembaga day care terverifikasi, aman, dan transparan di berbagai kota dan provinsi. Orang tua dapat mencari lokasi day care berbasis wilayah (Provinsi, Kota/Kabupaten, Kecamatan), membandingkan fasilitas, mendaftarkan anak secara online, memantau logbook aktivitas harian, serta melaporkan insiden secara cepat. Pengelola (caregiver) dan admin menggunakan platform ini untuk mengelola kuota slot penitipan secara real-time, memproses pendaftaran, menerbitkan laporan harian ter-blur (privasi), serta mengelola verifikasi izin resmi.

### Fitur Utama AI (Fiks)

- **AI Safety Score & Legal Verification (OCR):** Menghitung skor keselamatan daycare (0–100) berbasis indikator rasio pengasuh/anak dan fasilitas, serta memverifikasi dokumen izin operasional resmi dari Kementerian Pendidikan/Dinas Perizinan secara otomatis via OCR.
- **AI Summary Ulasan & Smart Reply:** Merangkum poin kelebihan (Pros) dan evaluasi (Cons) dari puluhan ulasan orang tua menjadi format terstruktur di profil daycare, serta menyediakan rekomendasi draf balasan ulasan otomatis untuk pengelola.
- **AI Instant Logbook Drafter & Privacy Masking:** Menyusun draf narasi catatan harian anak secara otomatis berdasarkan analisis foto kegiatan dan timestamp, sekaligus memburamkan (blur) wajah anak lain di latar belakang demi privasi.
- **AI Incident Urgency Triage:** Mengklasifikasikan tingkat kedaruratan laporan insiden dari orang tua (Rendah, Sedang, Tinggi, Darurat) berdasarkan narasi kronologi untuk menentukan prioritas respons pengelola/admin.

**Pasar Sasaran:** Orang tua bekerja di seluruh wilayah perkotaan Indonesia (Jabodetabek, Surabaya, Bandung, Medan, Makassar, Semarang, Malang, Gresik, dll.) yang membutuhkan tempat penitipan anak tepercaya, serta pengelola day care di seluruh Indonesia yang ingin mendigitalisasi manajemen operasionalnya.

## 2. Product Overview

### 2.1 Problem Statement

- Orang tua di berbagai wilayah perkotaan Indonesia tidak memiliki tolok ukur keselamatan, rasio pengasuh, dan verifikasi legalitas resmi day care yang terstandarisasi.
- Informasi biaya, fasilitas, SOP keselamatan, dan ulasan terpercaya sulit diakses serta tersebar secara manual di berbagai kanal publik.
- Pendaftaran dan ketersediaan kuota slot tidak sinkron, rawan salah informasi (overbooking), dan proses pendaftaran masih manual.
- Orang tua membutuhkan kepastian laporan harian anak yang transparan tanpa melanggar privasi anak lain.
- Pengelola day care kesulitan mengelola pengajuan pendaftaran, membuat catatan harian secara manual, dan membalas ulasan pengguna secara efisien.

### 2.2 Solution Overview

- Direktori day care nasional interaktif dengan pencarian berbasis koordinat/GPS, filter hierarki wilayah (Provinsi, Kota/Kabupaten, Kecamatan), indikator AI Safety Score, status verifikasi izin resmi, transparansi harga, dan kuota slot real-time.
- Alur pendaftaran anak secara online dengan penguncian kuota atomik (Approved/Rejected).
- Modul Catatan Harian (Daily Logbook) berfasilitas AI Photo Privacy Masking dan draf teks otomatis.
- Sistem Pelaporan Insiden Cepat (Incident Report) yang dilengkapi AI Urgency Triage untuk eskalasi prioritas.
- Dashboard Pengelola (Caregiver) dengan fitur AI Smart Reply ulasan dan manajemen status pendaftaran.

### 2.3 Target Market

- **Primer:** Orang tua bekerja (usia 22–40 tahun) di seluruh perkotaan Indonesia yang membutuhkan layanan penitipan anak tepercaya.
- **Sekunder:** Pengelola/staf day care (caregiver) dan Admin Platform Ayomi di seluruh Indonesia.

### 2.4 Competitive Landscape

- **Kategori Alternatif:** Direktori day care umum (Google Maps/Search), grup media sosial/WhatsApp, serta kunjungan langsung secara manual (walk-in).
- **Keunggulan Kompetitif Ayomi:** Standar transparan nasional berbasis AI Safety Score, verifikasi dokumen legalitas resmi, logbook harian berteknologi privasi AI, serta kepastian kuota pendaftaran terintegrasi.

## 3. Goals & Objectives

### 3.1 Business Goals

1. **Safety-First Positioning Nasional:** Menyediakan katalog day care terpercaya berskala nasional di seluruh Indonesia dengan AI Safety Score dan status verifikasi legalitas resmi sebagai nilai pembeda utama (unique value proposition).
2. **Efisiensi Operasional & Informasi Akurat:** Memastikan kuota slot penitipan dan status pengajuan pendaftaran terkelola secara real-time untuk mengeliminasi risiko salah informasi (overbooking) antara orang tua dan pengelola daycare.
3. **Model Bisnis (Freemium / B2B Subscription):** Pengisian profil dasar day care gratis, sedangkan fitur canggih (AI Safety Score Badge, AI Instant Logbook Drafter, AI Smart Reply, dan manajemen kuota) dapat diakses pengelola melalui paket langganan bulanan/tahunan.
4. **Target Akuisisi Nasional:** Menggaet 100+ day care terverifikasi di berbagai kota besar Indonesia serta 2.000+ akun orang tua aktif pada tahap peluncuran awal nasional (MVP).
5. **Batasan Versi (Scope Limit):** Fitur transaksi pembayaran online langsung (payment gateway) di luar cakupan versi ini (pembayaran dilakukan secara manual/offline antara orang tua dan pihak daycare setelah pendaftaran disetujui).

### 3.2 User Goals

- **Orang tua:** Mencari di wilayah/kota mana saja di Indonesia, membandingkan, mendaftarkan anak ke daycare terpercaya, serta memantau catatan harian anak secara aman.
- **Orang tua:** Melaporkan insiden/kendala secara cepat dengan prioritas respons yang jelas.
- **Pengelola:** Mengelola profil bisnis, meninjau pengajuan pendaftaran anak, memperbarui logbook harian secara cepat dengan AI, dan merespons ulasan.
- **Admin:** Memverifikasi dokumen legalitas daycare dari berbagai dinas/lembaga perizinan dan mengawasi eskalasi laporan insiden.

### 3.3 Success Criteria

| Tujuan | Metrik | Target Awal (Skala Nasional) |
| --- | --- | --- |
| Mempermudah pencarian dan pendaftaran | Waktu dari buka aplikasi sampai pengajuan pendaftaran terkirim | < 5 menit |
| Transparansi keselamatan nasional | Persentase daycare aktif terverifikasi yang memiliki Safety Score | 100% |
| Konsistensi kuota | Kasus slot negatif atau melebihi total kuota (overbooking) | 0 kasus |
| Efisiensi Pembuatan Logbook | Waktu pembuatan laporan harian per anak oleh pengelola | < 1 menit (dengan AI Drafter) |
| Kepuasan Fitur AI | Persentase draf AI (Logbook & Smart Reply) yang digunakan tanpa ubahan mayor | ≥ 80% |

## 4. User Personas & Stories

### 4.1 Primary Persona: Parent (Orang Tua)

| Atribut | Isi |
| --- | --- |
| Name | Bu Fiqo (Ibu Bekerja) |
| Role | Parent |
| Demographics | Berdomisili di Gresik, Jawa Timur |
| Goals | Mencari daycare aman di kota mana saja yang dekat dengan tempat kerja/rumah, mendaftar tanpa antre manual, dan mendapatkan laporan aktivitas anak harian yang jujur dan privat |
| Pain Points | Tidak ada standar keselamatan yang transparan, ketersediaan slot tidak jelas, khawatir foto anak lain terekspos, respon laporan lambat |

**Persona Sekunder:**
- **Caregiver (Pengelola Daycare):** Staf daycare di berbagai perkotaan Indonesia yang mengelola profil bisnis, mengonfirmasi pendaftaran anak, dan mengunggah logbook harian.
- **Admin Platform:** Mengelola seluruh data sistem dan memverifikasi dokumen izin operasional.

### 4.2 User Stories

**Parent**
- Sebagai orang tua, saya ingin mendaftar dan masuk dengan email/kata sandi agar data pribadi dan anak saya aman.
- Sebagai orang tua, saya ingin mencari dan memfilter daycare berdasarkan provinsi, kota/kabupaten, kecamatan, harga, Safety Score, dan sisa slot agar menemukan pilihan terbaik.
- Sebagai orang tua, saya ingin membandingkan 2–3 daycare secara side-by-side agar memudahkan pengambilan keputusan.
- Sebagai orang tua, saya ingin mendaftarkan anak secara online dan memantau status persetujuannya secara real-time.
- Sebagai orang tua, saya ingin melihat logbook aktivitas harian anak lengkap dengan foto yang sudah disamarkan privasinya.
- Sebagai orang tua, saya ingin melaporkan insiden secara cepat dan mengetahui tingkat urgensi penanganannya.

**Caregiver & Admin**
- Sebagai pengelola, saya ingin mengonfirmasi (Approved) atau menolak (Rejected) pendaftaran anak agar kuota terkelola otomatis.
- Sebagai pengelola, saya ingin mengunggah foto aktivitas harian dan memanfaatkan draf narasi AI agar laporan harian selesai lebih cepat.
- Sebagai pengelola, saya ingin membalas ulasan orang tua menggunakan bantuan rekomendasi AI Smart Reply.
- Sebagai admin, saya ingin memverifikasi dokumen perizinan daycare melalui ekstrak hasil AI OCR.

## 5. Features & Requirements

### 5.1 Core Features (MVP Skala Nasional)

| Fitur | Deskripsi | Kode FR | Fase |
| --- | --- | --- | --- |
| Autentikasi & Akun | Registrasi/login, pemisahan peran Parent, Caregiver, Admin | FR-01–04 | Fase 1 |
| Direktori & Detail Daycare | Katalog nasional, pencarian kota/provinsi, filter wilayah, detail tab (Fasilitas, Biaya, Ulasan) | FR-05–09 | Fase 1 |
| Profil & Data Anak | Manajemen profil anak, tanggal lahir, dan catatan kesehatan/alergi | FR-10–12 | Fase 1 |
| Komparasi Daycare | Fitur perbandingan side-by-side 2–3 daycare | FR-34–35 | Fase 1 |
| Pendaftaran & Kuota Atomik | Pengajuan pendaftaran online, status pengajuan, pengurangan kuota otomatis | FR-13–18 | Fase 2 |
| Catatan Harian & Privacy AI | Logbook aktivitas harian, AI Photo Masking (Blur), dan AI Instant Drafter | FR-36–38 | Fase 2 |
| Pusat Bantuan & AI Triage | Laporan insiden/kendala dan AI Incident Urgency Triage | FR-39–40 | Fase 2 |
| Ulasan, Safety Score & AI Reply | Evaluasi ulasan, AI Review Summary, AI Smart Reply, dan AI Safety Score OCR | FR-30–31, FR-41 | Fase 3 |
| Sistem Notifikasi | Feed notifikasi real-time untuk status pendaftaran dan laporan insiden | FR-42–43 | Fase 3 |

### 5.2 Functional Requirements

Status implementasi setiap FR ada di [bagian 12.3](#123-status-implementasi-per-fr).

- **FR-01:** Pengguna dapat mendaftar dan masuk menggunakan email dan kata sandi (Supabase Auth, JWT).
- **FR-02:** Peran (role) default akun baru adalah parent. Peran caregiver dan admin diberikan melalui penetapan admin.
- **FR-03:** Pengguna dapat memperbarui nama lengkap, nomor telepon, dan foto profil.
- **FR-04:** Akun aplikasi terhubung ke Supabase Auth melalui kolom `user_id` (UUID, UNIQUE) untuk mendukung Row Level Security (RLS).
- **FR-05:** Parent dapat melihat daftar dan detail daycare seluruh Indonesia: nama, alamat lengkap, kota, provinsi, harga bulanan, Safety Score, status izin, dan kuota slot tersedia.
- **FR-06:** Pencarian dan filter berbasis geolokasi/GPS serta hierarki wilayah (Provinsi, Kota/Kabupaten, Kecamatan), harga, Safety Score, dan ketersediaan slot.
- **FR-07:** Caregiver dapat memperbarui informasi profil daycare tempatnya bekerja; Admin dapat mengubah seluruh data daycare.
- **FR-08:** Status izin awal daycare baru adalah Menunggu Verifikasi; hanya Admin yang dapat mengubah status menjadi Terverifikasi.
- **FR-09:** Daycare yang memiliki riwayat pendaftaran tidak dapat dihapus dari database (ON DELETE RESTRICT).
- **FR-10:** Parent dapat menambah, melihat, mengubah, dan menghapus profil anak (nama, tanggal lahir, jenis kelamin, foto, catatan kesehatan/alergi).
- **FR-11:** Catatan kesehatan anak bersifat privat dan hanya dapat diakses oleh Parent pemilik, Caregiver terhubung, dan Admin.
- **FR-12:** Menghapus akun Parent akan menghapus data anak yang terikat secara otomatis (CASCADE).
- **FR-13:** Parent dapat mengajukan pendaftaran anak ke daycare pilihan dengan paket layanan tertentu; status awal adalah Pending.
- **FR-14:** Sistem memvalidasi bahwa `child_id` milik Parent yang login dan `slot_tersedia > 0` saat pendaftaran dikirim.
- **FR-15:** Sistem mencegah pengajuan pendaftaran aktif ganda (Pending/Approved) untuk anak dan daycare yang sama.
- **FR-16:** Caregiver/Admin dapat menyetujui (Approved) atau menolak (Rejected) pengajuan pendaftaran.
- **FR-17:** Saat pendaftaran diubah menjadi Approved, sistem mengurangi `slot_tersedia` sebanyak 1 secara atomik dalam satu transaksi database.
- **FR-18:** Parent dapat memantau status pengajuan pendaftaran secara real-time.
- **FR-34:** Parent dapat memilih hingga 3 daycare untuk dimasukkan ke dalam daftar perbandingan.
- **FR-35:** Sistem menampilkan tabel komparasi side-by-side meliputi harga, Safety Score, rasio pengasuh, fasilitas, dan status perizinan.
- **FR-36:** Caregiver dapat mengunggah catatan aktivitas harian anak (makan, tidur, mood, suhu tubuh, foto kegiatan).
- **FR-37:** Sistem AI memproses foto kegiatan untuk memburamkan (blur) wajah anak lain di latar belakang secara otomatis (Privacy Masking).
- **FR-38:** AI Vision-LLM menghasilkan draf narasi catatan harian berdasarkan foto dan timestamp yang dapat dikonfirmasi/diedit oleh pengasuh sebelum dipublikasikan.
- **FR-39:** Parent dapat mengirimkan laporan insiden/kendala melampirkan kronologi teks dan bukti foto/video.
- **FR-40:** AI Incident Urgency Triage menganalisis narasi laporan untuk mengklasifikasikan tingkat urgensi (Rendah, Sedang, Tinggi, Darurat) guna menentukan alur eskalasi.
- **FR-30:** Parent yang terdaftar hanya dapat memberikan 1 ulasan (rating 1–5 dan komentar) per daycare.
- **FR-31:** Hasil perhitungan AI Safety Score (OCR berkas izin + rasio pengasuh + fasilitas) dicatat di `safety_score_logs` dan memperbarui `daycares.safety_score`.
- **FR-41:** Caregiver dapat melihat ulasan dan menggunakan rekomendasi draf AI Smart Reply untuk membalas ulasan orang tua.
- **FR-42:** Sistem membuat notifikasi dalam aplikasi untuk perubahan status pendaftaran (Pending → Approved/Rejected).
- **FR-43:** Sistem mengirimkan notifikasi saat laporan harian anak baru dipublikasikan atau ada tanggapan insiden.

### 5.3 Non-Functional Requirements

- **Performance:** Indeks pada kolom wilayah (provinsi, kota) dan FK; respons query direktori nasional < 1 detik; pemrosesan AI (OCR/Logbook Drafter/Triage) < 3 detik.
- **Security:** Autentikasi JWT; pembatasan akses ketat berbasis Supabase Row Level Security (RLS) di seluruh 10 tabel; enkripsi data sensitif; API Key AI hanya disimpan di environment variable server backend.
- **Privacy:** Data catatan kesehatan anak dan foto kegiatan tidak dipublikasikan secara terbuka; penyamaran wajah anak lain diaktifkan secara default.
- **Reliability:** Transaksi atomik database (ACID compliance) untuk operasi perubahan kuota guna mencegah kondisi balapan (race condition).
- **Cost / Rate Limiting:** Pembatasan rate limit panggilan API AI untuk mencegah pemakaian berlebihan (abuse).
- **Accessibility:** Tampilan antarmuka memenuhi standar kontras warna dan keterbacaan WCAG 2.1 AA.
- **Device Support:** Aplikasi web responsif sepenuhnya (dukungan penuh pada layar HP/Mobile dan Desktop).

## 6. User Experience & Design

### 6.1 User Flow

**Alur Parent:**
1. Masuk/Daftar akun (`/masuk` atau `/daftar`).
2. Beranda Parent (`/beranda`): Ringkasan status anak hari ini, direktori favorit, dan rekomendasi daycare berbasis kota/posisi user.
3. Pencarian & Komparasi (`/pencarian` & `/bandingkan/hasil`): Memfilter daycare berbasis kota/provinsi di Indonesia, membandingkan 2–3 daycare, dan melihat detail profil (AI Safety Score, ringkasan ulasan AI).
4. Pendaftaran (`/pendaftaran-anak`): Mengisi data anak, memilih paket layanan, dan memantau status persetujuan (`/status-pendaftaran`).
5. Pemantauan Harian (`/catatan-harian`): Melihat linimasa aktivitas anak dengan foto ter-blur dan narasi ramah.
6. Laporan Insiden & Ulasan (`/laporan` & `/ulasan`): Mengirimkan laporan kendala cepat atau memberikan ulasan terverifikasi.

**Alur Caregiver:**
1. Masuk ke Dashboard Pengelola (`/pengelola`).
2. Mengelola Pengajuan Pendaftaran (`/pengelola/pendaftaran`): Meninjau berkas pendaftaran dan menyetujui/menolak pengajuan (kuota otomatis ter-update).
3. Input Logbook Harian (`/pengelola/laporan-harian/tambah`): Mengambil foto kegiatan, mengaktifkan AI Privacy Masking & Drafter, lalu melakukan 1-tap konfirmasi.
4. Respon Ulasan (`/pengelola/ulasan`): Membalas ulasan orang tua dengan bantuan draf AI Smart Reply.

### 6.2 Design System & Palette Guidelines

Tampilan UI dibangun menggunakan Tailwind CSS v4, Lucide React, dan Plus Jakarta Sans:

- **Deep Teal (`#264653`):** Warna primer untuk Header Navbar, Sidebar Pengelola, dan tombol utama.
- **Warm Mint (`#2A9D8F`):** Warna sekunder untuk badge terverifikasi, indikator sukses, dan tab aktif.
- **Warm Amber (`#E9C46A`):** Warna highlight untuk skor keselamatan dan status Pending.
- **Soft Coral (`#E76F51`):** Warna peringatan untuk tingkat urgensi tinggi dan penolakan.
- **Soft Cream (`#F8F9FA`):** Warna latar belakang netral aplikasi.

## 7. Technical Requirements

### 7.1 Architecture

- **Frontend:** Next.js (App Router), React 19, JavaScript (JSX), Tailwind CSS v4, Lucide React.
- **Backend & API:** Next.js Route Handlers / FastAPI (Python) untuk pengolahan logika AI (OCR, Privacy Masking, Prompt Engineering).
- **Database & Auth:** Supabase PostgreSQL (10 Tabel Utama), Supabase Auth (JWT), dan Storage untuk berkas foto/dokumen.

### 7.2 Technology Stack

- **Framework Frontend:** Next.js (App Router), React 19.
- **Styling & UI:** Tailwind CSS v4, Lucide React Icons.
- **Database & Service:** Supabase (PostgreSQL, Realtime, Storage).
- **AI Engine:** Google GenAI (Gemini 2.5 Flash / Vision AI) & OpenCV/MediaPipe (Face Detection Blur).

### 7.3 Data Requirements (10 Tabel Utuh Supabase – Skala Nasional)

1. **users:** Akun dan peran (id UUID, nama_lengkap, email, nomor_hp, role, foto_profil).
2. **daycares:** Data profil daycare seluruh Indonesia (id, user_id, nama_daycare, alamat, provinsi, kota, kecamatan, latitude, longitude, harga_bulanan, total_slot, slot_tersedia, status_izin, safety_score, rasio_pengasuh).
3. **children:** Data profil anak (id, parent_id, nama_anak, tanggal_lahir, jenis_kelamin, catatan_kesehatan, foto_anak).
4. **enrollments:** Data pengajuan pendaftaran (id, child_id, daycare_id, paket_layanan, tanggal_mulai_titip, status_pendaftaran, alasan_penolakan).
5. **daily_reports:** Logbook aktivitas harian (id, child_id, daycare_id, caregiver_id, tanggal, mood_anak, status_makan, durasi_tidur, catatan_kegiatan, foto_kegiatan).
6. **incident_reports:** Laporan insiden (id, parent_id, daycare_id, kategori_masalah, deskripsi_kronologi, urgency_level, status_laporan).
7. **reviews:** Ulasan terverifikasi (id, parent_id, daycare_id, enrollment_id, rating, teks_ulasan, balasan_caregiver, is_verified).
8. **daycare_documents:** Dokumen legalitas & AI OCR (id, daycare_id, jenis_dokumen, nomor_dokumen, url_berkas, status_validasi).
9. **daycare_facilities:** Daftar fasilitas daycare (id, daycare_id, nama_fasilitas, keterangan).
10. **notifications:** Feed notifikasi pengguna (id, user_id, judul, pesan, tipe_notifikasi, is_read).

### 7.4 Security Requirements (Matriks Hak Akses RLS)

| Tabel | Parent | Caregiver | Admin |
| --- | --- | --- | --- |
| users | Baca & ubah data sendiri | Baca & ubah data sendiri | Akses Penuh |
| daycares | Baca (Publik) | Baca & ubah daycare miliknya | Akses Penuh |
| children | CRUD data anak sendiri | Baca data anak terdaftar | Baca |
| enrollments | Buat & baca milik sendiri | Baca & ubah status untuk daycare-nya | Akses Penuh |
| daily_reports | Baca milik anaknya | Buat & ubah untuk daycare-nya | Akses Penuh |
| incident_reports | Buat & baca milik sendiri | Baca & tanggapi di daycare-nya | Akses Penuh |

## 8. Success Metrics

### 8.1 Key Performance Indicators (KPI)

- **Waktu Pengajuan Pendaftaran:** < 5 menit dari pencarian hingga status Pending terkirim.
- **Tingkat Transparansi Keselamatan:** 100% daycare terdaftar memiliki status verifikasi izin dan Safety Score.
- **Akurasi Pengelolaan Kuota:** 0 kasus overbooking (slot bernilai negatif).
- **Adopsi Fitur Logbook AI:** > 80% laporan harian dibuat menggunakan fitur draf otomatis AI.

### 8.2 Analytics & Tracking

Metrik dilacak secara internal melalui tabel database (enrollments, daily_reports, incident_reports, reviews) serta pencatatan log aktivitas sistem.

## 9. Timeline & Milestones

### 9.1 Release Plan

- **Fase 0 (Setup & Prototipe Frontend):** Setup repositori Next.js, konfigurasi Tailwind CSS v4 design tokens, pembuatan UI komponen reusable (CM001–CM024), dan halaman prototipe.
- **Fase 1 (Fondasi Database & Direktori):** Implementasi skema 10 tabel Supabase, Supabase Auth, RLS, modul direktori daycare nasional, data anak, dan komparasi (with expectation).
- **Fase 2 (Alur Transaksi & Operasional Harian):** Modul pendaftaran online (kuota atomik), Daily Logbook berfitur AI Privacy Masking & Drafter, serta Pusat Bantuan Laporan Insiden.
- **Fase 3 (Fitur AI Inti & Evaluasi):** Integrasi AI Safety Score OCR, AI Review Summary, AI Smart Reply ulasan, dan AI Incident Urgency Triage.
- **Fase 4 (Pengujian & Peluncuran MVP):** Pengujian integrasi end-to-end, UAT bersama pengelola daycare di berbagai perkotaan Indonesia, dan peluncuran resmi skala nasional.

## 10. Dependencies & Risks

### 10.1 Risks & Mitigation

| No | Risiko | Mitigasi |
| --- | --- | --- |
| 1 | Balapan kondisi kuota (race condition) saat pendaftaran serentak | Menggunakan transaksi database atomik dengan penguncian baris (row locking) di Supabase. |
| 2 | Kesalahan deteksi wajah pada AI Privacy Masking (memburamkan anak utama) | Menyediakan tombol penyesuaian manual (toggle) bagi pengasuh sebelum mengunggah. |
| 3 | Latensi panggilan API AI yang tinggi saat membuat draf | Menggunakan model AI yang cepat (Gemini 2.5 Flash) dan eksekusi secara asinkron. |
| 4 | Dokumen izin operasional daycare palsu atau tidak terbaca | Memasukkan status awal Menunggu Verifikasi yang wajib disetujui manual oleh Admin. |

## 11. Open Questions (Status Keputusan)

1. **Apakah fitur Komparasi Daycare, Catatan Harian, Laporan Insiden, dan Notifikasi masuk ke MVP?** Ya, masuk ke cakupan MVP untuk mendukung alur operasional dan pengawasan anak secara utuh.
2. **Siapa yang menginisiasi pendaftaran anak ke daycare?** Orang tua (Parent) yang mengajukan pendaftaran secara mandiri via aplikasi (FR-13).
3. **Apakah pengelola dapat membalas ulasan orang tua?** Ya, pengelola dapat membalas ulasan orang tua dan dibantu oleh fitur draf AI Smart Reply (FR-41).
4. **Bagaimana mekanisme transaksi pembayaran pendaftaran?** Pembayaran dilakukan secara manual/offline di luar aplikasi untuk versi MVP ini.

## 12. Perubahan saat Implementasi (v1.3)

Bagian ini mencatat di mana aplikasi MVP berbeda dari rencana di bagian 1–11, dan alasannya. Prinsip yang dipakai di semua fitur AI: **AI hanya mengusulkan, manusia yang memutuskan**, dan setiap hasil AI diberi label.

### 12.1 Perubahan utama

| Area | Rencana v1.2 | Implementasi MVP | Alasan |
| --- | --- | --- | --- |
| Peran pengguna | Tiga peran: Parent, Caregiver, Admin | Empat peran: Orang Tua, **Pengelola** daycare, **Pengasuh**, Admin. Pengasuh hanya melihat anak yang ditugaskan kepadanya, selama jam penugasan | Di daycare, yang mengurus pendaftaran, dokumen, dan staf berbeda dengan yang mengasuh anak. Data anak hanya dibuka untuk pengasuh yang sedang bertugas |
| Akun staf (FR-02) | Peran caregiver ditetapkan Admin | Pengelola diundang Admin. Pengasuh diundang Pengelola lalu diverifikasi Admin | Staf yang memegang data anak harus jelas daycare-nya dan sudah diperiksa |
| AI Safety Score (FR-31) | Dihitung AI dari OCR izin, rasio pengasuh, dan fasilitas | Empat komponen: **Legalitas 40, SOP 25, Staf 20, Fasilitas 15**, masing-masing Lulus / Sebagian / Tidak lulus. Admin menilai dari dokumen bukti yang sudah disetujui, server menghitung skor, lalu Admin memublikasikannya. Legalitas yang belum lulus menahan publikasi. Daycare tanpa penilaian tampil "Belum dinilai" | Skor menyangkut keselamatan anak, jadi harus bisa ditelusuri ke bukti, bukan ke tebakan model. Klaim profil dari Pengelola tidak dihitung sebagai bukti. Rating bintang tidak dimasukkan ke skor |
| Legal Verification (OCR) | AI memverifikasi dokumen izin secara otomatis | Layanan OCR membaca dokumen, lalu model bahasa mengusulkan nomor, penerbit, dan masa berlaku lengkap dengan kutipan halamannya. Isian yang tidak terbaca dibiarkan kosong. Ada peringatan bila isian berbeda dengan data Pengelola. **Admin yang memutuskan** setuju, minta revisi, atau tolak | OCR tidak bisa memastikan keaslian dokumen. Keputusan legalitas tetap di tangan manusia (sejalan dengan mitigasi risiko 4) |
| Privacy Masking (FR-37) | Blur wajah anak lain di latar belakang | **Foto Fokus Anak**: model YOLO11 segmentasi mendeteksi setiap orang di foto. Pengasuh memilih anak yang dituju, lalu semua orang lain dan latar diburamkan. Pengasuh meninjau dan menyetujui hasilnya. Orang Tua hanya menerima versi fokus anaknya; foto asli dihapus setelah ditinjau | Anak lain tetap bisa dikenali dari tubuh dan pakaian walau wajahnya diburamkan. Pilihan anak oleh pengasuh juga mencegah anak utama ikut terburam (risiko 2) |
| Logbook Drafter (FR-38) | Draf narasi dari analisis foto dan timestamp | Draf disusun dari catatan singkat pengasuh beserta data makan atau tidur. Draf berlabel AI, bisa dipakai atau dibuang, dan wajib ditinjau sebelum dikirim | Foto anak tidak perlu dikirim ke model bahasa. Draf juga tidak menambah fakta yang tidak dicatat pengasuh |
| Laporan insiden (FR-39) | Orang Tua melapor insiden dengan bukti foto/video | Insiden dilaporkan **Pengasuh**, lalu Orang Tua menerimanya dan menandai sudah dibaca. Orang Tua menyampaikan keluhan lewat **komplain** yang ditangani Admin. Lampiran bukti belum ada | Insiden terjadi di daycare dan disaksikan pengasuh, jadi laporannya harus datang secepatnya dari sana |
| AI Incident Urgency Triage (FR-40) | AI mengklasifikasikan urgensi laporan Orang Tua | Layanan triage terpisah menilai laporan pengasuh. AI **hanya bisa menaikkan** urgensi pelapor, menunjukkan kalimat buktinya, dan mengirim notifikasi kedua ke Pengelola dan Admin bila urgensi naik. Pengelola bisa menetapkan urgensi dengan alasan; setelah itu AI tidak mengubahnya lagi | Menurunkan urgensi berisiko menunda pertolongan. Laporan tetap tersimpan dan notifikasi tetap terkirim meski layanan AI mati |
| AI Summary Ulasan & Smart Reply (FR-41) | Termasuk 4 Fitur Utama AI | **Belum ada di UI MVP.** Kontrak AI dan API-nya sudah disiapkan. Saat ini Pengelola menulis balasan sendiri, dan ulasan serta balasan dimoderasi Admin | Ditunda ke versi berikutnya; tiga fitur AI lainnya menyangkut keselamatan dan privasi anak secara langsung |
| Ulasan (FR-30) | Satu ulasan per daycare | Satu ulasan per daycare, baru bisa ditulis setelah pengasuhan **selesai**, dan terbit setelah dimoderasi Admin | Ulasan hanya dari orang tua yang benar-benar memakai layanan |
| Pembayaran (batasan versi, open question 4) | Manual/offline di luar aplikasi | Setelah disetujui Pengelola, Orang Tua membayar lewat **QRIS statis** yang tampil di aplikasi. Admin mengonfirmasi pembayaran secara manual (berhasil, gagal, atau kedaluwarsa). Tanpa payment gateway | Status Aktif dan kuota harus konsisten dengan pembayaran, tetapi integrasi gateway masih di luar cakupan |
| Kuota (FR-14, FR-17) | `slot_tersedia` per daycare | Kapasitas dihitung per daycare **per tanggal layanan**. Slot ditahan saat Pengelola menyetujui dan pengajuan menunggu pembayaran, lalu dilepas bila kedaluwarsa | Penitipan bersifat harian, jadi ketersediaan berbeda di setiap tanggal |
| Pencarian (FR-06) | GPS, wilayah, harga, Safety Score, sisa slot | Kata kunci; Provinsi → Kota/Kabupaten → Kecamatan; biaya maksimal; rating minimal; rasio pengasuh; usia anak; urutan hasil. GPS, filter Safety Score, dan filter sisa slot **belum ada** | Sisa slot bergantung pada tanggal layanan, sehingga diperiksa saat pengajuan |
| Teknologi AI (7.2) | Gemini 2.5 Flash, OpenCV/MediaPipe | Layanan terpisah untuk OCR, triage, dan Foto Fokus (YOLO11 segmentasi), ditambah model bahasa terbuka lewat API yang kompatibel OpenAI. Kunci API hanya di server | Setiap layanan bisa diganti tanpa mengubah aplikasi. Foto anak diproses di layanan Foto Fokus sendiri, tidak dikirim ke model bahasa |
| Database (7.3) | 10 tabel | Lebih dari 10 tabel; skema lengkap ada di `supabase/migrations/` (37 migrasi) dengan RLS. Tambahan antara lain: penugasan pengasuh, versi ulasan, verifikasi dokumen, Safety Score, riwayat urgensi insiden, komplain, dan pekerjaan AI | Riwayat keputusan manusia dan hasil AI harus tersimpan agar bisa diaudit |

### 12.2 Fitur tambahan di luar PRD v1.2

- Penugasan pengasuh ke anak, lengkap dengan jam mulai dan selesai.
- Check-in anak pada hari layanan dan penyelesaian pengasuhan.
- Undangan staf lewat tautan dan verifikasi pengasuh oleh Admin.
- Komplain Orang Tua dengan alur: minta informasi, usulan penyelesaian, lalu konfirmasi Orang Tua.
- Love dan komentar Orang Tua pada catatan harian.
- Riwayat perubahan data kesehatan anak.
- Moderasi Admin untuk foto galeri dan perubahan harga layanan.

### 12.3 Status implementasi per FR

**Arti status:**
- **Terpenuhi:** sesuai teks PRD.
- **Disesuaikan:** kebutuhannya ada, tetapi caranya berbeda (lihat 12.1).
- **Sebagian:** sebagian isi FR belum dibuat.
- **Belum:** belum dibuat di MVP.

| FR | Status | Catatan |
| --- | --- | --- |
| FR-01 | Terpenuhi | |
| FR-02 | Disesuaikan | Staf lewat undangan dan verifikasi Admin |
| FR-03 | Sebagian | Nama dan nomor WhatsApp bisa diubah; foto profil belum |
| FR-04 | Terpenuhi | |
| FR-05 | Disesuaikan | Detail menampilkan kapasitas, bukan sisa slot per hari |
| FR-06 | Sebagian | GPS, filter Safety Score, dan sisa slot belum |
| FR-07 | Terpenuhi | Perubahan harga perlu persetujuan Admin |
| FR-08 | Terpenuhi | Mitra baru nonaktif sampai diaktifkan Admin |
| FR-09 | Terpenuhi | `ON DELETE RESTRICT` di basis data |
| FR-10 | Sebagian | Tambah anak dan ubah data kesehatan ada; ubah/hapus profil dan foto anak belum |
| FR-11 | Terpenuhi | |
| FR-12 | Belum | Fitur hapus akun belum ada |
| FR-13 | Terpenuhi | Status awal "Menunggu keputusan" |
| FR-14 | Disesuaikan | Kuota per tanggal layanan |
| FR-15 | Terpenuhi | Satu anak hanya boleh punya satu pengasuhan aktif |
| FR-16 | Terpenuhi | Penolakan wajib beralasan |
| FR-17 | Disesuaikan | Atomik dengan penguncian baris, per tanggal layanan |
| FR-18 | Terpenuhi | |
| FR-30 | Disesuaikan | Setelah pengasuhan selesai, dengan moderasi Admin |
| FR-31 | Disesuaikan | Empat komponen, dinilai Admin dari bukti |
| FR-34 | Terpenuhi | |
| FR-35 | Terpenuhi | |
| FR-36 | Sebagian | Jenis: Bermain, Belajar, Interaksi, Makan, Tidur, Lainnya; data makan dan tidur terstruktur; foto lewat Foto Fokus. Mood dan suhu tubuh belum |
| FR-37 | Disesuaikan | Foto Fokus Anak (YOLO11) |
| FR-38 | Disesuaikan | Draf dari catatan pengasuh |
| FR-39 | Disesuaikan | Pelapor insiden adalah pengasuh; Orang Tua memakai komplain; lampiran belum |
| FR-40 | Disesuaikan | AI hanya menaikkan urgensi; manusia bisa menetapkan dengan alasan |
| FR-41 | Belum | Balasan ulasan ditulis manual |
| FR-42 | Terpenuhi | |
| FR-43 | Terpenuhi | Baru notifikasi di aplikasi; email/WhatsApp belum |

### 12.4 Kebutuhan non-fungsional

| Kebutuhan | Status |
| --- | --- |
| Security (JWT, RLS, kunci API di server) | Terpenuhi |
| Privacy | Terpenuhi; foto asli tidak pernah dikirim ke Orang Tua |
| Reliability (transaksi atomik kuota) | Terpenuhi |
| Cost / Rate Limiting | Terpenuhi |
| Device Support | Terpenuhi |
| Performance: AI < 3 detik | Belum untuk OCR, yang butuh 2–60 detik tergantung jumlah halaman |
| Accessibility WCAG 2.1 AA | Belum diuji |

## 13. Appendix

### 13.1 Glossary

- **Safety Score:** Indikator skor keselamatan daycare (0–100) yang dihitung dari indikator legalitas dokumen, rasio pengasuh/anak, dan fasilitas keselamatan.
- **Privacy Masking:** Teknologi pemburaman (blurring) otomatis pada wajah anak-anak lain di latar belakang foto kegiatan untuk melindungi privasi.
- **Urgency Triage:** Klasifikasi otomatis tingkat kedaruratan laporan insiden berbasis analisis bahasa alami (NLP/LLM).
- **Row Level Security (RLS):** Fitur keamanan PostgreSQL pada Supabase untuk membatasi hak akses data per baris berdasarkan identitas pengguna.

### 13.2 Change Log

- **v1.0 (26 Oktober 2026):** Draft awal dari riset, template PRD, dan breakdown task sprint.
- **v1.1 (26 Oktober 2026):** Penyempurnaan PRD final: Penyesuaian 4 Fitur AI Fiks, penambahan FR-34 hingga FR-43, penetapan arsitektur 10 tabel Supabase, penyelarasan Design System Tailwind v4, serta penyempurnaan tujuan bisnis dan monetisasi MVP.
- **v1.2 (26 Oktober 2026):** Ekspansi jangkauan produk ke skala nasional Indonesia (multi-kota & multi-provinsi), penambahan field wilayah pada tabel daycares, serta pembaruan target akuisisi 100+ daycare dan 2.000+ user aktif.
- **v1.3 (21 November 2026):** Penyesuaian dengan implementasi MVP: penambahan bagian 12 (perubahan saat implementasi, alasan, dan status setiap FR), pemisahan peran Caregiver menjadi Pengelola dan Pengasuh, serta pembaruan teknologi AI yang dipakai. Isi bagian 1–11 tetap sama dengan v1.2.
