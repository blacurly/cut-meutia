-- SNAPSHOT skema Supabase yang berjalan (project uitkyzjezowynbedjkbw).
-- Diambil 2026-11-10 lewat pg_catalog. Ini DOKUMEN REFERENSI, bukan migrasi:
-- jangan dijalankan ulang ke database yang sama. Migrasi 001-029 tidak tersimpan di repo;
-- file ini adalah sumber kebenaran skema dasar. Perubahan baru tetap lewat supabase/migrations/.

-- ===================== TABEL =====================
CREATE TABLE public.account_sanctions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  target_user_id uuid,
  target_daycare_id uuid,
  investigation_id uuid,
  sanction_type text NOT NULL,
  reason text NOT NULL,
  imposed_by uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  revoked_by uuid,
  revoked_at timestamp with time zone,
  revocation_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT account_sanctions_pkey PRIMARY KEY (id),
  CONSTRAINT account_sanctions_check CHECK ((((target_user_id IS NOT NULL) AND (target_daycare_id IS NULL)) OR ((target_user_id IS NULL) AND (target_daycare_id IS NOT NULL)))),
  CONSTRAINT account_sanctions_check1 CHECK (((ends_at IS NULL) OR (ends_at > starts_at))),
  CONSTRAINT account_sanctions_sanction_type_check CHECK ((sanction_type = ANY (ARRAY['freeze'::text, 'block'::text])))
);
ALTER TABLE public.account_sanctions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activity_acknowledgements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  activity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ack_type text NOT NULL,
  acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT activity_acknowledgements_activity_id_ack_type_key UNIQUE (activity_id, ack_type),
  CONSTRAINT activity_acknowledgements_pkey PRIMARY KEY (id),
  CONSTRAINT activity_acknowledgements_ack_type_check CHECK ((ack_type = ANY (ARRAY['manager_review'::text, 'parent_read'::text])))
);
ALTER TABLE public.activity_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  admin_id uuid NOT NULL,
  action_type text NOT NULL,
  audit_log_id uuid NOT NULL,
  complaint_id uuid,
  investigation_id uuid,
  decision_summary text NOT NULL,
  executed_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT admin_actions_audit_log_id_key UNIQUE (audit_log_id),
  CONSTRAINT admin_actions_pkey PRIMARY KEY (id)
);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  feature text NOT NULL,
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
  status text DEFAULT 'queued'::text NOT NULL,
  attempt_number integer DEFAULT 1 NOT NULL,
  retry_of_id uuid,
  error_code text,
  requested_by uuid,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  idempotency_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT ai_jobs_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT ai_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_jobs_attempt_number_check CHECK ((attempt_number > 0)),
  CONSTRAINT ai_jobs_check CHECK ((((feature = 'legal_verification'::text) AND (document_id IS NOT NULL)) OR ((feature = 'safety_score'::text) AND (daycare_id IS NOT NULL)) OR ((feature = ANY (ARRAY['review_moderation'::text, 'review_summary'::text])) AND (review_version_id IS NOT NULL)) OR ((feature = 'smart_reply'::text) AND (reply_version_id IS NOT NULL)) OR ((feature = 'logbook_draft'::text) AND (activity_id IS NOT NULL)) OR ((feature = 'privacy_masking'::text) AND (attachment_id IS NOT NULL)) OR ((feature = 'incident_triage'::text) AND (incident_id IS NOT NULL)))),
  CONSTRAINT ai_jobs_feature_check CHECK ((feature = ANY (ARRAY['legal_verification'::text, 'safety_score'::text, 'review_moderation'::text, 'review_summary'::text, 'smart_reply'::text, 'logbook_draft'::text, 'privacy_masking'::text, 'incident_triage'::text]))),
  CONSTRAINT ai_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text])))
);
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attachment_variants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  attachment_id uuid NOT NULL,
  variant_type text NOT NULL,
  audience_child_id uuid,
  bucket text NOT NULL,
  object_path text NOT NULL,
  sha256 text NOT NULL,
  status text DEFAULT 'processing'::text NOT NULL,
  ai_job_id uuid,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT attachment_variants_bucket_object_path_key UNIQUE (bucket, object_path),
  CONSTRAINT attachment_variants_pkey PRIMARY KEY (id),
  CONSTRAINT attachment_variants_bucket_check CHECK ((bucket = 'logbook-masked'::text)),
  CONSTRAINT attachment_variants_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'ready'::text, 'failed'::text]))),
  CONSTRAINT attachment_variants_variant_type_check CHECK ((variant_type = ANY (ARRAY['masked'::text, 'thumbnail'::text])))
);
ALTER TABLE public.attachment_variants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
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
  byte_size bigint NOT NULL,
  sha256 text NOT NULL,
  status text DEFAULT 'uploading'::text NOT NULL,
  uploaded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT attachments_bucket_object_path_key UNIQUE (bucket, object_path),
  CONSTRAINT attachments_pkey PRIMARY KEY (id),
  CONSTRAINT attachments_byte_size_check CHECK ((byte_size > 0)),
  CONSTRAINT attachments_check CHECK ((num_nonnulls(activity_id, incident_id, pickup_id, document_id, payout_change_id, complaint_id, investigation_id, sanction_id) = 1)),
  CONSTRAINT attachments_check1 CHECK ((((activity_id IS NOT NULL) AND (bucket = 'logbook-originals'::text)) OR ((incident_id IS NOT NULL) AND (bucket = 'incident-evidence'::text)) OR ((pickup_id IS NOT NULL) AND (bucket = 'pickup-evidence'::text)) OR (((document_id IS NOT NULL) OR (payout_change_id IS NOT NULL)) AND (bucket = 'daycare-documents'::text)) OR (((complaint_id IS NOT NULL) OR (investigation_id IS NOT NULL) OR (sanction_id IS NOT NULL)) AND (bucket = 'case-evidence'::text)))),
  CONSTRAINT attachments_status_check CHECK ((status = ANY (ARRAY['uploading'::text, 'quarantined'::text, 'processing'::text, 'ready'::text, 'rejected'::text])))
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  actor_type text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  daycare_id uuid,
  reason text,
  before_summary jsonb,
  after_summary jsonb,
  request_id text NOT NULL,
  actor_label_snapshot text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text, 'gateway'::text, 'ai'::text]))),
  CONSTRAINT audit_logs_check CHECK (((actor_id IS NOT NULL) OR (actor_type <> 'user'::text)))
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.authorized_pickups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  child_id uuid NOT NULL,
  created_by uuid NOT NULL,
  enrollment_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text NOT NULL,
  permission_type text NOT NULL,
  valid_from timestamp with time zone NOT NULL,
  valid_until timestamp with time zone,
  revoked_at timestamp with time zone,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT authorized_pickups_pkey PRIMARY KEY (id),
  CONSTRAINT authorized_pickups_check CHECK (((valid_until IS NULL) OR (valid_until >= valid_from))),
  CONSTRAINT authorized_pickups_check1 CHECK (((permission_type <> 'one_time'::text) OR ((enrollment_id IS NOT NULL) AND (valid_until IS NOT NULL)))),
  CONSTRAINT authorized_pickups_permission_type_check CHECK ((permission_type = ANY (ARRAY['standing'::text, 'one_time'::text])))
);
ALTER TABLE public.authorized_pickups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.caregiver_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  ended_early_at timestamp with time zone,
  end_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT caregiver_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT caregiver_assignments_check CHECK ((starts_at < ends_at)),
  CONSTRAINT caregiver_assignments_check1 CHECK (((ended_early_at IS NULL) OR ((ended_early_at >= starts_at) AND (ended_early_at <= ends_at))))
);
ALTER TABLE public.caregiver_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.charges (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  charge_type text NOT NULL,
  price_version_id uuid,
  commission_rule_id uuid,
  policy_snapshot jsonb NOT NULL,
  service_amount bigint NOT NULL,
  parent_admin_fee bigint NOT NULL,
  total_amount bigint NOT NULL,
  daycare_commission_amount bigint NOT NULL,
  currency character(3) NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  due_at timestamp with time zone NOT NULL,
  paid_transaction_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT charges_paid_transaction_id_key UNIQUE (paid_transaction_id),
  CONSTRAINT charges_pkey PRIMARY KEY (id),
  CONSTRAINT charges_charge_type_check CHECK ((charge_type = ANY (ARRAY['service'::text, 'late_pickup'::text]))),
  CONSTRAINT charges_check CHECK ((total_amount = (service_amount + parent_admin_fee))),
  CONSTRAINT charges_check1 CHECK ((daycare_commission_amount <= service_amount)),
  CONSTRAINT charges_daycare_commission_amount_check CHECK ((daycare_commission_amount >= 0)),
  CONSTRAINT charges_parent_admin_fee_check CHECK ((parent_admin_fee >= 0)),
  CONSTRAINT charges_service_amount_check CHECK ((service_amount >= 0)),
  CONSTRAINT charges_status_check CHECK ((status = ANY (ARRAY['open'::text, 'paid'::text, 'expired'::text, 'cancelled'::text])))
);
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.child_health_change_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  child_id uuid NOT NULL,
  from_version integer NOT NULL,
  to_version integer NOT NULL,
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  changed_by uuid NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT child_health_change_logs_pkey PRIMARY KEY (id),
  CONSTRAINT child_health_change_logs_check CHECK (((from_version > 0) AND (to_version > from_version)))
);
ALTER TABLE public.child_health_change_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.child_health_correction_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  child_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  proposed_changes jsonb NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  decided_by uuid,
  decided_at timestamp with time zone,
  decision_note text,
  base_health_version integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT child_health_correction_requests_pkey PRIMARY KEY (id),
  CONSTRAINT child_health_correction_requests_base_health_version_check CHECK ((base_health_version > 0)),
  CONSTRAINT child_health_correction_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);
ALTER TABLE public.child_health_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.child_health_profiles (
  child_id uuid NOT NULL,
  allergies text,
  medical_history text,
  special_needs text,
  medication_notes text,
  version integer DEFAULT 1 NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT child_health_profiles_pkey PRIMARY KEY (child_id),
  CONSTRAINT child_health_profiles_version_check CHECK ((version > 0))
);
ALTER TABLE public.child_health_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.children (
  child_id uuid DEFAULT gen_random_uuid() NOT NULL,
  parent_id uuid NOT NULL,
  full_name text NOT NULL,
  birth_date date,
  gender text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  general_notes text,
  status text DEFAULT 'active'::text NOT NULL,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT children_child_parent_unique UNIQUE (child_id, parent_id),
  CONSTRAINT children_pkey PRIMARY KEY (child_id),
  CONSTRAINT children_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.commission_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  version integer NOT NULL,
  daycare_id uuid,
  offering_id uuid,
  category_code text,
  percentage numeric(7,4) NOT NULL,
  calculation_base text DEFAULT 'service_amount'::text NOT NULL,
  rounding_policy text NOT NULL,
  effective_from timestamp with time zone NOT NULL,
  effective_until timestamp with time zone,
  approved_by uuid NOT NULL,
  approved_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT commission_rules_name_version_key UNIQUE (name, version),
  CONSTRAINT commission_rules_pkey PRIMARY KEY (id),
  CONSTRAINT commission_rules_calculation_base_check CHECK ((calculation_base = 'service_amount'::text)),
  CONSTRAINT commission_rules_check CHECK (((effective_until IS NULL) OR (effective_until > effective_from))),
  CONSTRAINT commission_rules_check1 CHECK ((num_nonnulls(daycare_id, offering_id, category_code) <= 1)),
  CONSTRAINT commission_rules_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric))),
  CONSTRAINT commission_rules_version_check CHECK ((version > 0))
);
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.complaint_assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  complaint_id uuid NOT NULL,
  from_admin_id uuid,
  to_admin_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT complaint_assignments_pkey PRIMARY KEY (id)
);
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.complaint_status_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  complaint_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  actor_type text NOT NULL,
  reason text NOT NULL,
  response_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT complaint_status_logs_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_status_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text]))),
  CONSTRAINT complaint_status_logs_check CHECK (((actor_id IS NOT NULL) OR (actor_type = 'system'::text))),
  CONSTRAINT complaint_status_logs_to_status_check CHECK ((to_status = ANY (ARRAY['new'::text, 'in_progress'::text, 'waiting_for_response'::text, 'waiting_for_confirmation'::text, 'resolved'::text, 'closed'::text])))
);
ALTER TABLE public.complaint_status_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.complaints (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  submitted_by uuid NOT NULL,
  daycare_id uuid,
  enrollment_id uuid,
  incident_id uuid,
  category text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  assigned_admin_id uuid,
  resolution_text text,
  confirmation_requested_at timestamp with time zone,
  confirmation_due_at timestamp with time zone,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  closed_at timestamp with time zone,
  closure_reason text,
  version integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_category_check CHECK ((category = ANY (ARRAY['payment'::text, 'daycare_service'::text, 'caregiver_conduct'::text, 'child_safety'::text, 'account_access'::text, 'other'::text]))),
  CONSTRAINT complaints_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text]))),
  CONSTRAINT complaints_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'waiting_for_response'::text, 'waiting_for_confirmation'::text, 'resolved'::text, 'closed'::text]))),
  CONSTRAINT complaints_version_check CHECK ((version > 0))
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daily_report_activities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  report_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  activity_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  details jsonb NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  is_urgent boolean DEFAULT false NOT NULL,
  urgent_reason text,
  sent_at timestamp with time zone,
  draft_ai_job_id uuid,
  version integer DEFAULT 1 NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daily_report_activities_pkey PRIMARY KEY (id),
  CONSTRAINT daily_report_activities_activity_type_check CHECK ((activity_type = ANY (ARRAY['play'::text, 'learning'::text, 'interaction'::text, 'meal'::text, 'sleep'::text, 'other'::text]))),
  CONSTRAINT daily_report_activities_check CHECK (((NOT is_urgent) OR (NULLIF(TRIM(BOTH FROM urgent_reason), ''::text) IS NOT NULL))),
  CONSTRAINT daily_report_activities_check1 CHECK ((((status = 'draft'::text) AND (sent_at IS NULL)) OR ((status = 'sent'::text) AND (sent_at IS NOT NULL)))),
  CONSTRAINT daily_report_activities_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text]))),
  CONSTRAINT daily_report_activities_version_check CHECK ((version > 0))
);
ALTER TABLE public.daily_report_activities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daily_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  report_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daily_reports_enrollment_id_report_date_key UNIQUE (enrollment_id, report_date),
  CONSTRAINT daily_reports_pkey PRIMARY KEY (id)
);
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_delegations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  grantor_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  reason text NOT NULL,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  revocation_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_delegations_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_delegations_check CHECK ((starts_at < ends_at)),
  CONSTRAINT daycare_delegations_check1 CHECK ((grantor_id <> grantee_id))
);
ALTER TABLE public.daycare_delegations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  document_type text NOT NULL,
  version integer NOT NULL,
  document_number text,
  issuer text,
  valid_from date,
  expires_on date,
  submitted_by uuid NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  supersedes_id uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_documents_daycare_id_document_type_version_key UNIQUE (daycare_id, document_type, version),
  CONSTRAINT daycare_documents_id_daycare_id_key UNIQUE (id, daycare_id),
  CONSTRAINT daycare_documents_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_documents_check CHECK (((valid_from IS NULL) OR (expires_on IS NULL) OR (expires_on >= valid_from))),
  CONSTRAINT daycare_documents_check1 CHECK (((supersedes_id IS NULL) OR (supersedes_id <> id))),
  CONSTRAINT daycare_documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'superseded'::text]))),
  CONSTRAINT daycare_documents_version_check CHECK ((version > 0))
);
ALTER TABLE public.daycare_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_listings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_dataset text NOT NULL,
  source_row integer NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  province_code text NOT NULL,
  province_name text NOT NULL,
  city_name text NOT NULL,
  district_name text,
  address text NOT NULL,
  postal_code text,
  facilities_text text DEFAULT ''::text NOT NULL,
  facility_tags text[] DEFAULT '{}'::text[] NOT NULL,
  public_rating numeric(2,1),
  public_rating_source text,
  legal_status text NOT NULL,
  legal_reference text,
  legal_reference_url text,
  npsn text,
  data_quality_notes text[] DEFAULT '{}'::text[] NOT NULL,
  cover_image_path text,
  gallery_paths text[] DEFAULT '{}'::text[] NOT NULL,
  claimed_daycare_id uuid,
  visibility text DEFAULT 'published'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_listings_claimed_daycare_id_key UNIQUE (claimed_daycare_id),
  CONSTRAINT daycare_listings_slug_key UNIQUE (slug),
  CONSTRAINT daycare_listings_source_dataset_source_row_key UNIQUE (source_dataset, source_row),
  CONSTRAINT daycare_listings_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_listings_address_check CHECK ((char_length(btrim(address)) >= 5)),
  CONSTRAINT daycare_listings_check CHECK (((public_rating IS NULL) OR (public_rating_source IS NOT NULL))),
  CONSTRAINT daycare_listings_check1 CHECK (((legal_status <> 'referenced'::text) OR (legal_reference IS NOT NULL))),
  CONSTRAINT daycare_listings_legal_reference_url_check CHECK (((legal_reference_url IS NULL) OR (legal_reference_url ~ '^https://'::text))),
  CONSTRAINT daycare_listings_legal_status_check CHECK ((legal_status = ANY (ARRAY['referenced'::text, 'claimed_without_reference'::text, 'in_review'::text, 'not_available'::text]))),
  CONSTRAINT daycare_listings_name_check CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 200))),
  CONSTRAINT daycare_listings_npsn_check CHECK (((npsn IS NULL) OR (npsn ~ '^[0-9A-Z]{8}$'::text))),
  CONSTRAINT daycare_listings_postal_code_check CHECK (((postal_code IS NULL) OR (postal_code ~ '^[0-9]{5}$'::text))),
  CONSTRAINT daycare_listings_province_code_check CHECK ((province_code ~ '^[0-9]{2}$'::text)),
  CONSTRAINT daycare_listings_public_rating_check CHECK (((public_rating IS NULL) OR ((public_rating >= (0)::numeric) AND (public_rating <= (5)::numeric)))),
  CONSTRAINT daycare_listings_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
  CONSTRAINT daycare_listings_source_dataset_check CHECK ((source_dataset = ANY (ARRAY['dki'::text, 'jabar'::text, 'jatim'::text]))),
  CONSTRAINT daycare_listings_source_row_check CHECK ((source_row > 0)),
  CONSTRAINT daycare_listings_visibility_check CHECK ((visibility = ANY (ARRAY['published'::text, 'hidden'::text])))
);
ALTER TABLE public.daycare_listings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  user_id uuid NOT NULL,
  member_role text NOT NULL,
  status text DEFAULT 'invited'::text NOT NULL,
  verified_by uuid,
  verified_at timestamp with time zone,
  joined_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_members_daycare_id_user_id_key UNIQUE (daycare_id, user_id),
  CONSTRAINT daycare_members_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_members_member_role_check CHECK ((member_role = ANY (ARRAY['manager'::text, 'caregiver'::text]))),
  CONSTRAINT daycare_members_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'pending_verification'::text, 'active'::text, 'inactive'::text])))
);
ALTER TABLE public.daycare_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_payout_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  bank_code text NOT NULL,
  account_number_ciphertext text NOT NULL,
  account_last4 text NOT NULL,
  account_holder text NOT NULL,
  status text NOT NULL,
  approved_by uuid NOT NULL,
  approved_at timestamp with time zone NOT NULL,
  activated_at timestamp with time zone NOT NULL,
  deactivated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_payout_accounts_id_daycare_id_key UNIQUE (id, daycare_id),
  CONSTRAINT daycare_payout_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_payout_accounts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);
