BEGIN;

CREATE OR REPLACE FUNCTION public.app_manager_check_in_enrollment(
  p_enrollment_id uuid,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_manager_complete_enrollment(
  p_enrollment_id uuid,
  p_reason text,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.app_create_incident(
  p_enrollment_id uuid,
  p_occurred_at timestamptz,
  p_description text,
  p_first_aid text,
  p_urgency text,
  p_urgency_reason text,
  p_submission_key text,
  p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_incident_id uuid;
  v_recipient_id uuid;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF p_urgency NOT IN ('low', 'medium', 'high', 'emergency')
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

CREATE OR REPLACE FUNCTION public.app_update_incident_status(
  p_incident_id uuid,
  p_status text,
  p_reason text,
  p_request_id text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_incident public.incident_reports%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF p_status NOT IN ('in_progress', 'resolved')
     OR char_length(btrim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_incident_status_update';
  END IF;
  SELECT * INTO v_incident FROM public.incident_reports
  WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_not_found'; END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_incident.enrollment_id;
  IF NOT public.app_is_daycare_manager(v_enrollment.daycare_id)
     AND public.app_current_role() <> 'admin' THEN
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

CREATE OR REPLACE FUNCTION public.app_parent_acknowledge_incident(p_incident_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

REVOKE ALL ON FUNCTION public.app_manager_check_in_enrollment(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_complete_enrollment(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_create_incident(uuid,timestamptz,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_update_incident_status(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_parent_acknowledge_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_manager_check_in_enrollment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_complete_enrollment(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_create_incident(uuid,timestamptz,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_incident_status(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_acknowledge_incident(uuid) TO authenticated;

COMMIT;
