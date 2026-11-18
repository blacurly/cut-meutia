# Dokumentasi API Ayomi (fitur non-AI)

REST API dibangun dengan Next.js Route Handlers di `app/api/`. Logika bisnis dan validasi ada di `lib/api/`; aturan akses dan transaksi ada di fungsi database Supabase (`supabase/migrations/035`–`042`). Fitur AI belum termasuk dokumen ini.

## Autentikasi

- **Browser:** sesi Supabase Auth dari cookie, ditulis oleh `POST /api/auth/login` atau halaman `/masuk`.
- **Klien lain (Thunder Client, Postman, aplikasi):** header `Authorization: Bearer <access_token>`. Token didapat dari `session.access_token` pada response `POST /api/auth/login`.
- Endpoint bertanda **Publik** bisa dipanggil tanpa login. Endpoint lain mengembalikan `401` tanpa sesi yang valid.
- Peran (Orang Tua, Pengelola, Pengasuh, Admin) dibaca dari database, bukan dari request. Mengganti ID di URL atau body tidak menaikkan hak akses.

## Konvensi

- Body request dan response berformat JSON. Request dengan body wajib memakai `Content-Type: application/json` (selain itu `415`), kecuali endpoint unggah berkas yang menerima `multipart/form-data`. Field yang tidak dikenal ditolak (`400 invalid_fields`).
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
| POST | `/api/auth/register` | Publik | Daftar akun Orang Tua |
| POST | `/api/auth/login` | Publik | Masuk; mengembalikan peran, tujuan halaman, dan `access_token` |
| POST | `/api/auth/logout` | Publik | Keluar dan hapus cookie sesi |
| GET | `/api/daycares` | Publik | Katalog daycare dengan filter server (lihat di bawah), termasuk mitra aktif melalui RPC dengan kolom publik yang dibatasi. |
| GET | `/api/daycares/{id}` | Publik | Detail daycare berdasarkan UUID atau slug: profil, galeri, paket biaya; data mitra aktif diambil melalui RPC dengan kolom publik yang dibatasi. Galeri memakai foto Pengelola yang disetujui Admin (tautan bertanda tangan 1 jam); tanpa foto, `gallery` berisi gambar contoh dengan `illustration: true` |
| GET | `/api/daycares/compare?ids=a,b,c` | Publik | Bandingkan 2–3 daycare berdampingan |
| GET | `/api/daycares/{id}/offerings` | Publik | Layanan dan harga yang disetujui dari daycare mitra |
| GET | `/api/daycares/{id}/reviews` | Publik | Ulasan yang lolos moderasi (tanpa identitas penulis) |
| GET | `/api/me` | Login | Profil Orang Tua dan daftar anak |
| PATCH | `/api/me` | Orang Tua | Ubah nama dan nomor WhatsApp |
| GET | `/api/me/daycares` | Login | Daycare tempat pengguna menjadi Pengelola/Pengasuh |
| GET | `/api/me/assignments` | Pengasuh | Pengajuan anak yang sedang ditugaskan kepada Pengasuh (titik masuk logbook). Butuh migrasi `20261116100000` |
| GET | `/api/admin/partners` | Admin | Daftar daycare mitra, status, dan Manager aktif |
| POST | `/api/admin/partners` | Admin | Buat daycare nonaktif dan undangan Manager; token undangan dikembalikan satu kali |
| PATCH | `/api/admin/partners/{id}` | Admin | Ubah status mitra dengan alasan dan catatan audit |
| GET | `/api/me/daycares/{id}/onboarding` | Manager daycare | Muat profil, layanan/harga, dan status dokumen untuk onboarding |
| PATCH | `/api/me/daycares/{id}/profile` | Manager daycare | Perbarui profil, fasilitas, jam buka, dan kapasitas |
| GET | `/api/me/daycares/{id}/offerings` | Manager daycare | Daftar layanan dan riwayat harga |
| POST/PATCH | `/api/me/daycares/{id}/offerings` | Manager daycare | Buat/perbarui layanan dan ajukan versi harga baru |
| GET/POST | `/api/me/daycares/{id}/documents` | Manager daycare | Daftar dokumen atau unggah dokumen legal privat (PDF/JPG/PNG, maks. 15 MB) |
| GET/POST | `/api/me/daycares/{id}/photos` | Manager daycare | Lihat foto sendiri atau ajukan foto fasilitas (JPG/PNG/WEBP, maks. 8 MB); foto pending tidak publik |
| GET | `/api/daycares/{id}/photos` | Publik | Foto yang disetujui untuk daycare aktif; tautan foto berlaku 5 menit |
| GET | `/api/admin/photos` | Admin | Antrean moderasi foto fasilitas |
| PATCH | `/api/admin/photos/{id}` | Admin | Setujui atau tolak foto dengan alasan |
| GET | `/api/admin/daycare-documents?daycare_id={id}` | Admin | Daftar berkas legal untuk verifikasi |
| PATCH | `/api/admin/daycare-documents/{id}` | Admin | Setujui, tolak, atau minta revisi dokumen dengan alasan |
| GET | `/api/daycare-documents/{id}/file` | Manager daycare terkait / Admin | Dapatkan URL bertanda tangan yang berlaku 5 menit |
| GET | `/api/admin/prices` | Admin | Antrean harga baru yang menunggu keputusan |
| PATCH | `/api/admin/prices/{id}` | Admin | Setujui atau tolak harga yang diajukan Manager |
| GET | `/api/me/daycares/{id}/staff` | Manager daycare | Daftar Pengasuh daycare |
| POST | `/api/me/daycares/{id}/staff/invitations` | Manager daycare | Buat undangan Pengasuh; token dikembalikan satu kali untuk dibagikan |
| DELETE | `/api/me/daycares/{id}/staff/{memberId}` | Manager daycare | Nonaktifkan keanggotaan Pengasuh dengan alasan |
| GET/POST | `/api/me/daycares/{id}/delegations` | Manager daycare | Daftar delegasi aktif/riwayat atau delegasikan izin terbatas ke Pengasuh |
| DELETE | `/api/me/daycares/{id}/delegations/{delegationId}` | Manager daycare | Cabut delegasi dengan alasan |
| GET/POST | `/api/children/{id}/pickup-authorizations` | Orang Tua anak | Daftar atau beri izin penjemput tetap/sekali pakai |
| DELETE | `/api/pickup-authorizations/{authorizationId}` | Orang Tua pemberi izin | Cabut izin penjemput yang belum digunakan |
| GET/POST | `/api/enrollments/{id}/pickup` | GET Parent/Manager/Admin; POST Manager atau Pengasuh dengan delegasi `confirm_pickup` | Riwayat pickup dengan URL bukti 5 menit atau catat verifikasi/serah-terima dengan foto privat |
| GET/POST | `/api/complaints` | Pengaju terautentikasi; pembuatan untuk Orang Tua | Daftar laporan sendiri atau buat laporan terkait pengajuan/insiden |
| PATCH | `/api/complaints/{id}` | Orang Tua pengaju | Balas permintaan informasi, terima penyelesaian, atau tolak dengan alasan |
| GET | `/api/admin/complaints?status={status}&priority={priority}` | Admin | Antrean komplain dengan prioritas emergency lebih dahulu |
| PATCH | `/api/admin/complaints/{id}` | Admin | Mulai, minta informasi, usulkan penyelesaian, atau alihkan penanggung jawab |
| GET/POST | `/api/admin/investigations` | Admin | Daftar investigasi atau mulai investigasi dari komplain/insiden |
| PATCH | `/api/admin/investigations/{id}` | Admin | Perbarui status, temuan, dan rekomendasi; penyelesaian wajib berisi temuan |
| GET/POST | `/api/complaints/{id}/attachments` | Pengaju laporan; GET juga Manager terkait/Admin | Daftar tautan bukti atau unggah bukti PDF/JPG/PNG/WEBP (maks. 10 MB) |
| GET/POST | `/api/admin/investigations/{id}/attachments` | Admin | Baca atau unggah bukti internal investigasi |
| GET/POST | `/api/admin/sanctions` | Admin | Daftar sanksi atau buat sanksi dengan bukti; sanksi aktif membatasi akses akun/daycare |
| PATCH | `/api/admin/sanctions/{id}` | Admin | Cabut sanksi dengan alasan dan catatan audit |
| GET | `/api/admin/staff` | Admin | Daftar Pengasuh yang menunggu verifikasi |
| PATCH | `/api/admin/staff/{id}` | Admin | Setujui atau tolak Pengasuh dengan alasan |
| POST | `/api/invitations/accept` | Login dengan email undangan | Terima undangan Manager/Pengasuh setelah token dan email diverifikasi |
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
| PATCH | `/api/enrollments/{id}/activities/{activityId}` | Pengasuh penulis | Ubah draf (wajib alasan perubahan). Body boleh memuat `details` `{ meal }` atau `{ sleep }`; tanpa `details`, detail lama dipertahankan |
| DELETE | `/api/enrollments/{id}/activities/{activityId}` | Pengasuh penulis | Hapus draf yang belum terkirim |
| POST | `/api/enrollments/{id}/activities/{activityId}/ai-draft` | Pengasuh penulis | **Logbook Drafter:** draf AI dari catatan draf sendiri (usulan saja, tidak menyimpan). Lihat [ai-api.md](./ai-api.md) |
| POST | `/api/activities/{id}/acknowledgements` | Orang Tua / Pengelola | Tandai dibaca (`parent_read`) atau ditinjau (`manager_review`) |
| GET, POST | `/api/activities/{id}/photos` | Pengasuh bertugas | Daftar foto; unggah foto asli dan varian Foto Fokus Anak untuk ditinjau |
| PATCH | `/api/activities/{id}/photos/{variantId}` | Pengasuh bertugas, Pengelola | Tandai varian foto `ready` atau `failed` setelah tinjauan |
| PUT | `/api/activities/{id}/love` | Orang Tua | Beri tanda love (favorit) pada catatan |
| DELETE | `/api/activities/{id}/love` | Orang Tua | Hapus tanda love |
| GET | `/api/activities/{id}/comments` | Orang Tua, Pengelola, Pengasuh bertugas | Daftar komentar catatan |
| POST | `/api/activities/{id}/comments` | Orang Tua, Pengelola, Pengasuh bertugas | Tulis komentar |
| DELETE | `/api/activities/{id}/comments/{commentId}` | Penulis komentar | Hapus komentar sendiri |
| GET | `/api/incidents` | Orang Tua, Pengelola, Admin | Laporan insiden sesuai cakupan |
| POST | `/api/incidents` | Orang Tua, Pengelola, Pengasuh bertugas | Laporkan insiden |
| PATCH | `/api/incidents/{id}` | Pengelola, Admin | Ubah status (`in_progress`, `resolved`) |
| GET, POST | `/api/incidents/{id}/evidence` | Orang Tua, Pengelola, Admin | Daftar atau unggah foto bukti insiden |
| POST | `/api/incidents/{id}/acknowledgement` | Orang Tua | Konfirmasi sudah membaca laporan |
| POST | `/api/reviews` | Orang Tua | Tulis ulasan setelah pengasuhan selesai |
| DELETE | `/api/reviews/{id}` | Orang Tua | Tarik ulasan |
| POST | `/api/reviews/{id}/reply` | Pengelola | Balas ulasan yang sudah terbit |
| GET | `/api/notifications` | Login | Notifikasi (`?unread=true&limit=20`) |
| PATCH | `/api/notifications/{id}` | Login | Tandai dibaca |
| GET | `/api/admin/moderation` | Admin | Antrean moderasi ulasan dan balasan |
| PATCH | `/api/admin/moderation/{reviews\|replies}/{versionId}` | Admin | Setujui atau tolak |
| GET | `/api/admin/transactions` | Admin | Antrean pembayaran yang menunggu konfirmasi (`created`/`pending`; `?status=` untuk status lain). Butuh migrasi `20261116100000` |
| PATCH | `/api/admin/transactions/{id}` | Admin | Catat hasil pembayaran manual |
| GET | `/api/ai/features` | Publik | Daftar fitur AI dan contoh input (lihat [kerangka AI](./ai-api.md)) |
| POST | `/api/ai/sandbox/{feature}` | Admin | Jalankan satu tugas AI pada data sintetis |
| POST | `/api/ai/focus/segment` | Pengasuh, Pengelola, Admin | Foto Fokus Anak: deteksi orang di foto (uji coba) |
| POST | `/api/ai/focus/render` | Pengasuh, Pengelola, Admin | Foto Fokus Anak: foto dengan hanya anak target yang tajam |

