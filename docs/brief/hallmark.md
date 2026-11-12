# Hallmark Design Guidelines & Master UI Prompts — Ayomi Platform

> **System Blueprint for Cursor, v0, Claude Code, Windsurf & AI Coding Agents**
> **Platform Name:** Ayomi — National Daycare Management & Child Safety Platform
> **Design Version:** 1.2 (Anti-AI-Slop Clean SaaS Architecture)

---

## SECTION 1: CORE BRAND DESIGN SYSTEM & TOKENS

You are an expert Senior UI/UX Engineer building the frontend for **Ayomi**, a national daycare management and child safety web application in Indonesia. You must strictly adhere to the **Hallmark Design System** guidelines below to prevent generic "AI Slop" designs.

### 1. Color Palette Tokens

The Ayomi brand identity relies on an editorial, trustworthy, warm, and highly functional color hierarchy.

*   **Primary Trust / Main Header:** Deep Teal (`#264653`)
    *   Tailwind utilities: `bg-[#264653]`, `text-[#264653]`, `border-[#264653]`
    *   *Usage:* Navigation headers, primary action buttons, dark hero containers, left sidebars, structural cards.
*   **Secondary / Verified Accent:** Warm Mint (`#2A9D8F`)
    *   Tailwind utilities: `bg-[#2A9D8F]`, `text-[#2A9D8F]`, `border-[#2A9D8F]`
    *   *Usage:* Verification checkmarks, positive ratings, active tab indicators, success status badges, high-contrast CTA focus.
*   **Highlight / Safety Score Accent:** Warm Amber (`#E9C46A`)
    *   Tailwind utilities: `bg-[#E9C46A]`, `text-[#1A2E35]`, `border-[#E9C46A]`
    *   *Usage:* AI Safety score gauges, pending status badges, warning notifications, score highlights.
*   **Urgent / Alert Accent:** Soft Coral / Terracotta (`#E76F51`)
    *   Tailwind utilities: `bg-[#E76F51]`, `text-white`, `border-[#E76F51]`
    *   *Usage:* Emergency incident triage (Darurat/Tinggi), critical actions, alert badges, rejection buttons.
*   **Neutral Background Canvas:** Soft Cream-White (`#F8F9FA`)
    *   Page Surface: `#F8F9FA` or `#F4F5F6`
    *   Card Surface: Solid Pure White (`#FFFFFF`) with explicit 1px crisp borders (`border-slate-200` or `border-[#264653]/10`).
*   **Typography Colors:** Charcoal Dark (`#1A2E35`)
    *   Primary Text: `#1A2E35` (`text-slate-900` / `text-[#1A2E35]`)
    *   Secondary/Muted Text: `#556670` (`text-slate-600`)
    *   Subtle Borders: `#E2E8F0` or `#E5E7EB`

---

## SECTION 2: ANTI-AI-SLOP RULES (HALLMARK PRINCIPLES)

1.  **NO Generic Gradients & Neon Glows:**
    *   **FORBIDDEN:** `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500`, `shadow-[0_0_30px_rgba(59,130,246,0.5)]`, fuzzy blurred glowing edges.
    *   **REQUIRED:** Solid, high-contrast surfaces (`bg-[#264653]`, `bg-white`), crisp 1px borders (`border border-slate-200`), and subtle flat opacity fills (`bg-[#2A9D8F]/10`).
2.  **STRICT Micro-Iconography Rules (NO OS Color Emojis):**
    *   **FORBIDDEN:** Standard OS colorful emojis (e.g., 🤩, 😴, 🩹, 🚨, ❤️, 😊). Emojis ruin B2B/SaaS design consistency and create visual clutter.
    *   **REQUIRED:** Stroke-based vector icons from `lucide-react` (e.g., `<Smile className="w-4 h-4 text-[#2A9D8F]" />`, `<Thermometer className="w-4 h-4 text-[#E76F51]" />`, `<Clock />`, `<ShieldCheck />`, `<AlertTriangle />`).
    *   Status badges must pair stroke icons with structured text labels inside rectangular or slightly rounded pills.
3.  **High Information Density & Structured Grids:**
    *   Avoid floating elements with unanchored margins or giant empty white space.
    *   Use explicit 1px borders, data tables with crisp headers, key-value pairs, and tabular alignment.