ALTER TABLE public.daycare_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_safety_scores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  ai_job_id uuid NOT NULL,
  score numeric(5,2) NOT NULL,
  formula_version text NOT NULL,
  input_snapshot jsonb NOT NULL,
  explanation jsonb NOT NULL,
  status text DEFAULT 'pending_review'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_safety_scores_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_safety_scores_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric))),
  CONSTRAINT daycare_safety_scores_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'published'::text, 'rejected'::text, 'superseded'::text])))
);
ALTER TABLE public.daycare_safety_scores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycare_verifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  ai_job_id uuid,
  ocr_result jsonb,
  analysis_result jsonb,
  decision text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  reason text,
  verified_fields jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycare_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT daycare_verifications_decision_check CHECK ((decision = ANY (ARRAY['pending'::text, 'approved'::text, 'revision_required'::text, 'rejected'::text])))
);
ALTER TABLE public.daycare_verifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.daycares (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
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
  status text DEFAULT 'inactive'::text NOT NULL,
  main_manager_id uuid,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT daycares_slug_key UNIQUE (slug),
  CONSTRAINT daycares_pkey PRIMARY KEY (id),
  CONSTRAINT daycares_daily_capacity_check CHECK ((daily_capacity > 0)),
  CONSTRAINT daycares_latitude_check CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))),
  CONSTRAINT daycares_longitude_check CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))),
  CONSTRAINT daycares_status_check CHECK ((status = ANY (ARRAY['inactive'::text, 'active'::text, 'suspended'::text])))
);
ALTER TABLE public.daycares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.delegation_permissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  delegation_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT delegation_permissions_delegation_id_permission_key UNIQUE (delegation_id, permission),
  CONSTRAINT delegation_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT delegation_permissions_permission_check CHECK ((permission = ANY (ARRAY['manage_caregivers'::text, 'manage_assignments'::text, 'manage_daily_reports'::text, 'confirm_pickup'::text])))
);
ALTER TABLE public.delegation_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.enrollment_consents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  consent_type text NOT NULL,
  policy_version text NOT NULL,
  scope jsonb NOT NULL,
  wording_snapshot text NOT NULL,
  accepted_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT enrollment_consents_pkey PRIMARY KEY (id),
  CONSTRAINT enrollment_consents_consent_type_check CHECK ((consent_type = ANY (ARRAY['service_terms'::text, 'child_data_processing'::text])))
);
ALTER TABLE public.enrollment_consents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.enrollment_service_dates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  daycare_id uuid NOT NULL,
  service_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT enrollment_service_dates_enrollment_id_service_date_key UNIQUE (enrollment_id, service_date),
  CONSTRAINT enrollment_service_dates_pkey PRIMARY KEY (id)
);
ALTER TABLE public.enrollment_service_dates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.enrollment_status_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  actor_type text NOT NULL,
  reason text NOT NULL,
  request_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT enrollment_status_logs_pkey PRIMARY KEY (id),
  CONSTRAINT enrollment_status_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'system'::text, 'gateway'::text]))),
  CONSTRAINT enrollment_status_logs_check CHECK (((actor_id IS NOT NULL) OR (actor_type = ANY (ARRAY['system'::text, 'gateway'::text])))),
  CONSTRAINT enrollment_status_logs_to_status_check CHECK ((to_status = ANY (ARRAY['pending'::text, 'pending_payment'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text, 'expired'::text])))
);
ALTER TABLE public.enrollment_status_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.enrollments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  daycare_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  price_version_id uuid,
  service_date date NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  manager_decision text DEFAULT 'undecided'::text NOT NULL,
  decided_by uuid,
  decided_at timestamp with time zone,
  decision_reason text,
  activation_block_reason text,
  payment_deadline timestamp with time zone,
  approved_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  checked_in_by uuid,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  child_snapshot jsonb,
  version integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT enrollments_id_child_id_key UNIQUE (id, child_id),
  CONSTRAINT enrollments_id_daycare_id_key UNIQUE (id, daycare_id),
  CONSTRAINT enrollments_id_parent_id_key UNIQUE (id, parent_id),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_check CHECK (((status <> 'pending_payment'::text) OR (payment_deadline IS NOT NULL))),
  CONSTRAINT enrollments_manager_decision_check CHECK ((manager_decision = ANY (ARRAY['undecided'::text, 'accepted'::text, 'rejected'::text]))),
  CONSTRAINT enrollments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'pending_payment'::text, 'approved'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text, 'expired'::text]))),
  CONSTRAINT enrollments_version_check CHECK ((version > 0))
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.financial_holds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid,
  transaction_id uuid,
  refund_id uuid,
  payout_id uuid,
  hold_type text NOT NULL,
  complaint_id uuid,
  imposed_by uuid NOT NULL,
  reason text NOT NULL,
  released_by uuid,
  released_at timestamp with time zone,
  release_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT financial_holds_pkey PRIMARY KEY (id),
  CONSTRAINT financial_holds_check CHECK ((num_nonnulls(daycare_id, transaction_id, refund_id, payout_id) = 1)),
  CONSTRAINT financial_holds_check1 CHECK ((((released_at IS NULL) AND (released_by IS NULL)) OR ((released_at IS NOT NULL) AND (released_by IS NOT NULL)))),
  CONSTRAINT financial_holds_hold_type_check CHECK ((hold_type = ANY (ARRAY['payout'::text, 'refund'::text, 'settlement'::text])))
);
ALTER TABLE public.financial_holds ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_ai_analyses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  incident_id uuid NOT NULL,
  ai_job_id uuid NOT NULL,
  urgency text NOT NULL,
  reason text NOT NULL,
  recommendations text NOT NULL,
  analyzed_at timestamp with time zone NOT NULL,
  input_version integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT incident_ai_analyses_ai_job_id_key UNIQUE (ai_job_id),
  CONSTRAINT incident_ai_analyses_pkey PRIMARY KEY (id),
  CONSTRAINT incident_ai_analyses_input_version_check CHECK ((input_version > 0)),
  CONSTRAINT incident_ai_analyses_urgency_check CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text])))
);
ALTER TABLE public.incident_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_parent_acknowledgements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  incident_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  acknowledged_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT incident_parent_acknowledgements_incident_id_key UNIQUE (incident_id),
  CONSTRAINT incident_parent_acknowledgements_pkey PRIMARY KEY (id)
);
ALTER TABLE public.incident_parent_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  description text NOT NULL,
  first_aid text NOT NULL,
  caregiver_urgency text NOT NULL,
  caregiver_reason text NOT NULL,
  effective_urgency text NOT NULL,
  urgency_source text DEFAULT 'caregiver'::text NOT NULL,
  needs_urgency_review boolean DEFAULT false NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  related_incident_id uuid,
  resolved_at timestamp with time zone,
  version integer DEFAULT 1 NOT NULL,
  submission_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT incident_reports_submission_key_key UNIQUE (submission_key),
  CONSTRAINT incident_reports_pkey PRIMARY KEY (id),
  CONSTRAINT incident_reports_caregiver_urgency_check CHECK ((caregiver_urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text]))),
  CONSTRAINT incident_reports_check CHECK (((related_incident_id IS NULL) OR (related_incident_id <> id))),
  CONSTRAINT incident_reports_effective_urgency_check CHECK ((effective_urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text]))),
  CONSTRAINT incident_reports_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'resolved'::text]))),
  CONSTRAINT incident_reports_urgency_source_check CHECK ((urgency_source = ANY (ARRAY['caregiver'::text, 'ai_max'::text, 'manager_override'::text]))),
  CONSTRAINT incident_reports_version_check CHECK ((version > 0))
);
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_status_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  incident_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT incident_status_logs_pkey PRIMARY KEY (id),
  CONSTRAINT incident_status_logs_to_status_check CHECK ((to_status = ANY (ARRAY['new'::text, 'in_progress'::text, 'resolved'::text])))
);
ALTER TABLE public.incident_status_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_urgency_change_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  incident_id uuid NOT NULL,
  old_urgency text NOT NULL,
  new_urgency text NOT NULL,
  source text NOT NULL,
  actor_id uuid,
  analysis_id uuid,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT incident_urgency_change_logs_pkey PRIMARY KEY (id),
  CONSTRAINT incident_urgency_change_logs_check CHECK (((source <> 'manager_override'::text) OR (actor_id IS NOT NULL))),
  CONSTRAINT incident_urgency_change_logs_check1 CHECK (((source <> 'ai_max'::text) OR (analysis_id IS NOT NULL))),
  CONSTRAINT incident_urgency_change_logs_new_urgency_check CHECK ((new_urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text]))),
  CONSTRAINT incident_urgency_change_logs_old_urgency_check CHECK ((old_urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text]))),
  CONSTRAINT incident_urgency_change_logs_source_check CHECK ((source = ANY (ARRAY['ai_max'::text, 'manager_override'::text])))
);
ALTER TABLE public.incident_urgency_change_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.investigations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  complaint_id uuid,
  incident_id uuid,
  assigned_admin_id uuid NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  scope text NOT NULL,
  findings text,
  recommendation text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT investigations_pkey PRIMARY KEY (id),
  CONSTRAINT investigations_check CHECK (((complaint_id IS NOT NULL) OR (incident_id IS NOT NULL))),
  CONSTRAINT investigations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text])))
);
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_delivery_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  reminder_id uuid,
  channel text NOT NULL,
  attempt_number smallint NOT NULL,
  status text NOT NULL,
  provider_reference text,
  attempted_at timestamp with time zone,
  delivered_at timestamp with time zone,
  next_retry_at timestamp with time zone,
  error_code text,
  delivery_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_delivery_logs_delivery_key_key UNIQUE (delivery_key),
  CONSTRAINT notification_delivery_logs_pkey PRIMARY KEY (id),
  CONSTRAINT notification_delivery_logs_attempt_number_check CHECK ((attempt_number > 0)),
  CONSTRAINT notification_delivery_logs_channel_check CHECK ((channel = ANY (ARRAY['in_app'::text, 'email'::text, 'whatsapp'::text, 'sms'::text]))),
  CONSTRAINT notification_delivery_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sending'::text, 'sent'::text, 'delivered'::text, 'failed'::text])))
);
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_receipts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL,
  seen_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_receipts_notification_id_key UNIQUE (notification_id),
  CONSTRAINT notification_receipts_pkey PRIMARY KEY (id)
);
ALTER TABLE public.notification_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notification_reminders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  reminder_kind text NOT NULL,
  sequence integer NOT NULL,
  due_at timestamp with time zone NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  claimed_at timestamp with time zone,
  lease_until timestamp with time zone,
  sent_at timestamp with time zone,
  deduplication_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_reminders_deduplication_key_key UNIQUE (deduplication_key),
  CONSTRAINT notification_reminders_id_notification_id_key UNIQUE (id, notification_id),
  CONSTRAINT notification_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT notification_reminders_reminder_kind_check CHECK ((reminder_kind = ANY (ARRAY['manager_urgent_review'::text, 'parent_urgent_read'::text, 'parent_incident_ack'::text, 'legal_expiry'::text]))),
  CONSTRAINT notification_reminders_sequence_check CHECK ((sequence > 0)),
  CONSTRAINT notification_reminders_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'claimed'::text, 'sent'::text, 'cancelled'::text, 'failed'::text])))
);
ALTER TABLE public.notification_reminders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
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
  priority text DEFAULT 'normal'::text NOT NULL,
  deduplication_key text NOT NULL,
  available_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notifications_deduplication_key_key UNIQUE (deduplication_key),
  CONSTRAINT notifications_id_recipient_id_key UNIQUE (id, recipient_id),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text])))
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payment_details (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  method_details jsonb NOT NULL,
  provider_fee_amount bigint,
  provider_receipt_reference text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT payment_details_transaction_id_key UNIQUE (transaction_id),
  CONSTRAINT payment_details_pkey PRIMARY KEY (id),
  CONSTRAINT payment_details_provider_fee_amount_check CHECK (((provider_fee_amount IS NULL) OR (provider_fee_amount >= 0)))
);
ALTER TABLE public.payment_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payment_webhook_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  provider text NOT NULL,
  event_id text NOT NULL,
  resource_kind text NOT NULL,
  provider_resource_id text NOT NULL,
  transaction_id uuid,
  refund_id uuid,
  payout_id uuid,
  payload_digest text NOT NULL,
  sanitized_payload jsonb NOT NULL,
  verified_at timestamp with time zone NOT NULL,
  processing_status text DEFAULT 'received'::text NOT NULL,
  processed_at timestamp with time zone,
  error_code text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT payment_webhook_events_provider_event_id_key UNIQUE (provider, event_id),
  CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT payment_webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['received'::text, 'processed'::text, 'failed'::text, 'needs_review'::text]))),
  CONSTRAINT payment_webhook_events_resource_kind_check CHECK ((resource_kind = ANY (ARRAY['payment'::text, 'refund'::text, 'payout'::text])))
);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payout_account_change_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  current_account_id uuid,
  proposed_bank_code text NOT NULL,
  proposed_number_ciphertext text NOT NULL,
  proposed_last4 text NOT NULL,
  proposed_holder text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  reason text,
  result_account_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT payout_account_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT payout_account_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);
