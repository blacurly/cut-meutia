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

### Dokumentasi per fitur AI

Setiap fitur dijelaskan dengan lima poin dari Technical Requirement: (1) use case dan alasan AI dibutuhkan, (2) model dan alasan pemilihannya, (3) sumber dan jenis data, (4) input dan output, (5) hasil evaluasi, batasan, dan risiko. Rincian lengkapnya ada di [`docs/06-fitur-ai/`](docs/06-fitur-ai/dokumentasi-fitur-ai.md) dan di README setiap repository layanan.

#### 1. Foto Fokus Anak (fitur AI utama) · [ayomi-cv-api](https://github.com/taworld-star/ayomi-cv-api)

| Poin | Isi |
| --- | --- |
| **Use case dan alasan** | **Computer Vision.** PRD: orang tua butuh laporan harian yang transparan **tanpa melanggar privasi anak lain**. Foto kegiatan hampir selalu berisi beberapa anak, dan memburamkan secara manual tidak mungkin dilakukan pengasuh untuk setiap foto |
| **Model dan alasannya** | **YOLO11n-seg** (Ultralytics, open source, pre-trained COCO), di-fine-tune ke kelas `anak`/`dewasa`, dijalankan sebagai ONNX di CPU. Dipilih karena ukuran nano cukup cepat tanpa GPU, menghasilkan **mask segmentasi** sehingga pemburaman mengikuti bentuk tubuh, dan mudah dilatih di Colab |
| **Sumber dan jenis data** | Gambar **Open Images V7** (Google; anotasi CC BY 4.0) dengan mask berlabel Boy/Girl → `anak` dan Man/Woman → `dewasa`: train 2.747, validasi 338, uji 300 gambar. Saat dipakai: foto kegiatan yang diunggah pengasuh, disimpan di bucket privat |
| **Input → output** | Foto JPG/PNG/WebP ≤ 4 MB → daftar orang (kelas, **confidence**, siluet) dan penanda kualitas foto → pengasuh memilih anak → foto versi fokus: anak terpilih tajam, orang lain dan latar diburamkan |
| **Evaluasi** | 300 foto uji (1.142 anak): membedakan anak dan dewasa **97,5%**; deteksi palsu turun **23%** dibanding model dasar; anak bisa difokuskan 90,8% (target 95% belum tercapai) |
| **Batasan dan risiko** | Orang yang menempel dengan anak target bisa ikut tajam (kebocoran 62%), sehingga **pengasuh wajib meninjau** setiap foto. Model belum dilatih dengan foto daycare, dan bias (warna kulit, cahaya redup, hijab, kerumunan) belum diuji. Foto asli dihapus setelah ditinjau; tidak ada pengenalan wajah |

#### 2. Triage urgensi insiden · [ayomi-triage-api](https://github.com/taworld-star/ayomi-triage-api)

| Poin | Isi |
| --- | --- |
| **Use case dan alasan** | **Klasifikasi teks** 4 tingkat urgensi. PRD: orang tua ingin **prioritas respons yang jelas**. Laporan insiden ditulis cepat dalam kondisi panik, dan urgensi pilihan pelapor bisa terlalu rendah |
| **Model dan alasannya** | Production: **mesin aturan rubrik `draf-1` v2**. Eksperimen: **IndoBERT** `indobenchmark/indobert-base-p1` (MIT). Mesin aturan dipilih karena lebih baik pada data uji (macro F1 0,750 vs 0,548) dan setiap keputusannya bisa ditelusuri ke kalimat laporan |
| **Sumber dan jenis data** | Teks laporan **fiktif**: ±3.400 laporan sintetis dari 38 skenario rubrik untuk latih, dan 204 laporan tulisan LLM dengan gaya beragam untuk kalibrasi (68) dan uji (136). Bukan laporan pengasuh sungguhan |
| **Input → output** | Uraian, fakta yang diamati, pertolongan pertama, urgensi pelapor, usia anak dalam bulan (tanpa nama) → usulan urgensi, alasan, dan **kutipan kalimat** bukti |
| **Evaluasi** | 136 laporan uji, sistem `max(pelapor, AI)`: recall darurat **0,91** (29 dari 32), under-triage **3,7%**, **0** kasus darurat dinilai rendah/sedang |
| **Batasan dan risiko** | Target recall 0,95 belum tercapai; data uji tulisan LLM dan sedikit; rubrik belum disahkan mentor. Pengaman: AI **hanya bisa menaikkan** urgensi, notifikasi awal tidak menunggu AI, dan Pengelola bisa menetapkan urgensi dengan alasan. **Bukan diagnosis medis** |

#### 3. Baca dokumen legal (Safety Score & Legal Verification) · [ayomi-ocr-api](https://github.com/taworld-star/ayomi-ocr-api)