4.  **Typography & Hierarchy Rules:**
    *   Font Family: `Plus Jakarta Sans` or `Inter`.
    *   Headings: Bold (`font-bold` / `font-700`), tight letter-spacing (`tracking-tight`), text color `#1A2E35`.
    *   Data Labels: Small uppercase text with wider tracking (`text-[11px] font-semibold tracking-wider text-slate-500 uppercase`).
5.  **Buttons & Component Consistency:**
    *   `Primary CTA`: Solid `#264653` or `#2A9D8F`, rounded-xl (`border-radius: 12px`), padding `10px 20px`, text white, hover brightness `105%` (no fuzzy glow).
    *   `Secondary CTA`: Outline 1.5px `#264653` or `#2A9D8F`, text `#264653`, background `transparent`, hover background `#264653` with text `#FFFFFF`.
    *   `Ghost Button`: Text `#264653`, hover background `rgba(42, 157, 143, 0.08)`, rounded-lg.
    *   `Toggle Switch`: Container `w-12 h-6 rounded-full p-0.5 transition-colors`. Off: `bg-slate-300` knob left. On: `bg-[#2A9D8F]` knob right (`translate-x-6`).

---

## SECTION 3: DETAILED PAGE-BY-PAGE MASTER PROMPTS

### PAGE 3.1 — Interactive Splash & Welcome Screen (`/welcome`)

```text
Design an editorial, high-trust Splash & Welcome Screen for "Ayomi", a national daycare management & child safety platform.

Visual Architecture:
- Full-screen split hero with a left dark teal structural panel (#264653) and a right high-res photograph of an authentic, clean Indonesian daycare environment with a soft white overlay.

Left Panel Content (Dark Teal #264653, Text Pure White):
- Floating Top Navigation: White Ayomi brand mark (C-person emblem) + Language pill selector ("ID | EN").
- Badge: Monochrome icon <ShieldCheck className="w-4 h-4 text-[#E9C46A]" /> + Text "Platform Keselamatan Anak Nasional" (Text Amber #E9C46A, background #E9C46A/15, border border-[#E9C46A]/30, rounded-full, px-3 py-1).
- Headline: "Pengasuhan Transparan. Orang Tua Tenang." (Font Plus Jakarta Sans, bold, tracking-tight, 44px).
- Subtitle: "Direktori daycare terverifikasi di 34+ provinsi dengan AI Safety Score, logbook aktivitas real-time, dan proteksi privasi otomatis." (Text slate-300, 16px).

Interactive Entry Actions (Stacked Cards):
1. Primary Card Button (Solid #2A9D8F, text white, p-4, rounded-xl, flex justify-between items-center):
   - Text: "Masuk / Daftar sebagai Orang Tua"
   - Icon: <ArrowRight className="w-5 h-5" />
2. Secondary Card Button (Background #264653/80, border border-white/20, text white, p-4, rounded-xl, flex justify-between items-center):
   - Text: "Portal Pengelola Daycare (Caregiver)"
   - Icon: <Building2 className="w-5 h-5 text-[#E9C46A]" />
3. Bottom Link: "Masuk Portal System Administrator" (Text slate-400, hover:text-white, text-xs).

Footer Trust Bar:
- Horizontal flex row: <CheckCircle2 className="text-[#2A9D8F]" /> "100% Verifikasi Legalitas OCR" | <Lock className="text-[#2A9D8F]" /> "AI Privacy Face Blur" | <Building className="text-[#2A9D8F]" /> "Multi-Kota Indonesia".
```

---

### PAGE 3.2 — Multi-Role Authentication with Role Selector (`/daftar` & `/masuk`)

