# Dokumentasi API Ayomi (fitur non-AI)

REST API dibangun dengan Next.js Route Handlers di `app/api/`. Logika bisnis dan validasi ada di `lib/api/`; aturan akses dan transaksi ada di fungsi database Supabase (`supabase/migrations/035`–`040`). Fitur AI belum termasuk dokumen ini.

## Autentikasi

- **Browser:** sesi Supabase Auth dari cookie (otomatis setelah login di `/masuk`).
- **Klien lain (Thunder Client, aplikasi):** header `Authorization: Bearer <access_token>` dari Supabase Auth.
- Endpoint bertanda **Publik** bisa dipanggil tanpa login. Endpoint lain mengembalikan `401` tanpa sesi yang valid.
- Peran (Orang Tua, Pengelola, Pengasuh, Admin) dibaca dari database, bukan dari request. Mengganti ID di URL atau body tidak menaikkan hak akses.

## Konvensi

- Body request dan response berformat JSON. Request dengan body wajib memakai `Content-Type: application/json` (selain itu `415`). Field yang tidak dikenal ditolak (`400 invalid_fields`).
- Request `POST`/`PATCH`/`DELETE` dari situs lain ditolak (`403 invalid_origin`).
- Header opsional `Idempotency-Key` (12–100 karakter) membuat pengiriman ulang tidak menggandakan data, misalnya laporan insiden dan pembayaran.
- Semua response memakai `Cache-Control: private, no-store`.

### Format error

```json
{ "code": "daycare_capacity_full", "error": "Kapasitas daycare pada tanggal tersebut sudah penuh." }
```

| Status | Arti |
| --- | --- |
| 400 | Input tidak valid (`invalid_*`) |
| 401 | Belum login atau sesi berakhir (`not_authenticated`) |
| 403 | Peran atau cakupan tidak diizinkan (`*_scope_required`, `role_not_allowed`) |
| 404 | Data tidak ditemukan atau milik akun lain (`*_not_found`, `*_not_owned`) |
| 409 | Konflik status (`*_already_*`, `daycare_capacity_full`, `enrollment_cannot_*`) |
| 415 | Body bukan JSON |
| 500 | Kesalahan server; detail database tidak pernah dikirim ke klien |

Daftar lengkap kode error dan pesannya ada di `lib/api/errors.js`.

## Daftar endpoint