| Poin | Isi |
| --- | --- |
| **Use case dan alasan** | **Computer Vision (OCR)** + model bahasa. PRD: orang tua tidak punya tolok ukur legalitas daycare yang terstandarisasi. Admin harus memeriksa banyak dokumen; OCR mempercepat pemeriksaan dan menandai ketidakcocokan |
| **Model dan alasannya** | **RapidOCR PP-OCRv5** Latin (Apache-2.0) di CPU, lalu model bahasa terbuka `qwen/qwen3.8-27b` lewat Groq untuk mengambil isian. OCR dipilih karena ringan, open source, dan menjaga huruf serta spasi bahasa Indonesia |
| **Sumber dan jenis data** | Dokumen legal (PDF/JPG/PNG) yang diunggah Pengelola. Untuk pengujian: 16 dokumen spesimen **fiktif** buatan tim dengan kunci jawaban |
| **Input → output** | Berkas dokumen → teks per halaman → usulan nomor, penerbit, tanggal terbit dan berlaku, nama, alamat, lengkap dengan **kutipan per halaman**, plus peringatan (kedaluwarsa, nomor berbeda) |
| **Evaluasi** | **80/81 isian (99%)** terbaca tepat; tidak ada nilai salah yang lolos karena isian tanpa kutipan di teks OCR dikosongkan; 3–14 detik per dokumen |
| **Batasan dan risiko** | Scan buram atau miring menurunkan kualitas; dokumen spesimen bersih sehingga angkanya bukan akurasi dokumen asli; OCR tidak bisa memastikan keaslian dokumen. **Admin yang memutuskan**, dan Safety Score dihitung dari dokumen yang disetujui Admin |

#### 4. Draf catatan harian

| Poin | Isi |
| --- | --- |
| **Use case dan alasan** | **Generatif pendukung.** PRD: pengelola kesulitan membuat catatan harian secara manual. Draf dari catatan singkat mengurangi waktu menulis tanpa mengurangi waktu mengasuh |
| **Model dan alasannya** | `qwen/qwen3.8-27b` (open-weight) lewat Groq, prompt `logbook-draft-v2`. Dipilih setelah dibandingkan dengan `openai/gpt-oss-120b`: semua fakta terpakai, ±0,5–1,5 detik, dan instruksi di dalam catatan diabaikan |
| **Sumber dan jenis data** | Teks catatan pengasuh (maksimal 30 fakta) dan detail makan/tidur, dibaca dari database, bukan dari browser. Foto anak **tidak** dikirim ke model |
| **Input → output** | Catatan singkat → judul dan isi untuk orang tua, dengan indeks fakta yang dipakai; tidak boleh menambah fakta |
| **Evaluasi** | Uji manual pada catatan makan, tidur, dan bermain, ditambah uji *prompt injection*. Belum ada evaluasi berbasis dataset |
| **Batasan dan risiko** | Model bisa menulis kalimat yang kurang tepat; karena itu draf berlabel AI, server menolak fakta di luar catatan, dan **pengasuh wajib mengedit dan menyetujui** sebelum terkirim |

#### 5. Rekomendasi pencarian

| Poin | Isi |
| --- | --- |
| **Use case dan alasan** | **Recommendation System** (rule-based weighted scoring, diperbolehkan Technical Requirement). Orang tua perlu melihat daycare paling tepercaya lebih dulu |
| **Model dan alasannya** | Rumus berbobot di server (`lib/daycare-directory.js`): daycare mitra Ayomi mendapat skor 100; daycare katalog dinilai dari legalitas (punya referensi izin publik 20, sedang diproses 5) + rating × 2 + jumlah fasilitas (maksimal 6) × 0,5. Dipilih karena transparan dan tidak butuh riwayat pengguna |
| **Sumber dan jenis data** | Data katalog 104 daycare dari dataset publik DKI Jakarta, Jawa Barat, Jawa Timur ([`docs/04-database/`](docs/04-database/dataset-daycare-3-provinsi.md)) |
| **Input → output** | Legalitas, rating, fasilitas, dan filter pengguna → urutan hasil pencarian. Pengguna baru langsung mendapat urutan ini tanpa data interaksi |
| **Evaluasi** | Belum dievaluasi dengan metrik; urutannya bisa diperiksa langsung dari rumus |
| **Batasan dan risiko** | Belum dipersonalisasi per akun. Rating dan legalitas katalog berasal dari sumber publik, bukan verifikasi Ayomi, dan ditandai demikian di aplikasi |

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
| Back-end | **Route Handlers** untuk REST API (`app/api/`, 86 route, 117 metode) dan **Server Actions** untuk mutasi data dari form (`lib/actions/`). Keduanya memakai validasi dan fungsi database yang sama di `lib/api/` |
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
├── actions/                                  # Server Actions untuk form (memanggil lib/api)
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