Endpoint dengan CRUD lengkap: `/api/children`, `/api/enrollments`, `/api/enrollments/{id}/activities`, dan `/api/activities/{id}/comments`.

**Foto logbook.** `POST /api/activities/{id}/photos` menerima multipart `file`, `child_id`, dan `target_polygon` (JSON poligon hasil `/api/ai/focus/segment`). Server menghasilkan varian lewat layanan Foto Fokus Anak, menyimpan original di bucket privat tanpa akses baca, lalu menyimpan varian sebagai `processing`. Pengasuh bertugas atau Pengelola harus meninjau varian sebelum status `ready`; Orang Tua hanya mendapat tautan bertanda tangan untuk varian `ready` pada catatan yang sudah dikirim. Saat disetujui, foto asli langsung dihapus dari Storage; bila penghapusan gagal, respons memuat `cleanup_pending: true` dan reviewer yang sama dapat mengulang PATCH. Catatan normal perlu 1–3 foto `ready`; catatan urgent boleh tanpa foto.
**Bukti insiden.** `POST /api/incidents/{id}/evidence` menerima satu foto JPG, PNG, atau WebP maksimal 10 MB. Bukti disimpan privat dan tautan bertanda tangan berlaku lima menit.

**Tautan undangan staf.** `POST /api/admin/partners` dan `POST /api/me/daycares/{id}/staff/invitations` mengembalikan `invitation_token` satu kali. Bagikan tautan berformat `https://<domain>/undangan#<invitation_token>`. Halaman `/undangan` meminta pengguna masuk atau mendaftar dengan email undangan, lalu memanggil `POST /api/invitations/accept`. Token diletakkan di *fragment* URL, sehingga tidak ikut terkirim ke server sebagai bagian URL.