```text
Design a responsive split-screen Authentication Page for Ayomi featuring a 3-Role tab switcher.

Layout (50/50 Split Desktop):
- Left Side (Brand Showcase Panel - Deep Teal #264653):
  * Large white Ayomi Logo.
  * Card metrics stack (Solid white surface cards, p-4, rounded-xl, text-slate-900):
    - Metric 1: <ShieldCheck className="text-[#2A9D8F]" /> "100+ Daycare Terverifikasi Resmi"
    - Metric 2: <Sparkles className="text-[#E9C46A]" /> "AI Safety Score & AI Privacy Masking Active"
    - Metric 3: <Activity className="text-[#2A9D8F]" /> "Real-time Daily Activity Logbook"

- Right Side (Form Panel - Clean Soft White #F8F9FA):
  * Header: "Selamat Datang di Ayomi" (Text #1A2E35, 28px bold), Subtitle: "Silakan pilih peran akun Anda untuk melanjutkan."

Role Selector Tab Switcher (Horizontal Pill Container bg-slate-200/60 p-1 rounded-xl gap-1 mb-6):
- Role Option 1: <User className="w-4 h-4" /> "Orang Tua" -> Active state: bg-[#264653] text-white shadow-sm rounded-lg py-2 px-4.
- Role Option 2: <Building2 className="w-4 h-4" /> "Pengelola Daycare" -> Inactive state: text-slate-600 hover:text-slate-900 py-2 px-4.
- Role Option 3: <Key className="w-4 h-4" /> "Admin" -> Inactive state: text-slate-600 hover:text-slate-900 py-2 px-4.

Form Input Fields (Dynamic based on selected role):
- Field 1: Nama Lengkap (Input text with <User /> icon inside left, placeholder: "cth. Sustri Simamora").
- Field 2: Alamat Email (Input email with <Mail /> icon).
- Field 3: Nomor WhatsApp (Input tel with <Phone /> icon, +62 prefilled).
- Field 4: Kata Sandi (Input password with <Lock /> icon & <Eye /> toggle button right).
- Field 5 (Conditional for Caregiver): Nama Daycare & Kota Operasional.
- Checkbox: "Saya menyetujui Syarat & Ketentuan serta Kebijakan Privasi Ayomi" (Custom checkbox in #2A9D8F).

Action CTAs:
- Submit Button: Full width, solid #2A9D8F, rounded-xl, py-3, font-bold, text-white: "Daftar Akun Sekarang".
- Divider: "atau masuk dengan"
- Google OAuth Button: Full width, bg-white, border border-slate-300, text-slate-700, rounded-xl, py-2.5, hover:bg-slate-50.
- Link Bottom: "Sudah memiliki akun? Masuk di sini" (Link text #264653 font-semibold).
```

---

### PAGE 3.3 — Parent Directory & Search (`/pencarian`)

```text
Design the Parent Daycare Directory Search Page with multi-city hierarchical filters for Ayomi.

Top Header Bar:
- Navbar in Deep Teal (#264653): Logo, Location Dropdown (<MapPin /> "Kebomas, Kabupaten Gresik"), Nav Links ("Beranda", "Direktori", "Bandingkan (2)", "Logbook"), Notification Bell with counter badge, User Avatar.

Main Content Split (280px Filter Sidebar + Grid Listing):

Left Filter Panel (White surface card, border border-slate-200, rounded-xl, p-5):
- Title: "Filter Pencarian" + "Reset Filter" link.
- Hierarchical Location Selector (Accordion):
  * Dropdown 1: Provinsi ("Jawa Timur")
  * Dropdown 2: Kota/Kabupaten ("Gresik")
  * Dropdown 3: Kecamatan ("Kebomas")
- Price Range Slider: Rp 500.000 - Rp 5.000.000 / bln (Display active value label).
- Minimum AI Safety Score: Slider 0 - 100 (Default >80, Amber badge highlight).
- Caregiver Ratio Radios: "1:3 (Bayi)", "1:4 (Batita)", "1:6 (Balita)".
- Facility Checkboxes: "CCTV Online 24/7", "Dokter Visit Rutin", "Outdoor Playground", "Fingerprint Access", "Katering Gizi Organik".
- Verification Toggle Switch: "Hanya Daycare Terverifikasi Resmi" (Toggle switch active #2A9D8F).

Right Content Area:
- Top Result Bar: "Menampilkan 14 Daycare Terverifikasi di Kebomas, Gresik" + Sort Dropdown ("Safety Score Tertinggi", "Harga Termurah", "Jarak Terdekat").
- Daycare Cards Grid (3-Column Desktop):
  * Thumbnail Image with Top-Left Badge: <CheckCircle2 className="w-3.5 h-3.5 text-white" /> "Terverifikasi Resmi" (Mint #2A9D8F pill).
  * Top-Right Badge: <ShieldCheck className="w-3.5 h-3.5 text-[#1A2E35]" /> "AI Safety Score 96" (Amber #E9C46A pill).
  * Card Content: Title "Daycare Kasih Bunda", Address "Jl. Dr. Wahidin No. 45, Kebomas", Distance "0.8 km".
  * Metrics Grid (2x2): "Rasio 1:4", "Sisa 4 Slot", "Rp 1.500.000/bln", "Rating 4.8 (42 Ulasan)".
  * Bottom Action Buttons: "Bandingkan" (Outline #264653 50% width) & "Lihat Detail" (Solid #2A9D8F 50% width).
```

