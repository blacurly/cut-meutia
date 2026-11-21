# Alur Sistem dan User Flow Ayomi

Link User Flow : https://www.figma.com/board/Bhrj4DhI8bNIlc7gB36gSW/User-Flow-Ayomi?node-id=875-1085&t=FVADJmT2O44Ecn6o-1

Isi dokumen:
1. Arsitektur sistem
2. Peran dan hak akses
3. User flow per peran
4. Mesin status (pendaftaran, insiden, komplain)
5. Pipeline fitur AI
6. Data, privasi, dan keamanan

---

## 1. Arsitektur sistem

```mermaid
flowchart LR
  subgraph Klien["Browser (laptop / HP)"]
    UI["Next.js App Router<br/>React + Tailwind<br/>Context: sesi, daycare aktif"]
  end

  subgraph Vercel["Vercel (production)"]
    PX["proxy.js<br/>refresh sesi Supabase"]
    RH["Route Handlers /api/**<br/>86 file route"]
    LIB["lib/api: validasi, aturan, error<br/>lib/ai: kontrak AI, provider, batas frekuensi"]
  end

  subgraph Supabase["Supabase (cloud)"]
    AUTH["Auth<br/>email + sandi"]
    DB["PostgreSQL<br/>65 tabel, RLS di semua tabel<br/>122 fungsi RPC SECURITY DEFINER"]
    ST["Storage<br/>6 bucket privat"]
  end

  subgraph AI["Layanan AI (server-side, token rahasia)"]
    CV["CV Foto Fokus<br/>YOLO11n-seg (FastAPI)"]
    OCR["ayomi-ocr-api<br/>RapidOCR PP-OCRv5 (Dokploy)"]
    TRI["ayomi-triage-api<br/>mesin aturan rubrik (Dokploy)"]
    LLM["Model bahasa<br/>Qwen via Groq (OpenAI-compatible)"]
  end

  UI -->|"fetch /api/** (cookie sesi)"| PX --> RH --> LIB
  LIB -->|"RPC + query sebagai pengguna (RLS berlaku)"| DB
  LIB -->|"unggah / signed URL 5 menit"| ST
  LIB --> AUTH
  LIB -->|"Bearer CV_API_TOKEN"| CV
  LIB -->|"Bearer OCR_API_TOKEN"| OCR
  LIB -->|"Bearer TRIAGE_API_TOKEN"| TRI
  LIB -->|"AI_API_KEY"| LLM
```

**Poin penting untuk presentasi:**
- **Browser tidak pernah memanggil layanan AI langsung.** Semua kunci (`*_TOKEN`, `AI_API_KEY`) hanya ada di env server Vercel, tidak memakai awalan `NEXT_PUBLIC_`.
- **Aplikasi tidak memakai `service_role`.** Setiap query berjalan sebagai pengguna yang login, jadi RLS dan pemeriksaan peran di fungsi SQL selalu berlaku.
- **Logika bisnis terpisah dari route.** Route Handler hanya membungkus `lib/api/*`. Validasi, error, dan pemanggilan RPC ada di `lib/`.

## 2. Peran dan hak akses

| Peran | Cara mendapat akun | Portal | Hak utama |
| --- | --- | --- | --- |
| Tamu | — | `/`, `/pencarian`, `/detail/[id]`, `/bandingkan` | Membaca katalog publik |
| **Orang Tua** | Daftar sendiri (`/daftar`) + konfirmasi email | `/beranda` dan menu Orang Tua | Data anak, pendaftaran, pembayaran, catatan harian, laporan, komplain, ulasan |
| **Pengasuh** | Undangan Pengelola + verifikasi Admin | `/pengelola` (menu Pengasuh) | Catatan harian dan foto anak yang **sedang ditugaskan**, laporan insiden |
| **Pengelola** | Undangan Admin saat mitra dibuat | `/pengelola` (menu lengkap) | Pendaftaran, penugasan, staf, dokumen, profil dan harga, ulasan, insiden daycare-nya |
| **Admin** | Dikelola internal | `/admin` | Verifikasi (dokumen, harga, foto, pengasuh), pembayaran, moderasi, Safety Score, eskalasi |

## 3. User flow

### 3.1 Orang Tua: dari mencari sampai memantau