## Akun — `/api/auth/*`

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "bunda@example.com", "password": "rahasia123", "full_name": "Bunda Sari", "phone": "081234567890", "terms": true }
```

`201 Created`. Bila konfirmasi email aktif di Supabase: `{ "user": null, "role": "parent", "needs_email_confirmation": true, "session": null }`. Response ini sama untuk email yang sudah terdaftar, sehingga endpoint tidak membocorkan daftar email. Pendaftaran mandiri selalu membuat akun Orang Tua; akun Pengelola, Pengasuh, dan Admin dibuat lewat undangan.

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "bunda@example.com", "password": "rahasia123", "role": "parent" }
```

`200 OK`:

```json
{
  "user": { "id": "…", "email": "bunda@example.com" },
  "profile": { "role": "parent", "full_name": "Bunda Sari" },
  "session": { "access_token": "eyJ…", "token_type": "bearer", "expires_at": 1794300000 },
  "redirect_to": "/beranda"
}
```

`role` bersifat opsional: `parent`, `caregiver` (Pengelola atau Pengasuh), atau `admin`. Jika peran akun tidak cocok, sesi langsung ditutup (`403 role_not_allowed`). Refresh token tidak pernah dikirim di body; sesi browser diperbarui lewat cookie.

| Error | Arti |
| --- | --- |
| `400 invalid_email`, `invalid_password`, `invalid_phone`, `invalid_full_name`, `invalid_terms` | Input tidak valid |
| `401 invalid_credentials` | Email atau kata sandi salah |
| `403 email_not_confirmed`, `account_not_active`, `role_not_allowed` | Akun belum bisa masuk ke portal ini |
| `409 email_already_registered` | Email sudah terdaftar (hanya bila konfirmasi email nonaktif) |
| `429 too_many_requests` | Batas percobaan Supabase Auth tercapai |