---

### PAGE 3.4 — Daycare Detail Page & AI Insights (`/detail/[id]`)

```text
Design the Daycare Detail Page for Parents featuring AI Safety Score Breakdown and AI Review Summary.

Header Banner & Gallery:
- Photo Gallery Grid (1 main large left, 4 grid thumbnails right) + "Lihat Semua Foto (18)" button.
- Title Header: "Daycare Kasih Bunda", Verified Permit Badge ("Permit No: 421.1/089/Disdik/2025"), Address, and Action Bar Right: "Daftarkan Anak" (Solid #2A9D8F) & "Tambah Komparasi" (Outline #264653).

Tab Navigation Bar (4 Horizontal Tabs):
1. Tab 1: "Ringkasan & AI Safety Score"
   - Gauge Metric Display: "94 / 100" (AI Safety Score - Sangat Tinggi).
   - 3-Aspect Score Breakdown Cards:
     * Card A: <FileCheck className="text-[#2A9D8F]" /> "Legalitas Dokumen (30/30)" -> Verified OCR Status Active.
     * Card B: <Users className="text-[#2A9D8F]" /> "Rasio Pengasuh (34/35)" -> 1 Pengasuh : 4 Anak (Sesuai Standar IDAI).
     * Card C: <Shield className="text-[#2A9D8F]" /> "Fasilitas Keselamatan (30/35)" -> CCTV 24/7, P3K, Area Bermain Aman.
2. Tab 2: "AI Summary Ulasan"
   - AI Summary Box (bg-[#2A9D8F]/10, border border-[#2A9D8F]/30, rounded-xl, p-5):
     * Header: <Sparkles className="w-4 h-4 text-[#2A9D8F]" /> "Ringkasan AI dari 42 Ulasan Orang Tua".
     * Sentiment Bar: 92% Positif (Mint) | 8% Evaluasi (Amber).
     * Pros Bullets: <Check className="text-[#2A9D8F]" /> "Pengasuh sangat telaten & bersertifikat P3K", "Kebersihan toilet & kamar tidur sangat dijaga", "Update logbook harian konsisten via Ayomi".
     * Cons Bullets: <AlertCircle className="text-[#E76F51]" /> "Area parkir kendaraan terbatas saat jam penjemputan sore".
     * Top Topic Chips: "#PengasuhSabar", "#RuanganHigienis", "#UpdateCepat".
   - Individual Parent Reviews List below with rating stars, parent name, date, and caregiver response.
3. Tab 3: "Fasilitas & Legalitas" (Grid of verified badges & document PDF thumbnails).
4. Tab 4: "Biaya & Paket" (Full Day, Half Day, Daily cards).
```

---

### PAGE 3.5 — Side-by-Side Daycare Comparison (`/bandingkan/hasil`)

```text
Design a Side-by-Side Daycare Comparison Matrix Page for Parents.

Top Action Bar:
- Title: "Komparasi Daycare Pilihan" (Max 3 daycares side-by-side).
- Button: "+ Tambah Daycare Lain ke Komparasi".

Comparison Matrix Table:
- Sticky First Attribute Column:
  * Nama Daycare
  * Status Legalitas
  * AI Safety Score
  * Harga Bulanan
  * Rasio Pengasuh/Anak
  * Ketersediaan Slot
  * CCTV Online 24/7
  * Katering Gizi
  * Ringkasan Ulasan AI
- Columns 2 & 3: Selected Daycares (e.g., "Daycare Kasih Bunda" vs "TPA Tunas Bangsa").
- Highlight Rule: Best metric in each row gets a soft mint background fill (bg-[#2A9D8F]/10) and a stroke checkmark (<Check className="w-4 h-4 text-[#2A9D8F]" />).
- Bottom Action Row: Solid #2A9D8F "Pilih & Daftar Sekarang" button per daycare column.
```

