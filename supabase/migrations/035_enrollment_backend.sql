BEGIN;

-- Internal helpers are trigger/RPC implementation details and are never
-- callable by browser roles.
CREATE OR REPLACE FUNCTION public.app_internal_notify(
  p_recipient_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_priority text,
  p_deduplication_key text,
  p_enrollment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_internal_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_daycare_id uuid,
  p_reason text,
  p_before jsonb,
  p_after jsonb,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.app_internal_notify(uuid, text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.app_internal_audit(text, text, uuid, uuid, text, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.app_create_enrollment(
  p_child_id uuid,
  p_offering_id uuid,
  p_service_date date,
  p_policy_version text,
  p_consent_scope jsonb,
  p_wording_snapshot text,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_manager_decide_enrollment(
  p_enrollment_id uuid,
  p_decision text,
  p_reason text,
  p_request_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_parent_cancel_enrollment(
  p_enrollment_id uuid,
  p_reason text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_create_payment_ledger_entry(
  p_charge_id uuid,
  p_method text,
  p_idempotency_key text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_admin_record_payment_result(
  p_transaction_id uuid,
  p_status text,
  p_provider text,
  p_provider_transaction_id text,
  p_method_details jsonb,
  p_provider_fee_amount bigint,
  p_receipt_reference text,
  p_reason text,
  p_request_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_manager_assign_caregiver(
  p_enrollment_id uuid,
  p_caregiver_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Server job (pending_payment -> expired). Run with service_role, e.g. from
-- Supabase Cron: SELECT public.app_expire_overdue_enrollments();
-- Late payments then fail with payment_state_mismatch and go to Admin review.
CREATE OR REPLACE FUNCTION public.app_expire_overdue_enrollments(
  p_limit integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.app_expire_overdue_enrollments(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_expire_overdue_enrollments(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.app_create_enrollment(uuid, uuid, date, text, jsonb, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_decide_enrollment(uuid, text, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_parent_cancel_enrollment(uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_create_payment_ledger_entry(uuid, text, text, timestamptz)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_record_payment_result(uuid, text, text, text, jsonb, bigint, text, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_assign_caregiver(uuid, uuid, timestamptz, timestamptz, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.app_create_enrollment(uuid, uuid, date, text, jsonb, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_decide_enrollment(uuid, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_cancel_enrollment(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_create_payment_ledger_entry(uuid, text, text, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_record_payment_result(uuid, text, text, text, jsonb, bigint, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_assign_caregiver(uuid, uuid, timestamptz, timestamptz, text)
  TO authenticated;

COMMIT;
