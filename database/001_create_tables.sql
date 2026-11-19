-- AYOMI: 60 tabel aplikasi untuk Supabase / PostgreSQL
-- Sumber: kamus tabel fisik v1.
-- Jalankan seluruh file SEKALI melalui Supabase SQL Editor pada schema aplikasi kosong.
-- Tidak menghapus atau mengganti tabel yang sudah ada. Jika ada konflik, transaksi dibatalkan.
-- auth.users disediakan Supabase dan tidak dihitung sebagai tabel aplikasi.
--
-- Tahap ini hanya DDL: tabel, PK, FK, CHECK, UNIQUE, indeks, dan aktivasi RLS.
-- Belum termasuk policy akses per role, grant client, fungsi bisnis, trigger, seed,
-- bucket Storage, job notifikasi, integrasi pembayaran/AI, atau koneksi frontend.
-- RLS tanpa policy dan pencabutan grant membuat tabel belum dapat diakses client.
-- Akses melalui SQL Editor/admin tetap tersedia. Jangan gunakan service_role di browser.
-- updated_at baru memiliki nilai awal; pembaruan otomatis belum disediakan.
-- Log/versi historis belum dilindungi dari UPDATE oleh trigger atau policy.
-- Validasi lintas tabel, transisi status, scope akses, dan aturan proses masih perlu backend.
-- Deadline pembayaran, tarif komisi, kebijakan refund, dan formula AI tidak diisi otomatis.
-- Unik enrollment aktif saat ini diterapkan pada approved. Perlu keputusan bisnis
-- sebelum memasukkan pending_payment ke dalam batas enrollment aktif.

BEGIN;

-- 1. TABEL (FK ditambahkan setelah seluruh tabel ada untuk menangani relasi siklik).

-- 01. users
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('parent', 'manager', 'caregiver', 'admin')),
  full_name text NOT NULL,
  phone text,
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'suspended')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 02. daycares
CREATE TABLE public.daycares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  address text NOT NULL,
  province_code text NOT NULL,
  city_code text NOT NULL,
  district_code text NOT NULL,
  postal_code text,
  timezone text NOT NULL,
  contact_phone text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  facilities jsonb NOT NULL,
  opening_hours jsonb NOT NULL,
  public_gallery jsonb NOT NULL,
  commission_category_code text,
  daily_capacity integer NOT NULL,
  status text NOT NULL CHECK (status IN ('inactive', 'active', 'suspended')),
  main_manager_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug),
  CHECK (daily_capacity > 0),
  CHECK (latitude BETWEEN -90 AND 90),
  CHECK (longitude BETWEEN -180 AND 180)
);

-- 03. daycare_members
CREATE TABLE public.daycare_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  user_id uuid NOT NULL,
  member_role text NOT NULL CHECK (member_role IN ('manager', 'caregiver')),
  status text NOT NULL CHECK (status IN ('invited', 'pending_verification', 'active', 'inactive')),
  verified_by uuid,
  verified_at timestamptz,
  joined_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (daycare_id, user_id),
  CHECK (ended_at IS NULL OR joined_at IS NULL OR ended_at >= joined_at)
);

-- 04. staff_invitations
CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  email text NOT NULL,
  invited_role text NOT NULL CHECK (invited_role IN ('manager', 'caregiver')),
  token_hash text NOT NULL,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash),
  CHECK (expires_at > created_at),
  CHECK ((accepted_by IS NULL) = (accepted_at IS NULL))
);

-- 05. daycare_delegations
CREATE TABLE public.daycare_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  grantor_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (grantor_id <> grantee_id)
);

-- 06. delegation_permissions
CREATE TABLE public.delegation_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('manage_caregivers', 'manage_assignments', 'manage_daily_reports', 'confirm_pickup')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delegation_id, permission)
);

-- 07. service_offerings
CREATE TABLE public.service_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  name text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('daily')),
  description text NOT NULL,
  min_age_months integer NOT NULL,
  max_age_months integer NOT NULL,
  is_active boolean NOT NULL,
  published_price_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_age_months >= 0),
  CHECK (max_age_months >= min_age_months)
);

-- 08. service_price_versions
CREATE TABLE public.service_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  service_amount bigint NOT NULL CHECK (service_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  late_pickup_terms jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'superseded')),
  proposed_by uuid NOT NULL,
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  effective_from timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offering_id, version)
);

-- 09. system_settings
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  value jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'retired')),
  effective_from timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);

-- 10. children
CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  full_name text NOT NULL,
  birth_date date NOT NULL,
  gender text,
  general_notes text,
  status text NOT NULL CHECK (status IN ('active', 'inactive')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 11. child_health_profiles
CREATE TABLE public.child_health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  allergies text NOT NULL,
  medical_history text NOT NULL,
  special_needs text NOT NULL,
  medication_notes text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id)
);

-- 12. child_health_change_logs
CREATE TABLE public.child_health_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  from_version integer NOT NULL,
  to_version integer NOT NULL,
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  changed_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, to_version),
  CHECK (from_version >= 1),
  CHECK (to_version = from_version + 1)
);

-- 13. child_health_correction_requests
CREATE TABLE public.child_health_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  proposed_changes jsonb NOT NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  base_health_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (base_health_version >= 1)
);

-- 14. caregiver_assignments
CREATE TABLE public.caregiver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  ended_early_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

-- 15. enrollments
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  daycare_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  price_version_id uuid,
  service_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'pending_payment', 'approved', 'rejected', 'completed', 'cancelled', 'expired')),
  manager_decision text NOT NULL CHECK (manager_decision IN ('undecided', 'accepted', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  decision_reason text,
  activation_block_reason text,
  payment_deadline timestamptz,
  approved_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid,
  completed_at timestamptz,
  cancelled_at timestamptz,
  child_snapshot jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 16. enrollment_status_logs
CREATE TABLE public.enrollment_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  from_status text CHECK (from_status IN ('pending', 'pending_payment', 'approved', 'rejected', 'completed', 'cancelled', 'expired')),
  to_status text NOT NULL CHECK (to_status IN ('pending', 'pending_payment', 'approved', 'rejected', 'completed', 'cancelled', 'expired')),
  actor_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'gateway')),
  reason text NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 17. enrollment_consents