ALTER TABLE public.payout_account_change_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payout_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  payout_id uuid NOT NULL,
  charge_id uuid NOT NULL,
  gross_amount bigint NOT NULL,
  commission_amount bigint NOT NULL,
  refund_deduction bigint NOT NULL,
  other_deduction bigint NOT NULL,
  net_amount bigint NOT NULL,
  calculation_snapshot jsonb NOT NULL,
  reservation_status text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT payout_items_pkey PRIMARY KEY (id),
  CONSTRAINT payout_items_check CHECK ((net_amount = (((gross_amount - commission_amount) - refund_deduction) - other_deduction))),
  CONSTRAINT payout_items_commission_amount_check CHECK ((commission_amount >= 0)),
  CONSTRAINT payout_items_gross_amount_check CHECK ((gross_amount >= 0)),
  CONSTRAINT payout_items_net_amount_check CHECK ((net_amount >= 0)),
  CONSTRAINT payout_items_other_deduction_check CHECK ((other_deduction >= 0)),
  CONSTRAINT payout_items_refund_deduction_check CHECK ((refund_deduction >= 0)),
  CONSTRAINT payout_items_reservation_status_check CHECK ((reservation_status = ANY (ARRAY['reserved'::text, 'released'::text, 'paid'::text])))
);
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  payout_account_id uuid NOT NULL,
  account_snapshot jsonb NOT NULL,
  amount bigint NOT NULL,
  currency character(3) NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  provider text,
  provider_reference text,
  idempotency_key text NOT NULL,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT payouts_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT payouts_pkey PRIMARY KEY (id),
  CONSTRAINT payouts_check CHECK (((status = 'draft'::text) OR (amount > 0))),
  CONSTRAINT payouts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'held'::text, 'approved'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'cancelled'::text])))
);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pickup_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  enrollment_id uuid NOT NULL,
  authorization_id uuid,
  collector_snapshot jsonb NOT NULL,
  verification_status text NOT NULL,
  verification_note text NOT NULL,
  confirmed_by uuid NOT NULL,
  verified_at timestamp with time zone NOT NULL,
  handed_over_at timestamp with time zone,
  late_minutes integer NOT NULL,
  request_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT pickup_records_request_id_key UNIQUE (request_id),
  CONSTRAINT pickup_records_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_records_check CHECK (((handed_over_at IS NULL) OR (verification_status = 'verified'::text))),
  CONSTRAINT pickup_records_late_minutes_check CHECK ((late_minutes >= 0)),
  CONSTRAINT pickup_records_verification_status_check CHECK ((verification_status = ANY (ARRAY['failed'::text, 'verified'::text])))
);
ALTER TABLE public.pickup_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.refunds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  complaint_id uuid,
  requested_by uuid NOT NULL,
  decision text DEFAULT 'pending'::text NOT NULL,
  amount bigint DEFAULT 0 NOT NULL,
  reason text NOT NULL,
  decided_by uuid,
  decided_at timestamp with time zone,
  status text DEFAULT 'requested'::text NOT NULL,
  provider_reference text,
  idempotency_key text NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT refunds_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_amount_check CHECK ((amount >= 0)),
  CONSTRAINT refunds_check CHECK (((decision <> 'none'::text) OR ((amount = 0) AND (status = 'rejected'::text)))),
  CONSTRAINT refunds_check1 CHECK (((decision <> ALL (ARRAY['full'::text, 'partial'::text])) OR (amount > 0))),
  CONSTRAINT refunds_decision_check CHECK ((decision = ANY (ARRAY['pending'::text, 'full'::text, 'partial'::text, 'none'::text]))),
  CONSTRAINT refunds_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'processing'::text, 'succeeded'::text, 'failed'::text])))
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.report_change_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  activity_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  before_title text NOT NULL,
  after_title text NOT NULL,
  before_body text NOT NULL,
  after_body text NOT NULL,
  reason text NOT NULL,
  from_version integer NOT NULL,
  to_version integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT report_change_logs_pkey PRIMARY KEY (id),
  CONSTRAINT report_change_logs_check CHECK (((from_version > 0) AND (to_version > from_version)))
);
ALTER TABLE public.report_change_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.review_replies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  review_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  published_version_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT review_replies_id_published_version_id_key UNIQUE (id, published_version_id),
  CONSTRAINT review_replies_review_id_key UNIQUE (review_id),
  CONSTRAINT review_replies_pkey PRIMARY KEY (id)
);
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.review_reply_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reply_id uuid NOT NULL,
  version integer NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  draft_ai_job_id uuid,
  moderation_ai_job_id uuid,
  submitted_by uuid NOT NULL,
  moderated_by uuid,
  moderated_at timestamp with time zone,
  moderation_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT review_reply_versions_reply_id_id_key UNIQUE (reply_id, id),
  CONSTRAINT review_reply_versions_reply_id_version_key UNIQUE (reply_id, version),
  CONSTRAINT review_reply_versions_pkey PRIMARY KEY (id),
  CONSTRAINT review_reply_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'held'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT review_reply_versions_version_check CHECK ((version > 0))
);
ALTER TABLE public.review_reply_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.review_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  review_id uuid NOT NULL,
  version integer NOT NULL,
  rating smallint NOT NULL,
  body text NOT NULL,
  moderation_status text DEFAULT 'pending'::text NOT NULL,
  ai_job_id uuid,
  moderated_by uuid,
  moderated_at timestamp with time zone,
  moderation_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT review_versions_review_id_id_key UNIQUE (review_id, id),
  CONSTRAINT review_versions_review_id_version_key UNIQUE (review_id, version),
  CONSTRAINT review_versions_pkey PRIMARY KEY (id),
  CONSTRAINT review_versions_moderation_status_check CHECK ((moderation_status = ANY (ARRAY['pending'::text, 'held'::text, 'approved'::text, 'rejected'::text]))),
  CONSTRAINT review_versions_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT review_versions_version_check CHECK ((version > 0))
);
ALTER TABLE public.review_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  parent_id uuid NOT NULL,
  daycare_id uuid NOT NULL,
  qualifying_enrollment_id uuid NOT NULL,
  published_version_id uuid,
  revision_allowed_by uuid,
  revision_complaint_id uuid,
  revision_granted_at timestamp with time zone,
  revision_used_at timestamp with time zone,
  withdrawn_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reviews_id_published_version_id_key UNIQUE (id, published_version_id),
  CONSTRAINT reviews_parent_id_daycare_id_key UNIQUE (parent_id, daycare_id),
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service_offerings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  name text NOT NULL,
  service_type text NOT NULL,
  description text NOT NULL,
  min_age_months integer NOT NULL,
  max_age_months integer NOT NULL,
  is_active boolean NOT NULL,
  published_price_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT service_offerings_id_daycare_unique UNIQUE (id, daycare_id),
  CONSTRAINT service_offerings_pkey PRIMARY KEY (id),
  CONSTRAINT service_offerings_check CHECK (((min_age_months >= 0) AND (max_age_months >= min_age_months))),
  CONSTRAINT service_offerings_service_type_check CHECK ((service_type = ANY (ARRAY['daily'::text, 'monthly'::text])))
);
ALTER TABLE public.service_offerings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service_price_versions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  offering_id uuid NOT NULL,
  version integer NOT NULL,
  service_amount bigint NOT NULL,
  currency character(3) NOT NULL,
  late_pickup_terms jsonb NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  proposed_by uuid NOT NULL,
  decided_by uuid,
  decided_at timestamp with time zone,
  decision_reason text,
  effective_from timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT service_price_versions_id_offering_unique UNIQUE (id, offering_id),
  CONSTRAINT service_price_versions_offering_id_id_key UNIQUE (offering_id, id),
  CONSTRAINT service_price_versions_offering_id_version_key UNIQUE (offering_id, version),
  CONSTRAINT service_price_versions_pkey PRIMARY KEY (id),
  CONSTRAINT service_price_versions_service_amount_check CHECK ((service_amount >= 0)),
  CONSTRAINT service_price_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'superseded'::text]))),
  CONSTRAINT service_price_versions_version_check CHECK ((version > 0))
);
ALTER TABLE public.service_price_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.staff_invitations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  daycare_id uuid NOT NULL,
  email text NOT NULL,
  invited_role text NOT NULL,
  token_hash text NOT NULL,
  invited_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  accepted_by uuid,
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT staff_invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT staff_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT staff_invitations_invited_role_check CHECK ((invited_role = ANY (ARRAY['manager'::text, 'caregiver'::text])))
);
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.system_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  version integer NOT NULL,
  value jsonb NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  effective_from timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT system_settings_key_version_key UNIQUE (key, version),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id),
  CONSTRAINT system_settings_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'retired'::text]))),
  CONSTRAINT system_settings_version_check CHECK ((version > 0))
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  charge_id uuid NOT NULL,
  provider text NOT NULL,
  provider_transaction_id text,
  idempotency_key text NOT NULL,
  method text NOT NULL,
  amount bigint NOT NULL,
  currency character(3) NOT NULL,
  status text DEFAULT 'created'::text NOT NULL,
  reconciliation_status text DEFAULT 'normal'::text NOT NULL,
  reconciliation_reason text,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT transactions_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_method_check CHECK ((method = ANY (ARRAY['va'::text, 'qris'::text, 'ewallet'::text]))),
  CONSTRAINT transactions_reconciliation_status_check CHECK ((reconciliation_status = ANY (ARRAY['normal'::text, 'needs_review'::text, 'reviewed'::text]))),
  CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['created'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'expired'::text])))
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.users (
  id uuid NOT NULL,
  role text DEFAULT 'parent'::text NOT NULL,
  full_name text,
  phone character varying,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['parent'::text, 'manager'::text, 'caregiver'::text, 'admin'::text]))),
  CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ===================== FOREIGN KEY =====================