```mermaid
flowchart TD
  A([Buka Ayomi]) --> B["/pencarian<br/>filter wilayah, biaya, rating<br/>urutan rekomendasi"]
  B --> C["/detail/id<br/>Ringkasan · Biaya & Paket · Fasilitas & Legalitas<br/>Safety Score"]
  C --> D{Sudah login?}
  D -- Belum --> E["/daftar → cek email → /masuk"]
  E --> C
  D -- Sudah --> F{"Data anak ada?"}
  F -- Belum --> G["/profil: tambah anak + data kesehatan"]
  G --> H
  F -- Ada --> H["/pendaftaran-anak<br/>pilih anak, layanan, tanggal, persetujuan"]
  H --> I["/status-pendaftaran<br/>Menunggu keputusan"]
  I --> J{Keputusan Pengelola}
  J -- Ditolak --> K([Status Ditolak + alasan])
  J -- Diterima --> L["Menunggu pembayaran<br/>Buat pembayaran → QR QRIS"]
  L --> M{"Admin konfirmasi<br/>sebelum batas waktu?"}
  M -- Tidak --> N([Kedaluwarsa])
  M -- Ya --> O["Aktif"]
  O --> P["/catatan-harian<br/>catatan + foto fokus anak sendiri<br/>love, komentar, tandai dibaca"]
  O --> Q["/laporan<br/>insiden anak · ajukan komplain"]
  P --> R{"Pengasuhan selesai?"}
  R -- Ya --> S["/ulasan<br/>rating + ulasan → moderasi Admin"]
  I -. kapan saja .-> T([Batalkan pengajuan])
```

### 3.2 Pengasuh: catatan harian dengan dua AI

```mermaid
flowchart TD
  A(["Masuk sebagai Pengasuh"]) --> B["/pengelola<br/>anak yang ditugaskan hari ini"]
  B --> C["/pengelola/laporan-harian/tambah<br/>jenis kegiatan + catatan singkat"]
  C --> D["Simpan draf"]
  D --> E{"Butuh bantuan menulis?"}
  E -- Ya --> F["✨ Buat draf AI<br/>(Logbook Drafter)"]
  F --> G{"Pakai draf?"}
  G -- Buang --> D
  G -- Pakai → edit --> H
  E -- Tidak --> H["Tambah foto"]
  H --> I["✨ Foto Fokus Anak<br/>deteksi orang → ketuk anak → versi fokus"]
  I --> J["Tinjau versi fokus<br/>(Tandai sudah ditinjau → foto asli dihapus)"]
  J --> K["Kirim ke Orang Tua"]
  B --> L["/pengelola/insiden<br/>lapor kejadian + urgensi"]
  L --> M["✨ Triage berjalan di belakang layar"]
```

### 3.3 Pengelola: operasional daycare

```mermaid
flowchart TD
  A(["Terima undangan Admin"]) --> B["/pengelola/profil/edit<br/>profil, layanan & harga (harga → verifikasi Admin)"]
  B --> C["/pengelola/dokumen<br/>unggah izin, registrasi, SOP, sertifikat, pemeriksaan"]
  B --> D["/pengelola/staf<br/>undang Pengasuh → verifikasi Admin"]
  B --> E["/pengelola/foto<br/>foto fasilitas → moderasi Admin"]
  F["/pengelola/pendaftaran"] --> G{"Pengajuan baru"}
  G -- Tolak --> H([Ditolak + alasan])
  G -- Terima --> I["Menunggu pembayaran"]
  I --> J["Aktif → Tugaskan Pengasuh<br/>(pengasuh, Mulai, Selesai)"]
  J --> K["Hari layanan: Check-in anak"]
  K --> L["Selesaikan pengasuhan"]
  M["/pengelola/insiden"] --> N["Panel ✨ Penilaian urgensi<br/>lihat usulan AI · nilai ulang · tetapkan urgensi"]
  N --> O["Tangani → Selesai"]
  P["/pengelola/ulasan"] --> Q["Balas ulasan → moderasi Admin"]
```

### 3.4 Admin: verifikasi dan kendali

```mermaid
flowchart TD
  A(["Masuk Admin"]) --> B["/admin/daycare<br/>buat mitra (nonaktif) + undangan Pengelola"]
  B --> C["/admin/verifikasi-legal"]
  C --> D["Dokumen: Lihat berkas · ✨ Baca dengan AI<br/>→ Setujui / Minta revisi / Tolak"]
  C --> E["Harga · Foto · Pengasuh<br/>→ Setujui / Tolak"]
  D --> F["/admin/daycare/id/safety-score<br/>4 komponen + bukti dokumen disetujui"]
  F --> G{"Legalitas lulus?"}
  G -- Tidak --> H([Simpan sebagai draf])
  G -- Ya --> I["Publikasikan → tampil di detail daycare"]
  B --> J["Aktifkan mitra → tampil di katalog"]
  K["/admin"] --> L["Konfirmasi pembayaran<br/>Tandai berhasil / Gagal / Kedaluwarsa"]
  K --> M["Moderasi ulasan & balasan"]
  N["/admin/insiden"] --> O["Insiden: ✨ penilaian urgensi · Tangani · Selesai<br/>Komplain: Mulai tangani · Minta informasi · Usulkan penyelesaian"]
```

### 3.5 Skenario lintas peran (untuk demo dan UAT)