CREATE TABLE public.enrollment_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  policy_version text NOT NULL,
  scope jsonb NOT NULL,
  wording_snapshot text NOT NULL,
  accepted_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 18. authorized_pickups
CREATE TABLE public.authorized_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  created_by uuid NOT NULL,
  enrollment_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text NOT NULL,
  permission_type text NOT NULL CHECK (permission_type IN ('standing', 'one_time')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revoked_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (permission_type <> 'one_time' OR (enrollment_id IS NOT NULL AND valid_until IS NOT NULL))
);

-- 19. pickup_records
CREATE TABLE public.pickup_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  authorization_id uuid,
  collector_snapshot jsonb NOT NULL,
  verification_status text NOT NULL CHECK (verification_status IN ('failed', 'verified')),
  verification_note text NOT NULL,
  confirmed_by uuid NOT NULL,
  verified_at timestamptz NOT NULL,
  handed_over_at timestamptz,
  late_minutes integer NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id),
  CHECK (late_minutes >= 0),
  CHECK (handed_over_at IS NULL OR verification_status = 'verified'),
  CHECK (handed_over_at IS NULL OR handed_over_at >= verified_at)
);

-- 20. daily_reports
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  report_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, report_date)
);

-- 21. daily_report_activities
CREATE TABLE public.daily_report_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('play', 'learning', 'interaction', 'meal', 'sleep', 'other')),
  title text NOT NULL,
  body text NOT NULL,
  occurred_at timestamptz NOT NULL,
  details jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'sent')),
  is_urgent boolean NOT NULL,
  urgent_reason text,
  sent_at timestamptz,
  draft_ai_job_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_urgent OR (urgent_reason IS NOT NULL AND length(btrim(urgent_reason)) > 0)),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

-- 22. attachments
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid,
  incident_id uuid,
  pickup_id uuid,
  document_id uuid,
  payout_change_id uuid,
  complaint_id uuid,
  investigation_id uuid,
  sanction_id uuid,
  uploaded_by uuid NOT NULL,
  bucket text NOT NULL,
  object_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL,
  status text NOT NULL CHECK (status IN ('uploading', 'quarantined', 'processing', 'ready', 'rejected')),
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, object_path),
  CHECK (num_nonnulls(activity_id, incident_id, pickup_id, document_id, payout_change_id, complaint_id, investigation_id, sanction_id) = 1)
);

-- 23. attachment_variants
CREATE TABLE public.attachment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL,
  variant_type text NOT NULL CHECK (variant_type IN ('masked', 'thumbnail')),
  audience_child_id uuid,
  bucket text NOT NULL,
  object_path text NOT NULL,
  sha256 text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'ready', 'failed')),
  ai_job_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, object_path)
);

-- 24. report_change_logs
CREATE TABLE public.report_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  before_title text NOT NULL,
  after_title text NOT NULL,
  before_body text NOT NULL,
  after_body text NOT NULL,
  reason text NOT NULL,
  from_version integer NOT NULL,
  to_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, to_version),
  CHECK (from_version >= 1),
  CHECK (to_version = from_version + 1),
  CHECK (length(btrim(reason)) > 0)
);

-- 25. activity_acknowledgements
CREATE TABLE public.activity_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ack_type text NOT NULL CHECK (ack_type IN ('manager_review', 'parent_read')),
  acknowledged_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, ack_type)
);

-- 26. incident_reports
CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  first_aid text NOT NULL,
  caregiver_urgency text NOT NULL CHECK (caregiver_urgency IN ('low', 'medium', 'high', 'emergency')),
  caregiver_reason text NOT NULL,
  effective_urgency text NOT NULL CHECK (effective_urgency IN ('low', 'medium', 'high', 'emergency')),
  urgency_source text NOT NULL CHECK (urgency_source IN ('caregiver', 'ai_max', 'manager_override')),
  needs_urgency_review boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('new', 'in_progress', 'resolved')),
  related_incident_id uuid,
  resolved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  submission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_key),
  CHECK (related_incident_id IS NULL OR related_incident_id <> id)
);

-- 27. incident_ai_analyses
CREATE TABLE public.incident_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  ai_job_id uuid NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  reason text NOT NULL,
  recommendations text NOT NULL,
  analyzed_at timestamptz NOT NULL,
  input_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ai_job_id),
  CHECK (input_version >= 1)
);

-- 28. incident_urgency_change_logs
CREATE TABLE public.incident_urgency_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  old_urgency text NOT NULL CHECK (old_urgency IN ('low', 'medium', 'high', 'emergency')),
  new_urgency text NOT NULL CHECK (new_urgency IN ('low', 'medium', 'high', 'emergency')),
  source text NOT NULL CHECK (source IN ('ai_max', 'manager_override')),
  actor_id uuid,
  analysis_id uuid,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'ai_max' AND analysis_id IS NOT NULL) OR (source = 'manager_override' AND actor_id IS NOT NULL))
);

-- 29. incident_status_logs
CREATE TABLE public.incident_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  from_status text CHECK (from_status IN ('new', 'in_progress', 'resolved')),
  to_status text NOT NULL CHECK (to_status IN ('new', 'in_progress', 'resolved')),
  actor_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 30. incident_parent_acknowledgements
CREATE TABLE public.incident_parent_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id)
);

-- 31. reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  daycare_id uuid NOT NULL,
  qualifying_enrollment_id uuid NOT NULL,
  published_version_id uuid,
  revision_allowed_by uuid,
  revision_complaint_id uuid,
  revision_granted_at timestamptz,
  revision_used_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, daycare_id)
);

-- 32. review_versions
CREATE TABLE public.review_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  rating smallint NOT NULL,
  body text NOT NULL,
  moderation_status text NOT NULL CHECK (moderation_status IN ('pending', 'held', 'approved', 'rejected')),
  ai_job_id uuid,
  moderated_by uuid,
  moderated_at timestamptz,
  moderation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, version),
  CHECK (rating BETWEEN 1 AND 5)
);