ALTER TABLE public.account_sanctions ADD CONSTRAINT account_sanctions_imposed_by_fkey FOREIGN KEY (imposed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.account_sanctions ADD CONSTRAINT account_sanctions_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE RESTRICT;
ALTER TABLE public.account_sanctions ADD CONSTRAINT account_sanctions_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.account_sanctions ADD CONSTRAINT account_sanctions_target_daycare_id_fkey FOREIGN KEY (target_daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.account_sanctions ADD CONSTRAINT account_sanctions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.activity_acknowledgements ADD CONSTRAINT activity_acknowledgements_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES daily_report_activities(id) ON DELETE RESTRICT;
ALTER TABLE public.activity_acknowledgements ADD CONSTRAINT activity_acknowledgements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_audit_log_id_fkey FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE RESTRICT;
ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES daily_report_activities(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_attachment_fkey FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_document_id_fkey FOREIGN KEY (document_id) REFERENCES daycare_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_reply_version_id_fkey FOREIGN KEY (reply_version_id) REFERENCES review_reply_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_retry_of_id_fkey FOREIGN KEY (retry_of_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.ai_jobs ADD CONSTRAINT ai_jobs_review_version_id_fkey FOREIGN KEY (review_version_id) REFERENCES review_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.attachment_variants ADD CONSTRAINT attachment_variants_ai_job_id_fkey FOREIGN KEY (ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.attachment_variants ADD CONSTRAINT attachment_variants_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE RESTRICT;
ALTER TABLE public.attachment_variants ADD CONSTRAINT attachment_variants_audience_child_id_fkey FOREIGN KEY (audience_child_id) REFERENCES children(child_id) ON DELETE RESTRICT;
ALTER TABLE public.attachment_variants ADD CONSTRAINT attachment_variants_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES daily_report_activities(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_document_id_fkey FOREIGN KEY (document_id) REFERENCES daycare_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_payout_change_id_fkey FOREIGN KEY (payout_change_id) REFERENCES payout_account_change_requests(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_pickup_id_fkey FOREIGN KEY (pickup_id) REFERENCES pickup_records(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_sanction_id_fkey FOREIGN KEY (sanction_id) REFERENCES account_sanctions(id) ON DELETE RESTRICT;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.authorized_pickups ADD CONSTRAINT authorized_pickups_child_id_fkey FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE RESTRICT;
ALTER TABLE public.authorized_pickups ADD CONSTRAINT authorized_pickups_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.authorized_pickups ADD CONSTRAINT authorized_pickups_enrollment_id_child_id_fkey FOREIGN KEY (enrollment_id, child_id) REFERENCES enrollments(id, child_id) ON DELETE RESTRICT;
ALTER TABLE public.caregiver_assignments ADD CONSTRAINT caregiver_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.caregiver_assignments ADD CONSTRAINT caregiver_assignments_caregiver_id_fkey FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.caregiver_assignments ADD CONSTRAINT caregiver_assignments_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.charges ADD CONSTRAINT charges_commission_rule_id_fkey FOREIGN KEY (commission_rule_id) REFERENCES commission_rules(id) ON DELETE RESTRICT;
ALTER TABLE public.charges ADD CONSTRAINT charges_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.charges ADD CONSTRAINT charges_paid_transaction_fkey FOREIGN KEY (paid_transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.charges ADD CONSTRAINT charges_price_version_id_fkey FOREIGN KEY (price_version_id) REFERENCES service_price_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_change_logs ADD CONSTRAINT child_health_change_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_change_logs ADD CONSTRAINT child_health_change_logs_child_id_fkey FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_correction_requests ADD CONSTRAINT child_health_correction_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_correction_requests ADD CONSTRAINT child_health_correction_requests_enrollment_id_child_id_fkey FOREIGN KEY (enrollment_id, child_id) REFERENCES enrollments(id, child_id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_correction_requests ADD CONSTRAINT child_health_correction_requests_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_profiles ADD CONSTRAINT child_health_profiles_child_id_fkey FOREIGN KEY (child_id) REFERENCES children(child_id) ON DELETE RESTRICT;
ALTER TABLE public.child_health_profiles ADD CONSTRAINT child_health_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.children ADD CONSTRAINT children_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.commission_rules ADD CONSTRAINT commission_rules_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.commission_rules ADD CONSTRAINT commission_rules_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.commission_rules ADD CONSTRAINT commission_rules_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES service_offerings(id) ON DELETE RESTRICT;
ALTER TABLE public.complaint_assignments ADD CONSTRAINT complaint_assignments_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.complaint_assignments ADD CONSTRAINT complaint_assignments_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.complaint_assignments ADD CONSTRAINT complaint_assignments_from_admin_id_fkey FOREIGN KEY (from_admin_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.complaint_assignments ADD CONSTRAINT complaint_assignments_to_admin_id_fkey FOREIGN KEY (to_admin_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.complaint_status_logs ADD CONSTRAINT complaint_status_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.complaint_status_logs ADD CONSTRAINT complaint_status_logs_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daily_report_activities ADD CONSTRAINT daily_report_activities_caregiver_id_fkey FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daily_report_activities ADD CONSTRAINT daily_report_activities_draft_ai_job_fkey FOREIGN KEY (draft_ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.daily_report_activities ADD CONSTRAINT daily_report_activities_report_id_fkey FOREIGN KEY (report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_delegations ADD CONSTRAINT daycare_delegations_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_delegations ADD CONSTRAINT daycare_delegations_grantee_id_fkey FOREIGN KEY (grantee_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_delegations ADD CONSTRAINT daycare_delegations_grantor_id_fkey FOREIGN KEY (grantor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_delegations ADD CONSTRAINT daycare_delegations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_documents ADD CONSTRAINT daycare_documents_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_documents ADD CONSTRAINT daycare_documents_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_documents ADD CONSTRAINT daycare_documents_supersedes_id_daycare_id_fkey FOREIGN KEY (supersedes_id, daycare_id) REFERENCES daycare_documents(id, daycare_id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_listings ADD CONSTRAINT daycare_listings_claimed_daycare_id_fkey FOREIGN KEY (claimed_daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_members ADD CONSTRAINT daycare_members_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_members ADD CONSTRAINT daycare_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_members ADD CONSTRAINT daycare_members_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_payout_accounts ADD CONSTRAINT daycare_payout_accounts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_payout_accounts ADD CONSTRAINT daycare_payout_accounts_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_safety_scores ADD CONSTRAINT daycare_safety_scores_ai_job_fkey FOREIGN KEY (ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_safety_scores ADD CONSTRAINT daycare_safety_scores_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_safety_scores ADD CONSTRAINT daycare_safety_scores_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_verifications ADD CONSTRAINT daycare_verifications_ai_job_fkey FOREIGN KEY (ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_verifications ADD CONSTRAINT daycare_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES daycare_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.daycare_verifications ADD CONSTRAINT daycare_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.daycares ADD CONSTRAINT daycares_main_manager_id_fkey FOREIGN KEY (main_manager_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.delegation_permissions ADD CONSTRAINT delegation_permissions_delegation_id_fkey FOREIGN KEY (delegation_id) REFERENCES daycare_delegations(id) ON DELETE RESTRICT;
ALTER TABLE public.enrollment_consents ADD CONSTRAINT enrollment_consents_enrollment_id_parent_id_fkey FOREIGN KEY (enrollment_id, parent_id) REFERENCES enrollments(id, parent_id) ON DELETE RESTRICT;
ALTER TABLE public.enrollment_service_dates ADD CONSTRAINT enrollment_service_dates_enrollment_id_daycare_id_fkey FOREIGN KEY (enrollment_id, daycare_id) REFERENCES enrollments(id, daycare_id) ON DELETE RESTRICT;
ALTER TABLE public.enrollment_status_logs ADD CONSTRAINT enrollment_status_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.enrollment_status_logs ADD CONSTRAINT enrollment_status_logs_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_child_id_parent_id_fkey FOREIGN KEY (child_id, parent_id) REFERENCES children(child_id, parent_id) ON DELETE RESTRICT;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_offering_id_daycare_id_fkey FOREIGN KEY (offering_id, daycare_id) REFERENCES service_offerings(id, daycare_id) ON DELETE RESTRICT;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_offering_id_price_version_id_fkey FOREIGN KEY (offering_id, price_version_id) REFERENCES service_price_versions(offering_id, id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_imposed_by_fkey FOREIGN KEY (imposed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_released_by_fkey FOREIGN KEY (released_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_holds ADD CONSTRAINT financial_holds_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_ai_analyses ADD CONSTRAINT incident_ai_analyses_ai_job_fkey FOREIGN KEY (ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_ai_analyses ADD CONSTRAINT incident_ai_analyses_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_parent_acknowledgements ADD CONSTRAINT incident_parent_acknowledgements_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_parent_acknowledgements ADD CONSTRAINT incident_parent_acknowledgements_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_reports ADD CONSTRAINT incident_reports_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_reports ADD CONSTRAINT incident_reports_related_incident_id_fkey FOREIGN KEY (related_incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_reports ADD CONSTRAINT incident_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_status_logs ADD CONSTRAINT incident_status_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_status_logs ADD CONSTRAINT incident_status_logs_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_urgency_change_logs ADD CONSTRAINT incident_urgency_change_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_urgency_change_logs ADD CONSTRAINT incident_urgency_change_logs_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES incident_ai_analyses(id) ON DELETE RESTRICT;
ALTER TABLE public.incident_urgency_change_logs ADD CONSTRAINT incident_urgency_change_logs_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.investigations ADD CONSTRAINT investigations_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.investigations ADD CONSTRAINT investigations_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.investigations ADD CONSTRAINT investigations_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.notification_delivery_logs ADD CONSTRAINT notification_delivery_logs_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE RESTRICT;
ALTER TABLE public.notification_delivery_logs ADD CONSTRAINT notification_delivery_logs_reminder_id_notification_id_fkey FOREIGN KEY (reminder_id, notification_id) REFERENCES notification_reminders(id, notification_id) ON DELETE RESTRICT;
ALTER TABLE public.notification_receipts ADD CONSTRAINT notification_receipts_notification_id_user_id_fkey FOREIGN KEY (notification_id, user_id) REFERENCES notifications(id, recipient_id) ON DELETE RESTRICT;
ALTER TABLE public.notification_reminders ADD CONSTRAINT notification_reminders_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES daily_report_activities(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES daycare_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_health_change_id_fkey FOREIGN KEY (health_change_id) REFERENCES child_health_change_logs(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_details ADD CONSTRAINT payment_details_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_webhook_events ADD CONSTRAINT payment_webhook_events_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_webhook_events ADD CONSTRAINT payment_webhook_events_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_webhook_events ADD CONSTRAINT payment_webhook_events_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_account_change_requests ADD CONSTRAINT payout_account_change_request_current_account_id_daycare_i_fkey FOREIGN KEY (current_account_id, daycare_id) REFERENCES daycare_payout_accounts(id, daycare_id) ON DELETE RESTRICT;
ALTER TABLE public.payout_account_change_requests ADD CONSTRAINT payout_account_change_request_result_account_id_daycare_id_fkey FOREIGN KEY (result_account_id, daycare_id) REFERENCES daycare_payout_accounts(id, daycare_id) ON DELETE RESTRICT;
ALTER TABLE public.payout_account_change_requests ADD CONSTRAINT payout_account_change_requests_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_account_change_requests ADD CONSTRAINT payout_account_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_account_change_requests ADD CONSTRAINT payout_account_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_items ADD CONSTRAINT payout_items_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE RESTRICT;
ALTER TABLE public.payout_items ADD CONSTRAINT payout_items_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE RESTRICT;
ALTER TABLE public.payouts ADD CONSTRAINT payouts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.payouts ADD CONSTRAINT payouts_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.payouts ADD CONSTRAINT payouts_payout_account_id_daycare_id_fkey FOREIGN KEY (payout_account_id, daycare_id) REFERENCES daycare_payout_accounts(id, daycare_id) ON DELETE RESTRICT;
ALTER TABLE public.pickup_records ADD CONSTRAINT pickup_records_authorization_id_fkey FOREIGN KEY (authorization_id) REFERENCES authorized_pickups(id) ON DELETE RESTRICT;
ALTER TABLE public.pickup_records ADD CONSTRAINT pickup_records_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.pickup_records ADD CONSTRAINT pickup_records_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
ALTER TABLE public.report_change_logs ADD CONSTRAINT report_change_logs_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES daily_report_activities(id) ON DELETE RESTRICT;
ALTER TABLE public.report_change_logs ADD CONSTRAINT report_change_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_published_version_fkey FOREIGN KEY (id, published_version_id) REFERENCES review_reply_versions(reply_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE RESTRICT;
ALTER TABLE public.review_reply_versions ADD CONSTRAINT review_reply_versions_draft_ai_job_fkey FOREIGN KEY (draft_ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.review_reply_versions ADD CONSTRAINT review_reply_versions_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.review_reply_versions ADD CONSTRAINT review_reply_versions_moderation_ai_job_fkey FOREIGN KEY (moderation_ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.review_reply_versions ADD CONSTRAINT review_reply_versions_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES review_replies(id) ON DELETE RESTRICT;
ALTER TABLE public.review_reply_versions ADD CONSTRAINT review_reply_versions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.review_versions ADD CONSTRAINT review_versions_ai_job_fkey FOREIGN KEY (ai_job_id) REFERENCES ai_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.review_versions ADD CONSTRAINT review_versions_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.review_versions ADD CONSTRAINT review_versions_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE RESTRICT;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_published_version_fkey FOREIGN KEY (id, published_version_id) REFERENCES review_versions(review_id, id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_qualifying_enrollment_id_fkey FOREIGN KEY (qualifying_enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_revision_allowed_by_fkey FOREIGN KEY (revision_allowed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_revision_complaint_fkey FOREIGN KEY (revision_complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT;
ALTER TABLE public.service_offerings ADD CONSTRAINT service_offerings_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.service_offerings ADD CONSTRAINT service_offerings_published_price_fkey FOREIGN KEY (id, published_price_id) REFERENCES service_price_versions(offering_id, id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.service_price_versions ADD CONSTRAINT service_price_versions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.service_price_versions ADD CONSTRAINT service_price_versions_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES service_offerings(id) ON DELETE RESTRICT;
ALTER TABLE public.service_price_versions ADD CONSTRAINT service_price_versions_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.staff_invitations ADD CONSTRAINT staff_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.staff_invitations ADD CONSTRAINT staff_invitations_daycare_id_fkey FOREIGN KEY (daycare_id) REFERENCES daycares(id) ON DELETE RESTRICT;
ALTER TABLE public.staff_invitations ADD CONSTRAINT staff_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES charges(id) ON DELETE RESTRICT;
ALTER TABLE public.users ADD CONSTRAINT users_auth_user_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- ===================== INDEX (selain PK/UNIQUE constraint) =====================
CREATE INDEX account_sanctions_daycare_idx ON public.account_sanctions USING btree (target_daycare_id, starts_at);
CREATE INDEX account_sanctions_user_idx ON public.account_sanctions USING btree (target_user_id, starts_at);
CREATE INDEX admin_actions_complaint_idx ON public.admin_actions USING btree (complaint_id);
CREATE INDEX admin_actions_investigation_idx ON public.admin_actions USING btree (investigation_id);
CREATE INDEX ai_jobs_feature_created_idx ON public.ai_jobs USING btree (feature, created_at);
CREATE INDEX ai_jobs_status_created_idx ON public.ai_jobs USING btree (status, created_at);
CREATE INDEX attachment_variants_attachment_idx ON public.attachment_variants USING btree (attachment_id);
CREATE INDEX attachments_activity_idx ON public.attachments USING btree (activity_id);
CREATE INDEX attachments_complaint_idx ON public.attachments USING btree (complaint_id);
CREATE INDEX attachments_incident_idx ON public.attachments USING btree (incident_id);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (actor_id, created_at);
CREATE INDEX audit_logs_daycare_idx ON public.audit_logs USING btree (daycare_id, created_at);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id, created_at);
CREATE INDEX authorized_pickups_child_idx ON public.authorized_pickups USING btree (child_id);
CREATE INDEX caregiver_assignments_caregiver_idx ON public.caregiver_assignments USING btree (caregiver_id);
CREATE INDEX caregiver_assignments_enrollment_idx ON public.caregiver_assignments USING btree (enrollment_id);
CREATE UNIQUE INDEX charges_one_service_charge_per_enrollment ON public.charges USING btree (enrollment_id) WHERE (charge_type = 'service'::text);
CREATE INDEX charges_status_due_idx ON public.charges USING btree (status, due_at);
CREATE INDEX child_health_correction_requests_child_idx ON public.child_health_correction_requests USING btree (child_id, status);
CREATE INDEX commission_rules_scope_idx ON public.commission_rules USING btree (daycare_id, offering_id, category_code);
CREATE INDEX complaint_assignments_complaint_idx ON public.complaint_assignments USING btree (complaint_id, created_at);
CREATE INDEX complaint_status_logs_complaint_idx ON public.complaint_status_logs USING btree (complaint_id, created_at);
CREATE INDEX complaints_assigned_admin_idx ON public.complaints USING btree (assigned_admin_id, status);
CREATE INDEX complaints_daycare_status_idx ON public.complaints USING btree (daycare_id, status);
CREATE INDEX complaints_submitter_idx ON public.complaints USING btree (submitted_by, created_at);
CREATE INDEX daily_report_activities_caregiver_idx ON public.daily_report_activities USING btree (caregiver_id);
CREATE INDEX daily_report_activities_report_idx ON public.daily_report_activities USING btree (report_id, occurred_at);
CREATE INDEX daily_reports_enrollment_idx ON public.daily_reports USING btree (enrollment_id, report_date);
CREATE INDEX daycare_delegations_daycare_id_idx ON public.daycare_delegations USING btree (daycare_id);
CREATE INDEX daycare_documents_daycare_type_idx ON public.daycare_documents USING btree (daycare_id, document_type, status);
CREATE INDEX daycare_listings_facility_tags_idx ON public.daycare_listings USING gin (facility_tags);
CREATE INDEX daycare_listings_legal_idx ON public.daycare_listings USING btree (legal_status);
CREATE INDEX daycare_listings_region_idx ON public.daycare_listings USING btree (province_code, city_name, district_name);
CREATE UNIQUE INDEX daycare_members_one_active_manager ON public.daycare_members USING btree (daycare_id) WHERE ((member_role = 'manager'::text) AND (status = 'active'::text));
CREATE INDEX daycare_members_user_id_idx ON public.daycare_members USING btree (user_id);
CREATE UNIQUE INDEX daycare_payout_accounts_one_active ON public.daycare_payout_accounts USING btree (daycare_id) WHERE (status = 'active'::text);
CREATE INDEX daycare_safety_scores_daycare_idx ON public.daycare_safety_scores USING btree (daycare_id, created_at);
CREATE UNIQUE INDEX daycare_safety_scores_one_published ON public.daycare_safety_scores USING btree (daycare_id) WHERE (status = 'published'::text);
CREATE INDEX daycare_verifications_document_idx ON public.daycare_verifications USING btree (document_id, created_at);
CREATE INDEX enrollment_consents_enrollment_idx ON public.enrollment_consents USING btree (enrollment_id, consent_type);
CREATE INDEX enrollment_service_dates_capacity_idx ON public.enrollment_service_dates USING btree (daycare_id, service_date, enrollment_id);
CREATE INDEX enrollment_status_logs_enrollment_idx ON public.enrollment_status_logs USING btree (enrollment_id, created_at);
CREATE INDEX enrollments_daycare_status_date_idx ON public.enrollments USING btree (daycare_id, status, service_date);
CREATE UNIQUE INDEX enrollments_one_checkout_or_approved_per_child ON public.enrollments USING btree (child_id) WHERE (status = ANY (ARRAY['pending_payment'::text, 'approved'::text]));
CREATE INDEX enrollments_parent_id_idx ON public.enrollments USING btree (parent_id);
CREATE INDEX financial_holds_daycare_idx ON public.financial_holds USING btree (daycare_id, released_at);
CREATE INDEX financial_holds_payout_idx ON public.financial_holds USING btree (payout_id, released_at);
CREATE INDEX financial_holds_refund_idx ON public.financial_holds USING btree (refund_id, released_at);
CREATE INDEX financial_holds_transaction_idx ON public.financial_holds USING btree (transaction_id, released_at);
CREATE INDEX incident_ai_analyses_incident_idx ON public.incident_ai_analyses USING btree (incident_id, analyzed_at);
CREATE INDEX incident_reports_enrollment_idx ON public.incident_reports USING btree (enrollment_id, occurred_at);
CREATE INDEX incident_reports_status_idx ON public.incident_reports USING btree (status, created_at);
CREATE INDEX incident_status_logs_incident_idx ON public.incident_status_logs USING btree (incident_id, created_at);
CREATE INDEX incident_urgency_change_logs_incident_idx ON public.incident_urgency_change_logs USING btree (incident_id, created_at);
CREATE INDEX investigations_complaint_idx ON public.investigations USING btree (complaint_id);
CREATE INDEX investigations_incident_idx ON public.investigations USING btree (incident_id);
CREATE INDEX notification_delivery_logs_notification_idx ON public.notification_delivery_logs USING btree (notification_id, attempted_at);
CREATE INDEX notification_reminders_due_idx ON public.notification_reminders USING btree (status, due_at);
CREATE INDEX notifications_recipient_available_idx ON public.notifications USING btree (recipient_id, available_at);
CREATE INDEX payment_details_transaction_idx ON public.payment_details USING btree (transaction_id);
CREATE INDEX payment_webhook_events_processing_idx ON public.payment_webhook_events USING btree (processing_status, created_at);
CREATE INDEX payout_account_change_requests_daycare_idx ON public.payout_account_change_requests USING btree (daycare_id, status);
CREATE UNIQUE INDEX payout_items_one_reserved_or_paid_per_charge ON public.payout_items USING btree (charge_id) WHERE (reservation_status = ANY (ARRAY['reserved'::text, 'paid'::text]));
CREATE INDEX payout_items_payout_idx ON public.payout_items USING btree (payout_id);
CREATE INDEX payouts_daycare_status_idx ON public.payouts USING btree (daycare_id, status, created_at);
CREATE INDEX pickup_records_enrollment_idx ON public.pickup_records USING btree (enrollment_id, created_at);
CREATE UNIQUE INDEX pickup_records_one_handover_per_enrollment ON public.pickup_records USING btree (enrollment_id) WHERE (handed_over_at IS NOT NULL);
CREATE INDEX refunds_transaction_idx ON public.refunds USING btree (transaction_id, created_at);
CREATE INDEX report_change_logs_activity_idx ON public.report_change_logs USING btree (activity_id, created_at);
CREATE INDEX review_reply_versions_reply_idx ON public.review_reply_versions USING btree (reply_id, version);
CREATE INDEX review_versions_review_idx ON public.review_versions USING btree (review_id, version);
CREATE INDEX service_offerings_daycare_id_idx ON public.service_offerings USING btree (daycare_id);
CREATE INDEX service_price_versions_offering_id_idx ON public.service_price_versions USING btree (offering_id);
CREATE INDEX staff_invitations_daycare_id_idx ON public.staff_invitations USING btree (daycare_id);
CREATE INDEX transactions_charge_idx ON public.transactions USING btree (charge_id, created_at);
CREATE UNIQUE INDEX transactions_provider_id_unique ON public.transactions USING btree (provider, provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL);

-- ===================== FUNGSI =====================
CREATE OR REPLACE FUNCTION public.app_acknowledge_activity(p_activity_id uuid, p_ack_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_activity public.daily_report_activities%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
BEGIN
  IF COALESCE(p_ack_type, '') NOT IN ('manager_review', 'parent_read') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ack_type';
  END IF;
  SELECT * INTO v_activity
  FROM public.daily_report_activities
  WHERE id = p_activity_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'activity_not_found';
  END IF;
  SELECT e.* INTO v_enrollment
  FROM public.daily_reports AS dr
  JOIN public.enrollments AS e ON e.id = dr.enrollment_id
  WHERE dr.id = v_activity.report_id;

  IF (p_ack_type = 'parent_read'
      AND (v_enrollment.parent_id <> auth.uid() OR v_activity.status <> 'sent'))
     OR (p_ack_type = 'manager_review'
      AND NOT public.app_is_daycare_manager(v_enrollment.daycare_id)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'acknowledgement_not_allowed';
  END IF;

  INSERT INTO public.activity_acknowledgements (
    activity_id, user_id, ack_type, acknowledged_at
  ) VALUES (p_activity_id, auth.uid(), p_ack_type, now())
  ON CONFLICT (activity_id, ack_type) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        acknowledged_at = EXCLUDED.acknowledged_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_moderation_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN jsonb_build_object(
    'reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version_id', v.id, 'review_id', r.id, 'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'rating', v.rating, 'body', v.body, 'submitted_at', v.created_at) ORDER BY v.created_at)
      FROM public.review_versions AS v
      JOIN public.reviews AS r ON r.id = v.review_id
      JOIN public.daycares AS d ON d.id = r.daycare_id
      WHERE v.moderation_status = 'pending'), '[]'::jsonb),
    'replies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version_id', rv.id, 'review_id', rr.review_id, 'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'body', rv.body, 'submitted_at', rv.created_at) ORDER BY rv.created_at)
      FROM public.review_reply_versions AS rv
      JOIN public.review_replies AS rr ON rr.id = rv.reply_id
      JOIN public.reviews AS r ON r.id = rr.review_id
      JOIN public.daycares AS d ON d.id = r.daycare_id
      WHERE rv.status = 'pending'), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_moderate_review(p_version_id uuid, p_decision text, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_version public.review_versions%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin'
     OR COALESCE(p_decision, '') NOT IN ('approved', 'rejected')
     OR char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_review_decision_required';
  END IF;
  SELECT * INTO v_version FROM public.review_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND OR v_version.moderation_status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'review_version_not_pending';
  END IF;
  SELECT * INTO v_review FROM public.reviews WHERE id = v_version.review_id FOR UPDATE;
  UPDATE public.review_versions
  SET moderation_status = p_decision, moderated_by = auth.uid(), moderated_at = now(),
      moderation_reason = btrim(p_reason)
  WHERE id = p_version_id;
  IF p_decision = 'approved' THEN
    UPDATE public.reviews SET published_version_id = p_version_id WHERE id = v_review.id;
  END IF;
  PERFORM public.app_internal_notify(
    v_review.parent_id, 'review_moderated', 'Ulasan telah ditinjau', btrim(p_reason),
    'normal', 'review-moderated:' || p_version_id::text, NULL
  );
  PERFORM public.app_internal_audit(
    'review.moderate', 'review', v_review.id, v_review.daycare_id, p_reason,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision),
    v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_moderate_review_reply(p_version_id uuid, p_decision text, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_version public.review_reply_versions%ROWTYPE;
  v_reply public.review_replies%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin'
     OR COALESCE(p_decision, '') NOT IN ('approved', 'rejected')
     OR char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_reply_decision_required';
  END IF;
  SELECT * INTO v_version FROM public.review_reply_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND OR v_version.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'reply_version_not_pending';
  END IF;
  SELECT * INTO v_reply FROM public.review_replies WHERE id = v_version.reply_id FOR UPDATE;
  SELECT * INTO v_review FROM public.reviews WHERE id = v_reply.review_id;
  UPDATE public.review_reply_versions
  SET status = p_decision, moderated_by = auth.uid(), moderated_at = now(),
      moderation_reason = btrim(p_reason)
  WHERE id = p_version_id;
  IF p_decision = 'approved' THEN
    UPDATE public.review_replies SET published_version_id = p_version_id WHERE id = v_reply.id;
    PERFORM public.app_internal_notify(
      v_review.parent_id, 'review_reply_published', 'Daycare membalas ulasan Anda',
      'Balasan telah melalui moderasi manual.', 'normal',
      'review-reply-published:' || p_version_id::text, NULL
    );
  END IF;
  PERFORM public.app_internal_audit(
    'review_reply.moderate', 'review_reply', v_reply.id, v_review.daycare_id, p_reason,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision),
    v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_record_payment_result(p_transaction_id uuid, p_status text, p_provider text, p_provider_transaction_id text, p_method_details jsonb, p_provider_fee_amount bigint, p_receipt_reference text, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_transaction public.transactions%ROWTYPE;
  v_charge public.charges%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin'
     OR COALESCE(p_status, '') NOT IN ('pending', 'succeeded', 'failed', 'expired')
     OR char_length(btrim(COALESCE(p_provider, ''))) < 2
     OR char_length(btrim(COALESCE(p_reason, ''))) < 5
     OR COALESCE(p_provider_fee_amount, 0) < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_payment_result_required';
  END IF;

  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND OR v_transaction.status IN ('succeeded', 'failed', 'expired') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'transaction_already_final';
  END IF;
  SELECT * INTO v_charge
  FROM public.charges
  WHERE id = v_transaction.charge_id
  FOR UPDATE;
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = v_charge.enrollment_id
  FOR UPDATE;

  IF p_status = 'succeeded'
     AND (v_charge.status <> 'open' OR v_enrollment.status <> 'pending_payment') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payment_state_mismatch';
  END IF;
  IF p_status = 'succeeded' THEN
    PERFORM 1 FROM public.children WHERE child_id = v_enrollment.child_id FOR UPDATE;
    IF EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE child_id = v_enrollment.child_id
        AND id <> v_enrollment.id
        AND status = 'approved'
    ) THEN
      -- Leave the transaction for Admin reconciliation instead of hitting
      -- the unique index enrollment_one_approved_per_child.
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'child_has_active_enrollment';
    END IF;
  END IF;

  UPDATE public.transactions
  SET provider = btrim(p_provider),
      provider_transaction_id = NULLIF(btrim(p_provider_transaction_id), ''),
      status = p_status,
      paid_at = CASE WHEN p_status = 'succeeded' THEN now() ELSE NULL END,
      reconciliation_reason = btrim(p_reason)
  WHERE id = p_transaction_id;

  INSERT INTO public.payment_details (
    transaction_id, method_details, provider_fee_amount,
    provider_receipt_reference
  ) VALUES (
    p_transaction_id, COALESCE(p_method_details, '{}'::jsonb),
    COALESCE(p_provider_fee_amount, 0), NULLIF(btrim(p_receipt_reference), '')
  )
  ON CONFLICT (transaction_id) DO UPDATE
    SET method_details = EXCLUDED.method_details,
        provider_fee_amount = EXCLUDED.provider_fee_amount,
        provider_receipt_reference = EXCLUDED.provider_receipt_reference;

  IF p_status = 'succeeded' THEN
    UPDATE public.charges
    SET status = 'paid', paid_transaction_id = p_transaction_id
    WHERE id = v_charge.id;
    UPDATE public.enrollments
    SET status = 'approved', approved_at = now(), version = version + 1
    WHERE id = v_enrollment.id;
    INSERT INTO public.enrollment_status_logs (
      enrollment_id, from_status, to_status, actor_id, actor_type, reason, request_id
    ) VALUES (
      v_enrollment.id, 'pending_payment', 'approved', auth.uid(), 'gateway',
      btrim(p_reason), v_request_id
    );
    PERFORM public.app_internal_notify(
      v_enrollment.parent_id, 'payment_succeeded', 'Pembayaran tercatat',
      'Pengajuan telah disetujui dan menunggu penugasan pengasuh.', 'normal',
      'payment-succeeded:' || p_transaction_id::text, v_enrollment.id
    );
  ELSE
    PERFORM public.app_internal_notify(
      v_enrollment.parent_id, 'payment_status_updated', 'Status pembayaran diperbarui',
      btrim(p_reason), CASE WHEN p_status IN ('failed', 'expired') THEN 'urgent' ELSE 'normal' END,
      'payment-status:' || p_transaction_id::text || ':' || p_status,
      v_enrollment.id
    );
  END IF;

  PERFORM public.app_internal_audit(
    'payment.result', 'transaction', p_transaction_id, v_enrollment.daycare_id,
    p_reason, jsonb_build_object('status', v_transaction.status),
    jsonb_build_object('status', p_status, 'provider', p_provider), v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_can_caregiver_read_current_child_health(p_child_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
      AND public.app_is_current_assigned_caregiver(e.id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_manager_read_current_child_health(p_child_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
      AND public.app_is_daycare_manager(e.daycare_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_can_parent_read_logbook_variant(p_variant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.attachment_variants AS v
    JOIN public.attachments AS a ON a.id = v.attachment_id
    JOIN public.daily_report_activities AS act ON act.id = a.activity_id
    JOIN public.daily_reports AS r ON r.id = act.report_id
    JOIN public.enrollments AS e ON e.id = r.enrollment_id
    WHERE v.id = p_variant_id
      AND v.variant_type IN ('masked', 'thumbnail')
      AND v.status = 'ready'
      AND v.bucket = 'logbook-masked'
      AND v.audience_child_id = e.child_id
      AND a.status = 'ready'
      AND act.status = 'sent'
      AND act.deleted_at IS NULL
      AND e.parent_id = auth.uid()
      AND e.status IN ('approved', 'completed')
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_can_read_incident_storage_object(p_bucket_id text, p_object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.attachments AS a
    JOIN public.incident_reports AS i ON i.id = a.incident_id
    JOIN public.enrollments AS e ON e.id = i.enrollment_id
    WHERE a.bucket = p_bucket_id
      AND a.object_path = p_object_name
      AND a.status = 'ready'
      AND p_bucket_id = 'incident-evidence'
      AND (
        (
          public.app_current_role() = 'parent'
          AND e.parent_id = auth.uid()
          AND e.status IN ('approved', 'completed')
        )
        OR public.app_is_daycare_manager(e.daycare_id)
        OR public.app_current_role() = 'admin'
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_can_read_pickup_storage_object(p_bucket_id text, p_object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.attachments AS a
    JOIN public.pickup_records AS p ON p.id = a.pickup_id
    JOIN public.enrollments AS e ON e.id = p.enrollment_id
    WHERE a.bucket = p_bucket_id
      AND a.object_path = p_object_name
      AND a.status = 'ready'
      AND p_bucket_id = 'pickup-evidence'
      AND (
        (
          public.app_current_role() = 'parent'
          AND e.parent_id = auth.uid()
        )
        OR public.app_is_daycare_manager(e.daycare_id)
        OR public.app_current_role() = 'admin'
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_create_enrollment(p_child_id uuid, p_offering_id uuid, p_service_date date, p_policy_version text, p_consent_scope jsonb, p_wording_snapshot text, p_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_child public.children%ROWTYPE;
  v_offering public.service_offerings%ROWTYPE;
  v_daycare public.daycares%ROWTYPE;
  v_price public.service_price_versions%ROWTYPE;
  v_enrollment_id uuid;
  v_age_months integer;
  v_manager_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  -- IS DISTINCT FROM keeps the guard closed when the role resolves to NULL.
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;
  IF p_service_date IS NULL OR p_service_date < CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_service_date';
  END IF;
  -- Both consents are mandatory (docs/keputusan-mvp 3.1) and the live table
  -- only accepts these two consent_type values. p_consent_scope must be
  -- {"service_terms": true, "child_data_processing": true, ...}.
  IF char_length(btrim(COALESCE(p_policy_version, ''))) < 1
     OR char_length(btrim(COALESCE(p_wording_snapshot, ''))) < 10
     OR p_consent_scope IS NULL
     OR jsonb_typeof(p_consent_scope) <> 'object'
     OR p_consent_scope -> 'service_terms' IS DISTINCT FROM 'true'::jsonb
     OR p_consent_scope -> 'child_data_processing' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_consent';
  END IF;

  SELECT * INTO v_child
  FROM public.children
  WHERE child_id = p_child_id
    AND parent_id = v_parent_id
    AND status = 'active'
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;

  SELECT * INTO v_offering
  FROM public.service_offerings
  WHERE id = p_offering_id AND is_active
  FOR SHARE;
  IF NOT FOUND OR v_offering.published_price_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'offering_not_available';
  END IF;

  SELECT * INTO v_daycare
  FROM public.daycares
  WHERE id = v_offering.daycare_id
    AND status = 'active'
    AND deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'daycare_not_available';
  END IF;

  SELECT * INTO v_price
  FROM public.service_price_versions
  WHERE id = v_offering.published_price_id
    AND offering_id = v_offering.id
    AND status = 'approved'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'published_price_not_available';
  END IF;

  v_age_months := date_part('year', age(p_service_date, v_child.birth_date))::integer * 12
    + date_part('month', age(p_service_date, v_child.birth_date))::integer;
  IF v_age_months < v_offering.min_age_months
     OR v_age_months > v_offering.max_age_months THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'child_age_out_of_range';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE child_id = p_child_id
      AND service_date = p_service_date
      AND status IN ('pending', 'pending_payment', 'approved')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'duplicate_active_enrollment';
  END IF;

  INSERT INTO public.enrollments (
    child_id, parent_id, daycare_id, offering_id, price_version_id,
    service_date, status, manager_decision, child_snapshot, version
  ) VALUES (
    v_child.child_id, v_parent_id, v_daycare.id, v_offering.id, v_price.id,
    p_service_date, 'pending', 'undecided',
    jsonb_build_object(
      'full_name', v_child.full_name,
      'birth_date', v_child.birth_date,
      'general_notes', v_child.general_notes
    ),
    1
  ) RETURNING id INTO v_enrollment_id;

  -- One record per purpose, as the consent model requires.
  INSERT INTO public.enrollment_consents (
    enrollment_id, parent_id, consent_type, policy_version, scope,
    wording_snapshot, accepted_at
  )
  SELECT v_enrollment_id, v_parent_id, kind, btrim(p_policy_version),
         p_consent_scope || jsonb_build_object('kind', kind),
         btrim(p_wording_snapshot), now()
  FROM unnest(ARRAY['service_terms', 'child_data_processing']) AS kind;

  INSERT INTO public.enrollment_status_logs (
    enrollment_id, from_status, to_status, actor_id, actor_type, reason, request_id
  ) VALUES (
    v_enrollment_id, NULL, 'pending', v_parent_id, 'user',
    'Parent submitted enrollment', v_request_id
  );

  FOR v_manager_id IN
    SELECT DISTINCT recipient_id
    FROM (
      SELECT v_daycare.main_manager_id AS recipient_id
      UNION
      SELECT dm.user_id
      FROM public.daycare_members AS dm
      WHERE dm.daycare_id = v_daycare.id
        AND dm.member_role = 'manager'
        AND dm.status = 'active'
        AND dm.ended_at IS NULL
    ) AS managers
    WHERE recipient_id IS NOT NULL
  LOOP
    PERFORM public.app_internal_notify(
      v_manager_id, 'enrollment_submitted', 'Pengajuan pengasuhan baru',
      'Orang tua mengirim pengajuan yang perlu ditinjau.', 'normal',
      'enrollment-submitted:' || v_enrollment_id::text || ':' || v_manager_id::text,
      v_enrollment_id
    );
  END LOOP;

  PERFORM public.app_internal_audit(
    'enrollment.create', 'enrollment', v_enrollment_id, v_daycare.id,
    'Parent submitted enrollment', NULL,
    jsonb_build_object('status', 'pending', 'service_date', p_service_date),
    v_request_id
  );
  RETURN v_enrollment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_create_incident(p_enrollment_id uuid, p_occurred_at timestamp with time zone, p_description text, p_first_aid text, p_urgency text, p_urgency_reason text, p_submission_key text, p_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_incident_id uuid;
  v_recipient_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF COALESCE(p_urgency, '') NOT IN ('low', 'medium', 'high', 'emergency')
     OR p_occurred_at IS NULL OR p_occurred_at > now() + interval '5 minutes'
     OR char_length(btrim(COALESCE(p_description, ''))) NOT BETWEEN 20 AND 4000
     OR char_length(btrim(COALESCE(p_first_aid, ''))) < 2
     OR char_length(btrim(COALESCE(p_urgency_reason, ''))) < 5
     OR char_length(btrim(COALESCE(p_submission_key, ''))) < 8 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_incident';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments
  WHERE id = p_enrollment_id FOR SHARE;
  IF NOT FOUND OR v_enrollment.status NOT IN ('approved', 'completed') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'incident_enrollment_not_active';
  END IF;
  IF v_enrollment.parent_id <> auth.uid()
     AND NOT public.app_is_daycare_manager(v_enrollment.daycare_id)
     AND NOT public.app_is_current_assigned_caregiver(p_enrollment_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_scope_required';
  END IF;

  SELECT id INTO v_incident_id FROM public.incident_reports
  WHERE submission_key = btrim(p_submission_key);
  IF v_incident_id IS NOT NULL THEN RETURN v_incident_id; END IF;

  INSERT INTO public.incident_reports (
    enrollment_id, reported_by, occurred_at, description, first_aid,
    caregiver_urgency, caregiver_reason, effective_urgency,
    urgency_source, needs_urgency_review, status, version, submission_key
  ) VALUES (
    p_enrollment_id, auth.uid(), p_occurred_at, btrim(p_description),
    btrim(p_first_aid), p_urgency, btrim(p_urgency_reason), p_urgency,
    'caregiver', false, 'new', 1, btrim(p_submission_key)
  ) RETURNING id INTO v_incident_id;
  INSERT INTO public.incident_status_logs (
    incident_id, from_status, to_status, actor_id, reason
  ) VALUES (v_incident_id, NULL, 'new', auth.uid(), 'Incident submitted');

  FOR v_recipient_id IN
    SELECT DISTINCT recipient_id FROM (
      SELECT v_enrollment.parent_id AS recipient_id
      UNION SELECT dm.user_id FROM public.daycare_members AS dm
        WHERE dm.daycare_id = v_enrollment.daycare_id
          AND dm.member_role = 'manager' AND dm.status = 'active' AND dm.ended_at IS NULL
      UNION SELECT u.id FROM public.users AS u
        WHERE u.role = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL
    ) AS recipients
    WHERE recipient_id IS NOT NULL AND recipient_id <> auth.uid()
  LOOP
    PERFORM public.app_internal_notify(
      v_recipient_id, 'incident_submitted', 'Laporan insiden baru',
      'Laporan insiden memerlukan peninjauan sesuai kewenangan Anda.',
      CASE WHEN p_urgency IN ('high', 'emergency') THEN 'urgent' ELSE 'normal' END,
      'incident-submitted:' || v_incident_id::text || ':' || v_recipient_id::text,
      p_enrollment_id
    );
  END LOOP;
  PERFORM public.app_internal_audit(
    'incident.create', 'incident', v_incident_id, v_enrollment.daycare_id,
    p_urgency_reason, NULL, jsonb_build_object('status', 'new', 'urgency', p_urgency),
    v_request_id
  );
  RETURN v_incident_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_create_parent_child(p_full_name text, p_birth_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_child_id uuid;
BEGIN
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = v_parent_id
      AND u.role = 'parent'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;

  IF p_full_name IS NULL
     OR char_length(btrim(p_full_name)) < 2
     OR char_length(btrim(p_full_name)) > 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_name';
  END IF;

  IF p_birth_date IS NULL OR p_birth_date > CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_birth_date';
  END IF;

  INSERT INTO public.children (parent_id, full_name, birth_date, status)
  VALUES (v_parent_id, btrim(p_full_name), p_birth_date, 'active')
  RETURNING child_id INTO v_child_id;

  INSERT INTO public.child_health_profiles (child_id, updated_by)
  VALUES (v_child_id, v_parent_id);

  RETURN v_child_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_create_payment_ledger_entry(p_charge_id uuid, p_method text, p_idempotency_key text, p_expires_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_charge public.charges%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_transaction_id uuid;
BEGIN
  IF COALESCE(p_method, '') NOT IN ('va', 'qris', 'ewallet')
     OR char_length(btrim(COALESCE(p_idempotency_key, ''))) < 12
     OR p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_payment_request';
  END IF;

  SELECT * INTO v_charge
  FROM public.charges
  WHERE id = p_charge_id
  FOR UPDATE;
  IF NOT FOUND OR v_charge.status <> 'open' OR v_charge.due_at <= now() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'charge_not_payable';
  END IF;
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = v_charge.enrollment_id;
  IF v_enrollment.parent_id <> auth.uid()
     OR v_enrollment.status <> 'pending_payment' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'charge_not_owned';
  END IF;

  INSERT INTO public.transactions (
    charge_id, provider, idempotency_key, method, amount, currency,
    status, reconciliation_status, expires_at
  ) VALUES (
    p_charge_id, 'unconfigured', btrim(p_idempotency_key), p_method,
    v_charge.total_amount, v_charge.currency, 'created', 'normal', p_expires_at
  )
  ON CONFLICT (idempotency_key) DO UPDATE
    SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_current_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT u.role
  FROM public.users AS u
  WHERE u.id = auth.uid()
    AND u.status = 'active'
$function$;

CREATE OR REPLACE FUNCTION public.app_delete_draft_activity(p_activity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_activity public.daily_report_activities%ROWTYPE;
BEGIN
  SELECT * INTO v_activity
  FROM public.daily_report_activities
  WHERE id = p_activity_id
  FOR UPDATE;
  IF NOT FOUND OR v_activity.deleted_at IS NOT NULL
     OR v_activity.caregiver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'activity_not_owned';
  END IF;
  IF v_activity.status <> 'draft' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'sent_activity_is_immutable';
  END IF;
  UPDATE public.daily_report_activities
  SET deleted_at = now(), version = version + 1, updated_at = now()
  WHERE id = p_activity_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_expire_overdue_enrollments(p_limit integer DEFAULT 200)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_count integer := 0;
  v_request_id text := 'expire-job:' || gen_random_uuid()::text;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_expire_limit';
  END IF;

  FOR v_enrollment IN
    SELECT *
    FROM public.enrollments
    WHERE status = 'pending_payment'
      AND payment_deadline <= now()
    ORDER BY payment_deadline
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.enrollments
    SET status = 'expired', version = version + 1
    WHERE id = v_enrollment.id;
    UPDATE public.charges
    SET status = 'expired'
    WHERE enrollment_id = v_enrollment.id AND status = 'open';
    INSERT INTO public.enrollment_status_logs (
      enrollment_id, from_status, to_status, actor_id, actor_type, reason, request_id
    ) VALUES (
      v_enrollment.id, 'pending_payment', 'expired', NULL, 'system',
      'Payment deadline passed', v_request_id
    );
    PERFORM public.app_internal_notify(
      v_enrollment.parent_id, 'enrollment_expired', 'Batas pembayaran terlewat',
      'Pengajuan kedaluwarsa karena pembayaran belum diterima sampai batas waktu.',
      'urgent', 'enrollment-expired:' || v_enrollment.id::text, v_enrollment.id
    );
    PERFORM public.app_internal_audit(
      'enrollment.expire', 'enrollment', v_enrollment.id, v_enrollment.daycare_id,
      'Payment deadline passed', jsonb_build_object('status', 'pending_payment'),
      jsonb_build_object('status', 'expired'), v_request_id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_get_enrollment(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_audience text;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;
  IF v_enrollment.parent_id = auth.uid() THEN
    v_audience := 'parent';
  ELSIF COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false) THEN
    v_audience := 'manager';
  ELSIF COALESCE(public.app_is_current_assigned_caregiver(v_enrollment.id), false) THEN
    v_audience := 'caregiver';
  ELSE
    -- Same answer as a missing row: never confirm a foreign enrollment exists.
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;

  RETURN public.app_internal_enrollment_json(v_enrollment, v_audience)
    || jsonb_build_object(
      'viewer_role', v_audience,
      'status_logs', CASE WHEN v_audience = 'caregiver' THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'from_status', l.from_status, 'to_status', l.to_status,
          'actor_type', l.actor_type, 'reason', l.reason, 'created_at', l.created_at)
          ORDER BY l.created_at)
        FROM public.enrollment_status_logs AS l WHERE l.enrollment_id = v_enrollment.id
      ), '[]'::jsonb) END,
      'caregivers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'assignment_id', a.id, 'caregiver_id', a.caregiver_id, 'full_name', u.full_name,
          'starts_at', a.starts_at, 'ends_at', a.ends_at) ORDER BY a.starts_at)
        FROM public.caregiver_assignments AS a
        JOIN public.users AS u ON u.id = a.caregiver_id
        WHERE a.enrollment_id = v_enrollment.id AND a.ended_early_at IS NULL
      ), '[]'::jsonb)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_internal_audit(p_action text, p_entity_type text, p_entity_id uuid, p_daycare_id uuid, p_reason text, p_before jsonb, p_after jsonb, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_label text;
BEGIN
  SELECT full_name INTO v_actor_label
  FROM public.users
  WHERE id = v_actor_id;

  INSERT INTO public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, daycare_id,
    reason, before_summary, after_summary, request_id, actor_label_snapshot
  ) VALUES (
    v_actor_id,
    CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'user' END,
    p_action, p_entity_type, p_entity_id, p_daycare_id,
    NULLIF(btrim(p_reason), ''), p_before, p_after,
    COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text),
    COALESCE(v_actor_label, 'System')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_internal_enrollment_json(p_enrollment enrollments, p_audience text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'id', p_enrollment.id,
    'reference', upper(left(replace(p_enrollment.id::text, '-', ''), 8)),
    'status', p_enrollment.status,
    'manager_decision', p_enrollment.manager_decision,
    'service_date', p_enrollment.service_date,
    'payment_deadline', p_enrollment.payment_deadline,
    'decision_reason', p_enrollment.decision_reason,
    'checked_in_at', p_enrollment.checked_in_at,
    'completed_at', p_enrollment.completed_at,
    'created_at', p_enrollment.created_at,
    'daycare', (SELECT jsonb_build_object('id', d.id, 'name', d.name)
                FROM public.daycares AS d WHERE d.id = p_enrollment.daycare_id),
    'offering', (SELECT jsonb_build_object('id', o.id, 'name', o.name, 'service_type', o.service_type)
                 FROM public.service_offerings AS o WHERE o.id = p_enrollment.offering_id),
    'child', CASE
      WHEN p_audience = 'parent' OR p_enrollment.status IN ('approved', 'completed')
      THEN jsonb_build_object(
        'child_id', p_enrollment.child_id,
        'full_name', p_enrollment.child_snapshot ->> 'full_name',
        'birth_date', p_enrollment.child_snapshot ->> 'birth_date')
      ELSE NULL END,
    'charge', CASE WHEN p_audience IN ('parent', 'manager') THEN (
      SELECT jsonb_build_object('id', c.id, 'total_amount', c.total_amount, 'currency', c.currency,
                                'status', c.status, 'due_at', c.due_at)
      FROM public.charges AS c
      WHERE c.enrollment_id = p_enrollment.id AND c.charge_type = 'service') END
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_internal_notify(p_recipient_id uuid, p_event_type text, p_title text, p_body text, p_priority text, p_deduplication_key text, p_enrollment_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (
    recipient_id, event_type, enrollment_id, title, body,
    priority, deduplication_key, available_at
  ) VALUES (
    p_recipient_id, p_event_type, p_enrollment_id, btrim(p_title),
    btrim(p_body), p_priority, p_deduplication_key, now()
  )
  ON CONFLICT (deduplication_key) DO UPDATE
    SET deduplication_key = EXCLUDED.deduplication_key
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_is_active_daycare_member(p_daycare_id uuid, p_member_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT CASE
    WHEN p_member_role NOT IN ('manager', 'caregiver') THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.daycare_members AS m
      JOIN public.users AS u ON u.id = m.user_id
      WHERE m.daycare_id = p_daycare_id
        AND m.user_id = auth.uid()
        AND m.member_role = p_member_role
        AND m.status = 'active'
        AND u.role = p_member_role
        AND u.status = 'active'
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.app_is_current_assigned_caregiver(p_enrollment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.caregiver_assignments AS a
    JOIN public.enrollments AS e ON e.id = a.enrollment_id
    JOIN public.daycare_members AS m
      ON m.daycare_id = e.daycare_id
     AND m.user_id = a.caregiver_id
     AND m.member_role = 'caregiver'
     AND m.status = 'active'
    JOIN public.users AS u
      ON u.id = a.caregiver_id
     AND u.role = 'caregiver'
     AND u.status = 'active'
    WHERE a.enrollment_id = p_enrollment_id
      AND a.caregiver_id = auth.uid()
      AND a.starts_at <= now()
      AND a.ends_at > now()
      AND (a.ended_early_at IS NULL OR a.ended_early_at > now())
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_is_daycare_manager(p_daycare_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.daycares AS d
    JOIN public.daycare_members AS m
      ON m.daycare_id = d.id
     AND m.user_id = auth.uid()
     AND m.member_role = 'manager'
     AND m.status = 'active'
    JOIN public.users AS u
      ON u.id = m.user_id
     AND u.role = 'manager'
     AND u.status = 'active'
    WHERE d.id = p_daycare_id
      AND d.main_manager_id = auth.uid()
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_is_parent_of_child(p_child_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.children AS c
    JOIN public.users AS u ON u.id = c.parent_id
    WHERE c.child_id = p_child_id
      AND c.parent_id = auth.uid()
      AND u.role = 'parent'
      AND u.status = 'active'
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_list_daily_activities(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_own_only boolean := false;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;
  IF v_enrollment.parent_id = auth.uid()
     OR COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false) THEN
    v_own_only := false;  -- sent activities only
  ELSIF COALESCE(public.app_is_current_assigned_caregiver(v_enrollment.id), false) THEN
    v_own_only := true;   -- the caregiver's own drafts and sent activities
  ELSE
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'enrollment_not_found';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'report_date', r.report_date, 'activity_type', a.activity_type,
      'title', a.title, 'body', a.body, 'occurred_at', a.occurred_at, 'status', a.status,
      'is_urgent', a.is_urgent, 'urgent_reason', a.urgent_reason, 'sent_at', a.sent_at,
      'version', a.version, 'caregiver_name', u.full_name,
      'parent_read_at', (SELECT k.acknowledged_at FROM public.activity_acknowledgements AS k
                         WHERE k.activity_id = a.id AND k.ack_type = 'parent_read'))
      ORDER BY a.occurred_at DESC)
    FROM public.daily_report_activities AS a
    JOIN public.daily_reports AS r ON r.id = a.report_id
    JOIN public.users AS u ON u.id = a.caregiver_id
    WHERE r.enrollment_id = v_enrollment.id
      AND a.deleted_at IS NULL
      AND (CASE WHEN v_own_only THEN a.caregiver_id = auth.uid() ELSE a.status = 'sent' END)
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_daycare_offerings(p_daycare_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'name', o.name, 'service_type', o.service_type, 'description', o.description,
    'min_age_months', o.min_age_months, 'max_age_months', o.max_age_months,
    'price', jsonb_build_object('amount', p.service_amount, 'currency', p.currency, 'version', p.version))
    ORDER BY o.name), '[]'::jsonb)
  FROM public.service_offerings AS o
  JOIN public.daycares AS d ON d.id = o.daycare_id AND d.status = 'active' AND d.deleted_at IS NULL
  JOIN public.service_price_versions AS p ON p.id = o.published_price_id AND p.status = 'approved'
  WHERE o.daycare_id = p_daycare_id AND o.is_active;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_enrollments(p_daycare_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_daycare_id IS NULL THEN
    IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
    END IF;
    RETURN COALESCE((
      SELECT jsonb_agg(public.app_internal_enrollment_json(e, 'parent')
                       ORDER BY e.service_date DESC, e.created_at DESC)
      FROM (SELECT * FROM public.enrollments WHERE parent_id = auth.uid()
            ORDER BY service_date DESC, created_at DESC LIMIT 200) AS e
    ), '[]'::jsonb);
  END IF;

  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.app_internal_enrollment_json(e, 'manager')
                     ORDER BY e.service_date DESC, e.created_at DESC)
    FROM (SELECT * FROM public.enrollments WHERE daycare_id = p_daycare_id
          ORDER BY service_date DESC, created_at DESC LIMIT 200) AS e
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_incidents(p_enrollment_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_role text := public.app_current_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('parent', 'manager', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
      SELECT i.created_at, jsonb_build_object(
        'id', i.id, 'enrollment_id', i.enrollment_id,
        'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'child_name', e.child_snapshot ->> 'full_name',
        'occurred_at', i.occurred_at, 'description', i.description, 'first_aid', i.first_aid,
        'urgency', i.effective_urgency, 'urgency_source', i.urgency_source,
        'status', i.status, 'resolved_at', i.resolved_at, 'created_at', i.created_at,
        'parent_acknowledged_at', (SELECT k.acknowledged_at FROM public.incident_parent_acknowledgements AS k
                                   WHERE k.incident_id = i.id),
        'status_logs', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('from_status', l.from_status, 'to_status', l.to_status,
                                              'reason', l.reason, 'created_at', l.created_at) ORDER BY l.created_at)
          FROM public.incident_status_logs AS l WHERE l.incident_id = i.id), '[]'::jsonb)) AS item
      FROM public.incident_reports AS i
      JOIN public.enrollments AS e ON e.id = i.enrollment_id
      JOIN public.daycares AS d ON d.id = e.daycare_id
      WHERE (p_enrollment_id IS NULL OR i.enrollment_id = p_enrollment_id)
        AND CASE v_role
          WHEN 'parent' THEN e.parent_id = auth.uid()
          WHEN 'manager' THEN COALESCE(public.app_is_daycare_manager(e.daycare_id), false)
          ELSE true END
      ORDER BY i.created_at DESC
      LIMIT 200) AS page
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_daycares()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'name', d.name, 'status', d.status, 'member_role', m.member_role,
    'is_main_manager', d.main_manager_id = auth.uid()) ORDER BY d.name), '[]'::jsonb)
  FROM public.daycare_members AS m
  JOIN public.daycares AS d ON d.id = m.daycare_id AND d.deleted_at IS NULL
  WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.ended_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_my_notifications(p_only_unread boolean DEFAULT false, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  RETURN jsonb_build_object(
    'unread_count', (
      SELECT count(*) FROM public.notifications AS n
      LEFT JOIN public.notification_receipts AS r ON r.notification_id = n.id
      WHERE n.recipient_id = v_user_id AND n.available_at <= now() AND r.read_at IS NULL),
    'items', COALESCE((
      SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
        SELECT n.created_at, jsonb_build_object(
          'id', n.id, 'event_type', n.event_type, 'title', n.title, 'body', n.body,
          'priority', n.priority, 'enrollment_id', n.enrollment_id,
          'created_at', n.created_at, 'read_at', r.read_at) AS item
        FROM public.notifications AS n
        LEFT JOIN public.notification_receipts AS r ON r.notification_id = n.id
        WHERE n.recipient_id = v_user_id AND n.available_at <= now()
          AND (NOT COALESCE(p_only_unread, false) OR r.read_at IS NULL)
        ORDER BY n.created_at DESC
        LIMIT v_limit) AS page
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_public_reviews(p_daycare_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH published AS (
    SELECT r.id, v.rating, v.body, v.moderated_at,
      (SELECT jsonb_build_object('body', rv.body, 'published_at', rv.moderated_at)
       FROM public.review_replies AS rr
       JOIN public.review_reply_versions AS rv ON rv.id = rr.published_version_id
       WHERE rr.review_id = r.id) AS reply
    FROM public.reviews AS r
    JOIN public.review_versions AS v ON v.id = r.published_version_id
    WHERE r.daycare_id = p_daycare_id AND r.withdrawn_at IS NULL
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM published),
    'average_rating', (SELECT round(avg(rating)::numeric, 1) FROM published),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'rating', rating, 'body', body, 'published_at', moderated_at, 'reply', reply)
      ORDER BY moderated_at DESC) FROM published), '[]'::jsonb));
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_assign_caregiver(p_enrollment_id uuid, p_caregiver_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_assignment_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_starts_at >= p_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_assignment_period';
  END IF;
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.app_is_daycare_manager(v_enrollment.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF v_enrollment.status <> 'approved' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'enrollment_not_approved';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.daycare_members
    WHERE daycare_id = v_enrollment.daycare_id
      AND user_id = p_caregiver_id
      AND member_role = 'caregiver'
      AND status = 'active'
      AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'caregiver_not_active_member';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.caregiver_assignments
    WHERE enrollment_id = p_enrollment_id
      AND caregiver_id = p_caregiver_id
      AND ended_early_at IS NULL
      AND tstzrange(starts_at, ends_at, '[)')
        && tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'assignment_period_overlaps';
  END IF;

  INSERT INTO public.caregiver_assignments (
    enrollment_id, caregiver_id, assigned_by, starts_at, ends_at
  ) VALUES (
    p_enrollment_id, p_caregiver_id, auth.uid(), p_starts_at, p_ends_at
  ) RETURNING id INTO v_assignment_id;

  PERFORM public.app_internal_notify(
    p_caregiver_id, 'caregiver_assignment_created', 'Penugasan pengasuhan baru',
    'Anda ditugaskan pada pengasuhan yang telah disetujui.', 'normal',
    'caregiver-assignment:' || v_assignment_id::text, p_enrollment_id
  );
  PERFORM public.app_internal_audit(
    'caregiver_assignment.create', 'caregiver_assignment', v_assignment_id,
    v_enrollment.daycare_id, 'Manager assigned caregiver', NULL,
    jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'caregiver_id', p_caregiver_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at
    ),
    v_request_id
  );
  RETURN v_assignment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_check_in_enrollment(p_enrollment_id uuid, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments
  WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.app_is_daycare_manager(v_enrollment.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF v_enrollment.status <> 'approved' OR v_enrollment.service_date <> CURRENT_DATE
     OR v_enrollment.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'enrollment_cannot_check_in';
  END IF;
  UPDATE public.enrollments
  SET checked_in_at = now(), checked_in_by = auth.uid(), version = version + 1
  WHERE id = p_enrollment_id;
  PERFORM public.app_internal_notify(
    v_enrollment.parent_id, 'child_checked_in', 'Anak sudah check-in',
    'Pengelola telah mencatat kedatangan anak.', 'normal',
    'child-checked-in:' || p_enrollment_id::text, p_enrollment_id
  );
  PERFORM public.app_internal_audit(
    'enrollment.check_in', 'enrollment', p_enrollment_id, v_enrollment.daycare_id,
    'Manager confirmed check-in', NULL, jsonb_build_object('checked_in_at', now()), v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_complete_enrollment(p_enrollment_id uuid, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments
  WHERE id = p_enrollment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.app_is_daycare_manager(v_enrollment.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF v_enrollment.status <> 'approved' OR v_enrollment.checked_in_at IS NULL
     OR v_enrollment.service_date > CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'enrollment_cannot_complete';
  END IF;
  UPDATE public.enrollments
  SET status = 'completed', completed_at = now(), version = version + 1
  WHERE id = p_enrollment_id;
  INSERT INTO public.enrollment_status_logs (
    enrollment_id, from_status, to_status, actor_id, actor_type, reason, request_id
  ) VALUES (
    p_enrollment_id, 'approved', 'completed', auth.uid(), 'user',
    COALESCE(NULLIF(btrim(p_reason), ''), 'Service completed'), v_request_id
  );
  PERFORM public.app_internal_notify(
    v_enrollment.parent_id, 'enrollment_completed', 'Pengasuhan selesai',
    'Layanan telah selesai. Anda dapat memberikan ulasan.', 'normal',
    'enrollment-completed:' || p_enrollment_id::text, p_enrollment_id
  );
  PERFORM public.app_internal_audit(
    'enrollment.complete', 'enrollment', p_enrollment_id, v_enrollment.daycare_id,
    p_reason, jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'completed'), v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_decide_enrollment(p_enrollment_id uuid, p_decision text, p_reason text, p_request_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_manager_id uuid := auth.uid();
  v_enrollment public.enrollments%ROWTYPE;
  v_price public.service_price_versions%ROWTYPE;
  v_rule public.commission_rules%ROWTYPE;
  v_next_status text;
  v_deadline timestamptz;
  v_commission bigint := 0;
  v_capacity integer;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  -- A NULL decision must not fall through to the "accepted" branch below.
  IF p_decision IS NULL OR p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_enrollment_decision';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'decision_reason_required';
  END IF;

  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.app_is_daycare_manager(v_enrollment.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF v_enrollment.status <> 'pending' OR v_enrollment.manager_decision <> 'undecided' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'enrollment_already_decided';
  END IF;

  IF p_decision = 'rejected' THEN
    v_next_status := 'rejected';
    UPDATE public.enrollments
    SET status = v_next_status, manager_decision = 'rejected',
        decided_by = v_manager_id, decided_at = now(),
        decision_reason = btrim(p_reason), version = version + 1
    WHERE id = p_enrollment_id;
  ELSE
    -- Serialize per child (same lock as app_create_enrollment) so two
    -- daycares cannot both open a checkout for the same child.
    PERFORM 1 FROM public.children WHERE child_id = v_enrollment.child_id FOR UPDATE;
    -- Only one active enrollment per child (index enrollment_one_approved_per_child).
    -- Refuse here instead of failing later when the payment is recorded.
    IF EXISTS (
      SELECT 1
      FROM public.enrollments
      WHERE child_id = v_enrollment.child_id
        AND id <> p_enrollment_id
        AND (status = 'approved'
             OR (status = 'pending_payment' AND payment_deadline > now()))
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'child_has_active_enrollment';
    END IF;

    -- Lock the daycare row so concurrent approvals cannot exceed capacity.
    -- Checkouts whose payment deadline has passed no longer hold a slot.
    SELECT daily_capacity INTO v_capacity
    FROM public.daycares
    WHERE id = v_enrollment.daycare_id
    FOR UPDATE;
    IF (
      SELECT count(*)
      FROM public.enrollments
      WHERE daycare_id = v_enrollment.daycare_id
        AND service_date = v_enrollment.service_date
        AND (status = 'approved'
             OR (status = 'pending_payment' AND payment_deadline > now()))
    ) >= v_capacity THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'daycare_capacity_full';
    END IF;

    SELECT * INTO v_price
    FROM public.service_price_versions
    WHERE id = v_enrollment.price_version_id AND status = 'approved'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'enrollment_price_not_available';
    END IF;

    SELECT * INTO v_rule
    FROM public.commission_rules AS cr
    WHERE cr.effective_from <= now()
      AND (cr.effective_until IS NULL OR cr.effective_until > now())
      AND (
        cr.offering_id = v_enrollment.offering_id
        OR cr.daycare_id = v_enrollment.daycare_id
        OR (cr.offering_id IS NULL AND cr.daycare_id IS NULL AND cr.category_code IS NULL)
      )
    ORDER BY
      CASE WHEN cr.offering_id IS NOT NULL THEN 1
           WHEN cr.daycare_id IS NOT NULL THEN 2 ELSE 3 END,
      cr.version DESC
    LIMIT 1;
    IF FOUND THEN
      v_commission := round(v_price.service_amount * v_rule.percentage / 100.0)::bigint;
    END IF;

    v_deadline := now() + interval '24 hours';
    v_next_status := 'pending_payment';
    UPDATE public.enrollments
    SET status = v_next_status, manager_decision = 'accepted',
        decided_by = v_manager_id, decided_at = now(),
        decision_reason = btrim(p_reason), payment_deadline = v_deadline,
        version = version + 1
    WHERE id = p_enrollment_id;

    INSERT INTO public.charges (
      enrollment_id, charge_type, price_version_id, commission_rule_id,
      policy_snapshot, service_amount, parent_admin_fee, total_amount,
      daycare_commission_amount, currency, status, due_at
    ) VALUES (
      p_enrollment_id, 'service', v_price.id, v_rule.id,
      jsonb_build_object(
        'price_version', v_price.version,
        'commission_rule_id', v_rule.id,
        'payment_window_hours', 24
      ),
      v_price.service_amount, 0, v_price.service_amount,
      v_commission, v_price.currency, 'open', v_deadline
    );
  END IF;

  INSERT INTO public.enrollment_status_logs (
    enrollment_id, from_status, to_status, actor_id, actor_type, reason, request_id
  ) VALUES (
    p_enrollment_id, 'pending', v_next_status, v_manager_id, 'user',
    btrim(p_reason), v_request_id
  );

  PERFORM public.app_internal_notify(
    v_enrollment.parent_id,
    CASE WHEN p_decision = 'accepted' THEN 'enrollment_accepted' ELSE 'enrollment_rejected' END,
    CASE WHEN p_decision = 'accepted' THEN 'Pengajuan diterima' ELSE 'Pengajuan belum dapat diterima' END,
    btrim(p_reason),
    CASE WHEN p_decision = 'accepted' THEN 'normal' ELSE 'urgent' END,
    'enrollment-decision:' || p_enrollment_id::text,
    p_enrollment_id
  );
  PERFORM public.app_internal_audit(
    'enrollment.decide', 'enrollment', p_enrollment_id, v_enrollment.daycare_id,
    p_reason, jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_next_status, 'decision', p_decision),
    v_request_id
  );
  RETURN v_next_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_submit_review_reply(p_review_id uuid, p_body text, p_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_reply_id uuid;
  v_version integer;
  v_version_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF char_length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_review_reply';
  END IF;
  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR SHARE;
  IF NOT FOUND OR v_review.published_version_id IS NULL
     OR NOT public.app_is_daycare_manager(v_review.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_review_scope_required';
  END IF;
  INSERT INTO public.review_replies (review_id, manager_id)
  VALUES (p_review_id, auth.uid())
  ON CONFLICT (review_id) DO UPDATE SET manager_id = EXCLUDED.manager_id
  RETURNING id INTO v_reply_id;
  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM public.review_reply_versions WHERE reply_id = v_reply_id;
  INSERT INTO public.review_reply_versions (
    reply_id, version, body, status, submitted_by,
    draft_ai_job_id, moderation_ai_job_id
  ) VALUES (v_reply_id, v_version, btrim(p_body), 'pending', auth.uid(), NULL, NULL)
  RETURNING id INTO v_version_id;
  PERFORM public.app_internal_audit(
    'review_reply.submit', 'review_reply', v_reply_id, v_review.daycare_id,
    'Manager submitted reply for manual moderation', NULL,
    jsonb_build_object('version_id', v_version_id), v_request_id
  );
  RETURN v_version_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_mark_notification(p_notification_id uuid, p_read boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE id = p_notification_id AND recipient_id = v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'notification_not_owned';
  END IF;
  INSERT INTO public.notification_receipts (
    notification_id, user_id, seen_at, read_at
  ) VALUES (
    p_notification_id, v_user_id, now(),
    CASE WHEN p_read THEN now() ELSE NULL END
  )
  ON CONFLICT (notification_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        seen_at = COALESCE(notification_receipts.seen_at, EXCLUDED.seen_at),
        read_at = CASE WHEN p_read THEN now() ELSE notification_receipts.read_at END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_acknowledge_incident(p_incident_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.incident_reports AS ir
    JOIN public.enrollments AS e ON e.id = ir.enrollment_id
    WHERE ir.id = p_incident_id AND e.parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_not_owned';
  END IF;
  INSERT INTO public.incident_parent_acknowledgements (
    incident_id, parent_id, acknowledged_at
  ) VALUES (p_incident_id, auth.uid(), now())
  ON CONFLICT (incident_id) DO UPDATE SET acknowledged_at = EXCLUDED.acknowledged_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_archive_child(p_child_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;
  PERFORM 1 FROM public.children
  WHERE child_id = p_child_id AND parent_id = auth.uid() AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments WHERE child_id = p_child_id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'child_has_enrollment_history';
  END IF;
  UPDATE public.children
  SET status = 'inactive', deleted_at = now(), updated_at = now()
  WHERE child_id = p_child_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_cancel_enrollment(p_enrollment_id uuid, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id AND parent_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'enrollment_not_owned';
  END IF;
  -- Business rule (docs/alur-bisnis-dan-database-ayomi.md 4.3): a Parent may
  -- self-cancel only while pending. pending_payment/approved need Admin
  -- handling because a charge or refund decision is involved.
  IF v_enrollment.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'enrollment_cannot_be_cancelled';
  END IF;

  UPDATE public.enrollments
  SET status = 'cancelled', cancelled_at = now(), version = version + 1
  WHERE id = p_enrollment_id;
  INSERT INTO public.enrollment_status_logs (
    enrollment_id, from_status, to_status, actor_id, actor_type, reason, request_id
  ) VALUES (
    p_enrollment_id, v_enrollment.status, 'cancelled', auth.uid(), 'user',
    COALESCE(NULLIF(btrim(p_reason), ''), 'Cancelled by parent'), v_request_id
  );
  PERFORM public.app_internal_audit(
    'enrollment.cancel', 'enrollment', p_enrollment_id, v_enrollment.daycare_id,
    p_reason, jsonb_build_object('status', v_enrollment.status),
    jsonb_build_object('status', 'cancelled'), v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_update_child(p_child_id uuid, p_full_name text, p_birth_date date, p_gender text, p_general_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_child public.children%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;
  IF p_full_name IS NULL OR char_length(btrim(p_full_name)) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_name';
  END IF;
  IF p_birth_date IS NULL OR p_birth_date > CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_birth_date';
  END IF;
  IF (p_gender IS NOT NULL AND p_gender NOT IN ('female', 'male'))
     OR char_length(COALESCE(p_general_notes, '')) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_fields';
  END IF;

  SELECT * INTO v_child
  FROM public.children
  WHERE child_id = p_child_id AND parent_id = v_parent_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;
  -- Age eligibility was checked against the stored birth date; it may not
  -- change once the child appears in any enrollment.
  IF p_birth_date IS DISTINCT FROM v_child.birth_date
     AND EXISTS (SELECT 1 FROM public.enrollments WHERE child_id = p_child_id) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'child_has_enrollment_history';
  END IF;

  UPDATE public.children
  SET full_name = btrim(p_full_name),
      birth_date = p_birth_date,
      gender = p_gender,
      general_notes = NULLIF(btrim(COALESCE(p_general_notes, '')), ''),
      updated_at = now()
  WHERE child_id = p_child_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_update_child_health(p_child_id uuid, p_allergies text, p_medical_history text, p_special_needs text, p_medication_notes text, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_profile public.child_health_profiles%ROWTYPE;
  v_before_data jsonb;
  v_after_data jsonb;
  v_log_id uuid;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_new_version integer;
BEGIN
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = v_parent_id
      AND u.role = 'parent'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;

  IF p_child_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.children AS c
    WHERE c.child_id = p_child_id
      AND c.parent_id = v_parent_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;

  IF char_length(COALESCE(p_allergies, '')) > 4000
     OR char_length(COALESCE(p_medical_history, '')) > 4000
     OR char_length(COALESCE(p_special_needs, '')) > 4000
     OR char_length(COALESCE(p_medication_notes, '')) > 4000
     OR char_length(COALESCE(v_reason, '')) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'health_text_too_long';
  END IF;

  -- Lock the child so simultaneous edits receive consecutive versions.
  PERFORM 1
  FROM public.children AS c
  WHERE c.child_id = p_child_id
    AND c.parent_id = v_parent_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'child_not_owned';
  END IF;

  -- Initialize an empty health profile if the child predates this flow.
  INSERT INTO public.child_health_profiles (child_id, updated_by)
  VALUES (p_child_id, v_parent_id)
  ON CONFLICT (child_id) DO NOTHING;

  SELECT * INTO v_profile
  FROM public.child_health_profiles AS hp
  WHERE hp.child_id = p_child_id
  FOR UPDATE;

  v_before_data := jsonb_build_object(
    'allergies', v_profile.allergies,
    'medical_history', v_profile.medical_history,
    'special_needs', v_profile.special_needs,
    'medication_notes', v_profile.medication_notes
  );

  v_after_data := jsonb_build_object(
    'allergies', NULLIF(btrim(p_allergies), ''),
    'medical_history', NULLIF(btrim(p_medical_history), ''),
    'special_needs', NULLIF(btrim(p_special_needs), ''),
    'medication_notes', NULLIF(btrim(p_medication_notes), '')
  );

  IF v_before_data = v_after_data THEN
    RETURN v_profile.version;
  END IF;

  v_new_version := v_profile.version + 1;

  UPDATE public.child_health_profiles
  SET allergies = v_after_data ->> 'allergies',
      medical_history = v_after_data ->> 'medical_history',
      special_needs = v_after_data ->> 'special_needs',
      medication_notes = v_after_data ->> 'medication_notes',
      version = v_new_version,
      updated_by = v_parent_id,
      updated_at = now()
  WHERE child_id = p_child_id;

  INSERT INTO public.child_health_change_logs (
    child_id, from_version, to_version, before_data, after_data, changed_by, reason
  ) VALUES (
    p_child_id, v_profile.version, v_new_version,
    v_before_data, v_after_data, v_parent_id, v_reason
  )
  RETURNING id INTO v_log_id;

  -- Notify currently authorized staff without including health details.
  WITH approved_daycares AS (
    SELECT DISTINCT e.daycare_id
    FROM public.enrollments AS e
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
  ), eligible_recipients AS (
    SELECT d.main_manager_id AS recipient_id
    FROM approved_daycares AS ad
    JOIN public.daycares AS d ON d.id = ad.daycare_id
    JOIN public.users AS u ON u.id = d.main_manager_id
    JOIN public.daycare_members AS dm
      ON dm.daycare_id = d.id
     AND dm.user_id = u.id
     AND dm.member_role = 'manager'
     AND dm.status = 'active'
    WHERE d.status = 'active'
      AND d.deleted_at IS NULL
      AND u.role = 'manager'
      AND u.status = 'active'
      AND u.deleted_at IS NULL

    UNION

    SELECT ca.caregiver_id AS recipient_id
    FROM public.enrollments AS e
    JOIN public.caregiver_assignments AS ca ON ca.enrollment_id = e.id
    JOIN public.daycare_members AS dm
      ON dm.daycare_id = e.daycare_id
     AND dm.user_id = ca.caregiver_id
     AND dm.member_role = 'caregiver'
     AND dm.status = 'active'
    JOIN public.users AS u ON u.id = ca.caregiver_id
    WHERE e.child_id = p_child_id
      AND e.status = 'approved'
      AND ca.starts_at <= now()
      AND ca.ends_at > now()
      AND ca.ended_early_at IS NULL
      AND u.role = 'caregiver'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  )
  INSERT INTO public.notifications (
    recipient_id, event_type, health_change_id, title, body,
    priority, deduplication_key, available_at
  )
  SELECT DISTINCT
    er.recipient_id,
    'child_health_updated',
    v_log_id,
    'Informasi kesehatan anak diperbarui',
    'Orang tua memperbarui informasi kesehatan. Buka aplikasi untuk memeriksa akses dan melihat data terbaru.',
    'normal',
    'child-health-updated:' || v_log_id::text || ':' || er.recipient_id::text,
    now()
  FROM eligible_recipients AS er
  WHERE er.recipient_id <> v_parent_id
  ON CONFLICT (deduplication_key) DO NOTHING;

  RETURN v_new_version;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_withdraw_review(p_review_id uuid, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  SELECT * INTO v_review FROM public.reviews
  WHERE id = p_review_id AND parent_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_review.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'review_not_owned_or_withdrawn';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'withdraw_reason_required';
  END IF;
  UPDATE public.reviews SET withdrawn_at = now() WHERE id = p_review_id;
  PERFORM public.app_internal_audit(
    'review.withdraw', 'review', p_review_id, v_review.daycare_id, p_reason,
    jsonb_build_object('withdrawn_at', NULL), jsonb_build_object('withdrawn_at', now()),
    v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_save_daily_activity(p_activity_id uuid, p_enrollment_id uuid, p_report_date date, p_activity_type text, p_title text, p_body text, p_occurred_at timestamp with time zone, p_details jsonb, p_status text, p_is_urgent boolean, p_urgent_reason text, p_change_reason text, p_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_enrollment public.enrollments%ROWTYPE;
  v_report_id uuid;
  v_activity public.daily_report_activities%ROWTYPE;
  v_activity_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF COALESCE(p_activity_type, '') NOT IN ('play', 'learning', 'interaction', 'meal', 'sleep', 'other')
     OR COALESCE(p_status, '') NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_activity_type_or_status';
  END IF;
  IF p_report_date IS NULL OR p_report_date > CURRENT_DATE
     OR p_occurred_at IS NULL OR p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_activity_time';
  END IF;
  IF char_length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 3 AND 100
     OR char_length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_activity_content';
  END IF;
  IF COALESCE(p_is_urgent, false)
     AND char_length(btrim(COALESCE(p_urgent_reason, ''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'urgent_reason_required';
  END IF;

  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id
  FOR SHARE;
  IF NOT FOUND OR v_enrollment.status <> 'approved'
     OR NOT public.app_is_current_assigned_caregiver(p_enrollment_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'active_caregiver_assignment_required';
  END IF;
  IF p_report_date <> v_enrollment.service_date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'report_date_outside_service';
  END IF;

  INSERT INTO public.daily_reports (enrollment_id, report_date, created_by)
  VALUES (p_enrollment_id, p_report_date, v_user_id)
  ON CONFLICT (enrollment_id, report_date) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_report_id;

  IF p_activity_id IS NULL THEN
    INSERT INTO public.daily_report_activities (
      report_id, caregiver_id, activity_type, title, body, occurred_at,
      details, status, is_urgent, urgent_reason, sent_at, draft_ai_job_id
    ) VALUES (
      v_report_id, v_user_id, p_activity_type, btrim(p_title), btrim(p_body),
      p_occurred_at, COALESCE(p_details, '{}'::jsonb), p_status,
      COALESCE(p_is_urgent, false),
      CASE WHEN p_is_urgent THEN btrim(p_urgent_reason) ELSE NULL END,
      CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
      NULL
    ) RETURNING id INTO v_activity_id;
  ELSE
    SELECT * INTO v_activity
    FROM public.daily_report_activities
    WHERE id = p_activity_id
    FOR UPDATE;
    IF NOT FOUND OR v_activity.report_id <> v_report_id
       OR v_activity.caregiver_id <> v_user_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'activity_not_owned';
    END IF;
    IF v_activity.status <> 'draft' OR v_activity.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'sent_activity_is_immutable';
    END IF;
    IF char_length(btrim(COALESCE(p_change_reason, ''))) < 5 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'change_reason_required';
    END IF;

    UPDATE public.daily_report_activities
    SET activity_type = p_activity_type,
        title = btrim(p_title), body = btrim(p_body),
        occurred_at = p_occurred_at,
        details = COALESCE(p_details, '{}'::jsonb),
        status = p_status, is_urgent = COALESCE(p_is_urgent, false),
        urgent_reason = CASE WHEN p_is_urgent THEN btrim(p_urgent_reason) ELSE NULL END,
        sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
        version = version + 1
    WHERE id = p_activity_id;

    INSERT INTO public.report_change_logs (
      activity_id, changed_by, before_title, after_title,
      before_body, after_body, reason, from_version, to_version
    ) VALUES (
      p_activity_id, v_user_id, v_activity.title, btrim(p_title),
      v_activity.body, btrim(p_body), btrim(p_change_reason),
      v_activity.version, v_activity.version + 1
    );
    v_activity_id := p_activity_id;
  END IF;

  IF p_status = 'sent' THEN
    PERFORM public.app_internal_notify(
      v_enrollment.parent_id,
      CASE WHEN p_is_urgent THEN 'daily_activity_urgent' ELSE 'daily_activity_sent' END,
      CASE WHEN p_is_urgent THEN 'Catatan penting dari pengasuh' ELSE 'Cerita baru hari ini' END,
      btrim(p_title),
      CASE WHEN p_is_urgent THEN 'urgent' ELSE 'normal' END,
      'daily-activity-sent:' || v_activity_id::text,
      p_enrollment_id
    );
  END IF;

  PERFORM public.app_internal_audit(
    CASE WHEN p_activity_id IS NULL THEN 'daily_activity.create' ELSE 'daily_activity.update' END,
    'daily_report_activity', v_activity_id, v_enrollment.daycare_id,
    p_change_reason, NULL,
    jsonb_build_object('status', p_status, 'urgent', p_is_urgent), v_request_id
  );
  RETURN v_activity_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_submit_review(p_enrollment_id uuid, p_rating integer, p_body text, p_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_review_id uuid;
  v_version_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5
     OR char_length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 20 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_review';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments
  WHERE id = p_enrollment_id AND parent_id = auth.uid() AND status = 'completed'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'completed_enrollment_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE parent_id = auth.uid() AND daycare_id = v_enrollment.daycare_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'review_already_exists';
  END IF;
  INSERT INTO public.reviews (parent_id, daycare_id, qualifying_enrollment_id)
  VALUES (auth.uid(), v_enrollment.daycare_id, p_enrollment_id)
  RETURNING id INTO v_review_id;
  INSERT INTO public.review_versions (
    review_id, version, rating, body, moderation_status, ai_job_id
  ) VALUES (v_review_id, 1, p_rating, btrim(p_body), 'pending', NULL)
  RETURNING id INTO v_version_id;
  PERFORM public.app_internal_audit(
    'review.submit', 'review', v_review_id, v_enrollment.daycare_id,
    'Parent submitted review for manual moderation', NULL,
    jsonb_build_object('version_id', v_version_id, 'rating', p_rating), v_request_id
  );
  RETURN v_review_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_update_incident_status(p_incident_id uuid, p_status text, p_reason text, p_request_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_incident public.incident_reports%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF COALESCE(p_status, '') NOT IN ('in_progress', 'resolved')
     OR char_length(btrim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_incident_status_update';
  END IF;
  SELECT * INTO v_incident FROM public.incident_reports
  WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_not_found'; END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_incident.enrollment_id;
  IF NOT public.app_is_daycare_manager(v_enrollment.daycare_id)
     AND public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_review_scope_required';
  END IF;
  IF v_incident.status = 'resolved' OR v_incident.status = p_status THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'incident_transition_not_allowed';
  END IF;
  UPDATE public.incident_reports
  SET status = p_status,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
      version = version + 1
  WHERE id = p_incident_id;
  INSERT INTO public.incident_status_logs (
    incident_id, from_status, to_status, actor_id, reason
  ) VALUES (p_incident_id, v_incident.status, p_status, auth.uid(), btrim(p_reason));
  PERFORM public.app_internal_notify(
    v_enrollment.parent_id, 'incident_status_updated', 'Status laporan diperbarui',
    btrim(p_reason), 'normal',
    'incident-status:' || p_incident_id::text || ':' || (v_incident.version + 1)::text,
    v_enrollment.id
  );
  PERFORM public.app_internal_audit(
    'incident.status_update', 'incident', p_incident_id, v_enrollment.daycare_id,
    p_reason, jsonb_build_object('status', v_incident.status),
    jsonb_build_object('status', p_status), v_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_update_parent_profile(p_full_name text, p_phone text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_phone text := NULLIF(btrim(p_phone), '');
BEGIN
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = v_parent_id
      AND u.role = 'parent'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;

  IF p_full_name IS NULL
     OR char_length(btrim(p_full_name)) < 2
     OR char_length(btrim(p_full_name)) > 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_parent_name';
  END IF;

  IF v_phone IS NOT NULL AND v_phone !~ '^8[0-9]{8,11}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_parent_phone';
  END IF;

  UPDATE public.users
  SET full_name = btrim(p_full_name),
      phone = v_phone,
      updated_at = now()
  WHERE id = v_parent_id
    AND role = 'parent'
    AND status = 'active'
    AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_parent_profile_for_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.users (id, role, full_name, phone, status)
  VALUES (
    NEW.id,
    'parent',
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), ''),
    'active'
  );
  RETURN NEW;
END;
$function$;

-- ===================== TRIGGER =====================
CREATE TRIGGER on_auth_user_created_parent_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_parent_profile_for_auth_user();

-- ===================== RLS POLICY =====================
CREATE POLICY activity_acknowledgements_parent_read ON public.activity_acknowledgements AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ((daily_report_activities a
     JOIN daily_reports r ON ((r.id = a.report_id)))
     JOIN enrollments e ON ((e.id = r.enrollment_id)))
  WHERE ((a.id = activity_acknowledgements.activity_id) AND (a.status = 'sent'::text) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text]))))));
CREATE POLICY attachment_variants_parent_masked_read ON public.attachment_variants AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_can_parent_read_logbook_variant(id));
CREATE POLICY authorized_pickups_parent_read ON public.authorized_pickups AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM children c
  WHERE ((c.child_id = authorized_pickups.child_id) AND (c.parent_id = auth.uid())))));
CREATE POLICY caregiver_assignments_self_read ON public.caregiver_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((caregiver_id = auth.uid()));
CREATE POLICY child_health_change_logs_parent_read ON public.child_health_change_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM children c
  WHERE ((c.child_id = child_health_change_logs.child_id) AND (c.parent_id = auth.uid())))));
CREATE POLICY child_health_correction_requests_parent_read ON public.child_health_correction_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM children c
  WHERE ((c.child_id = child_health_correction_requests.child_id) AND (c.parent_id = auth.uid())))));
CREATE POLICY child_health_profiles_assigned_caregiver_read ON public.child_health_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_can_caregiver_read_current_child_health(child_id));
CREATE POLICY child_health_profiles_manager_approved_read ON public.child_health_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_can_manager_read_current_child_health(child_id));
CREATE POLICY child_health_profiles_parent_read ON public.child_health_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM children c
  WHERE ((c.child_id = child_health_profiles.child_id) AND (c.parent_id = auth.uid())))));
CREATE POLICY children_select_parent ON public.children AS PERMISSIVE FOR SELECT TO authenticated
  USING ((parent_id = auth.uid()));
CREATE POLICY complaint_status_logs_parent_read ON public.complaint_status_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM complaints c
  WHERE ((c.id = complaint_status_logs.complaint_id) AND (c.submitted_by = auth.uid())))));
CREATE POLICY complaints_parent_read ON public.complaints AS PERMISSIVE FOR SELECT TO authenticated
  USING ((submitted_by = auth.uid()));
CREATE POLICY daily_report_activities_caregiver_own_read ON public.daily_report_activities AS PERMISSIVE FOR SELECT TO authenticated
  USING ((caregiver_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY daily_report_activities_parent_read ON public.daily_report_activities AS PERMISSIVE FOR SELECT TO authenticated
  USING (((status = 'sent'::text) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM (daily_reports r
     JOIN enrollments e ON ((e.id = r.enrollment_id)))
  WHERE ((r.id = daily_report_activities.report_id) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text])))))));
CREATE POLICY daily_reports_caregiver_own_read ON public.daily_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY daily_reports_parent_read ON public.daily_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.id = daily_reports.enrollment_id) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text]))))));
CREATE POLICY daycare_delegations_manager_or_participant_read ON public.daycare_delegations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((app_is_daycare_manager(daycare_id) OR (grantor_id = auth.uid()) OR (grantee_id = auth.uid())));
CREATE POLICY daycare_listings_admin_read ON public.daycare_listings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((app_current_role() = 'admin'::text));
CREATE POLICY daycare_listings_public_read ON public.daycare_listings AS PERMISSIVE FOR SELECT TO anon,authenticated
  USING ((visibility = 'published'::text));
CREATE POLICY daycare_members_manager_or_self_read ON public.daycare_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR app_is_daycare_manager(daycare_id)));
CREATE POLICY daycares_manager_read ON public.daycares AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_is_daycare_manager(id));
CREATE POLICY daycares_specific_user_read ON public.daycares AS PERMISSIVE FOR SELECT TO authenticated
  USING (((( SELECT auth.uid() AS uid) = '7b02b27e-c8b2-4561-9858-25d8859001a9'::uuid) AND (id = '180e0aaf-edbd-45ee-9131-a7b7a88ef1a1'::uuid) AND (status = 'active'::text) AND (deleted_at IS NULL)));
CREATE POLICY delegation_permissions_manager_or_participant_read ON public.delegation_permissions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM daycare_delegations d
  WHERE ((d.id = delegation_permissions.delegation_id) AND (app_is_daycare_manager(d.daycare_id) OR (d.grantor_id = auth.uid()) OR (d.grantee_id = auth.uid()))))));
CREATE POLICY enrollment_consents_parent_read ON public.enrollment_consents AS PERMISSIVE FOR SELECT TO authenticated
  USING ((parent_id = auth.uid()));
CREATE POLICY enrollment_service_dates_parent_read ON public.enrollment_service_dates AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.id = enrollment_service_dates.enrollment_id) AND (e.parent_id = auth.uid())))));
CREATE POLICY enrollment_status_logs_parent_read ON public.enrollment_status_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.id = enrollment_status_logs.enrollment_id) AND (e.parent_id = auth.uid())))));
CREATE POLICY enrollments_parent_read ON public.enrollments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((parent_id = auth.uid()));
CREATE POLICY incident_ai_analyses_parent_read ON public.incident_ai_analyses AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (incident_reports i
     JOIN enrollments e ON ((e.id = i.enrollment_id)))
  WHERE ((i.id = incident_ai_analyses.incident_id) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text]))))));
CREATE POLICY incident_parent_ack_parent_read ON public.incident_parent_acknowledgements AS PERMISSIVE FOR SELECT TO authenticated
  USING (((parent_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (incident_reports i
     JOIN enrollments e ON ((e.id = i.enrollment_id)))
  WHERE ((i.id = incident_parent_acknowledgements.incident_id) AND (e.parent_id = auth.uid()))))));
CREATE POLICY incident_reports_parent_read ON public.incident_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.id = incident_reports.enrollment_id) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text]))))));
CREATE POLICY incident_status_logs_parent_read ON public.incident_status_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (incident_reports i
     JOIN enrollments e ON ((e.id = i.enrollment_id)))
  WHERE ((i.id = incident_status_logs.incident_id) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text]))))));
