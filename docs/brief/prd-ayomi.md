# Product Requirement Document (PRD): AYOMI

| Parameter Dokumen | Detail |
| :--- | :--- |
| **Nama Produk** | **Ayomi** (Sistem Informasi & Asesmen Pengasuhan Aman) |
| **Versi Dokumen** | v2.1 (Revised: Direct Online Enrollment Flow & Manual Search Refinement) |
| **Tanggal Pembaruan** | Oktober 2026 |
| **Status Dokumen** | *Final Design & Engineering Handover* |
| **Target Rilis** | MVP (Minimum Viable Product) |
| **Penyusun** | Tim Produk & UI/UX Design (Kelompok 5 Cut Meutia) |

---

## 1. Ringkasan Eksekutif & Visi Produk

### 1.1 Visi Produk
Menjadi ekosistem digital terpercaya di Indonesia yang menjembatani transparansi, verifikasi legalitas, proses pendaftaran, dan pemantauan kualitas pengasuhan anak usia dini antara Orang Tua dan Pengelola *Daycare* melalui pendekatan analitis berbasis AI dan prinsip *Human-in-the-Loop*.

### 1.2 Misi Utama
1. Menghilangkan kecemasan orang tua pekerja dalam memilih *daycare* dengan menyediakan akses verifikasi legalitas, lokasi, kurikulum, serta skor keselamatan yang objektif (*AI Safety Score*).
2. Menyediakan **Alur Pendaftaran Anak ke Daycare** yang terstruktur, transparan, dan dapat dipantau status pengajuannya secara *real-time*.
3. Meringankan beban administratif pengasuh melalui otomatisasi pencatatan kegiatan harian dan pemetaan sentimen ulasan.
4. Membangun mekanisme mitigasi risiko dan penanganan laporan insiden yang cepat, akurat, serta terintegrasi dengan otoritas terkait (KemenPPPA/KPAI).

---

## 2. Latar Belakang, Problem Statement & User Persona

### 2.1 Analisis Masalah
Berdasarkan hasil riset sekunder dan survei primer:
* **Krisis Keamanan & Kepercayaan:** Hanya 36,02% TPA di Indonesia yang terakreditasi resmi, dengan rasio ketersediaan 1 fasilitas berbanding 8.719 balita. Maraknya kasus kekerasan dan *daycare* ilegal menciptakan trauma kolektif bagi orang tua.
* **Proses Pendaftaran yang Rumit & Manual:** Orang tua kesulitan mengetahui ketersediaan slot/kuota secara transparan dan harus melakukan pendaftaran manual yang tidak terintegrasi dengan sistem pemantauan anak.
* **Defisit Transparansi Harian:** 71,4% orang tua mengalami kekhawatiran terkait kesehatan, cedera, dan keterlambatan pembaruan informasi harian anak.
* **Ketiadaan Mitigasi Risiko:** Belum ada saluran komunikasi terdokumentasi dan terstruktur untuk mengklasifikasikan tingkat urgensi insiden secara *real-time*.

### 2.2 Target Pengguna (User Personas)

#### Role 1: Orang Tua (Parent) — *Representasi: "Bu Fiqo"*
* **Demografi:** Pekerja kantoran/dosen/wirausaha (usia 25–42 tahun), domisili area perkotaan/penyangga (misal: Gresik), pendapatan rumah tangga Rp5jt–Rp10jt/bulan.
* **Kebutuhan Utama:** Memverifikasi legalitas resmi, membandingkan fasilitas & harga, mendaftarkan anak secara online ke daycare pilihan, serta memantau aktivitas harian anak.
* **Pain Points:** Riset manual yang memakan waktu, proses pendaftaran berbelit, dan khawatir akan keselamatan serta kesehatan anak.