---

### PAGE 3.6 — Parent Daily Logbook Timeline (`/catatan-harian`)

```text
Design the Parent Daily Child Activity Logbook Feed with AI Privacy Masking indicators.

Header Control Widget (White card surface, border border-slate-200, rounded-xl, p-4 mb-6):
- Left: Child Selector Dropdown (<User /> "Arka Pratama - 2 Tahun 5 Bulan") + Date Picker (<Calendar /> "Senin, 26 Oktober 2026").
- Right Quick Health Metrics (Horizontal Pill Badges with Lucide Icons - NO Emojis):
  * Mood Metric: <Smile className="w-4 h-4 text-[#2A9D8F]" /> <span className="text-xs font-semibold text-[#2A9D8F]">Mood: Ceria & Aktif</span> (bg-[#2A9D8F]/10 px-3 py-1.5 rounded-md border border-[#2A9D8F]/20).
  * Temperature Metric: <Thermometer className="w-4 h-4 text-[#264653]" /> <span className="text-xs font-semibold text-[#264653]">Suhu: 36.5 °C (Normal)</span> (bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200).
  * Sleep Metric: <Clock className="w-4 h-4 text-[#264653]" /> <span className="text-xs font-semibold text-[#264653]">Tidur: 1.5 Jam</span> (bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200).

Chronological Activity Feed (Timeline Layout):
- Timeline Item 1 (12:15 WIB - Makan Siang):
  * Header: Timestamp pill + Category badge "Makan Siang".
  * Activity Photo: Photo container showing activity. Overlay badge in top-right: <EyeOff className="w-3.5 h-3.5 text-white" /> "🔒 AI Privacy Masked (Wajah Anak Lain Ter-blur)" (bg-black/70 text-white text-[11px] px-2.5 py-1 rounded-full).
  * AI Narrative Box: "Arka terlihat sangat ceria dan lahap saat menikmati makan siang dengan lauk sup sayur dan ayam pada pukul 12.15 WIB."
  * Caregiver Signature: "Dicatat oleh: Mbak Siti (Caregiver)".
  * Parent Reaction Row: Stroke icon reaction buttons (<Heart className="w-4 h-4 text-slate-500 hover:text-[#E76F51]" />, <ThumbsUp />, <MessageSquare />) + Quick reply input.
```

---

### PAGE 3.7 — Incident Reporting & AI Urgency Triage (`/laporan/tambah`)

```text
Design a Quick Incident Reporting Form for Parents with Real-Time AI Urgency Triage Assessment.

Top Header:
- Dark Teal bar (#264653): Title "Pusat Bantuan & Laporan Insiden", Subtext "Tim Ayomi dan Pengelola Daycare siap menindaklanjuti laporan Anda."

Form Layout (Card Surface):
1. Daycare & Child Selector Dropdown: "Arka Pratama" @ "Daycare Kasih Bunda".
2. Category Selection Cards Grid (2x2 Choice Pills):
   - <Activity className="w-4 h-4 text-[#E76F51]" /> "Kesehatan & Cedera Physical"
   - <ShieldAlert className="w-4 h-4 text-[#E9C46A]" /> "Fasilitas & Keamanan"
   - <Clock className="w-4 h-4 text-[#264653]" /> "Jadwal & Penjemputan"
   - <HelpCircle className="w-4 h-4 text-slate-600" /> "Lainnya"
3. Chronology Textarea: "Jelaskan secara rinci kronologi kejadian, waktu, dan dampak pada anak..."
4. Photo/Video Proof Upload Dropzone: File dropzone with camera capture button.
5. Anonymous Toggle Switch: "Kirimkan sebagai Laporan Anonim".

Real-Time AI Triage Feedback Box (Dynamic output upon typing/submitting):
- AI Triage Card (bg-[#E76F51]/10, border border-[#E76F51]/30, rounded-xl, p-4, mt-4):
  * Header: <AlertTriangle className="w-5 h-5 text-[#E76F51]" /> "Hasil AI Urgency Triage: DARURAT / CRITICAL (Score: 92/100)" (Red Coral badge with pulse dot indicator).
  * AI Summary: "Laporan Anda terdeteksi membutuhkan perhatian P3K / medis segera. Notifikasi prioritas tinggi telah diteruskan ke Pengelola dan Admin Ayomi."
- Action Submit Button: Solid #E76F51 (Terracotta Red) button: "Kirim Laporan Insiden Sekarang".
```