CREATE POLICY incident_urgency_logs_parent_read ON public.incident_urgency_change_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (incident_reports i
     JOIN enrollments e ON ((e.id = i.enrollment_id)))
  WHERE ((i.id = incident_urgency_change_logs.incident_id) AND (e.parent_id = auth.uid()) AND (e.status = ANY (ARRAY['approved'::text, 'completed'::text]))))));
CREATE POLICY notification_receipts_user_read ON public.notification_receipts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY notifications_recipient_read ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recipient_id = auth.uid()));
CREATE POLICY review_replies_parent_read_own_review ON public.review_replies AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_replies.review_id) AND (r.parent_id = auth.uid())))));
CREATE POLICY review_reply_versions_parent_read_approved ON public.review_reply_versions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((status = 'approved'::text) AND (EXISTS ( SELECT 1
   FROM (review_replies rr
     JOIN reviews r ON ((r.id = rr.review_id)))
  WHERE ((rr.id = review_reply_versions.reply_id) AND (r.parent_id = auth.uid()))))));
CREATE POLICY review_versions_parent_read_own ON public.review_versions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM reviews r
  WHERE ((r.id = review_versions.review_id) AND (r.parent_id = auth.uid())))));
CREATE POLICY reviews_parent_read_own ON public.reviews AS PERMISSIVE FOR SELECT TO authenticated
  USING ((parent_id = auth.uid()));