| Method | Endpoint | Akses | Fungsi |
| --- | --- | --- | --- |
| GET | `/api/daycare/list` | Publik | Katalog daycare (104 daycare 3 provinsi + mitra untuk pengguna login) |
| GET | `/api/daycares/{id}/offerings` | Publik | Layanan dan harga yang disetujui dari daycare mitra |
| GET | `/api/daycares/{id}/reviews` | Publik | Ulasan yang lolos moderasi (tanpa identitas penulis) |
| GET | `/api/me` | Login | Profil Orang Tua dan daftar anak |
| PATCH | `/api/me` | Orang Tua | Ubah nama dan nomor WhatsApp |
| GET | `/api/me/daycares` | Login | Daycare tempat pengguna menjadi Pengelola/Pengasuh |
| GET | `/api/children` | Orang Tua | Daftar anak |
| POST | `/api/children` | Orang Tua | Tambah anak |
| GET | `/api/children/{id}` | Orang Tua | Detail anak |
| PATCH | `/api/children/{id}` | Orang Tua | Ubah data anak (tanggal lahir terkunci setelah ada pendaftaran) |
| DELETE | `/api/children/{id}` | Orang Tua | Arsipkan anak yang belum punya riwayat pendaftaran |
| GET | `/api/children/{id}/health` | Orang Tua | Data kesehatan anak |
| PATCH | `/api/children/{id}/health` | Orang Tua | Ubah data kesehatan (berversi, tercatat di log) |
| GET | `/api/enrollments` | Orang Tua | Pengajuan milik sendiri |
| GET | `/api/enrollments?daycare_id={id}` | Pengelola | Antrean daycare; identitas anak disembunyikan sampai disetujui |
| POST | `/api/enrollments` | Orang Tua | Ajukan pendaftaran anak |
| GET | `/api/enrollments/{id}` | Orang Tua, Pengelola, Pengasuh bertugas | Detail, riwayat status, pengasuh |
| PATCH | `/api/enrollments/{id}` | Pengelola | Aksi: `decide`, `assign_caregiver`, `check_in`, `complete` |
| DELETE | `/api/enrollments/{id}` | Orang Tua | Batalkan pengajuan (hanya saat `pending`) |
| POST | `/api/enrollments/{id}/payments` | Orang Tua | Catat permintaan pembayaran tagihan |
| GET | `/api/enrollments/{id}/activities` | Orang Tua, Pengelola, Pengasuh bertugas | Catatan harian |
| POST | `/api/enrollments/{id}/activities` | Pengasuh bertugas | Tulis catatan (draf atau kirim) |
| PATCH | `/api/enrollments/{id}/activities/{activityId}` | Pengasuh penulis | Ubah draf (wajib alasan perubahan) |
| DELETE | `/api/enrollments/{id}/activities/{activityId}` | Pengasuh penulis | Hapus draf yang belum terkirim |
| POST | `/api/activities/{id}/acknowledgements` | Orang Tua / Pengelola | Tandai dibaca (`parent_read`) atau ditinjau (`manager_review`) |
| GET | `/api/incidents` | Orang Tua, Pengelola, Admin | Laporan insiden sesuai cakupan |
| POST | `/api/incidents` | Orang Tua, Pengelola, Pengasuh bertugas | Laporkan insiden |
| PATCH | `/api/incidents/{id}` | Pengelola, Admin | Ubah status (`in_progress`, `resolved`) |
| POST | `/api/incidents/{id}/acknowledgement` | Orang Tua | Konfirmasi sudah membaca laporan |
| POST | `/api/reviews` | Orang Tua | Tulis ulasan setelah pengasuhan selesai |
| DELETE | `/api/reviews/{id}` | Orang Tua | Tarik ulasan |
| POST | `/api/reviews/{id}/reply` | Pengelola | Balas ulasan yang sudah terbit |
| GET | `/api/notifications` | Login | Notifikasi (`?unread=true&limit=20`) |
| PATCH | `/api/notifications/{id}` | Login | Tandai dibaca |
| GET | `/api/admin/moderation` | Admin | Antrean moderasi ulasan dan balasan |
| PATCH | `/api/admin/moderation/{reviews\|replies}/{versionId}` | Admin | Setujui atau tolak |
| PATCH | `/api/admin/transactions/{id}` | Admin | Catat hasil pembayaran manual |

Endpoint dengan CRUD lengkap: `/api/children`, `/api/enrollments`, dan `/api/enrollments/{id}/activities`.

## Alur pendaftaran (contoh)

### 1. Orang Tua mengajukan — `POST /api/enrollments`

```http
POST /api/enrollments
Authorization: Bearer <token-orang-tua>
Content-Type: application/json
Idempotency-Key: daftar-arka-2026-11-12

{
  "child_id": "5f0c3d8e-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  "offering_id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d",
  "service_date": "2026-11-12",
  "consents": { "service_terms": true, "child_data_processing": true }
}
```

`201 Created`:

```json
{
  "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "reference": "C1D2E3F4",
  "status": "pending",
  "manager_decision": "undecided",
  "service_date": "2026-11-12",
  "daycare": { "id": "…", "name": "Daycare Mitra" },
  "offering": { "id": "…", "name": "Penitipan harian", "service_type": "daily" },
  "child": { "child_id": "5f0c3d8e-…", "full_name": "Arka", "birth_date": "2024-03-14" },
  "charge": null,
  "viewer_role": "parent",
  "status_logs": [{ "from_status": null, "to_status": "pending", "actor_type": "user", "reason": "Parent submitted enrollment" }],
  "caregivers": []
}
```

Kedua persetujuan wajib `true`. Teks dan versinya ditentukan server (`lib/enrollment-consent.js`) dan disimpan per jenis persetujuan.