## Katalog, detail, dan perbandingan daycare

Katalog berisi 104 daycare dari dataset publik DKI Jakarta, Jawa Barat, dan Jawa Timur. Nama, alamat, fasilitas, rating, dan legalitas berasal dari dataset. Biaya, rasio pengasuh, kapasitas, usia, jam operasional, dan paket **tidak tersedia di sumber publik**, sehingga nilainya **disintesis** (`lib/daycare-synthetic.js`). Data sintetis ditandai `profile.estimated: true` dan harus ditampilkan sebagai estimasi. Pengelola menggantinya dengan data asli setelah mengklaim daycare.

### Filter `GET /api/daycares`

| Parameter | Nilai | Contoh |
| --- | --- | --- |
| `q` | Teks nama, alamat, kota, atau kecamatan | `q=tebet` |
| `province`, `city`, `district` | Nama wilayah persis | `province=Jawa Timur` |
| `maxFee` | Biaya bulanan maksimal: `1500000`, `2000000`, `3000000`, `4000000`, `5000000` | `maxFee=3000000` |
| `maxRatio` | Anak per pengasuh maksimal: `3`–`6` | `maxRatio=4` |
| `ageMonths` | Usia anak dalam bulan (0–84) | `ageMonths=18` |
| `facilities` | Kode fasilitas dipisah koma (`lib/daycare-facilities.js`) | `facilities=cctv,meals` |
| `legal` | `referenced`: hanya yang punya referensi izin publik | |
| `minRating` | `4` atau `4.5` | |
| `sort` | `recommended` (bawaan), `rating`, `fee`, `ratio`, `name` | `sort=fee` |