#### Role 2: Caregiver / Pengelola Daycare
* **Demografi:** Pengelola, pemilik *daycare* skala kecil-menengah, dan staf pengasuh harian.
* **Kebutuhan Utama:** Menunjukkan kredibilitas & izin resmi, mengelola pendaftaran masuk anak (kuota slot), serta mempermudah pembuatan laporan harian tanpa menyita waktu pengasuhan fisik.
* **Pain Points:** Beban administrasi manual berlebih, verifikasi pendaftaran anak yang tidak teratur, dan ulasan tidak berimbang.

---

## 3. Arsitektur Fitur & Integrasi AI

Sistem berfokus pada efisiensi operasional dan analisis data yang objektif. 

+-----------------------------------------------------------------------------------+
|                                  AYOMI SYSTEM                                     |
+-----------------------------------------+-----------------------------------------+
|        ROLE 1: ORANG TUA (PARENT)       |       ROLE 2: CAREGIVER / MITRA         |
+-----------------------------------------+-----------------------------------------+
| [AI] AI Safety Score (0-100)            | [AI] AI OCR Legalitas Doc Validation    |
| [AI] Real-time Urgency Detection        | [AI] AI Recommendation Score Booster    |
| [AI] AI Review Summary                  | [AI] AI Sentiment Review Summary        |
| [AI] Anti-Fake Review Filter            | [AI] AI Smart Reply Drafter             |
|                                         | [AI] AI Daily Report Drafter (Photo)    |
| [Non-AI] Directory & Advanced Filter    | [Non-AI] Profile & Capacity Manager     |
| [Non-AI] Side-by-Side Comparison        | [Non-AI] Child Enrollment Approval      |
| [Non-AI] Direct Online Child Enrollment | [Non-AI] Child-to-Daycare Linking       |
| [Non-AI] Real-time Daily Activity Feed  | [Non-AI] Manual Daily Log & Batch Send  |
| [Non-AI] Incident Form & Status Tracker | [Non-AI] Micro-Certification Checklist  |
+-----------------------------------------+-----------------------------------------+


### 3.1 Detail Fitur Berbasis AI & Non-AI

#### A. Fitur Sisi Orang Tua
1. **Direktori & Filter Pencarian Manual (Non-AI):** Pencarian direktori presisi berdasarkan lokasi/jarak, rentang harga bulanan, ketersediaan slot, akreditasi legalitas, dan fasilitas khusus.
2. **Skor Keamanan AI (AI Safety Score):** Algoritma agregasi (0–100) yang membaca kelengkapan dokumen perizinan (40%), rasio pengasuh:anak (30%), dan analisis sentimen ulasan/laporan tersembunyi (30%).
3. **Alur Pendaftaran Online Anak (Non-AI):** Form pendaftaran anak langsung dari halaman detail daycare (pilih data anak, tanggal mulai titip, paket/layanan, upload dokumen riwayat medis/imunisasi).
4. **AI Deteksi Urgensi Laporan (Real-time Triage):** Mengklasifikasikan deskripsi laporan insiden ke dalam 4 tingkatan (*Rendah, Sedang, Tinggi, Darurat*). Status *Darurat* memicu eskalasi langsung ke tim pengawas & hotline KemenPPPA/KPAI.
5. **Ringkasan Ulasan Otomatis (AI Review Summary):** Merangkum puluhan ulasan tekstual menjadi poin ringkas kekuatan (positif) dan area perbaikan (negatif).
6. **Filter Ulasan Otentik (Anti-Spam AI):** Memverifikasi bahwa akun penulisan ulasan terhubung dengan status anak yang "Sedang/Pernah Digunakan".