Error umum: `400 invalid_consent`, `400 child_age_out_of_range`, `409 duplicate_active_enrollment`, `404 child_not_owned`.

### 2. Pengelola memutuskan — `PATCH /api/enrollments/{id}`

```json
{ "action": "decide", "decision": "accepted", "reason": "Slot tersedia" }
```

Hasil: `status` menjadi `pending_payment` dengan `charge` berisi harga yang disetujui dan batas bayar 24 jam. Error: `409 daycare_capacity_full`, `409 child_has_active_enrollment`, `403 manager_scope_required`.

Aksi lain:

```json
{ "action": "assign_caregiver", "caregiver_id": "…", "starts_at": "2026-11-12T00:00:00Z", "ends_at": "2026-11-12T10:00:00Z" }
{ "action": "check_in" }
{ "action": "complete", "reason": "Anak dijemput orang tua" }
```

### 3. Orang Tua membayar — `POST /api/enrollments/{id}/payments`

```json
{ "method": "qris" }
```

`201 Created`:

```json
{ "transaction_id": "…", "amount": 150000, "currency": "IDR", "method": "qris", "expires_at": "2026-11-12T03:00:00.000Z", "status": "created" }
```

Gateway pembayaran belum terpasang. Admin mengonfirmasi hasilnya lewat `PATCH /api/admin/transactions/{id}` dengan body `{ "status": "succeeded", "provider": "manual", "reason": "Transfer diverifikasi" }`, dan pengajuan menjadi `approved`. Checkout yang lewat batas bayar diubah menjadi `expired` oleh fungsi server `app_expire_overdue_enrollments()`.

## Catatan harian — `POST /api/enrollments/{id}/activities`

```json
{
  "report_date": "2026-11-12",
  "activity_type": "meal",
  "title": "Makan siang",
  "body": "Menghabiskan nasi, sayur bayam, dan buah pepaya.",
  "occurred_at": "2026-11-12T05:10:00Z",
  "status": "sent",
  "is_urgent": false
}
```

`201 Created` → `{ "id": "…" }`. Nilai `activity_type`: `play`, `learning`, `interaction`, `meal`, `sleep`, `other`. `status: "draft"` hanya terlihat oleh penulis. Catatan terkirim tidak dapat diubah atau dihapus (`409 sent_activity_is_immutable`). Catatan `is_urgent: true` wajib menyertakan `urgent_reason`.

## Laporan insiden — `POST /api/incidents`

```json
{
  "enrollment_id": "…",
  "occurred_at": "2026-11-12T04:00:00Z",
  "description": "Anak terbentur meja kecil saat bermain di ruang dalam.",
  "first_aid": "Dikompres dingin",
  "urgency": "medium",
  "urgency_reason": "Benjolan kecil di dahi"
}
```

`201 Created` → `{ "id": "…" }`. Nilai `urgency`: `low`, `medium`, `high`, `emergency`, dipilih manual oleh pelapor. Orang Tua, Pengelola, dan Admin menerima notifikasi. Kirim `Idempotency-Key` agar pengiriman ulang tidak membuat laporan ganda.

## Ulasan — `POST /api/reviews`

```json
{ "enrollment_id": "…", "rating": 5, "body": "Pengasuh sangat komunikatif dan laporan hariannya rinci." }
```

`201 Created` → `{ "id": "…", "moderation_status": "pending" }`. Ulasan baru tampil di `GET /api/daycares/{id}/reviews` setelah disetujui Admin. Syaratnya pengasuhan sudah `completed`, dan satu Orang Tua hanya boleh menulis satu ulasan per daycare.

## Pengujian

| Lapisan | Cara menjalankan |
| --- | --- |
| Unit test API dan validasi | `node --test lib/*.test.mjs lib/api/*.test.mjs` |
| Kecocokan migrasi dengan skema yang berjalan | `node --test lib/supabase-schema.test.mjs` |
| Alur end-to-end di database (otomatis ROLLBACK) | Jalankan `supabase/tests/e2e_non_ai_flow.sql` di SQL Editor; hasil akhir `E2E OK` |