CREATE POLICY service_offerings_manager_read ON public.service_offerings AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_is_daycare_manager(daycare_id));
CREATE POLICY service_price_versions_manager_read ON public.service_price_versions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM service_offerings s
  WHERE ((s.id = service_price_versions.offering_id) AND app_is_daycare_manager(s.daycare_id)))));
CREATE POLICY staff_invitations_manager_read ON public.staff_invitations AS PERMISSIVE FOR SELECT TO authenticated
  USING (app_is_daycare_manager(daycare_id));
CREATE POLICY users_select_own_profile ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id = ( SELECT auth.uid() AS uid)));

-- ===================== HAK AKSES TABEL (anon/authenticated) =====================
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.account_sanctions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.account_sanctions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.activity_acknowledgements TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.activity_acknowledgements TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.admin_actions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.admin_actions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.ai_jobs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.ai_jobs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.attachment_variants TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.attachment_variants TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.attachments TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.attachments TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.audit_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.audit_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.authorized_pickups TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.authorized_pickups TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.caregiver_assignments TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.caregiver_assignments TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.charges TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.charges TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.child_health_change_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.child_health_change_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.child_health_correction_requests TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.child_health_correction_requests TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.child_health_profiles TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.child_health_profiles TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.children TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.children TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.commission_rules TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.commission_rules TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.complaint_assignments TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.complaint_assignments TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.complaint_status_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.complaint_status_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.complaints TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.complaints TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daily_report_activities TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daily_report_activities TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daily_reports TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daily_reports TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_delegations TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_delegations TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_documents TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_documents TO authenticated;
GRANT SELECT ON public.daycare_listings TO anon;
GRANT SELECT ON public.daycare_listings TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_members TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_members TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_payout_accounts TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_payout_accounts TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_safety_scores TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_safety_scores TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_verifications TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycare_verifications TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycares TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.daycares TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.delegation_permissions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.delegation_permissions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollment_consents TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollment_consents TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollment_service_dates TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollment_service_dates TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollment_status_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollment_status_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollments TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.enrollments TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.financial_holds TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.financial_holds TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_ai_analyses TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_ai_analyses TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_parent_acknowledgements TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_parent_acknowledgements TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_reports TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_reports TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_status_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_status_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_urgency_change_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.incident_urgency_change_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.investigations TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.investigations TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notification_delivery_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notification_delivery_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notification_receipts TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notification_receipts TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notification_reminders TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notification_reminders TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notifications TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.notifications TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payment_details TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payment_details TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payment_webhook_events TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payment_webhook_events TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payout_account_change_requests TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payout_account_change_requests TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payout_items TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payout_items TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payouts TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.payouts TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.pickup_records TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.pickup_records TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.refunds TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.refunds TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.report_change_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.report_change_logs TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.review_replies TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.review_replies TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.review_reply_versions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.review_reply_versions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.review_versions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.review_versions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.reviews TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.reviews TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.service_offerings TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.service_offerings TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.service_price_versions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.service_price_versions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.staff_invitations TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.staff_invitations TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.system_settings TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.system_settings TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.transactions TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.transactions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.users TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.users TO authenticated;