#### B. Fitur Sisi Caregiver
1. **Manajemen Pendaftaran Anak & Kuota (Non-AI):** Dashboard untuk meninjau pengajuan pendaftaran anak dari orang tua (Terima/Tolak/Menunggu Pembayaran) serta manajemen kapasitas slot harian/bulanan.
2. **AI Ekstraksi & Validasi Dokumen (OCR):** Membaca foto/scan izin operasional (PAUD/TPA) untuk mengekstrak Nomor Izin, Lembaga Penerbit, dan Masa Berlaku secara otomatis saat onboarding bisnis.
3. **AI Rekomendasi Perbaikan Skor:** Panduan prioritas operasional untuk menaikkan skor keselamatan daycare.
4. **AI Ringkasan Sentimen Ulasan:** Pemetaan distribusi sentimen masukan orang tua.
5. **AI Draft Balasan Ulasan/Laporan:** Draf tanggapan santun & profesional untuk ulasan publik atau laporan non-darurat.
6. **AI Menulis Update Harian dari Foto (Human-in-the-Loop):** Menganalisis konteks foto aktivitas anak yang diunggah dan menghasilkan draf narasi catatan harian. **Wajib ditinjau dan disetujui pengasuh sebelum terkirim ke orang tua**.

---

## 4. Alur Pengguna & User Flow Spesifik (Enrollment & Linking)

Berikut adalah diagram alur pengguna terbaru yang mencakup **Proses Pendaftaran Anak ke Daycare**:

```mermaid
flowchart TD
    Start([Akses Platform Ayomi Web]) --> AuthCheck{Autentikasi}
    AuthCheck -- Belum Login --> RegisterPage[Form Register & Pilih Role]
    AuthCheck -- Sudah Login --> RoleCheck{Role User?}

    %% ROLE ORANG TUA
    RoleCheck -- Orang Tua --> ParentHome[Halaman Beranda Orang Tua /beranda]
    ParentHome --> SearchFlow[Cari Daycare via Filter /pencarian]
    SearchFlow --> DetailDaycare[Detail Profil Daycare /detail]
    DetailDaycare --> CompareFlow[Bandingkan Daycare /bandingkan]
    
    %% ALUR PENDAFTARAN ANAK ONLINE (NEW FLOW)
    DetailDaycare --> EnrollAction{Aksi Pengguna}
    EnrollAction -- "Tanya Dulu" --> ContactWA[Hubungi via WhatsApp]
    EnrollAction -- "Daftar Langsung" --> EnrollForm[Form Pendaftaran Anak /pendaftaran-anak]
    
    EnrollForm --> SelectChildData[Pilih/Tambah Profil Anak]
    SelectChildData --> FillEnrollDetails[Isi Tanggal Mulai Titip & Paket]
    FillEnrollDetails --> UploadChildDocs[Upload Riwayat Imunisasi/Kesehatan]
    UploadChildDocs --> SubmitEnrollment[Kirim Pengajuan Pendaftaran]
    SubmitEnrollment --> TrackEnrollmentStatus[Halaman Status Pendaftaran /status-pendaftaran]

    TrackEnrollmentStatus --> CaregiverReviewStatus{Keputusan Daycare}
    CaregiverReviewStatus -- "Disetujui" --> PaymentConfirm[Konfirmasi / Pembayaran]
    PaymentConfirm --> ActiveChildLinked[Status Anak: 'Sedang Titip' & Terhubung]
    ActiveChildLinked --> AccessDailyJournal[Akses Terbuka: Catatan Harian /catatan-harian]
    CaregiverReviewStatus -- "Ditolak / Slot Penuh" --> EnrollRejected[Status: Ditolak dengan Alasan]

    %% ROLE CAREGIVER
    RoleCheck -- Caregiver --> CaregiverRegister[Pendaftaran Akun Bisnis]
    CaregiverRegister --> UploadDocOCR[Upload Dokumen Izin & AI OCR]
    UploadDocOCR --> VerificationStatus{Status Verifikasi Moderator}
    VerificationStatus -- Pending --> DashboardRestricted[Dashboard Mode Tinjauan 'Menunggu Verifikasi']
    VerificationStatus -- Approved --> DashboardFull[Dashboard Utama Pengelola /pengelola]

    %% ALUR KELOLA PENDAFTARAN SISI CAREGIVER
    DashboardFull --> ManageEnrollments[Kelola Pendaftaran Anak /pengelola/pendaftaran]
    ManageEnrollments --> CaregiverReviewStatus
    
    DashboardFull --> DailyReportForm[Form Laporan Harian Anak /pengelola/laporan-harian/tambah]
    DailyReportForm --> PhotoAI[Upload Foto -> AI Draft Generated]
    PhotoAI --> HumanEdit[Human-in-the-Loop: Pengasuh Review & Edit]
    HumanEdit --> PublishFeed[Kirim ke Feed Orang Tua]

    
    ## 5. Matriks Halaman & Rute Web (Next.js Routing)

Dokumen ini memetakan seluruh rute aplikasi web yang wajib dikembangkan sesuai daftar tugas `CM001` hingga `CM044` plus rute pendaftaran baru[cite: 7]:

| ID Task | Rute Web | Deskripsi & Fungsionalitas Halaman | Komponen UI Utama | Responsivitas & Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `CM025` | `/masuk` | Halaman Login Pengguna (Orang Tua & Caregiver)[cite: 7]. | `Input`, `Button`, `Toast`[cite: 7]. | Form validation email/phone & password[cite: 7]. |
| `CM026` | `/daftar` | Halaman Buat Akun Baru + Selector Peran[cite: 7]. | `Tabs`, `Input`, `Button`[cite: 7]. | Choice Role (Parent vs Caregiver)[cite: 1, 7]. |
| `CM027` | `/beranda` | Dashboard Beranda Orang Tua[cite: 7]. | `Card`, `Banner`, `ProgressBarWithCard`[cite: 7]. | Responsive heading title size (`CM044`)[cite: 7]. |
| `CM028` | `/pencarian` | Katalog & Directory Pencarian Manual Daycare[cite: 7]. | `Input`, `Dropdown`, `Card`, `Badge`[cite: 7]. | Sidebar filter desktop / Bottom-sheet mobile[cite: 7]. |
| `CM029` | `/detail` | Detail Daycare (Informasi, AI Score, & 4 Tab)[cite: 7]. | `Tabs`, `StarRating`, `Badge`, `Button`[cite: 7]. | Action Bar: "Daftarkan Anak" & "Bandingkan"[cite: 1, 7]. |
| `CM030` | `/bandingkan` | Modal / Selector Pilih Daycare Komparasi[cite: 7]. | `Modal`, `Card`, `Input`[cite: 7]. | Max 3 daycare selection[cite: 1, 7]. |
| `CM031` | `/bandingkan/hasil`| Tabel Hasil Perbandingan Daycare *Side-by-Side*[cite: 7]. | Table grid layout, `Badge`, `Button`[cite: 7]. | Horizontal scroll table on mobile[cite: 7]. |
| `NEW-01`| `/pendaftaran-anak`| Form Pendaftaran Anak ke Daycare (Online Enrollment)[cite: 1, 3, 7]. | `Dropdown`, `Input`, Upload File, `Button`[cite: 7]. | Child profile selection & medical history attachment[cite: 1, 7]. |
| `NEW-02`| `/status-pendaftaran`| Halaman Pelacakan Status Pengajuan Pendaftaran Anak[cite: 1, 3, 7]. | Timeline Step Tracker, `Badge`, `Card`[cite: 7]. | Status tracking (Pending/Accepted/Rejected)[cite: 1, 7]. |
| `CM033` | `/catatan-harian`| Linimasa & Ringkasan Aktivitas Anak Harian[cite: 7]. | Calendar Picker, `ProgressBarWithCard`[cite: 7]. | Chronological activity timeline[cite: 1, 7]. |
| `CM035` | `/laporan` | Pusat Bantuan & Form Laporan Cepat Insiden[cite: 7]. | `ToggleSwitch`, `Input` (Textarea), `Toast`[cite: 7]. | Real-time AI urgency preview badge[cite: 1, 7]. |
| `CM036` | `/ulasan` | Form Input Ulasan & Rating Terverifikasi[cite: 7]. | `StarRating`, `Input`, `Button`[cite: 7]. | Star rating mandatory validation[cite: 7]. |
| `CM037` | `/notifikasi` | Feed Daftar Notifikasi Sistem[cite: 7]. | List Item, `Badge`, Time-ago format[cite: 7]. | Read / Unread status toggle[cite: 7]. |
| `CM034` | `/profil` | Pengaturan Profil Pengguna & Keluar[cite: 7]. | `ProfilePicture`, List Menu, `Button`[cite: 7]. | Account data management[cite: 1, 7]. |
| `CM038` | `/pengelola` | Dashboard Utama Pengelola Daycare[cite: 7]. | `Card`, KPI Grid, `Banner`, `Button`[cite: 7]. | Metric summaries & pending enrollment alert[cite: 1, 7]. |
| `NEW-03`| `/pengelola/pendaftaran`| Halaman Kelola Pengajuan Pendaftaran Anak[cite: 1, 3, 7]. | Table List, Modal Detail Anak, `Button`[cite: 7]. | Approve / Reject actions with note[cite: 1, 7]. |
| `CM039` | `/pengelola/laporan-harian` | Daftar & Ringkasan Laporan Harian Anak[cite: 7]. | Table / List, Status Badges, `Button`[cite: 7]. | Batch creation & status filter[cite: 7]. |
| `CM040` | `/pengelola/laporan-harian/tambah` | Form Input Laporan Harian + AI Drafter[cite: 7]. | `Dropdown`, Image Uploader, `Input`[cite: 7]. | Human-in-the-loop review textarea[cite: 1, 7]. |
| `CM041` | `/pengelola/ulasan` | Dashboard Manajemen Ulasan & Balasan AI[cite: 7]. | `Card`, AI Summary Box, `Button`[cite: 7]. | Copy/edit AI reply template[cite: 1, 7]. |
| `CM042` | `/pengelola/profil` | Profil Bisnis — Mode View (Public Preview)[cite: 7]. | Photo Gallery, `Badge` Legalitas, Info Grid[cite: 7]. | Verification badge & document validity date[cite: 7]. |
| `CM043` | `/pengelola/profil/edit` | Profil Bisnis — Mode Edit Form[cite: 7]. | Form controls, Multi-checkbox, `Button`[cite: 7]. | Form validation & draft save[cite: 7]. |

---

## 6. Spesifikasi Sistem Komponen UI Reusable (`components/`)

Sesuai lembar *Daftar Komponen yang Dibuat*, seluruh komponen React wajib mengimplementasikan spesifikasi props berikut[cite: 7]:

```typescript
// 1. Button (CM009)
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost'; // primary: #264653, secondary: outline, ghost: text-only
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// 2. Badge (CM010)
interface BadgeProps {
  variant: 'green' | 'white' | 'yellow' | 'grey';
  children: React.ReactNode;
}

