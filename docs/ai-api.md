# Kerangka API fitur AI Ayomi

Status per 11 November 2026: **kerangka siap, model belum dipilih.** Kode ada di `lib/ai/`, dan endpoint ada di `app/api/ai/`. Endpoint saat ini memakai provider `fixture`, yaitu jawaban contoh dari kontrak, sehingga dapat dicoba tanpa API key. Hasil fixture **bukan** keluaran AI dan tidak boleh tampil sebagai AI di produksi.

Acuan: [keputusan MVP dan kontrak AI v1](./keputusan-mvp-dan-kontrak-ai-v1.md) dan [pipeline AI](./pipeline-ai-ayomi.md). Kontrak mesin disalin ke `lib/ai/contract-v1.json`. Sebuah test memastikan salinan itu tetap sama dengan `docs/kontrak-ai-mvp-v1.json`.

## 1. Fitur AI dan use case Technical Requirement

Empat fitur produk terdiri atas delapan jenis job. Technical Requirement mewajibkan **satu fitur AI utama berfungsi penuh lebih dulu**, memakai **model open source pre-trained**, dan termasuk salah satu use case berikut: Recommendation, RAG, Computer Vision, atau Predictive ML.

| Job (`feature`) | Fitur produk | Use case | Pemroses | Siapa yang meminta |
| --- | --- | --- | --- | --- |
| `legal_verification` | Safety Score & Legal Verification | Computer Vision (OCR dokumen) | gambar/dokumen | Admin, Pengelola |
| `safety_score` | Safety Score & Legal Verification | Weighted scoring berbasis bukti | model menilai kriteria; skor dihitung kode | Admin |
| `incident_triage` | Incident Urgency Triage | Predictive ML (klasifikasi ordinal) | model bahasa / classifier | Pengelola, Admin |
| `logbook_draft` | Instant Logbook Drafter | Generatif dari fakta terstruktur | model bahasa | Pengasuh |
| `privacy_masking` | Privacy Masking | Computer Vision (deteksi wajah) | detektor wajah + pemroses piksel | Pengasuh, Pengelola |
| `review_moderation` | Summary Ulasan & Smart Reply | Predictive ML (klasifikasi teks) | model bahasa / classifier | Admin (otomatis saat ulasan masuk) |
| `smart_reply` | Summary Ulasan & Smart Reply | Generatif dengan kebijakan sebagai konteks | model bahasa | Pengelola |
| `review_summary` | Summary Ulasan & Smart Reply | Generatif dengan sumber per klaim | model bahasa | Admin (otomatis) |

**Perlu keputusan tim.** Dokumen pipeline merencanakan Gemini, padahal Gemini bukan model open source. Kerangka ini tidak terikat provider tertentu. Adapter `openai-compatible` dapat memanggil model open source, misalnya lewat Hugging Face Inference router. Pemilihan model dan fitur utama tetap perlu disepakati bersama mentor (Technical Requirement bagian Integrasi AI).

## 2. Arsitektur

```text
Route Handler (app/api/ai/...)          autentikasi, peran, batas ukuran, rate limit
  → lib/api/ai.js                        layanan API, memetakan AiError ke HTTP
    → lib/ai/run.js                      validasi input kontrak → aturan input fitur
      → lib/ai/providers/*               fixture | openai-compatible (retry ≤ 3 percobaan)
      → FEATURES[feature].check()        pemeriksaan deterministik server
      → validasi output kontrak          → envelope job (review_state=pending)
```

| File | Isi |
| --- | --- |
| `lib/ai/contract-v1.json` | Kontrak v1: skema input/output dan contoh untuk 8 fitur |
| `lib/ai/schema.js` | Validator JSON Schema untuk keyword yang dipakai kontrak (tanpa dependensi) |
| `lib/ai/errors.js` | 14 kode error kontrak, status HTTP, dan penanda apakah error boleh di-retry |
| `lib/ai/features.js` | Registry fitur: peran, kolom sumber `ai_jobs`, instruksi model, pemeriksaan server, serta perhitungan Safety Score, urgensi efektif, dan durasi tidur |
| `lib/ai/run.js` | Menjalankan satu tugas: validasi, panggilan provider dengan retry, pemeriksaan, envelope |
| `lib/ai/providers/` | `fixture` (pengembangan) dan `openai-compatible` (model open source) |
| `lib/ai/rate-limit.js` | Batas 10 permintaan per menit per pengguna (per instance server) |

