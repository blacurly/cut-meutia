# Ayomi

**Ayomi** adalah aplikasi web pengasuhan dan keselamatan anak yang mempertemukan orang tua bekerja dengan daycare terverifikasi. Orang tua mencari dan membandingkan daycare, melihat **Safety Score** dari dokumen yang diverifikasi, mendaftarkan anak secara online, lalu menerima kabar harian dengan **foto yang hanya memfokuskan anaknya sendiri**. Daycare mengelola pendaftaran, catatan harian, dan laporan insiden; Admin memverifikasi legalitas dan memantau eskalasi.

- **Website:** https://project-ayomi-cut-meutia.vercel.app
- **Repository:** [aplikasi web](https://github.com/taworld-star/Project-Ayomi_Cut_Meutia) · [Foto Fokus Anak](https://github.com/taworld-star/ayomi-cv-api) · [OCR dokumen](https://github.com/taworld-star/ayomi-ocr-api) · [triage insiden](https://github.com/taworld-star/ayomi-triage-api)
- **Dokumentasi:** [`docs/`](docs/README.md) · API: [`docs/05-api/swagger.html`](docs/05-api/swagger.html) (Swagger UI)

Final Project *AI Full Stack Web Development*, Kelompok 5 Cut Meutia.

## Fitur AI

Semua hasil AI diberi label di tampilan, punya status loading, hasil kosong, dan pesan error, dan **selalu ditinjau manusia** sebelum dipakai. AI hanya mengusulkan; keputusan tetap di tangan pengasuh, pengelola, atau admin.

| Fitur | Use case | Model | Input → output | Di mana dalam alur |
| --- | --- | --- | --- | --- |
| **Foto Fokus Anak** *(fitur AI utama)* | Computer Vision | **YOLO11n-seg** (Ultralytics, pre-trained COCO), di-fine-tune ke kelas `anak`/`dewasa` dengan Open Images V7 | Foto kegiatan → siluet setiap orang dengan confidence → versi fokus: anak terpilih tajam, orang lain dan latar diburamkan | Pengasuh mengunggah foto di catatan harian; Orang Tua hanya menerima versi fokus anaknya |
| **Triage urgensi insiden** | Klasifikasi teks | Mesin aturan rubrik `draf-1` v2 (production); IndoBERT `indobert-base-p1` (eksperimen) | Uraian insiden → urgensi `low`/`medium`/`high`/`emergency` + kutipan kalimat bukti | Setiap laporan insiden baru; AI **hanya bisa menaikkan** urgensi |
| **Baca dokumen legal** | Computer Vision (OCR) + model bahasa | RapidOCR **PP-OCRv5** Latin + `qwen/qwen3.8-27b` (Groq) | Dokumen legal → isian nomor, penerbit, masa berlaku dengan kutipan per halaman + peringatan | Admin memverifikasi dokumen; dokumen yang disetujui menjadi bukti Safety Score |
| **Draf catatan harian** | Generatif pendukung | `qwen/qwen3.8-27b` (Groq), prompt `logbook-draft-v2` | Catatan singkat pengasuh → draf catatan untuk orang tua, tanpa menambah fakta | Pengasuh menulis catatan harian |
| **Rekomendasi pencarian** | Recommendation (rule-based weighted scoring) | Rumus berbobot di server | Legalitas, rating, fasilitas → urutan hasil | Katalog `/pencarian` |

**Hasil evaluasi singkat** (rinciannya di [`docs/06-fitur-ai/`](docs/06-fitur-ai/dokumentasi-fitur-ai.md)):
- **Foto Fokus Anak** (300 foto uji, 1.142 anak): membedakan anak dan dewasa **97,5%**; anak bisa difokuskan 90,8% (target 95% belum tercapai); deteksi palsu turun 23% dibanding model dasar. Karena siluet orang yang menempel masih bisa ikut tajam, pengasuh wajib meninjau setiap foto.
- **Triage** (136 laporan uji fiktif): recall darurat **0,91** (target 0,95 belum tercapai), under-triage **3,7%**, dan **0** kasus darurat yang dinilai rendah.
- **OCR** (16 dokumen spesimen fiktif): **80/81 isian (99%)** terbaca tepat; tidak ada nilai salah yang lolos ke usulan AI.

### Arsitektur AI

Model berjalan di layanan terpisah, sedangkan data, izin akses, dan keputusan tetap di aplikasi ini.

```text
Browser ──▶ Next.js (Vercel): Route Handlers app/api/*
              │  validasi input, login & peran, batas pemakaian, cek kontrak output, catat ai_jobs
              ├──▶ ayomi-cv-api       YOLO11n-seg (ONNX)     Foto Fokus Anak
              ├──▶ ayomi-ocr-api      RapidOCR PP-OCRv5      Baca dokumen legal
              ├──▶ ayomi-triage-api   mesin aturan rubrik    Triage urgensi insiden
              ├──▶ Groq (OpenAI-compatible)  Qwen            Isian dokumen & draf catatan
              └──▶ Supabase: PostgreSQL (66 tabel, RLS), Auth, Storage privat
```

## Repository

Ayomi terdiri dari empat repository. Aplikasi web memanggil ketiga layanan AI lewat HTTPS dengan token, dan setiap layanan punya README sendiri yang menjelaskan model, data, API, evaluasi, dan cara menjalankannya.

| Repository | Isi | Teknologi | Dipakai oleh |
| --- | --- | --- | --- |
| [**Project-Ayomi_Cut_Meutia**](https://github.com/taworld-star/Project-Ayomi_Cut_Meutia) (repo ini) | Aplikasi web, REST API, database, dan dokumentasi | Next.js, Supabase | Pengguna (website) |
| [**ayomi-cv-api**](https://github.com/taworld-star/ayomi-cv-api) | Layanan **Foto Fokus Anak**: deteksi anak/dewasa dan versi fokus foto | FastAPI, YOLO11n-seg (ONNX) | `POST /api/ai/focus/*`, `POST /api/activities/{id}/photos` |
| [**ayomi-ocr-api**](https://github.com/taworld-star/ayomi-ocr-api) | Layanan **OCR dokumen legal** untuk Legal Verification dan Safety Score | FastAPI, RapidOCR PP-OCRv5 | `POST /api/admin/daycare-documents/{id}/ai-read` |
| [**ayomi-triage-api**](https://github.com/taworld-star/ayomi-triage-api) | Layanan **triage urgensi insiden** | FastAPI, mesin aturan rubrik; IndoBERT (eksperimen) | `POST /api/incidents`, `POST /api/incidents/{id}/triage` |

Model bahasa untuk draf catatan harian dan isian dokumen tidak punya repository sendiri: aplikasi memanggil `qwen/qwen3.8-27b` lewat API Groq yang kompatibel OpenAI (`lib/ai/`).

**Keamanan integrasi AI:**
- Semua AI dipanggil dari server (Route Handler). Kunci dan token layanan hanya ada di environment variable server, tidak pernah `NEXT_PUBLIC_`.
- Input divalidasi: jenis berkas dicek dari isi berkas, ukuran dibatasi, field yang tidak dikenal ditolak.
- Output divalidasi dengan kontrak JSON; kutipan atau fakta harus benar-benar ada di sumbernya.
- Hanya pengguna yang login dengan peran yang tepat yang bisa memakai AI, dengan batas pemakaian per menit.
- Data ke AI dibuat minimal: triage hanya menerima usia anak dalam bulan, tanpa nama dan tanggal lahir. Foto asli dihapus setelah versi fokus ditinjau.

## Fitur per peran

| Peran | Fitur |
| --- | --- |
| **Pengunjung** | Katalog 104 daycare di DKI Jakarta, Jawa Barat, dan Jawa Timur; filter wilayah, biaya, rating, rasio pengasuh, usia, dan fasilitas; detail dengan Safety Score; perbandingan 2–3 daycare |
| **Orang Tua** | Profil anak dan data kesehatan; pendaftaran online; pembayaran QRIS; catatan harian dengan foto versi fokus, love, dan komentar; laporan insiden; komplain; ulasan; notifikasi |
| **Pengasuh** | Daftar anak yang ditugaskan; catatan harian dengan **draf AI** dan **Foto Fokus Anak**; laporan insiden |
| **Pengelola** | Terima atau tolak pendaftaran; tugaskan pengasuh; check-in dan penyelesaian; profil, layanan, dan harga; dokumen legal; undangan staf; panel penilaian urgensi insiden; balasan ulasan |
| **Admin** | Mitra daycare; verifikasi dokumen dengan **baca dokumen AI**; penilaian dan publikasi Safety Score; konfirmasi pembayaran; moderasi ulasan, foto, dan harga; komplain, investigasi, dan sanksi |

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Front-end | Next.js 16 (App Router), React 19, JavaScript (JSX), Tailwind CSS v4, `lucide-react` |
| Back-end | Next.js Route Handlers (`app/api/`, 86 route, 117 metode) |
| Database | Supabase PostgreSQL, 66 tabel dengan Row Level Security, fungsi database `app_*` |
| Auth | Supabase Auth (email dan kata sandi); 4 peran: Orang Tua, Pengasuh, Pengelola, Admin |
| Storage | Supabase Storage, bucket privat dengan tautan bertanda tangan 5 menit |
| AI | Layanan Python (FastAPI) terpisah + model bahasa lewat API OpenAI-compatible |
| Deploy | Vercel (aplikasi), Supabase (database), Docker (layanan AI) |

## Menjalankan di komputer

Prasyarat: Node.js 20 atau lebih baru, dan project Supabase.

```bash
npm install
cp .env.example .env.local     # lalu isi nilainya
npm run dev                    # http://localhost:3000
```

### Environment variables

Isi di `.env.local` (lokal) atau **Vercel → Settings → Environment Variables** (production). Semua variabel selain `NEXT_PUBLIC_*` hanya dibaca server.

| Variabel | Untuk |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Koneksi Supabase |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL`, `AI_JSON_MODE` | Model bahasa (draf catatan, isian dokumen). `AI_PROVIDER=openai-compatible` untuk Groq; kosong di production berarti AI nonaktif |
| `CV_API_URL`, `CV_API_TOKEN` | Layanan Foto Fokus Anak |
| `OCR_API_URL`, `OCR_API_TOKEN` | Layanan OCR dokumen legal |
| `TRIAGE_API_URL`, `TRIAGE_API_TOKEN` | Layanan triage insiden. Kosong = laporan tetap memakai urgensi pelapor |
| `QRIS_STATIC_PAYLOAD` | String QRIS statis merchant. Kosong = QR demo yang tidak bisa dibayar |

Penjelasan tiap variabel ada di `.env.example`. Credential tidak pernah di-commit.

### Database

Urutan menjalankan skema, migrasi, dan seed ada di [`docs/04-database/`](docs/04-database/README.md).

### Pengujian

```bash
node --test lib/**/*.test.mjs   # unit test API, AI, validasi, dan skema
npm run lint
```

Uji alur lengkap di database ada di `supabase/tests/e2e_non_ai_flow.sql`, dan skenario UAT di [`docs/07-pengujian/`](docs/07-pengujian/UAT-ayomi.md).

## Dokumentasi

| Dokumen | Lokasi |
| --- | --- |
| PRD | [`docs/01-prd/`](docs/01-prd/prd-ayomi.md) |
| User story, user flow, prototype | [`docs/02-user-story-flow-prototype/`](docs/02-user-story-flow-prototype/) |
| ERD / schema diagram | [`docs/03-erd/`](docs/03-erd/erd.md) |
| Script SQL dan seed | [`docs/04-database/`](docs/04-database/README.md) |
| API documentation (OpenAPI + Swagger UI) | [`docs/05-api/`](docs/05-api/README.md) |
| Dokumentasi fitur AI | [`docs/06-fitur-ai/`](docs/06-fitur-ai/dokumentasi-fitur-ai.md) |
| UAT | [`docs/07-pengujian/`](docs/07-pengujian/UAT-ayomi.md) |

Dokumentasi API dan ERD dibuat dari kode: `npm run docs:api` dan `npm run docs:erd`.

## Struktur folder

```text
app/
├── (auth)/ (parent)/ (caregiver)/ (admin)/   # Halaman per peran (route group, tidak masuk URL)
├── api/                                      # Route Handlers REST API
└── layout.js, page.js, globals.css
components/
├── ui/ layout/ features/ live/               # Komponen UI, layout, fitur, dan halaman yang terhubung API
lib/
├── api/                                      # Validasi dan logika per endpoint
├── ai/                                       # Kontrak AI v1, provider, validasi output
└── supabase/                                 # Client Supabase
supabase/
├── schema/live_schema_snapshot.sql           # Snapshot skema production
├── migrations/                               # Migrasi
└── seed/                                     # Seed katalog daycare
scripts/                                      # Seed, foto, generator dokumentasi API dan ERD
docs/                                         # Dokumentasi submission
public/                                       # Aset statis
```

## AI yang bertanggung jawab

- **Transparansi:** setiap hasil AI berlabel, dan panel triage menampilkan alasan serta kutipan kalimatnya.
- **Manusia yang memutuskan:** draf catatan, versi fokus foto, usulan OCR, dan urgensi AI semuanya usulan yang bisa ditolak atau diubah.
- **Keselamatan:** triage hanya boleh menaikkan urgensi; notifikasi awal tidak menunggu AI; kalau AI gagal, sistem kembali ke penilaian manusia.
- **Privasi:** tanpa pengenalan wajah, foto asli dihapus setelah ditinjau, dan data yang dikirim ke AI dibuat minimal.
- **Bukan nasihat profesional:** triage dan Safety Score adalah prioritas operasional, bukan diagnosis medis atau sertifikasi hukum.