-- 33. review_replies
CREATE TABLE public.review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id)
);

-- 34. review_reply_versions
CREATE TABLE public.review_reply_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'held', 'approved', 'rejected')),
  draft_ai_job_id uuid,
  moderation_ai_job_id uuid,
  submitted_by uuid NOT NULL,
  moderated_by uuid,
  moderated_at timestamptz,
  moderation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, version)
);

-- 35. daycare_documents
CREATE TABLE public.daycare_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  document_type text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  document_number text,
  issuer text,
  valid_from date,
  expires_on date,
  submitted_by uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'superseded')),
  supersedes_id uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (daycare_id, document_type, version),
  CHECK (expires_on IS NULL OR valid_from IS NULL OR expires_on >= valid_from),
  CHECK (supersedes_id IS NULL OR supersedes_id <> id)
);

-- 36. daycare_verifications
CREATE TABLE public.daycare_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  ai_job_id uuid,
  ocr_result jsonb,
  analysis_result jsonb,
  decision text NOT NULL CHECK (decision IN ('pending', 'approved', 'revision_required', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reason text,
  verified_fields jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 37. daycare_safety_scores
CREATE TABLE public.daycare_safety_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  ai_job_id uuid NOT NULL,
  score numeric(5,2) NOT NULL,
  formula_version text NOT NULL,
  input_snapshot jsonb NOT NULL,
  explanation jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_review', 'published', 'rejected', 'superseded')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (score BETWEEN 0 AND 100)
);

-- 38. charges
CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  charge_type text NOT NULL CHECK (charge_type IN ('service', 'late_pickup')),
  price_version_id uuid,
  commission_rule_id uuid,
  policy_snapshot jsonb NOT NULL,
  service_amount bigint NOT NULL CHECK (service_amount >= 0),
  parent_admin_fee bigint NOT NULL CHECK (parent_admin_fee >= 0),
  total_amount bigint NOT NULL CHECK (total_amount >= 0),
  daycare_commission_amount bigint NOT NULL CHECK (daycare_commission_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  status text NOT NULL CHECK (status IN ('open', 'paid', 'expired', 'cancelled')),
  due_at timestamptz NOT NULL,
  paid_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_amount = service_amount + parent_admin_fee),
  CHECK (daycare_commission_amount <= service_amount)
);

-- 39. transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL,
  provider text NOT NULL,
  provider_transaction_id text,
  idempotency_key text NOT NULL,
  method text NOT NULL CHECK (method IN ('va', 'qris', 'ewallet')),
  amount bigint NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  status text NOT NULL CHECK (status IN ('created', 'pending', 'succeeded', 'failed', 'expired')),
  reconciliation_status text NOT NULL CHECK (reconciliation_status IN ('normal', 'needs_review', 'reviewed')),
  reconciliation_reason text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  UNIQUE (provider, provider_transaction_id)
);

-- 40. payment_details
CREATE TABLE public.payment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  method_details jsonb NOT NULL,
  provider_fee_amount bigint CHECK (provider_fee_amount >= 0),
  provider_receipt_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);

-- 41. payment_webhook_events
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  resource_kind text NOT NULL CHECK (resource_kind IN ('payment', 'refund', 'payout')),
  provider_resource_id text NOT NULL,
  transaction_id uuid,
  refund_id uuid,
  payout_id uuid,
  payload_digest text NOT NULL,
  sanitized_payload jsonb NOT NULL,
  verified_at timestamptz NOT NULL,
  processing_status text NOT NULL CHECK (processing_status IN ('received', 'processed', 'failed', 'needs_review')),
  processed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id),
  CHECK ((transaction_id IS NULL OR resource_kind = 'payment') AND (refund_id IS NULL OR resource_kind = 'refund') AND (payout_id IS NULL OR resource_kind = 'payout'))
);

-- 42. commission_rules
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  daycare_id uuid,
  offering_id uuid,
  category_code text,
  percentage numeric(7,4) NOT NULL,
  calculation_base text NOT NULL CHECK (calculation_base IN ('service_amount')),
  rounding_policy text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (percentage BETWEEN 0 AND 100),
  CHECK (num_nonnulls(daycare_id, offering_id, category_code) <= 1),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- 43. payouts
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  payout_account_id uuid NOT NULL,
  account_snapshot jsonb NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  status text NOT NULL CHECK (status IN ('draft', 'held', 'approved', 'processing', 'paid', 'failed', 'cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  provider text,
  provider_reference text,
  idempotency_key text NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CHECK (status IN ('draft', 'cancelled') OR amount > 0)
);

-- 44. payout_items
CREATE TABLE public.payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL,
  charge_id uuid NOT NULL,
  gross_amount bigint NOT NULL CHECK (gross_amount >= 0),
  commission_amount bigint NOT NULL CHECK (commission_amount >= 0),
  refund_deduction bigint NOT NULL CHECK (refund_deduction >= 0),
  other_deduction bigint NOT NULL CHECK (other_deduction >= 0),
  net_amount bigint NOT NULL CHECK (net_amount >= 0),
  calculation_snapshot jsonb NOT NULL,
  reservation_status text NOT NULL CHECK (reservation_status IN ('reserved', 'released', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (net_amount = gross_amount - commission_amount - refund_deduction - other_deduction)
);

-- 45. refunds
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  complaint_id uuid,
  requested_by uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('pending', 'full', 'partial', 'none')),
  amount bigint NOT NULL CHECK (amount >= 0),
  reason text NOT NULL,
  decided_by uuid,
  decided_at timestamptz,
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'processing', 'succeeded', 'failed')),
  provider_reference text,
  idempotency_key text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CHECK (decision <> 'none' OR (amount = 0 AND status = 'rejected')),
  CHECK (decision NOT IN ('full', 'partial') OR amount > 0)
);