Nilai filter yang tidak valid diabaikan, tidak menghasilkan error. Daycare yang nilainya belum diketahui tidak lolos filter biaya, rasio, atau usia.

### Detail `GET /api/daycares/{id-atau-slug}`

Field utama: `name`, `address`, `facilities`, `facilityLabels`, `rating`, `legalStatus`, `legalReferenceUrl`, `monthlyFee`, `ratio`, `capacity`, `ageMinMonths`, `ageMaxMonths`, `profile` (`estimated`, `dailyFee`, `registrationFee`, `hours`, `operatingDays`, `packages`), dan `gallery`.

`gallery` berisi `{ "url": "/images/daycare-room.webp", "illustration": true }`. Selama daycare belum mengunggah foto, galeri memakai tiga ilustrasi AI bawaan aplikasi dengan urutan yang berbeda per daycare. `illustration: true` berarti gambar **bukan** foto daycare tersebut. Foto asli dari Storage (`illustration: false`) selalu diutamakan.

Error: `400 invalid_daycare_id`, `404 daycare_not_found`.

### Perbandingan `GET /api/daycares/compare?ids=a,b,c`

`ids` berisi 2–3 UUID atau slug yang berbeda. Response:

```json
{
  "daycares": [{ "id": "…", "slug": "…", "name": "…", "city": "…" }],
  "rows": [
    { "key": "monthly_fee", "label": "Biaya bulanan (mulai dari)", "estimated": true,
      "values": [{ "value": 2100000, "display": "Rp 2.100.000" }, { "value": 3650000, "display": "Rp 3.650.000" }],
      "best": [0] }
  ],
  "notes": ["Status legalitas dan rating berasal dari sumber publik …"]
}
```

Baris yang dibandingkan: legalitas, rating, biaya bulanan, biaya harian, biaya pendaftaran, rasio pengasuh, kapasitas, usia, jam operasional, jumlah fasilitas, dan setiap fasilitas. `best` berisi indeks kolom dengan nilai terbaik: biaya dan rasio terkecil, rating dan fasilitas terbanyak. `best` kosong bila semua nilai sama. Error: `400 invalid_compare_ids`, `404 daycare_not_found`.

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
{ "transaction_id": "…", "amount": 150000, "currency": "IDR", "method": "qris", "expires_at": "2026-11-12T03:00:00.000Z", "status": "created",
  "qr": { "mode": "qris_dynamic", "payload": "000201010212…6304ABCD", "image_data_url": "data:image/png;base64,…", "confirmation": "manual_admin" } }