-- ===================== HAK EKSEKUSI FUNGSI =====================
GRANT EXECUTE ON FUNCTION public.app_acknowledge_activity(p_activity_id uuid, p_ack_type text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_admin_list_moderation_queue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_admin_moderate_review(p_version_id uuid, p_decision text, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_admin_moderate_review_reply(p_version_id uuid, p_decision text, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_admin_record_payment_result(p_transaction_id uuid, p_status text, p_provider text, p_provider_transaction_id text, p_method_details jsonb, p_provider_fee_amount bigint, p_receipt_reference text, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_caregiver_read_current_child_health(p_child_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_manager_read_current_child_health(p_child_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_parent_read_logbook_variant(p_variant_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_read_incident_storage_object(p_bucket_id text, p_object_name text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_can_read_pickup_storage_object(p_bucket_id text, p_object_name text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_create_enrollment(p_child_id uuid, p_offering_id uuid, p_service_date date, p_policy_version text, p_consent_scope jsonb, p_wording_snapshot text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_create_incident(p_enrollment_id uuid, p_occurred_at timestamp with time zone, p_description text, p_first_aid text, p_urgency text, p_urgency_reason text, p_submission_key text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_create_parent_child(p_full_name text, p_birth_date date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_create_payment_ledger_entry(p_charge_id uuid, p_method text, p_idempotency_key text, p_expires_at timestamp with time zone) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_delete_draft_activity(p_activity_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_expire_overdue_enrollments(p_limit integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_get_enrollment(p_enrollment_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_active_daycare_member(p_daycare_id uuid, p_member_role text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_current_assigned_caregiver(p_enrollment_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_daycare_manager(p_daycare_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_parent_of_child(p_child_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_daily_activities(p_enrollment_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_daycare_offerings(p_daycare_id uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_enrollments(p_daycare_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_incidents(p_enrollment_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_my_daycares() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_my_notifications(p_only_unread boolean, p_limit integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_list_public_reviews(p_daycare_id uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_manager_assign_caregiver(p_enrollment_id uuid, p_caregiver_id uuid, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_manager_check_in_enrollment(p_enrollment_id uuid, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_manager_complete_enrollment(p_enrollment_id uuid, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_manager_decide_enrollment(p_enrollment_id uuid, p_decision text, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_manager_submit_review_reply(p_review_id uuid, p_body text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_mark_notification(p_notification_id uuid, p_read boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_parent_acknowledge_incident(p_incident_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_parent_archive_child(p_child_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_parent_cancel_enrollment(p_enrollment_id uuid, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_parent_update_child(p_child_id uuid, p_full_name text, p_birth_date date, p_gender text, p_general_notes text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_parent_update_child_health(p_child_id uuid, p_allergies text, p_medical_history text, p_special_needs text, p_medication_notes text, p_reason text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_parent_withdraw_review(p_review_id uuid, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_save_daily_activity(p_activity_id uuid, p_enrollment_id uuid, p_report_date date, p_activity_type text, p_title text, p_body text, p_occurred_at timestamp with time zone, p_details jsonb, p_status text, p_is_urgent boolean, p_urgent_reason text, p_change_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_submit_review(p_enrollment_id uuid, p_rating integer, p_body text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_update_incident_status(p_incident_id uuid, p_status text, p_reason text, p_request_id text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_update_parent_profile(p_full_name text, p_phone text) TO authenticated, service_role;