-- 46. daycare_payout_accounts
CREATE TABLE public.daycare_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  bank_code text NOT NULL,
  account_number_ciphertext text NOT NULL,
  account_last4 text NOT NULL,
  account_holder text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'inactive')),
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL,
  activated_at timestamptz NOT NULL,
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 47. payout_account_change_requests
CREATE TABLE public.payout_account_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  current_account_id uuid,
  proposed_bank_code text NOT NULL,
  proposed_number_ciphertext text NOT NULL,
  proposed_last4 text NOT NULL,
  proposed_holder text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reason text,
  result_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 48. financial_holds
CREATE TABLE public.financial_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daycare_id uuid,
  transaction_id uuid,
  refund_id uuid,
  payout_id uuid,
  hold_type text NOT NULL CHECK (hold_type IN ('payout', 'refund', 'settlement')),
  complaint_id uuid,
  imposed_by uuid NOT NULL,
  reason text NOT NULL,
  released_by uuid,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(daycare_id, transaction_id, refund_id, payout_id) = 1)
);

-- 49. complaints
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  daycare_id uuid,
  enrollment_id uuid,
  incident_id uuid,
  category text NOT NULL CHECK (category IN ('payment', 'daycare_service', 'caregiver_conduct', 'child_safety', 'account_access', 'other')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('new', 'in_progress', 'waiting_for_response', 'waiting_for_confirmation', 'resolved', 'closed')),
  assigned_admin_id uuid,
  resolution_text text,
  confirmation_requested_at timestamptz,
  confirmation_due_at timestamptz,
  confirmed_by uuid,
  confirmed_at timestamptz,
  closed_at timestamptz,
  closure_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 50. complaint_assignments
CREATE TABLE public.complaint_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  from_admin_id uuid,
  to_admin_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 51. complaint_status_logs
CREATE TABLE public.complaint_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  from_status text CHECK (from_status IN ('new', 'in_progress', 'waiting_for_response', 'waiting_for_confirmation', 'resolved', 'closed')),
  to_status text NOT NULL CHECK (to_status IN ('new', 'in_progress', 'waiting_for_response', 'waiting_for_confirmation', 'resolved', 'closed')),
  actor_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system')),
  reason text NOT NULL,
  response_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 52. investigations
CREATE TABLE public.investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid,
  incident_id uuid,
  assigned_admin_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'in_progress', 'completed')),
  scope text NOT NULL,
  findings text,
  recommendation text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(complaint_id, incident_id) >= 1)
);

-- 53. notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  event_type text NOT NULL,
  enrollment_id uuid,
  activity_id uuid,
  incident_id uuid,
  complaint_id uuid,
  document_id uuid,
  health_change_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('normal', 'urgent')),
  deduplication_key text NOT NULL,
  available_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deduplication_key)
);

-- 54. notification_receipts
CREATE TABLE public.notification_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  seen_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id)
);

-- 55. notification_reminders
CREATE TABLE public.notification_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  reminder_kind text NOT NULL CHECK (reminder_kind IN ('manager_urgent_review', 'parent_urgent_read', 'parent_incident_ack', 'legal_expiry')),
  sequence integer NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'claimed', 'sent', 'cancelled', 'failed')),
  claimed_at timestamptz,
  lease_until timestamptz,
  sent_at timestamptz,
  deduplication_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deduplication_key),
  CHECK (sequence >= 1)
);

-- 56. notification_delivery_logs
CREATE TABLE public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  reminder_id uuid,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'whatsapp', 'sms')),
  attempt_number smallint NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed')),
  provider_reference text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  next_retry_at timestamptz,
  error_code text,
  delivery_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_key),
  CHECK (attempt_number >= 1)
);

-- 57. audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'gateway', 'ai')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  daycare_id uuid,
  reason text,
  before_summary jsonb,
  after_summary jsonb,
  request_id text NOT NULL,
  actor_label_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 58. account_sanctions
CREATE TABLE public.account_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid,
  target_daycare_id uuid,
  investigation_id uuid,
  sanction_type text NOT NULL CHECK (sanction_type IN ('freeze', 'block')),
  reason text NOT NULL,
  imposed_by uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(target_user_id, target_daycare_id) = 1),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- 59. ai_jobs
CREATE TABLE public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL CHECK (feature IN ('legal_verification', 'safety_score', 'review_moderation', 'review_summary', 'smart_reply', 'logbook_draft', 'privacy_masking', 'incident_triage')),
  daycare_id uuid,
  document_id uuid,
  review_version_id uuid,
  reply_version_id uuid,
  activity_id uuid,
  attachment_id uuid,
  incident_id uuid,
  provider text NOT NULL,
  model text NOT NULL,
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  input_version text NOT NULL,
  input_snapshot jsonb NOT NULL,
  output jsonb,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt_number integer NOT NULL,
  retry_of_id uuid,
  error_code text,
  requested_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CHECK (attempt_number >= 1),
  CHECK (retry_of_id IS NULL OR retry_of_id <> id)
);

-- 60. admin_actions
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action_type text NOT NULL,
  audit_log_id uuid NOT NULL,
  complaint_id uuid,
  investigation_id uuid,
  decision_summary text NOT NULL,
  executed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_log_id)
);

-- 2. FOREIGN KEYS. Riwayat tidak dihapus dengan cascade.