```

**QR code (khusus `method: "qris"`):**
- **`qris_dynamic`:** dipakai kalau server punya `QRIS_STATIC_PAYLOAD`, yaitu string QRIS statis milik merchant (hasil memindai QRIS statis). QR diubah menjadi QRIS dinamis berisi **nominal tagihan**, sehingga bisa dipindai aplikasi bank atau e-wallet.
- **`demo`:** dipakai kalau variabel itu kosong. Isinya kode transaksi dan nominal dengan penanda `AYOMI-DEMO-BUKAN-PEMBAYARAN`, dan **tidak bisa dipakai untuk membayar**.
- `image_data_url` berupa PNG yang bisa langsung dipakai di `<img src>`.
- Kalau `QRIS_STATIC_PAYLOAD` tidak valid (CRC salah, atau bukan mata uang Rupiah), server mengembalikan `503 qris_not_configured`.

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

### Love dan komentar logbook

`PUT /api/activities/{id}/love` (tanpa body) → `200` `{ "activity_id": "…", "loved_by_me": true, "love_count": 1 }`. `DELETE` menghapusnya. Keduanya idempoten. Hanya Orang Tua anak tersebut yang dapat memberi love (`403 reaction_not_allowed`). Pengasuh penulis menerima satu notifikasi per catatan.

`POST /api/activities/{id}/comments` dengan body `{ "body": "Terima kasih, Bu!" }` → `201`:

```json
{ "id": "…", "activity_id": "…", "body": "Terima kasih, Bu!", "author_role": "parent", "author_name": "Bunda Sari", "is_mine": true, "created_at": "…" }
```

Komentar 1–1.000 karakter. Komentar Orang Tua memberi notifikasi ke pengasuh penulis; komentar Pengelola atau Pengasuh memberi notifikasi ke Orang Tua. Kirim `Idempotency-Key` agar pengiriman ulang tidak menggandakan komentar. Hanya penulis yang dapat menghapus komentar (`403 comment_delete_not_allowed`). Love dan komentar hanya berlaku untuk catatan terkirim; pihak lain mendapat `404 activity_not_found`.

`GET /api/enrollments/{id}/activities` kini menyertakan `love_count`, `loved_by_me`, dan `comment_count` per catatan.

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

## Penjemputan dan delegasi

Manager dapat mendelegasikan izin terbatas kepada Pengasuh aktif untuk periode tertentu. Pengasuh yang memiliki `confirm_pickup` dapat mencatat penjemputan, tetapi tidak dapat membaca riwayat. Orang Tua dapat mendaftarkan penjemput tetap atau izin satu kali untuk enrollment tertentu. Pencatatan `verification_status: "verified"` memerlukan foto JPG/PNG/WEBP maksimal 8 MB, izin yang cocok (atau identitas Parent yang cocok), check-in pada tanggal layanan, dan enrollment berstatus approved. Keberhasilan pencatatan foto, konsumsi izin satu kali, dan penyelesaian enrollment terjadi dalam satu transaksi. Catatan gagal tidak menyelesaikan enrollment. `late_minutes` disimpan `null` sampai jam layanan dan masa toleransi ditetapkan.

`POST /api/enrollments/{id}/pickup` menerima `multipart/form-data`: `verification_status`, `verification_note`, `collector_name`, `collector_phone`, `relationship`, `source` (`parent`, `authorized`, atau `unknown`), `authorization_id` bila ada, dan `file` wajib untuk status `verified`. GET mengembalikan URL bertanda tangan 5 menit untuk foto yang boleh dilihat.

## Komplain dan investigasi

Parent dapat mengirim komplain umum atau yang terkait enrollment/insiden miliknya. Admin memulai penanganan, meminta informasi, mengusulkan penyelesaian, dan mengalihkan penanggung jawab. Pengaju mendapat 72 jam untuk menerima atau menolak usulan; penolakan harus menyertakan alasan dan mengembalikan kasus ke `in_progress`. Supabase Cron menjalankan penutupan kasus yang melewati tenggat setiap 15 menit.

## Sanksi Admin

`POST /api/admin/sanctions` menerima `multipart/form-data` dengan tepat satu target (`target_user_id` atau `target_daycare_id`), `sanction_type` (`freeze` atau `block`), `reason`, `starts_at`, `ends_at` opsional, `investigation_id` opsional, dan `file` bukti wajib. Bukti privat dibatasi PDF/JPG/PNG/WEBP maksimal 10 MB. Sanksi akun aktif membuat fungsi akses mengembalikan role tidak aktif; sanksi daycare membatasi operasi untuk daycare tersebut. `block` tanpa waktu akhir tetap aktif sampai Admin mencabutnya.

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