---

### PAGE 3.8 — Caregiver Main Management Dashboard (`/pengelola`)

```text
Design the Caregiver Business Management Dashboard with a fixed Dark Teal Sidebar (#264653).

Left Fixed Sidebar Navigation (#264653):
- Brand Logo Ayomi Daycare Admin.
- Daycare Profile Widget: "Daycare Kasih Bunda (Terverifikasi)".
- Nav Links:
  * Dashboard Summary (Active: bg-[#2A9D8F] text-white rounded-lg px-3 py-2)
  * Kelola Pendaftaran (Badge counter: 3 Pending)
  * Logbook Harian Anak
  * Ulasan & AI Smart Reply
  * Dokumen Legalitas
  * Profil Bisnis
- Bottom User Profile: Avatar + "Mbak Siti (Caregiver)" + Logout button.

Main Content Workspace:
- Metrics Overview Row (4 Metric Cards):
  1. Total Anak Aktif: "18 Anak" (<Users className="text-[#264653]" />)
  2. Sisa Slot Available: "2 / 20 Slot" (Progress ring indicator)
  3. Pengajuan Pending: "3 Anak" (Amber badge #E9C46A)
  4. AI Safety Score: "94 / 100" (Mint badge #2A9D8F)

Section 1: Pending Enrollment Requests Table
- Columns: Nama Anak, Usia, Nama Orang Tua, Paket Layanan, Tanggal Pengajuan, Status, Aksi.
- Row Action Buttons: Solid #2A9D8F "Approve" (Triggers atomic slot decrease) & Solid #E76F51 "Reject".

Section 2: Quick Daily Logbook Action Banner
- Button: <Plus className="w-4 h-4" /> "Buat Logbook Harian Baru dengan AI Drafter".
```

---

### PAGE 3.9 — AI Instant Logbook Drafter & Privacy Masking (`/pengelola/laporan-harian/tambah`)

```text
Design the AI-Assisted Daily Activity Logbook Entry Form for Caregivers.

Form Card Steps:
1. Child Selector Pills: Multi-select pills for children attending activity ("Arka Pratama", "Kirana A.").
2. Timestamp Lock Display: Auto-filled timestamp "26 Okt 2026, 10:30 WIB".
3. Photo Upload & Privacy Masking Section:
   - Photo Dropzone / Live Camera stream.
   - Preview Canvas displaying auto-detected face bounding boxes.
   - Privacy Blur Toggle Switch (Default ON - #2A9D8F): <EyeOff className="w-4 h-4" /> "AI Privacy Masking (Buramkan Wajah Anak Lain Otomatis)".
   - Preview Toggle Switch: "Foto Asli (Caregiver View)" vs "Foto Ter-blur (Parent View)".

4. AI Instant Caption Drafter Card:
   - Button: <Sparkles className="w-4 h-4 text-white" /> "Generate Draf Narasi AI" (Solid #2A9D8F).
   - AI Output Textarea (bg-slate-50, border border-slate-300, rounded-xl, p-4):
     * Text: "Arka terlihat sangat ceria dan fokus saat mengikuti sesi mewarnai gambar hewan bersama teman-teman pada pukul 10.30 WIB."
   - 1-Tap Publish Action Row:
     * Button 1: "Edit Manual" (Outline #264653).
     * Button 2: "Publikasikan Sekarang (1-Tap Approve)" (Solid #2A9D8F).
     * SLA Timer Badge: <Clock className="w-3.5 h-3.5 text-slate-500" /> "Auto-release dalam 14:59 menit jika tidak diedit".
```

---

### PAGE 3.10 — Review Management & AI Smart Reply (`/pengelola/ulasan`)