ALTER TABLE public.users
  ADD FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycares
  ADD FOREIGN KEY (main_manager_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_members
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_members
  ADD FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_members
  ADD FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_invitations
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_invitations
  ADD FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_invitations
  ADD FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_delegations
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_delegations
  ADD FOREIGN KEY (grantor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_delegations
  ADD FOREIGN KEY (grantee_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_delegations
  ADD FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.delegation_permissions
  ADD FOREIGN KEY (delegation_id) REFERENCES public.daycare_delegations(id) ON DELETE RESTRICT;

ALTER TABLE public.service_offerings
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.service_offerings
  ADD FOREIGN KEY (published_price_id) REFERENCES public.service_price_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.service_price_versions
  ADD FOREIGN KEY (offering_id) REFERENCES public.service_offerings(id) ON DELETE RESTRICT;

ALTER TABLE public.service_price_versions
  ADD FOREIGN KEY (proposed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.service_price_versions
  ADD FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.system_settings
  ADD FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.children
  ADD FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_profiles
  ADD FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_profiles
  ADD FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_change_logs
  ADD FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_change_logs
  ADD FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_correction_requests
  ADD FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_correction_requests
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_correction_requests
  ADD FOREIGN KEY (proposed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.child_health_correction_requests
  ADD FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.caregiver_assignments
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.caregiver_assignments
  ADD FOREIGN KEY (caregiver_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.caregiver_assignments
  ADD FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (offering_id) REFERENCES public.service_offerings(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (price_version_id) REFERENCES public.service_price_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollments
  ADD FOREIGN KEY (checked_in_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollment_status_logs
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollment_status_logs
  ADD FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollment_consents
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.enrollment_consents
  ADD FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.authorized_pickups
  ADD FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE RESTRICT;

ALTER TABLE public.authorized_pickups
  ADD FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.authorized_pickups
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.pickup_records
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.pickup_records
  ADD FOREIGN KEY (authorization_id) REFERENCES public.authorized_pickups(id) ON DELETE RESTRICT;

ALTER TABLE public.pickup_records
  ADD FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_reports
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_reports
  ADD FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_report_activities
  ADD FOREIGN KEY (report_id) REFERENCES public.daily_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_report_activities
  ADD FOREIGN KEY (caregiver_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_report_activities
  ADD FOREIGN KEY (draft_ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (activity_id) REFERENCES public.daily_report_activities(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (pickup_id) REFERENCES public.pickup_records(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (document_id) REFERENCES public.daycare_documents(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (payout_change_id) REFERENCES public.payout_account_change_requests(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (sanction_id) REFERENCES public.account_sanctions(id) ON DELETE RESTRICT;

ALTER TABLE public.attachments
  ADD FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.attachment_variants
  ADD FOREIGN KEY (attachment_id) REFERENCES public.attachments(id) ON DELETE RESTRICT;

ALTER TABLE public.attachment_variants
  ADD FOREIGN KEY (audience_child_id) REFERENCES public.children(id) ON DELETE RESTRICT;

ALTER TABLE public.attachment_variants
  ADD FOREIGN KEY (ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.attachment_variants
  ADD FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.report_change_logs
  ADD FOREIGN KEY (activity_id) REFERENCES public.daily_report_activities(id) ON DELETE RESTRICT;

ALTER TABLE public.report_change_logs
  ADD FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.activity_acknowledgements
  ADD FOREIGN KEY (activity_id) REFERENCES public.daily_report_activities(id) ON DELETE RESTRICT;

ALTER TABLE public.activity_acknowledgements
  ADD FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_reports
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_reports
  ADD FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_reports
  ADD FOREIGN KEY (related_incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_ai_analyses
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_ai_analyses
  ADD FOREIGN KEY (ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_urgency_change_logs
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_urgency_change_logs
  ADD FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_urgency_change_logs
  ADD FOREIGN KEY (analysis_id) REFERENCES public.incident_ai_analyses(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_status_logs
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_status_logs
  ADD FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_parent_acknowledgements
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.incident_parent_acknowledgements
  ADD FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.reviews
  ADD FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.reviews
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.reviews
  ADD FOREIGN KEY (qualifying_enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.reviews
  ADD FOREIGN KEY (published_version_id) REFERENCES public.review_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.reviews
  ADD FOREIGN KEY (revision_allowed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.reviews
  ADD FOREIGN KEY (revision_complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.review_versions
  ADD FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE RESTRICT;

ALTER TABLE public.review_versions
  ADD FOREIGN KEY (ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.review_versions
  ADD FOREIGN KEY (moderated_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.review_replies
  ADD FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE RESTRICT;

ALTER TABLE public.review_replies
  ADD FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.review_replies
  ADD FOREIGN KEY (published_version_id) REFERENCES public.review_reply_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.review_reply_versions
  ADD FOREIGN KEY (reply_id) REFERENCES public.review_replies(id) ON DELETE RESTRICT;

ALTER TABLE public.review_reply_versions
  ADD FOREIGN KEY (draft_ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.review_reply_versions
  ADD FOREIGN KEY (moderation_ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.review_reply_versions
  ADD FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.review_reply_versions
  ADD FOREIGN KEY (moderated_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_documents
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_documents
  ADD FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_documents
  ADD FOREIGN KEY (supersedes_id) REFERENCES public.daycare_documents(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_verifications
  ADD FOREIGN KEY (document_id) REFERENCES public.daycare_documents(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_verifications
  ADD FOREIGN KEY (ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_verifications
  ADD FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_safety_scores
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_safety_scores
  ADD FOREIGN KEY (ai_job_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_safety_scores
  ADD FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.charges
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.charges
  ADD FOREIGN KEY (price_version_id) REFERENCES public.service_price_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.charges
  ADD FOREIGN KEY (commission_rule_id) REFERENCES public.commission_rules(id) ON DELETE RESTRICT;

ALTER TABLE public.charges
  ADD FOREIGN KEY (paid_transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.transactions
  ADD FOREIGN KEY (charge_id) REFERENCES public.charges(id) ON DELETE RESTRICT;

ALTER TABLE public.payment_details
  ADD FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events
  ADD FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events
  ADD FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events
  ADD FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE RESTRICT;

ALTER TABLE public.commission_rules
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.commission_rules
  ADD FOREIGN KEY (offering_id) REFERENCES public.service_offerings(id) ON DELETE RESTRICT;

ALTER TABLE public.commission_rules
  ADD FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.payouts
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.payouts
  ADD FOREIGN KEY (payout_account_id) REFERENCES public.daycare_payout_accounts(id) ON DELETE RESTRICT;

ALTER TABLE public.payouts
  ADD FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_items
  ADD FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_items
  ADD FOREIGN KEY (charge_id) REFERENCES public.charges(id) ON DELETE RESTRICT;

ALTER TABLE public.refunds
  ADD FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.refunds
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.refunds
  ADD FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.refunds
  ADD FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_payout_accounts
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.daycare_payout_accounts
  ADD FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_account_change_requests
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_account_change_requests
  ADD FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_account_change_requests
  ADD FOREIGN KEY (current_account_id) REFERENCES public.daycare_payout_accounts(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_account_change_requests
  ADD FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.payout_account_change_requests
  ADD FOREIGN KEY (result_account_id) REFERENCES public.daycare_payout_accounts(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (imposed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_holds
  ADD FOREIGN KEY (released_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaints
  ADD FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaints
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.complaints
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.complaints
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.complaints
  ADD FOREIGN KEY (assigned_admin_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaints
  ADD FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaint_assignments
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.complaint_assignments
  ADD FOREIGN KEY (from_admin_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaint_assignments
  ADD FOREIGN KEY (to_admin_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaint_assignments
  ADD FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.complaint_status_logs
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.complaint_status_logs
  ADD FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.investigations
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.investigations
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.investigations
  ADD FOREIGN KEY (assigned_admin_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (activity_id) REFERENCES public.daily_report_activities(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (document_id) REFERENCES public.daycare_documents(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD FOREIGN KEY (health_change_id) REFERENCES public.child_health_change_logs(id) ON DELETE RESTRICT;

ALTER TABLE public.notification_receipts
  ADD FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE RESTRICT;

ALTER TABLE public.notification_receipts
  ADD FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.notification_reminders
  ADD FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE RESTRICT;

ALTER TABLE public.notification_delivery_logs
  ADD FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE RESTRICT;

ALTER TABLE public.notification_delivery_logs
  ADD FOREIGN KEY (reminder_id) REFERENCES public.notification_reminders(id) ON DELETE RESTRICT;

ALTER TABLE public.audit_logs
  ADD FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.audit_logs
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.account_sanctions
  ADD FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.account_sanctions
  ADD FOREIGN KEY (target_daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.account_sanctions
  ADD FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE RESTRICT;

ALTER TABLE public.account_sanctions
  ADD FOREIGN KEY (imposed_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.account_sanctions
  ADD FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (daycare_id) REFERENCES public.daycares(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (document_id) REFERENCES public.daycare_documents(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (review_version_id) REFERENCES public.review_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (reply_version_id) REFERENCES public.review_reply_versions(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (activity_id) REFERENCES public.daily_report_activities(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (attachment_id) REFERENCES public.attachments(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (incident_id) REFERENCES public.incident_reports(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (retry_of_id) REFERENCES public.ai_jobs(id) ON DELETE RESTRICT;

ALTER TABLE public.ai_jobs
  ADD FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.admin_actions
  ADD FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.admin_actions
  ADD FOREIGN KEY (audit_log_id) REFERENCES public.audit_logs(id) ON DELETE RESTRICT;

ALTER TABLE public.admin_actions
  ADD FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE RESTRICT;

ALTER TABLE public.admin_actions
  ADD FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE RESTRICT;

-- 3. UNIQUE INDEX BERSYARAT.

CREATE UNIQUE INDEX daycare_one_active_manager
  ON public.daycare_members (daycare_id)
  WHERE member_role = 'manager' AND status = 'active';

CREATE UNIQUE INDEX enrollment_one_approved_per_child
  ON public.enrollments (child_id)
  WHERE status = 'approved';

CREATE UNIQUE INDEX pickup_one_handover_per_enrollment
  ON public.pickup_records (enrollment_id)
  WHERE verification_status = 'verified' AND handed_over_at IS NOT NULL;

CREATE UNIQUE INDEX safety_score_one_published_per_daycare
  ON public.daycare_safety_scores (daycare_id)
  WHERE status = 'published';

CREATE UNIQUE INDEX charge_one_service_per_enrollment
  ON public.charges (enrollment_id)
  WHERE charge_type = 'service';

CREATE UNIQUE INDEX payout_one_reserved_or_paid_item_per_charge
  ON public.payout_items (charge_id)
  WHERE reservation_status IN ('reserved', 'paid');

CREATE UNIQUE INDEX payout_account_one_active_per_daycare
  ON public.daycare_payout_accounts (daycare_id)
  WHERE status = 'active';

-- 4. INDEKS FOREIGN KEY UNTUK JOIN DAN PEMERIKSAAN RELASI.

CREATE INDEX ON public.daycares (main_manager_id);
CREATE INDEX ON public.daycare_members (user_id);
CREATE INDEX ON public.daycare_members (verified_by);
CREATE INDEX ON public.staff_invitations (daycare_id);
CREATE INDEX ON public.staff_invitations (invited_by);
CREATE INDEX ON public.staff_invitations (accepted_by);
CREATE INDEX ON public.daycare_delegations (daycare_id);
CREATE INDEX ON public.daycare_delegations (grantor_id);
CREATE INDEX ON public.daycare_delegations (grantee_id);
CREATE INDEX ON public.daycare_delegations (revoked_by);
CREATE INDEX ON public.service_offerings (daycare_id);
CREATE INDEX ON public.service_offerings (published_price_id);
CREATE INDEX ON public.service_price_versions (proposed_by);
CREATE INDEX ON public.service_price_versions (decided_by);
CREATE INDEX ON public.system_settings (approved_by);
CREATE INDEX ON public.children (parent_id);
CREATE INDEX ON public.child_health_profiles (updated_by);
CREATE INDEX ON public.child_health_change_logs (changed_by);
CREATE INDEX ON public.child_health_correction_requests (child_id);
CREATE INDEX ON public.child_health_correction_requests (enrollment_id);
CREATE INDEX ON public.child_health_correction_requests (proposed_by);
CREATE INDEX ON public.child_health_correction_requests (decided_by);
CREATE INDEX ON public.caregiver_assignments (enrollment_id);
CREATE INDEX ON public.caregiver_assignments (caregiver_id);
CREATE INDEX ON public.caregiver_assignments (assigned_by);
CREATE INDEX ON public.enrollments (child_id);
CREATE INDEX ON public.enrollments (parent_id);
CREATE INDEX ON public.enrollments (daycare_id);
CREATE INDEX ON public.enrollments (offering_id);
CREATE INDEX ON public.enrollments (price_version_id);
CREATE INDEX ON public.enrollments (decided_by);
CREATE INDEX ON public.enrollments (checked_in_by);
CREATE INDEX ON public.enrollment_status_logs (enrollment_id);
CREATE INDEX ON public.enrollment_status_logs (actor_id);
CREATE INDEX ON public.enrollment_consents (enrollment_id);
CREATE INDEX ON public.enrollment_consents (parent_id);
CREATE INDEX ON public.authorized_pickups (child_id);
CREATE INDEX ON public.authorized_pickups (created_by);
CREATE INDEX ON public.authorized_pickups (enrollment_id);
CREATE INDEX ON public.pickup_records (enrollment_id);
CREATE INDEX ON public.pickup_records (authorization_id);
CREATE INDEX ON public.pickup_records (confirmed_by);
CREATE INDEX ON public.daily_reports (created_by);
CREATE INDEX ON public.daily_report_activities (report_id);
CREATE INDEX ON public.daily_report_activities (caregiver_id);
CREATE INDEX ON public.daily_report_activities (draft_ai_job_id);
CREATE INDEX ON public.attachments (activity_id);
CREATE INDEX ON public.attachments (incident_id);
CREATE INDEX ON public.attachments (pickup_id);
CREATE INDEX ON public.attachments (document_id);
CREATE INDEX ON public.attachments (payout_change_id);
CREATE INDEX ON public.attachments (complaint_id);
CREATE INDEX ON public.attachments (investigation_id);
CREATE INDEX ON public.attachments (sanction_id);
CREATE INDEX ON public.attachments (uploaded_by);
CREATE INDEX ON public.attachment_variants (attachment_id);
CREATE INDEX ON public.attachment_variants (audience_child_id);
CREATE INDEX ON public.attachment_variants (ai_job_id);
CREATE INDEX ON public.attachment_variants (reviewed_by);
CREATE INDEX ON public.report_change_logs (changed_by);
CREATE INDEX ON public.activity_acknowledgements (user_id);
CREATE INDEX ON public.incident_reports (enrollment_id);
CREATE INDEX ON public.incident_reports (reported_by);
CREATE INDEX ON public.incident_reports (related_incident_id);
CREATE INDEX ON public.incident_ai_analyses (incident_id);
CREATE INDEX ON public.incident_urgency_change_logs (incident_id);
CREATE INDEX ON public.incident_urgency_change_logs (actor_id);
CREATE INDEX ON public.incident_urgency_change_logs (analysis_id);
CREATE INDEX ON public.incident_status_logs (incident_id);
CREATE INDEX ON public.incident_status_logs (actor_id);
CREATE INDEX ON public.incident_parent_acknowledgements (parent_id);
CREATE INDEX ON public.reviews (daycare_id);
CREATE INDEX ON public.reviews (qualifying_enrollment_id);
CREATE INDEX ON public.reviews (published_version_id);
CREATE INDEX ON public.reviews (revision_allowed_by);
CREATE INDEX ON public.reviews (revision_complaint_id);
CREATE INDEX ON public.review_versions (ai_job_id);
CREATE INDEX ON public.review_versions (moderated_by);
CREATE INDEX ON public.review_replies (manager_id);
CREATE INDEX ON public.review_replies (published_version_id);
CREATE INDEX ON public.review_reply_versions (draft_ai_job_id);
CREATE INDEX ON public.review_reply_versions (moderation_ai_job_id);
CREATE INDEX ON public.review_reply_versions (submitted_by);
CREATE INDEX ON public.review_reply_versions (moderated_by);
CREATE INDEX ON public.daycare_documents (submitted_by);
CREATE INDEX ON public.daycare_documents (supersedes_id);
CREATE INDEX ON public.daycare_verifications (document_id);
CREATE INDEX ON public.daycare_verifications (ai_job_id);
CREATE INDEX ON public.daycare_verifications (reviewed_by);
CREATE INDEX ON public.daycare_safety_scores (daycare_id);
CREATE INDEX ON public.daycare_safety_scores (ai_job_id);
CREATE INDEX ON public.daycare_safety_scores (reviewed_by);
CREATE INDEX ON public.charges (enrollment_id);
CREATE INDEX ON public.charges (price_version_id);
CREATE INDEX ON public.charges (commission_rule_id);
CREATE INDEX ON public.charges (paid_transaction_id);
CREATE INDEX ON public.transactions (charge_id);
CREATE INDEX ON public.payment_webhook_events (transaction_id);
CREATE INDEX ON public.payment_webhook_events (refund_id);
CREATE INDEX ON public.payment_webhook_events (payout_id);
CREATE INDEX ON public.commission_rules (daycare_id);
CREATE INDEX ON public.commission_rules (offering_id);
CREATE INDEX ON public.commission_rules (approved_by);
CREATE INDEX ON public.payouts (daycare_id);
CREATE INDEX ON public.payouts (payout_account_id);
CREATE INDEX ON public.payouts (approved_by);
CREATE INDEX ON public.payout_items (payout_id);
CREATE INDEX ON public.payout_items (charge_id);
CREATE INDEX ON public.refunds (transaction_id);
CREATE INDEX ON public.refunds (complaint_id);
CREATE INDEX ON public.refunds (requested_by);
CREATE INDEX ON public.refunds (decided_by);
CREATE INDEX ON public.daycare_payout_accounts (daycare_id);
CREATE INDEX ON public.daycare_payout_accounts (approved_by);
CREATE INDEX ON public.payout_account_change_requests (daycare_id);
CREATE INDEX ON public.payout_account_change_requests (requested_by);
CREATE INDEX ON public.payout_account_change_requests (current_account_id);
CREATE INDEX ON public.payout_account_change_requests (reviewed_by);
CREATE INDEX ON public.payout_account_change_requests (result_account_id);
CREATE INDEX ON public.financial_holds (daycare_id);
CREATE INDEX ON public.financial_holds (transaction_id);
CREATE INDEX ON public.financial_holds (refund_id);
CREATE INDEX ON public.financial_holds (payout_id);
CREATE INDEX ON public.financial_holds (complaint_id);
CREATE INDEX ON public.financial_holds (imposed_by);
CREATE INDEX ON public.financial_holds (released_by);
CREATE INDEX ON public.complaints (submitted_by);
CREATE INDEX ON public.complaints (daycare_id);
CREATE INDEX ON public.complaints (enrollment_id);
CREATE INDEX ON public.complaints (incident_id);
CREATE INDEX ON public.complaints (assigned_admin_id);
CREATE INDEX ON public.complaints (confirmed_by);
CREATE INDEX ON public.complaint_assignments (complaint_id);
CREATE INDEX ON public.complaint_assignments (from_admin_id);
CREATE INDEX ON public.complaint_assignments (to_admin_id);
CREATE INDEX ON public.complaint_assignments (changed_by);
CREATE INDEX ON public.complaint_status_logs (complaint_id);
CREATE INDEX ON public.complaint_status_logs (actor_id);
CREATE INDEX ON public.investigations (complaint_id);
CREATE INDEX ON public.investigations (incident_id);
CREATE INDEX ON public.investigations (assigned_admin_id);
CREATE INDEX ON public.notifications (recipient_id);
CREATE INDEX ON public.notifications (enrollment_id);
CREATE INDEX ON public.notifications (activity_id);
CREATE INDEX ON public.notifications (incident_id);
CREATE INDEX ON public.notifications (complaint_id);
CREATE INDEX ON public.notifications (document_id);
CREATE INDEX ON public.notifications (health_change_id);
CREATE INDEX ON public.notification_receipts (user_id);
CREATE INDEX ON public.notification_reminders (notification_id);
CREATE INDEX ON public.notification_delivery_logs (notification_id);
CREATE INDEX ON public.notification_delivery_logs (reminder_id);
CREATE INDEX ON public.audit_logs (actor_id);
CREATE INDEX ON public.audit_logs (daycare_id);
CREATE INDEX ON public.account_sanctions (target_user_id);
CREATE INDEX ON public.account_sanctions (target_daycare_id);
CREATE INDEX ON public.account_sanctions (investigation_id);
CREATE INDEX ON public.account_sanctions (imposed_by);
CREATE INDEX ON public.account_sanctions (revoked_by);
CREATE INDEX ON public.ai_jobs (daycare_id);
CREATE INDEX ON public.ai_jobs (document_id);
CREATE INDEX ON public.ai_jobs (review_version_id);
CREATE INDEX ON public.ai_jobs (reply_version_id);
CREATE INDEX ON public.ai_jobs (activity_id);
CREATE INDEX ON public.ai_jobs (attachment_id);
CREATE INDEX ON public.ai_jobs (incident_id);
CREATE INDEX ON public.ai_jobs (retry_of_id);
CREATE INDEX ON public.ai_jobs (requested_by);
CREATE INDEX ON public.admin_actions (admin_id);
CREATE INDEX ON public.admin_actions (complaint_id);
CREATE INDEX ON public.admin_actions (investigation_id);

-- 5. AKTIFKAN RLS. Policy/grant akses dibuat pada tahap berikutnya.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.users FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycares ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycares FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycare_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycare_members FROM PUBLIC, anon, authenticated;
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.staff_invitations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycare_delegations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycare_delegations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.delegation_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.delegation_permissions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.service_offerings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.service_offerings FROM PUBLIC, anon, authenticated;
ALTER TABLE public.service_price_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.service_price_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.system_settings FROM PUBLIC, anon, authenticated;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.children FROM PUBLIC, anon, authenticated;
ALTER TABLE public.child_health_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.child_health_profiles FROM PUBLIC, anon, authenticated;
ALTER TABLE public.child_health_change_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.child_health_change_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.child_health_correction_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.child_health_correction_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.caregiver_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.caregiver_assignments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.enrollments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.enrollment_status_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.enrollment_status_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.enrollment_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.enrollment_consents FROM PUBLIC, anon, authenticated;
ALTER TABLE public.authorized_pickups ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.authorized_pickups FROM PUBLIC, anon, authenticated;
ALTER TABLE public.pickup_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.pickup_records FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daily_reports FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daily_report_activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daily_report_activities FROM PUBLIC, anon, authenticated;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.attachments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.attachment_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.attachment_variants FROM PUBLIC, anon, authenticated;
ALTER TABLE public.report_change_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.report_change_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.activity_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.activity_acknowledgements FROM PUBLIC, anon, authenticated;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.incident_reports FROM PUBLIC, anon, authenticated;
ALTER TABLE public.incident_ai_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.incident_ai_analyses FROM PUBLIC, anon, authenticated;
ALTER TABLE public.incident_urgency_change_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.incident_urgency_change_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.incident_status_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.incident_status_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.incident_parent_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.incident_parent_acknowledgements FROM PUBLIC, anon, authenticated;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.reviews FROM PUBLIC, anon, authenticated;
ALTER TABLE public.review_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.review_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.review_replies FROM PUBLIC, anon, authenticated;
ALTER TABLE public.review_reply_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.review_reply_versions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycare_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycare_documents FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycare_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycare_verifications FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycare_safety_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycare_safety_scores FROM PUBLIC, anon, authenticated;
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.charges FROM PUBLIC, anon, authenticated;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.transactions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.payment_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.payment_details FROM PUBLIC, anon, authenticated;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.payment_webhook_events FROM PUBLIC, anon, authenticated;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.commission_rules FROM PUBLIC, anon, authenticated;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.payouts FROM PUBLIC, anon, authenticated;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.payout_items FROM PUBLIC, anon, authenticated;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.refunds FROM PUBLIC, anon, authenticated;
ALTER TABLE public.daycare_payout_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.daycare_payout_accounts FROM PUBLIC, anon, authenticated;
ALTER TABLE public.payout_account_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.payout_account_change_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.financial_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.financial_holds FROM PUBLIC, anon, authenticated;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.complaints FROM PUBLIC, anon, authenticated;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.complaint_assignments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.complaint_status_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.complaint_status_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.investigations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notification_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notification_receipts FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notification_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notification_reminders FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notification_delivery_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.account_sanctions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.account_sanctions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.ai_jobs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.admin_actions FROM PUBLIC, anon, authenticated;

COMMIT;