// 3. Card (CM011)
interface CardProps {
  color?: 'white' | 'yellow' | 'green' | 'blue';
  children: React.ReactNode;
  className?: string;
}

// 4. ToggleSwitch (CM014)
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

// 5. Modal (CM015)
interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  children: React.ReactNode;
}

// 6. Input (CM016)
interface InputProps {
  type: 'text' | 'number' | 'textarea' | 'password';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement HTMLTextAreaElement |>) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  error?: string;
}

// 7. ProgressBarWithCard (CM017)
interface ProgressBarWithCardProps {
  label: string;
  value: number; // 0 - 100
  color?: string;
  subtitle?: string;
}

// 8. ProfilePicture (CM018)
interface ProfilePictureProps {
  src?: string;
  name: string; // Used for fallback initials
  size?: 'sm' | 'md' | 'lg';
  colorRandom?: boolean;
}

// 9. Dropdown (CM019)
interface DropdownProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
}

// 10. StarRating (CM020)
interface StarRatingProps {
  rating: number; // 1 - 5
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

// 11. Tabs (CM021)
interface TabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

// 12. Banner (CM022)
interface BannerProps {
  title: string;
  description: string;
  ctaText?: string;
  onCtaClick?: () => void;
  type?: 'info' | 'warning' | 'ai';
}

// 13. Toast (CM023)
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  open: boolean;
  onClose: () => void;
}