```text
Design the Caregiver Review Management Dashboard with AI Smart Reply integration.

Top Analytics Header:
- Overall Rating Badge: "4.8 / 5.0" (From 42 Parent Reviews).
- Sentiment Distribution Progress: 92% Positive, 8% Evaluation.

Reviews Feed List:
- Individual Review Card: Parent Name ("Bunda Sustri S."), Rating Stars (5/5), Date ("24 Okt 2026"), Review Text ("Pengasuhnya sabar banget, fasilitas bersih...").
- AI Smart Reply Box Widget below review (bg-emerald-50/50, border border-[#2A9D8F]/30, rounded-xl, p-4):
  * Button: <Sparkles className="w-4 h-4 text-[#2A9D8F]" /> "Generate AI Smart Reply".
  * Suggested Draft Response Text: "Halo Bunda Sustri, terima kasih banyak atas ulasan positifnya! Kami sangat bahagia mendengar Arka merasa nyaman di Kasih Bunda. Salam hangat dari tim pengasuh! 🙏✨"
  * Action Buttons: "Edit Teks" (Outline #264653) & "Kirim Balasan Resmi" (Solid #264653).
```

---

### PAGE 3.11 — Admin Legal Verification & AI OCR Approval (`/admin/verifikasi-legal`)

```text
Design the System Admin Permit Verification Interface featuring AI OCR Data Extraction.

Split-Screen Verification Interface (50/50 Split):
- Left Panel (Uploaded Document Viewer):
  * PDF/Image scan viewer of official PAUD/TPA permit document with zoom & rotate controls.

- Right Panel (AI OCR Extracted Data Form):
  * Status Badge Top: <Sparkles className="w-4 h-4 text-[#2A9D8F]" /> "AI OCR Extraction Confidence: 99% (High Accuracy)" (Mint badge).
  * Field 1: Nomor Surat Izin/NIB -> Extracted: "421.1/089/Disdik/2025" (Editable input).
  * Field 2: Nama Lembaga Daycare -> Extracted: "Daycare Kasih Bunda".
  * Field 3: Alamat Operasional -> Extracted: "Jl. Dr. Wahidin No. 45, Kebomas, Gresik".
  * Field 4: Masa Berlaku Perizinan -> Extracted: "15 Agustus 2028".

Decision Action Box (Bottom Row):
- Radio Selection Options:
  * "Setujui & Terbitkan Status Terverifikasi + AI Safety Score" (Mint accent)
  * "Minta Perbaikan Berkas Dokumen" (Amber accent)
  * "Tolak Permanen (Dokumen Tidak Valid)" (Red Coral accent)
- Action Submit Button: Solid #2A9D8F "Simpan Keputusan Verification".
```

---

### PAGE 3.12 — Admin Incident Escalation Center (`/admin/insiden`)

```text
Design the National System Admin Incident Escalation & Safety Center for Ayomi.

Top Header Bar:
- Title: "Pusat Eskalasi Insiden & Keselamatan Nasional".
- Quick Alert Summary Cards (4 Columns):
  1. <AlertTriangle className="text-[#E76F51]" /> "1 Insiden Darurat (Perlu Aksi Immediately)"
  2. <AlertCircle className="text-[#E9C46A]" /> "2 Insiden Tinggi (Dalam Diproses)"
  3. <Clock className="text-[#264653]" /> "4 Insiden Sedang"
  4. <CheckCircle2 className="text-[#2A9D8F]" /> "28 Insiden Selesai"

High-Priority Incident Alert Card (Highlighted at top):
- Red Coral Accent Bar (#E76F51 left border 4px).
- Status Pulse Badge: "🔴 Urgensi: DARURAT (AI Score: 95/100)".
- Incident Details:
  * Daycare: "Daycare Kasih Bunda (Kebomas, Gresik)"
  * Child & Parent: "Arka Pratama (Orang Tua: Sustri Simamora - 0812-XXXX-XXXX)"
  * AI Summary: "Anak mengalami luka memar di dahi akibat terjatuh di perosotan outdoor. Membutuhkan konfirmasi pertolongan pertama P3K segera."
- Action Buttons:
  * "Hubungi Pengelola Daycare" (Solid #264653)
  * "Hubungi Orang Tua Langsung" (Solid #E76F51)
  * "Tandai Selesai & Tutup Kasus" (Solid #2A9D8F)
```

---

## SECTION 4: HOW TO EXECUTE WITH AI CODING AGENTS

