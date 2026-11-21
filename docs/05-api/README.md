# API Documentation

REST API Ayomi dibuat dengan **Next.js Route Handlers** di `app/api/`: **86 route, 117 metode**, termasuk endpoint fitur AI. Dokumentasinya memakai standar **OpenAPI 3.1** dan bisa dibuka dengan **Swagger UI**.

| Berkas | Isi |
| --- | --- |
| [`swagger.html`](swagger.html) | **Swagger UI.** Buka langsung di browser (klik dua kali). Semua endpoint dikelompokkan per fitur, lengkap dengan parameter, skema body, contoh request dan response, serta kode error |
| [`openapi.json`](openapi.json) | Spesifikasi OpenAPI 3.1 yang sama, untuk diimpor ke alat lain |

## Cara membuka

- **Swagger UI lokal:** buka `docs/05-api/swagger.html` di browser. Spesifikasi sudah disematkan di dalam berkas, jadi tidak perlu server.
- **Swagger Editor online:** buka https://editor.swagger.io, lalu **File → Import file** dan pilih `openapi.json`.
- **Thunder Client / Postman:** impor `openapi.json` (Thunder Client: **Collections → menu → Import → OpenAPI**; Postman: **Import**). Semua endpoint langsung menjadi koleksi yang bisa dijalankan.
- **GitHub:** tampilan berkas JSON di GitHub tidak interaktif; unduh `swagger.html` lalu buka di browser.

Tombol **Try it out** di Swagger UI yang dibuka dari berkas lokal akan ditolak browser (CORS), karena halaman dan API berbeda origin. Untuk mencoba endpoint, pakai Thunder Client atau Postman dengan koleksi hasil impor.

## Autentikasi

1. Panggil `POST /api/auth/login` dengan `email`, `password`, dan `role` (`parent`, `caregiver`, atau `admin`).
2. Salin `session.access_token` dari respons.
3. Kirim di setiap request: `Authorization: Bearer <access_token>`.

Di browser, sesi juga dibaca dari cookie Supabase. **Peran dibaca dari database**, bukan dari request; mengganti ID di URL atau body tidak menaikkan hak akses, dan data milik akun lain dijawab `404`.

## Route Handlers dan Server Actions

- **Route Handlers** (`app/api/`) adalah REST API yang didokumentasikan di sini. Dipakai website dan juga klien lain seperti Thunder Client dan Postman.
- **Server Actions** (`lib/actions/parent.js`) dipakai untuk mutasi data dari form di halaman `/profil`: `updateProfileAction` (ubah profil Orang Tua) dan `addChildAction` (tambah anak).
- Kedua jalur memanggil fungsi yang sama di `lib/api/parent.js`, sehingga validasi, kode error, dan fungsi database Supabase identik. Endpoint `PATCH /api/me` dan `POST /api/children` tetap tersedia.
- Server Action memeriksa login dari cookie sesi dan menolak kolom yang tidak dikenal. Next.js juga menolak panggilan dari origin lain.

## Konvensi

- Body JSON dengan `Content-Type: application/json` (selain itu `415`), kecuali unggahan `multipart/form-data`.
- Field yang tidak dikenal ditolak: `400 invalid_fields`.
- Request `POST`/`PATCH`/`PUT`/`DELETE` dari situs lain ditolak: `403 invalid_origin`.
- Header opsional `Idempotency-Key` (12–100 karakter) mencegah data ganda saat request dikirim ulang.
- Semua respons memakai `Cache-Control: private, no-store`.
- **Format error** selalu sama:

```json
{ "code": "daycare_capacity_full", "error": "Kapasitas daycare pada tanggal tersebut sudah penuh." }
```

| Status | Arti |
| --- | --- |
| 400 | Input tidak valid (`invalid_*`) |
| 401 | Belum login atau sesi berakhir (`not_authenticated`) |
| 403 | Peran atau cakupan tidak diizinkan |
| 404 | Data tidak ditemukan atau milik akun lain |
| 409 | Konflik status, misalnya kapasitas penuh |
| 413 / 415 | Berkas terlalu besar / body bukan JSON |
| 422 | Berkas atau hasil AI ditolak |
| 429 | Batas pemakaian tercapai (`RATE_LIMITED`) |
| 500 | Kesalahan server. Detail database tidak pernah dikirim ke klien |
| 502 / 503 / 504 | Layanan AI bermasalah, belum diatur, atau terlalu lama |