```mermaid
sequenceDiagram
  autonumber
  actor OT as Orang Tua
  actor PL as Pengelola
  actor AD as Admin
  actor PG as Pengasuh
  OT->>PL: Ajukan pendaftaran anak
  PL-->>OT: Terima (Menunggu pembayaran)
  OT->>AD: Bayar QRIS
  AD-->>OT: Tandai berhasil (Aktif)
  PL->>PG: Tugaskan (Mulai–Selesai)
  PL->>PL: Check-in (hari layanan)
  PG->>OT: Catatan + foto fokus (AI)
  PG->>PL: Laporan insiden (urgensi Rendah)
  Note over PL,AD: AI triage menaikkan ke Darurat + notifikasi kedua
  PL->>PL: Tetapkan urgensi (override manusia)
  PL-->>OT: Selesaikan pengasuhan
  OT->>AD: Ulasan → moderasi
```

## 4. Mesin status

### 4.1 Pendaftaran (`enrollments.status`)

```mermaid
stateDiagram-v2
  [*] --> pending: Orang Tua mengajukan
  pending --> pending_payment: Pengelola menerima
  pending --> rejected: Pengelola menolak
  pending --> cancelled: Orang Tua membatalkan
  pending_payment --> approved: Admin tandai pembayaran berhasil
  pending_payment --> cancelled: Orang Tua membatalkan
  pending_payment --> expired: lewat batas bayar
  approved --> completed: check-in (hari layanan) lalu Selesaikan
  rejected --> [*]
  cancelled --> [*]
  expired --> [*]
  completed --> [*]
```

Label di aplikasi: pending = **Menunggu keputusan**, pending_payment = **Menunggu pembayaran**, approved = **Aktif**, completed = **Selesai**.

### 4.2 Insiden dan urgensi

```mermaid
stateDiagram-v2
  [*] --> new: laporan dibuat (urgensi pelapor)
  new --> in_progress: Tangani (alasan)
  in_progress --> resolved: Selesai
  note right of new
    Urgensi efektif = max(pelapor, AI)
    AI hanya menaikkan, tidak setelah override
    Kenaikan → log + notifikasi kedua
  end note
```

### 4.3 Komplain

```mermaid
stateDiagram-v2
  [*] --> new: Orang Tua mengajukan
  new --> in_progress: Admin mulai tangani
  in_progress --> waiting_for_response: Minta informasi
  waiting_for_response --> in_progress: Orang Tua menjawab
  in_progress --> waiting_for_confirmation: Usulkan penyelesaian
  waiting_for_confirmation --> resolved: Orang Tua menerima
  waiting_for_confirmation --> in_progress: Orang Tua menolak (alasan wajib)
  waiting_for_confirmation --> closed: tidak dijawab 72 jam
```

## 5. Pipeline fitur AI

### 5.1 Foto Fokus Anak (Computer Vision)

```mermaid
sequenceDiagram
  autonumber
  actor PG as Pengasuh
  participant UI as Browser
  participant API as Next.js /api
  participant CV as Layanan CV (YOLO11n-seg)
  participant ST as Supabase Storage
  participant DB as Postgres (RLS)
  PG->>UI: Ambil/pilih foto (JPG/PNG/WebP ≤ 4 MB)
  UI->>API: POST /api/ai/focus/segment
  API->>API: cek sesi + peran staf, cek tipe dari byte, batas 30/menit
  API->>CV: /segment (Bearer token)
  CV-->>API: orang + kelas (anak/dewasa) + polygon + confidence
  API-->>UI: siluet hijau (anak) / oranye (dewasa)
  PG->>UI: Ketuk siluet anak yang dituju
  UI->>API: POST /api/activities/{id}/photos (file + child_id + polygon)
  API->>CV: /render (hanya target tajam)
  API->>ST: simpan asli → logbook-originals, versi fokus → logbook-masked
  API->>DB: catat attachment + varian per anak
  PG->>API: Tandai sudah ditinjau
  API->>ST: hapus foto asli
  Note over UI,DB: Orang Tua hanya mendapat signed URL 5 menit untuk varian anaknya sendiri
```

### 5.2 Draf Catatan Harian (Logbook Drafter)

```mermaid
flowchart LR
  A["Catatan singkat pengasuh<br/>(draf tersimpan)"] --> B["POST .../activities/{id}/ai-draft"]
  B --> C["Baca catatan dari DB<br/>sebagai pengasuh yang ditugaskan"]
  C --> D["Pecah jadi fakta bernomor"]
  D --> E["Model bahasa<br/>kontrak logbook_draft"]
  E --> F{"Validasi kontrak<br/>+ fakta harus dari catatan"}
  F -- gagal --> G["Error jelas, coba lagi"]
  F -- lolos --> H["Usulan berlabel AI<br/>+ dicatat di ai_jobs"]
  H --> I{"Pengasuh"}
  I -- Pakai --> J["Edit → simpan → kirim"]
  I -- Buang --> K["Catatan tidak berubah"]
```