When building pages using Cursor, v0, Windsurf, or Claude Code:
1. Copy the relevant page prompt from **SECTION 3** above.
2. Instruct your AI agent: *"Read `hallmark.md` to enforce colors `#264653`, `#2A9D8F`, `#E9C46A`, `#E76F51`, Lucide icons, and strictly avoid generic purple/cyan gradients or OS color emojis."*
3. Verify that all components render with explicit 1px borders, Plus Jakarta Sans typography, and clean micro-interactions.

## 4. Universal Navigation Bar (Navbar) Specifications

The Navigation Bar must be strictly consistent, responsive across all screen sizes (Mobile, Tablet, Desktop), and highly interactive. It dynamically adjusts based on the active route and user authentication state/role.

### A. Layout & Behavior Tokens
- Positioning: Sticky at the top (`sticky top-0 z-50`).
- Background Surface: Solid Soft Cream/White (`bg-white/95 backdrop-blur-md border-b border-slate-200`).
- Container Constraints: Maximum width `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Height: Fixed `h-16` (64px) for desktop and mobile.

### B. Responsive Architecture
1. Desktop View (`hidden md:flex`):
   - Brand Section (Left): Bold Ayomi Logo + Tagline Badge (`#264653` Deep Teal with `#2A9D8F` Warm Mint dot).
   - Core Navigation Links (Center): High-contrast links with subtle hover backgrounds (`hover:bg-slate-100 rounded-md px-3 py-2 text-sm font-medium text-[#1A2E35]`).
   - Active State Indicator: Solid 2px bottom border or solid fill background (`bg-slate-100 text-[#264653] font-semibold`).
   - Action & Profile Area (Right):
     - Role Selector / Status Switcher.
     - Interactive Notification Bell Button with live indicator badge (`<Bell />` icon from Lucide React).
     - User Profile Dropdown Menu (`<User />`, `<ChevronDown />`) or "Masuk / Daftar" Primary Action Buttons (`#264653` Deep Teal).

2. Mobile & Tablet View (`md:hidden`):
   - Header Bar: Brand Logo (Left), Quick Notification Bell (Center-Right), and Animated Hamburger Menu Toggle Button (`<Menu />` / `<X />` Lucide Icon) on the far right.
   - Drawer / Flyout Mobile Menu: Slide-down smooth transition (`transition-all duration-200 ease-in-out`).
   - Mobile Links: Vertical stacked list with full-width touch targets (`p-3 text-base rounded-lg hover:bg-slate-100`).
   - Mobile Role Action Footer: Quick button to toggle account settings or switch views.

### C. Role-Based Navigation Routing
- Public / Visitor (`/`, `/pencarian`, `/bandingkan`):
  - Links: `Direktori Daycare`, `Fitur Keselamatan AI`, `Cara Kerja`, `Tentang Ayomi`.
  - Actions: `Masuk` (Outline Button), `Daftar` (Solid `#264653` Button).
- Parent Role (`/beranda`, `/pencarian`, `/pendaftaran-anak`, `/catatan-harian`, `/laporan`):
  - Links: `Beranda`, `Cari Daycare`, `Anak Saya`, `Logbook Harian`, `Pusat Laporan`.
  - Actions: Notification Feed Bell, Profile Avatar Dropdown with Child Switcher Quick Menu.
- Caregiver Role (`/pengelola`, `/pengelola/pendaftaran`, `/pengelola/laporan-harian`, `/pengelola/ulasan`):
  - Links: `Dashboard`, `Pengajuan Slot`, `Input Logbook AI`, `Respon Ulasan`.
  - Actions: Daycare Status Badge ("Terverifikasi" `#2A9D8F`), Caregiver Profile Menu.
- Admin Role (`/admin`, `/admin/verifikasi-izin`, `/admin/eskalasi-insiden`):
  - Links: `Overview Platform`, `Verifikasi OCR Izin`, `Eskalasi Insiden`, `Manajemen Daycare`.
  - Actions: System Health Badge, Admin Security Profile.

### D. Interactivity Requirements
- Dropdown Menus: Trigger on click/hover with click-outside listener.
- Mobile Hamburger Toggle: State-driven (`isOpen` boolean) with smooth accordion collapse.
- Notification Indicator: Animated pulse badge when new urgent incident/logbook is unread.
- Micro-Icons: Exclusively stroke-based `lucide-react` icons (`<Search />`, `<Compass />`, `<ClipboardList />`, `<ShieldAlert />`, `<Bell />`, `<User />`). NO emojis.