## Endpoint fitur AI

Semua endpoint AI butuh login dengan peran yang sesuai, memvalidasi input, dan punya batas pemakaian. Hasil AI selalu berupa **usulan berlabel AI** yang ditinjau manusia. Contoh request dan response lengkapnya ada di Swagger UI, grup **Fitur AI**.

| Fitur | Endpoint | Akses | Batas |
| --- | --- | --- | --- |
| Foto Fokus Anak: deteksi orang | `POST /api/ai/focus/segment` | Pengasuh, Pengelola, Admin | JPG/PNG/WebP ≤ 4 MB; 30 foto per menit |
| Foto Fokus Anak: versi fokus | `POST /api/ai/focus/render` | Pengasuh, Pengelola, Admin | Sama |
| Foto Fokus Anak di catatan harian | `POST /api/activities/{id}/photos` | Pengasuh yang bertugas | Sama; foto disimpan privat |
| Draf catatan harian | `POST /api/enrollments/{id}/activities/{activityId}/ai-draft` | Pengasuh penulis | 10 per menit |
| Baca dokumen legal (OCR + AI) | `POST` / `GET /api/admin/daycare-documents/{id}/ai-read` | Admin | 6 per menit; sampai 300 detik |
| Triage urgensi insiden | otomatis setelah `POST /api/incidents`; ulang lewat `POST /api/incidents/{id}/triage` | Pengelola, Admin | 10 per menit |
| Daftar fitur AI | `GET /api/ai/features` | Publik | – |

### Contoh: Foto Fokus Anak (respons asli production, 21 November 2026)

```http
POST /api/ai/focus/segment
Authorization: Bearer <token Pengasuh>
Content-Type: multipart/form-data; boundary=…

file=@foto-kegiatan.jpg
```

`200 OK` (dari 4 anak yang terdeteksi, ditampilkan 1; polygon dipersingkat):

```json
{
  "image_size": { "width": 1281, "height": 1600 },
  "people": [
    { "id": 0, "class": "anak", "confidence": 0.9138, "polygon": [[1101, 690], [1038, 722], [1001, 772], [1001, 805]] }
  ],
  "suggested_target_id": null,
  "quality_flags": ["multiple_children", "blurry"],
  "model_version": "focus-yolo11n-seg-v1-20261111",
  "latency_ms": 222,
  "ai_generated": true,
  "requires_human_review": true
}
```

`suggested_target_id` bernilai `null` karena ada lebih dari satu anak, jadi Pengasuh harus mengetuk anak yang dituju. `quality_flags` dipakai UI untuk memberi peringatan.

Kasus gagal yang diuji pada hari yang sama:

| Kasus | Status | Respons |
| --- | --- | --- |
| Tanpa login | `401` | `{ "code": "not_authenticated", "error": "Sesi login berakhir. Masuk kembali lalu coba lagi." }` |
| Berkas bukan gambar (`.txt`) | `400` | `{ "code": "invalid_file", "error": "Berkas harus JPG, PNG, atau WebP maksimal 4 MB." }` |

## Memperbarui dokumentasi

Dokumentasi ini **dibuat otomatis dari kode**:

```bash
npm run docs:api
```

Skrip `scripts/generate-openapi.mjs` membaca:
- setiap `app/api/**/route.js` untuk daftar endpoint dan metodenya;
- `lib/api/*.js` untuk field body (`readObject`, `readUpload`), tipe dan aturannya (`uuid`, `text`, `oneOf`, `integer`, dan lain-lain), query parameter, serta kode error yang dilempar;
- `lib/api/errors.js` untuk status HTTP dan pesan setiap kode error;
- `scripts/openapi/endpoints.json` untuk ringkasan dan hak akses, dan `scripts/openapi/examples.json` untuk contoh.

Setelah menambah endpoint, isi ringkasannya di `endpoints.json`, lalu jalankan ulang perintah di atas.