### 5.3 Baca Dokumen Legalitas (OCR + model bahasa)

```mermaid
flowchart LR
  A["Admin: Baca dengan AI"] --> B["Ambil dokumen + lampiran terbaru"]
  B --> C{"SHA-256 berkas =<br/>catatan unggahan?"}
  C -- tidak --> X["409 SOURCE_CHANGED"]
  C -- ya --> D["OCR RapidOCR<br/>(PDF berteks dibaca langsung)"]
  D --> E["Model bahasa<br/>kontrak legal_verification"]
  E --> F["Cek ulang di server:<br/>kutipan & nilai harus ada di teks OCR"]
  F --> G["Pemeriksaan tanpa model:<br/>masa berlaku, nomor vs isian Pengelola,<br/>nama/alamat, kalimat perintah ke AI"]
  G --> H["Usulan + peringatan<br/>(dicatat di ai_jobs, hanya Admin)"]
  H --> I{"Admin"}
  I --> J["Setujui / Minta revisi / Tolak"]
  J --> K["Bukti untuk Safety Score"]
```

### 5.4 Penilaian Urgensi Insiden (Triage)

```mermaid
sequenceDiagram
  autonumber
  actor R as Pelapor
  participant API as POST /api/incidents
  participant DB as Postgres
  participant T as ayomi-triage-api
  R->>API: uraian, pertolongan pertama, urgensi pelapor
  API->>DB: simpan laporan + notifikasi awal
  API-->>R: 201 (pelapor tidak menunggu AI)
  API->>DB: after(): ambil teks + usia anak (tanpa nama/tgl lahir)
  API->>T: /triage + rubrik draf-1 (Bearer)
  T-->>API: urgensi usulan + kutipan + informasi kurang
  API->>API: validasi kontrak (kutipan harus dari laporan)
  API->>DB: app_record_incident_triage
  DB->>DB: efektif = max(pelapor, AI); naik → log + notifikasi Pengelola & Admin
  Note over DB: Gagal/timeout → hanya dicatat di ai_jobs, urgensi pelapor tetap
```

### 5.5 Safety Score (rumus, bukan model)

```mermaid
flowchart LR
  A["Dokumen disetujui Admin"] --> B["Admin pilih status per komponen<br/>+ alasan + dokumen bukti"]
  B --> C["Skor = 40×Legalitas + 25×SOP + 20×Staf + 15×Fasilitas<br/>Lulus=1 · Sebagian=0,5 · Tidak=0"]
  C --> D{"Ada 'Belum diketahui'?"}
  D -- ya --> E["Ditolak"]
  D -- tidak --> F{"Legalitas lulus?"}
  F -- tidak --> G["Hanya draf"]
  F -- ya --> H["Publikasi → detail daycare<br/>disembunyikan otomatis bila bukti kedaluwarsa"]
```

### 5.6 Rekomendasi di pencarian (rule-based weighted scoring)

`lib/daycare-directory.js` → `recommendationScore`:
- Daycare **mitra** Ayomi: skor 100.
- Daycare katalog: skor dihitung dari tiga bobot, lalu dijumlah:
  - legalitas: terdaftar 20, sedang ditinjau 5;
  - rating × 2;
  - jumlah fasilitas (maksimal 6) × 0,5.
- Filter wilayah, biaya, dan rating, serta pengurutan, dijalankan di **server** (`/api/daycares`).

## 6. Data, privasi, dan keamanan (ringkas untuk slide)

| Aspek | Penerapan |
| --- | --- |
| Data anak ke AI | Triage hanya menerima uraian dan usia dalam bulan, **tanpa nama dan tanggal lahir**. Foto, dokumen, dan laporan dikirim ke layanan AI milik tim sendiri (CV, OCR, triage), bukan ke pihak ketiga. Hanya teks catatan dan teks OCR yang dikirim ke model bahasa (Groq). Kebijakan penyimpanan di layanan CV perlu dicek tim CV sebelum ditulis di slide |
| Foto anak | Orang Tua hanya melihat varian anaknya sendiri lewat signed URL 5 menit. Foto asli dihapus setelah ditinjau |
| Penanda AI | Semua hasil AI berlabel "Dibuat AI" atau menyebut mesinnya |
| Human-in-the-loop | Draf AI, OCR, dan triage semuanya usulan. Keputusan tetap di tangan Pengasuh, Admin, dan Pengelola |
| Kunci | Hanya di env server. Riwayat git sudah dipindai dan bersih |
| Akses data | RLS di 65 tabel, 122 fungsi berhak-penuh yang dikunci, 6 bucket privat |
| Batas penggunaan AI | 6–30 permintaan per menit per akun. Input dibatasi ukuran dan tipenya |