Aturan yang sudah ditegakkan kode, sesuai kontrak:
- **Hal yang dihitung kode, bukan model:**
  - Safety Score (`40×legal + 25×sop + 20×staff + 15×facility`; ada kriteria `unknown` → skor `null`);
  - `coverage` (0–1) dan `blockers`;
  - urgensi efektif `max(Pengasuh, AI)` kecuali sudah ada override Pengelola;
  - durasi tidur.
- **Hasil ditolak (`EVIDENCE_MISMATCH`) jika:**
  - kutipan bukti tidak ada di teks sumber;
  - rujukan SOP atau kebijakan tidak dikenal;
  - klaim ringkasan tidak punya sumber yang valid;
  - draf logbook merujuk fakta yang tidak ada.
- **Hasil ditolak (`OUTPUT_INVALID`) jika:**
  - Smart Reply menjanjikan refund, kompensasi, atau batas waktu;
  - JSON tidak sesuai skema.
- **Input:** input tidak valid tidak pernah dikirim ke model.
- **Retry:** hanya untuk `RATE_LIMITED`, `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`, dan `WORKER_LOST`, maksimal 3 percobaan dengan jeda 5 s lalu 20 s ditambah jitter.

## 3. Endpoint

| Method | Path | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/ai/features` | Publik | Daftar 8 fitur, use case, pemroses, peran, ketersediaan, dan contoh input |
| POST | `/api/ai/sandbox/{feature}` | Admin | Menjalankan satu tugas pada input kontrak (data sintetis), mengembalikan envelope job |
| POST | `/api/ai/focus/segment` | Pengasuh, Pengelola, Admin | **Foto Fokus Anak (uji coba).** Multipart `file` (JPG/PNG/WebP ≤ 4 MB) → daftar orang (`id`, `class` anak/dewasa, `confidence`, `polygon`) + `suggested_target_id` |
| POST | `/api/ai/focus/render` | Pengasuh, Pengelola, Admin | Multipart `file` + `target_polygon` (JSON `[[x,y],…]`) → JPEG base64 dengan hanya anak target yang tajam |

**Foto Fokus Anak.** Route di atas meneruskan foto ke layanan CV dari notebook `foto-fokus-anak-yolo11n-seg.ipynb`, dengan pengaturan `CV_API_URL` dan `CV_API_TOKEN` di server.

Pemeriksaan yang dilakukan server Ayomi sebelum foto diteruskan:
- sesi dan peran: Admin, Pengelola, atau Pengasuh aktif, atau keanggotaan daycare aktif;
- jenis berkas dicek dari *magic bytes*;
- batas ukuran;
- rate limit 30 foto per menit per pengguna.

Output layanan divalidasi ulang sebelum dikirim ke browser. Jika tidak sesuai, server mengembalikan `OUTPUT_INVALID`. Foto **tidak disimpan**.

Kode error:
- `MODEL_UNAVAILABLE` (503): variabel layanan belum diatur;
- `PROVIDER_TIMEOUT` (504) atau `PROVIDER_UNAVAILABLE` (503): layanan tidak bisa dihubungi;
- `photo_rejected` (422): foto ditolak layanan.

Halaman uji coba: `/pengelola/foto-fokus`. Penyimpanan foto asli dan varian per anak (`attachments`, `attachment_variants`) menjadi tahap berikutnya di alur logbook.

Endpoint sandbox hanya untuk eksperimen dan evaluasi. Endpoint produksi akan menerima `source_id` + `input_version`, lalu membaca sumbernya dari database setelah memeriksa peran, kepemilikan, dan penugasan. Browser tidak boleh mengirim isi data sumber sebagai otoritas.

**Contoh request**: `POST /api/ai/sandbox/logbook_draft`

```json
{
  "input": {
    "activity_id": "00000005-1111-4111-8111-111111111111",
    "input_version": 1,
    "activity_type": "meal",
    "occurred_at": "2026-11-05T09:00:00Z",
    "timezone": "Asia/Jakarta",
    "observed_facts": ["Makan dengan bantuan pengasuh."],
    "meal": { "food": "Nasi dan sup sayur", "portion_consumed": "Setengah porsi", "observed_condition": "Makan dengan bantuan pengasuh." },
    "sleep": null
  }
}
```

**Contoh response `200`**:

```json
{
  "contract_version": "1.0.0",
  "feature": "logbook_draft",
  "status": "succeeded",
  "attempt_number": 1,
  "review_state": "pending",
  "application_state": "not_applied",
  "result": {
    "title": "Waktu makan",
    "body": "Anak makan setengah porsi nasi dan sup sayur dengan bantuan pengasuh.",
    "missing_fields": [],
    "used_fact_indices": [0],
    "requires_caregiver_review": true
  },
  "error": null,
  "meta": { "provider": "fixture", "model": "contract-v1-example", "model_version": "not_reported", "usage": null,
            "prompt_version": "logbook-draft-v1", "latency_ms": 3, "ai_generated": true }
}
```

`meta.ai_generated: true` dipakai UI untuk menampilkan penanda "Dibuat AI" (Technical Requirement). `review_state: "pending"` berarti hasil masih berupa usulan yang harus ditinjau manusia.

**Error** (format sama dengan API lain, `{ code, error }`):

| Status | `code` | Kapan |
| --- | --- | --- |
| 400 | `INPUT_INVALID` | Input tidak sesuai kontrak (pesan menyebut path yang salah) |
| 400 | `invalid_fields` / `invalid_json` | Body bukan `{ "input": {...} }` |
| 401 | `not_authenticated` | Belum login |
| 403 | `admin_role_required` | Bukan Admin |
| 404 | `ai_feature_not_found` | Nama fitur tidak dikenal |
| 413 | `input_too_large` | Input melebihi 32 KB |
| 422 | `EVIDENCE_MISMATCH` / `SAFETY_BLOCKED` | Hasil tidak didukung sumber, atau diblokir model |
| 429 | `RATE_LIMITED` | Lebih dari 10 permintaan per menit |
| 502 | `OUTPUT_INVALID` / `PROVIDER_AUTH` | Hasil model tidak valid, atau API key salah |
| 503/504 | `MODEL_UNAVAILABLE` / `PROVIDER_UNAVAILABLE` / `PROVIDER_TIMEOUT` | Model belum diatur atau sedang tidak tersedia |

## 4. Menyambungkan model

Isi variabel server di `.env.local` (lokal) atau Vercel Environment Variables (produksi):

```text
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://router.huggingface.co/v1
AI_API_KEY=<token provider>
AI_TEXT_MODEL=<id model open source, mis. model instruksi multibahasa>
AI_JSON_MODE=true   # hanya jika provider/model mendukung response_format json_object
```

Di produksi, `AI_PROVIDER` yang kosong berarti AI nonaktif (`503 MODEL_UNAVAILABLE`), bukan otomatis memakai fixture. Fitur gambar dan dokumen (`privacy_masking`, `legal_verification`) membutuhkan adapter detektor wajah atau OCR tersendiri. Sampai adapter itu dibuat, keduanya hanya berjalan dengan fixture di luar produksi.

Adapter baru cukup mengekspor `{ id, configured(), generate({ feature, instructions, input, outputSchema }) → { output, meta } }`, lalu didaftarkan di `lib/ai/providers/index.js`. Semua validasi dan pemeriksaan tetap berjalan sama untuk adapter apa pun.

## 5. Langkah berikutnya (belum dibuat)

1. **Pilih fitur utama dan model** bersama mentor (lihat bagian 1).
2. **Endpoint produksi per fitur**, misalnya `POST /api/ai/logbook-draft` dengan `{ activity_id, input_version }`: server membaca fakta aktivitas dari DB setelah memastikan Pengasuh sedang ditugaskan, lalu membentuk input kontrak.
3. **Persistensi `ai_jobs`:** migrasi kolom antrean (`available_at`, `lease_*`, `applied_at`; kontrak bagian 9), RPC pencatatan job yang hanya dapat dipanggil `service_role`, `GET /api/ai/jobs/{id}`, dan eksekusi dengan `after()` dari `next/server` agar respons `202` tidak menunggu model.
4. **UI:** loading, hasil dengan penanda AI, kosong/abstain, error, serta aksi tinjau/terapkan.
5. **Evaluasi:** set uji berlabel per fitur dan laporan metrik (pipeline AI bagian 7).

Catatan skema: CHECK `ai_jobs` mewajibkan `review_version_id` untuk `review_summary`, sedangkan kontrak menyebut sumbernya `daycare_id`. Ini perlu diselaraskan sebelum ringkasan disimpan ke `ai_jobs`.

## 6. Pengujian

`node --test lib/ai/ai.test.mjs` menguji hal berikut:
- keyword kontrak yang didukung validator;
- kesamaan salinan kontrak dengan dokumen;
- kedelapan fitur berjalan pada contoh kontrak;
- perhitungan Safety Score dan urgensi;
- penolakan bukti karangan dan janji refund;
- retry;
- adapter `openai-compatible` dengan fetch tiruan;
- pemilihan provider;
- rate limit;
- akses sandbox (Admin 200, Orang Tua 403, 404, 429).
