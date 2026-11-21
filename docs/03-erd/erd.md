# ERD / Schema Diagram Ayomi

Database Ayomi berjalan di **Supabase PostgreSQL**: **66 tabel**, **194 relasi foreign key**, dan RLS aktif di semua tabel.

**Sumber skema (diambil dari Supabase):**
- `supabase/schema/live_schema_snapshot.sql`: snapshot skema yang diambil **langsung dari database Supabase production** lewat `pg_catalog` (tabel, constraint, index, policy, fungsi, hak akses);
- `supabase/migrations/*.sql`: perubahan setelah snapshot, misalnya tabel `daycare_photos`.

Diagram di folder ini dibuat dari kedua sumber itu, jadi sama dengan database production. `database/001_create_tables.sql` adalah rancangan awal dan sudah berbeda di beberapa bagian (misalnya kunci tabel `children` adalah `child_id`).

## Isi folder ini

| Berkas | Isi |
| --- | --- |
| `erd.md` (halaman ini) | 3 diagram **inti** yang menunjukkan alur utama, daftar 66 tabel per domain, dan catatan desain |
| [`erd-per-domain.md`](erd-per-domain.md) | 13 diagram, satu per domain, dengan **semua kolom** setiap tabel. Dibuat otomatis dari skrip SQL |
| [`schema.dbml`](schema.dbml) | Seluruh skema dalam format DBML. Buka di [dbdiagram.io](https://dbdiagram.io): **Import → DBML**, lalu tempel isi berkas untuk diagram interaktif yang bisa digeser dan diperbesar |
| `gambar/` | PNG semua diagram, siap dipakai di deck |

Untuk membuat ulang `erd-per-domain.md` dan `schema.dbml` setelah skema berubah: `node scripts/generate-erd.mjs`.

**Mengambil ERD langsung dari Supabase:** buka Supabase Dashboard → **Database → Schema Visualizer**. Halaman itu menggambar semua tabel dan relasi dari database production. Karena ada 66 tabel, diagramnya sangat lebar, jadi lebih mudah dibaca per bagian (perbesar lalu screenshot) atau lewat diagram per domain di folder ini.

Notasi: `||--o{` artinya satu ke banyak. PK = primary key, FK = foreign key.

## 1. Akun, daycare, pendaftaran, dan pembayaran

![ERD inti 1: akun, daycare, pendaftaran, dan pembayaran](gambar/inti-1.png)

```mermaid
erDiagram
  users ||--o{ children : "parent_id"
  users ||--o{ daycare_members : "user_id"
  daycares ||--o{ daycare_members : "daycare_id"
  users ||--o{ daycares : "main_manager_id"
  daycares ||--o{ staff_invitations : "daycare_id"
  children ||--|| child_health_profiles : "child_id"
  daycares ||--o{ service_offerings : "daycare_id"
  service_offerings ||--o{ service_price_versions : "offering_id"
  children ||--o{ enrollments : "child_id"
  users ||--o{ enrollments : "parent_id"
  daycares ||--o{ enrollments : "daycare_id"
  service_offerings ||--o{ enrollments : "offering_id"
  service_price_versions ||--o{ enrollments : "price_version_id"
  enrollments ||--o{ charges : "enrollment_id"
  charges ||--o{ transactions : "charge_id"
  enrollments ||--o{ caregiver_assignments : "enrollment_id"
  users ||--o{ caregiver_assignments : "caregiver_id"

  users {
    uuid id PK "= auth.users.id"
    text role "parent | caregiver | manager | admin"
    text full_name
    text phone
    text status "active | ..."
  }
  daycares {
    uuid id PK
    text slug UK
    text name
    text address
    jsonb facilities
    int daily_capacity
    text status "active | inactive | suspended"
    uuid main_manager_id FK
  }
  daycare_members {
    uuid id PK
    uuid daycare_id FK
    uuid user_id FK
    text member_role "manager | caregiver"
    text status "pending_verification | active | inactive"
  }
  staff_invitations {
    uuid id PK
    uuid daycare_id FK
    text email
    text invited_role
    text token_hash "SHA-256, token tidak disimpan"
    timestamptz expires_at
  }
  children {
    uuid id PK
    uuid parent_id FK
    text full_name
    date birth_date
  }
  child_health_profiles {
    uuid id PK
    uuid child_id FK
    text allergies
    text medical_history
    text special_needs
    int version
  }
  service_offerings {
    uuid id PK
    uuid daycare_id FK
    text name
    text service_type
    uuid published_price_id FK
  }
  service_price_versions {
    uuid id PK
    uuid offering_id FK
    bigint service_amount
    text status "pending | approved | rejected"
  }
  enrollments {
    uuid id PK
    uuid child_id FK
    uuid parent_id FK
    uuid daycare_id FK
    uuid offering_id FK
    date service_date
    text status "pending | pending_payment | approved | ..."
    timestamptz payment_deadline
    timestamptz checked_in_at
  }
  charges {
    uuid id PK
    uuid enrollment_id FK
    bigint total_amount
    text status
    timestamptz due_at
  }
  transactions {
    uuid id PK
    uuid charge_id FK
    text method "qris | va | ewallet"
    bigint amount
    text status "created | pending | succeeded | failed | expired"
  }
  caregiver_assignments {
    uuid id PK
    uuid enrollment_id FK
    uuid caregiver_id FK
    timestamptz starts_at
    timestamptz ends_at
  }
```

## 2. Catatan harian, media, dan data AI

![ERD inti 2: catatan harian, media, dan data AI](gambar/inti-2.png)

```mermaid
erDiagram
  enrollments ||--o{ daily_reports : "enrollment_id"
  daily_reports ||--o{ daily_report_activities : "report_id"
  users ||--o{ daily_report_activities : "caregiver_id"
  ai_jobs |o--o{ daily_report_activities : "draft_ai_job_id"
  daily_report_activities ||--o{ attachments : "activity_id"
  attachments ||--o{ attachment_variants : "attachment_id"
  children ||--o{ attachment_variants : "audience_child_id"
  ai_jobs |o--o{ attachment_variants : "ai_job_id"
  daily_report_activities ||--o{ activity_comments : "activity_id"
  daily_report_activities ||--o{ activity_reactions : "activity_id"
  daily_report_activities ||--o{ activity_acknowledgements : "activity_id"

  daily_reports {
    uuid id PK
    uuid enrollment_id FK
    date report_date "UNIQUE per enrollment"
  }
  daily_report_activities {
    uuid id PK
    uuid report_id FK
    uuid caregiver_id FK
    text activity_type
    text title
    text body
    text status "draft | sent"
    uuid draft_ai_job_id FK "draf AI yang dipakai"
  }
  attachments {
    uuid id PK
    uuid activity_id FK "atau incident/document/pickup/..."
    text bucket "logbook-originals | incident-evidence | ..."
    text object_path
    text sha256
    text status
  }
  attachment_variants {
    uuid id PK
    uuid attachment_id FK
    uuid audience_child_id FK "versi fokus per anak"
    text variant_type
    text object_path "bucket logbook-masked"
    uuid ai_job_id FK
    timestamptz reviewed_at
  }
  ai_jobs {
    uuid id PK
    text feature "logbook_draft | privacy_masking | legal_verification | incident_triage | ..."
    text provider
    text model
    text model_version
    text prompt_version
    jsonb input_snapshot
    jsonb output
    text status "succeeded | failed"
    text error_code
    uuid requested_by FK
  }
  activity_comments {
    uuid id PK
    uuid activity_id FK
    uuid user_id FK
    text body
  }
  activity_reactions {
    uuid activity_id FK
    uuid user_id FK
  }
  activity_acknowledgements {
    uuid id PK
    uuid activity_id FK
    uuid user_id FK
  }
```

## 3. Insiden, verifikasi, Safety Score, ulasan, dan komplain

![ERD inti 3: insiden, verifikasi, Safety Score, ulasan, dan komplain](gambar/inti-3.png)

```mermaid
erDiagram
  enrollments ||--o{ incident_reports : "enrollment_id"
  incident_reports ||--o{ incident_ai_analyses : "incident_id"
  ai_jobs ||--o{ incident_ai_analyses : "ai_job_id"
  incident_reports ||--o{ incident_urgency_change_logs : "incident_id"
  incident_ai_analyses |o--o{ incident_urgency_change_logs : "analysis_id"
  incident_reports ||--o{ incident_status_logs : "incident_id"
  daycares ||--o{ daycare_documents : "daycare_id"
  daycare_documents ||--o{ daycare_verifications : "document_id"
  ai_jobs |o--o{ daycare_verifications : "ai_job_id"
  daycares ||--o{ daycare_safety_scores : "daycare_id"
  daycares ||--o{ reviews : "daycare_id"
  reviews ||--o{ review_versions : "review_id"
  reviews ||--o{ review_replies : "review_id"
  users ||--o{ complaints : "submitted_by"
  complaints ||--o{ complaint_status_logs : "complaint_id"
  users ||--o{ notifications : "recipient_id"

  incident_reports {
    uuid id PK
    uuid enrollment_id FK
    uuid reported_by FK
    text description
    text first_aid
    text caregiver_urgency "urgensi pelapor"
    text effective_urgency "max(pelapor, AI) atau override"
    text urgency_source "caregiver | ai_max | manager_override"
    bool needs_urgency_review
    text status "new | in_progress | resolved"
  }
  incident_ai_analyses {
    uuid id PK
    uuid incident_id FK
    uuid ai_job_id FK
    text urgency "usulan AI"
    text reason
    int input_version
  }
  incident_urgency_change_logs {
    uuid id PK
    uuid incident_id FK
    text old_urgency
    text new_urgency
    text source
    uuid analysis_id FK
    text reason
  }
  incident_status_logs {
    uuid id PK
    uuid incident_id FK
    text from_status
    text to_status
  }
  daycare_documents {
    uuid id PK
    uuid daycare_id FK
    text document_type
    text document_number
    date expires_on
    text status "pending | approved | revision_required | rejected"
  }
  daycare_verifications {
    uuid id PK
    uuid document_id FK
    uuid ai_job_id FK
    jsonb ocr_result
    text decision
  }
  daycare_safety_scores {
    uuid id PK
    uuid daycare_id FK
    numeric score "0-100"
    text formula_version
    jsonb explanation "status + alasan per komponen"
    text status "pending_review | published | rejected | superseded"
  }
  reviews {
    uuid id PK
    uuid parent_id FK
    uuid daycare_id FK
    uuid qualifying_enrollment_id FK "harus pengasuhan selesai"
  }
  review_versions {
    uuid id PK
    uuid review_id FK
    smallint rating
    text body
    text moderation_status
  }
  review_replies {
    uuid id PK
    uuid review_id FK
  }
  complaints {
    uuid id PK
    uuid submitted_by FK
    text category
    text status
    timestamptz confirmation_due_at "72 jam"
  }
  complaint_status_logs {
    uuid id PK
    uuid complaint_id FK
  }
  notifications {
    uuid id PK
    uuid recipient_id FK
    text event_type
    text title
    text priority
  }
```

## 4. Daftar lengkap 66 tabel per domain

Diagram lengkap setiap domain (semua kolom) ada di [`erd-per-domain.md`](erd-per-domain.md).

| Domain | Tabel |
| --- | --- |
| Akun & peran | `users`, `daycare_members`, `staff_invitations`, `daycare_delegations`, `delegation_permissions`, `account_sanctions` |
| Daycare & katalog | `daycares`, `daycare_listings`, `daycare_listing_profiles`, `daycare_photos`, `service_offerings`, `service_price_versions`, `commission_rules` |
| Anak | `children`, `child_health_profiles`, `child_health_change_logs`, `child_health_correction_requests` |
| Pendaftaran | `enrollments`, `enrollment_service_dates`, `enrollment_consents`, `enrollment_status_logs`, `caregiver_assignments` |
| Pembayaran | `charges`, `transactions`, `payment_details`, `payment_webhook_events`, `refunds`, `financial_holds`, `payouts`, `payout_items`, `daycare_payout_accounts`, `payout_account_change_requests` |
| Catatan harian | `daily_reports`, `daily_report_activities`, `activity_comments`, `activity_reactions`, `activity_acknowledgements`, `report_change_logs` |
| Media | `attachments`, `attachment_variants` |
| Penjemputan | `authorized_pickups`, `pickup_records` |
| Insiden | `incident_reports`, `incident_ai_analyses`, `incident_urgency_change_logs`, `incident_status_logs`, `incident_parent_acknowledgements` |
| Legalitas & Safety Score | `daycare_documents`, `daycare_verifications`, `daycare_safety_scores` |
| Ulasan | `reviews`, `review_versions`, `review_replies`, `review_reply_versions` |
| Komplain & investigasi | `complaints`, `complaint_status_logs`, `complaint_assignments`, `investigations`, `admin_actions` |
| Notifikasi | `notifications`, `notification_receipts`, `notification_reminders`, `notification_delivery_logs` |
| AI | `ai_jobs` (semua fitur), plus tabel hasil per fitur: `incident_ai_analyses`, `daycare_verifications`, `attachment_variants` |
| Sistem & audit | `system_settings`, `audit_logs` |

## 5. Catatan desain (untuk penjelasan juri)

**Normalisasi:**
- Harga disimpan per versi (`service_price_versions`), tagihan per pendaftaran (`charges`), dan transaksi per percobaan bayar (`transactions`).
- Ulasan dan balasan juga berversi (`*_versions`) supaya riwayat moderasi tidak tertimpa.

**Riwayat tidak dihapus:**
- Foreign key memakai `ON DELETE RESTRICT`.
- Perubahan penting dicatat di tabel `*_logs` dan `audit_logs`.

**Constraint:**
- `NOT NULL`, `CHECK` untuk status dan enum, `UNIQUE` (misalnya satu `daily_reports` per pendaftaran per tanggal);
- rentang waktu penugasan tidak boleh tumpang tindih;
- kolom `version` untuk penguncian optimistis.

**Data AI:** setiap pemanggilan AI tercatat di `ai_jobs` (model, versi prompt, input, output, status, error). Hasil per fitur ditaruh di tabel domainnya:

| Fitur | Tabel hasil |
| --- | --- |
| Triage | `incident_ai_analyses` |
| OCR | `daycare_verifications` |
| Foto Fokus | `attachment_variants` |
| Draf catatan | `daily_report_activities.draft_ai_job_id` |

**Keamanan:**
- RLS aktif di **semua 66 tabel**.
- Tulis dan baca lewat fungsi RPC `SECURITY DEFINER` yang memeriksa peran. Hak `EXECUTE` dicabut dari `anon` kecuali 7 fungsi katalog publik.
- Storage memakai 6 bucket privat dengan kebijakan per folder.

**Script dan seed** (kriteria 14):
- skema: `database/001_create_tables.sql` dan `supabase/migrations/`;
- seed katalog: `supabase/seed/daycare_listings_seed.sql` dan `daycare_listing_profiles_seed.sql`;
- akun demo: `scripts/import-demo-daycare-accounts.mjs`.
