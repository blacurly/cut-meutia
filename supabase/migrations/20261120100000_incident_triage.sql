-- Incident Urgency Triage (contract v1 "incident_triage").
--
-- After a report is saved, the server sends it to the triage service
-- (ayomi-triage-api: rubric rules now, the IndoBERT model once it passes the
-- criteria in docs/panduan-incident-triage.md) and stores the result here:
--   * app_get_incident_for_triage           report text + child age for the service;
--   * app_record_incident_triage            ai_jobs + incident_ai_analyses, and
--                                           effective urgency = max(reporter, AI);
--   * app_override_incident_urgency         Manager/Admin decide, with a reason;
--   * app_list_incidents (replaced)         adds the AI result and urgency history
--                                           for Manager/Admin.
--
-- Rules enforced here, whatever the caller sends:
--   * AI can only RAISE the urgency, never lower it, and never after a
--     Manager/Admin override;
--   * every evidence quote must appear in the report text;
--   * the reporter may only record within 15 minutes of submitting, at most
--     3 times (the automatic run after submit). Manager/Admin may re-run.
-- A reporter could still forge a "higher" result, but they can already pick
-- emergency themselves; a forged result cannot lower anything.

BEGIN;

CREATE OR REPLACE FUNCTION public.app_internal_child_age_months(p_birth_date text, p_at timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_birth_date IS NULL OR p_birth_date !~ '^\d{4}-\d{2}-\d{2}$' OR p_at IS NULL THEN NULL
    ELSE GREATEST(0, (date_part('year', age(p_at::date, p_birth_date::date)) * 12
                      + date_part('month', age(p_at::date, p_birth_date::date)))::integer)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.app_get_incident_for_triage(p_incident_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_incident public.incident_reports%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  SELECT * INTO v_incident FROM public.incident_reports WHERE id = p_incident_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_not_found';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_incident.enrollment_id;
  IF NOT (v_incident.reported_by = auth.uid()
          OR public.app_current_role() IS NOT DISTINCT FROM 'admin'
          OR COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_scope_required';
  END IF;
  RETURN jsonb_build_object(
    'incident_id', v_incident.id, 'version', v_incident.version, 'occurred_at', v_incident.occurred_at,
    'description', v_incident.description, 'first_aid', v_incident.first_aid,
    'caregiver_urgency', v_incident.caregiver_urgency, 'effective_urgency', v_incident.effective_urgency,
    'urgency_source', v_incident.urgency_source, 'status', v_incident.status,
    'daycare_id', v_enrollment.daycare_id,
    'age_months', public.app_internal_child_age_months(v_enrollment.child_snapshot ->> 'birth_date', v_incident.occurred_at)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_record_incident_triage(
  p_incident_id uuid,
  p_input_version integer,
  p_provider text,
  p_model text,
  p_model_version text,
  p_prompt_version text,
  p_input_snapshot jsonb,
  p_output jsonb,
  p_status text,
  p_error_code text,
  p_attempt_number integer,
  p_started_at timestamptz,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_incident public.incident_reports%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_rank constant jsonb := '{"low": 1, "medium": 2, "high": 3, "emergency": 4}';
  v_staff boolean;
  v_job_id uuid;
  v_analysis_id uuid;
  v_urgency text;
  v_quote text;
  v_haystack text;
  v_recommendations text;
  v_raised boolean := false;
  v_recipient_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF COALESCE(p_status, '') NOT IN ('succeeded', 'failed')
     OR (p_status = 'succeeded') <> (p_output IS NOT NULL)
     OR (p_status = 'failed' AND NULLIF(btrim(COALESCE(p_error_code, '')), '') IS NULL)
     OR NULLIF(btrim(COALESCE(p_provider, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(p_model, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(p_prompt_version, '')), '') IS NULL
     OR p_input_snapshot IS NULL
     OR char_length(COALESCE(p_idempotency_key, '')) NOT BETWEEN 12 AND 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ai_job';
  END IF;

  SELECT * INTO v_incident FROM public.incident_reports WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_not_found';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_incident.enrollment_id;
  v_staff := public.app_current_role() IS NOT DISTINCT FROM 'admin'
             OR COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false);
  IF NOT v_staff THEN
    IF v_incident.reported_by <> v_user_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_scope_required';
    END IF;
    IF v_incident.created_at < now() - interval '15 minutes'
       OR (SELECT count(*) FROM public.ai_jobs
           WHERE incident_id = p_incident_id AND feature = 'incident_triage') >= 3 THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'triage_window_closed';
    END IF;
  END IF;
  IF p_input_version IS DISTINCT FROM v_incident.version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ai_source_changed';
  END IF;

  IF p_status = 'succeeded' THEN
    IF jsonb_typeof(p_output) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_output -> 'evidence_quotes') IS DISTINCT FROM 'array'
       OR char_length(COALESCE(p_output ->> 'reason', '')) NOT BETWEEN 1 AND 2000 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ai_job';
    END IF;
    v_urgency := p_output ->> 'urgency';
    IF v_urgency IS NOT NULL AND v_urgency NOT IN ('low', 'medium', 'high', 'emergency') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ai_job';
    END IF;
    v_haystack := lower(regexp_replace(v_incident.description || ' ' || v_incident.first_aid, '\s+', ' ', 'g'));
    FOR v_quote IN SELECT jsonb_array_elements_text(p_output -> 'evidence_quotes') LOOP
      IF btrim(v_quote) = '' OR position(lower(regexp_replace(btrim(v_quote), '\s+', ' ', 'g')) IN v_haystack) = 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ai_evidence_mismatch';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.ai_jobs (
    feature, daycare_id, incident_id, provider, model, model_version, prompt_version,
    input_version, input_snapshot, output, status, attempt_number, error_code,
    requested_by, started_at, finished_at, idempotency_key
  ) VALUES (
    'incident_triage', v_enrollment.daycare_id, p_incident_id, left(btrim(p_provider), 100),
    left(btrim(p_model), 200), left(COALESCE(NULLIF(btrim(p_model_version), ''), 'not_reported'), 200),
    left(btrim(p_prompt_version), 100), p_input_version::text, p_input_snapshot, p_output,
    p_status, GREATEST(COALESCE(p_attempt_number, 1), 1),
    CASE WHEN p_status = 'failed' THEN left(btrim(p_error_code), 100) ELSE NULL END,
    v_user_id, COALESCE(p_started_at, now()), now(), p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_job_id;
  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id FROM public.ai_jobs
    WHERE idempotency_key = p_idempotency_key AND incident_id = p_incident_id;
    IF v_job_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ai_job';
    END IF;
    RETURN jsonb_build_object(
      'job_id', v_job_id, 'duplicate', true, 'raised', false,
      'analysis_id', (SELECT id FROM public.incident_ai_analyses WHERE ai_job_id = v_job_id),
      'effective_urgency', v_incident.effective_urgency, 'urgency_source', v_incident.urgency_source);
  END IF;

  IF p_status = 'succeeded' AND v_urgency IS NOT NULL THEN
    SELECT concat_ws(' ',
      CASE WHEN p_output -> 'operational_actions' ? 'notify_manager' THEN 'Beri tahu Pengelola segera.' END,
      CASE WHEN p_output -> 'operational_actions' ? 'request_more_information'
           THEN 'Lengkapi informasi: ' || COALESCE((SELECT string_agg(value, ', ')
                FROM jsonb_array_elements_text(COALESCE(p_output -> 'missing_information', '[]'::jsonb))), '-') || '.' END,
      CASE WHEN p_output -> 'operational_actions' ? 'follow_approved_sop' THEN 'Ikuti SOP penanganan insiden daycare.' END)
    INTO v_recommendations;
    INSERT INTO public.incident_ai_analyses (incident_id, ai_job_id, urgency, reason, recommendations, analyzed_at, input_version)
    VALUES (p_incident_id, v_job_id, v_urgency, left(p_output ->> 'reason', 2000), COALESCE(v_recommendations, ''),
            now(), p_input_version)
    RETURNING id INTO v_analysis_id;

    IF v_incident.urgency_source <> 'manager_override'
       AND (v_rank ->> v_urgency)::integer > (v_rank ->> v_incident.effective_urgency)::integer THEN
      UPDATE public.incident_reports
      SET effective_urgency = v_urgency, urgency_source = 'ai_max', needs_urgency_review = true, updated_at = now()
      WHERE id = p_incident_id;
      INSERT INTO public.incident_urgency_change_logs (incident_id, old_urgency, new_urgency, source, actor_id, analysis_id, reason)
      VALUES (p_incident_id, v_incident.effective_urgency, v_urgency, 'ai_max', NULL, v_analysis_id,
              'Dinaikkan otomatis: usulan AI lebih tinggi dari urgensi sebelumnya.');
      v_raised := true;

      FOR v_recipient_id IN
        SELECT DISTINCT recipient_id FROM (
          SELECT dm.user_id AS recipient_id FROM public.daycare_members AS dm
            WHERE dm.daycare_id = v_enrollment.daycare_id
              AND dm.member_role = 'manager' AND dm.status = 'active' AND dm.ended_at IS NULL
          UNION SELECT u.id FROM public.users AS u
            WHERE u.role = 'admin' AND u.status = 'active' AND u.deleted_at IS NULL
        ) AS recipients
        WHERE recipient_id IS NOT NULL
      LOOP
        PERFORM public.app_internal_notify(
          v_recipient_id, 'incident_urgency_raised', 'Urgensi insiden dinaikkan AI',
          'Usulan AI menilai laporan insiden lebih mendesak dari penilaian pelapor. Tinjau dan konfirmasi urgensinya.',
          CASE WHEN v_urgency IN ('high', 'emergency') THEN 'urgent' ELSE 'normal' END,
          'incident-ai-raised:' || p_incident_id::text || ':' || v_analysis_id::text || ':' || v_recipient_id::text,
          v_incident.enrollment_id
        );
      END LOOP;
      PERFORM public.app_internal_audit(
        'incident.urgency_ai_raise', 'incident', p_incident_id, v_enrollment.daycare_id,
        'Usulan AI lebih tinggi dari urgensi sebelumnya',
        jsonb_build_object('urgency', v_incident.effective_urgency, 'source', v_incident.urgency_source),
        jsonb_build_object('urgency', v_urgency, 'source', 'ai_max', 'ai_job_id', v_job_id),
        p_idempotency_key
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'job_id', v_job_id, 'analysis_id', v_analysis_id, 'duplicate', false, 'raised', v_raised,
    'effective_urgency', CASE WHEN v_raised THEN v_urgency ELSE v_incident.effective_urgency END,
    'urgency_source', CASE WHEN v_raised THEN 'ai_max' ELSE v_incident.urgency_source END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_override_incident_urgency(
  p_incident_id uuid,
  p_urgency text,
  p_reason text,
  p_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_incident public.incident_reports%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_request_id text := COALESCE(NULLIF(btrim(p_request_id), ''), gen_random_uuid()::text);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF COALESCE(p_urgency, '') NOT IN ('low', 'medium', 'high', 'emergency')
     OR char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_urgency_override';
  END IF;
  SELECT * INTO v_incident FROM public.incident_reports WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'incident_not_found';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_incident.enrollment_id;
  IF NOT (public.app_current_role() IS NOT DISTINCT FROM 'admin'
          OR COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id), false)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'incident_review_scope_required';
  END IF;

  UPDATE public.incident_reports
  SET effective_urgency = p_urgency, urgency_source = 'manager_override', needs_urgency_review = false, updated_at = now()
  WHERE id = p_incident_id;
  INSERT INTO public.incident_urgency_change_logs (incident_id, old_urgency, new_urgency, source, actor_id, analysis_id, reason)
  VALUES (p_incident_id, v_incident.effective_urgency, p_urgency, 'manager_override', auth.uid(),
          (SELECT a.id FROM public.incident_ai_analyses AS a WHERE a.incident_id = p_incident_id
           ORDER BY a.analyzed_at DESC LIMIT 1),
          btrim(p_reason));
  PERFORM public.app_internal_audit(
    'incident.urgency_override', 'incident', p_incident_id, v_enrollment.daycare_id, btrim(p_reason),
    jsonb_build_object('urgency', v_incident.effective_urgency, 'source', v_incident.urgency_source),
    jsonb_build_object('urgency', p_urgency, 'source', 'manager_override'),
    v_request_id
  );
  RETURN jsonb_build_object('id', p_incident_id, 'urgency', p_urgency, 'urgency_source', 'manager_override');
END;
$function$;

-- Same as the live version plus caregiver urgency, review flag, and for
-- Manager/Admin the latest AI triage and the urgency history.
CREATE OR REPLACE FUNCTION public.app_list_incidents(p_enrollment_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
        'caregiver_urgency', i.caregiver_urgency, 'needs_urgency_review', i.needs_urgency_review,
        'status', i.status, 'resolved_at', i.resolved_at, 'created_at', i.created_at,
        'parent_acknowledged_at', (SELECT k.acknowledged_at FROM public.incident_parent_acknowledgements AS k
                                   WHERE k.incident_id = i.id),
        'status_logs', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('from_status', l.from_status, 'to_status', l.to_status,
                                              'reason', l.reason, 'created_at', l.created_at) ORDER BY l.created_at)
          FROM public.incident_status_logs AS l WHERE l.incident_id = i.id), '[]'::jsonb),
        'triage', CASE WHEN v_role = 'parent' THEN NULL ELSE (
          SELECT jsonb_build_object('job_id', j.id, 'status', j.status, 'error_code', j.error_code,
                                    'result', j.output, 'provider', j.provider, 'model', j.model,
                                    'model_version', j.model_version, 'finished_at', j.finished_at)
          FROM public.ai_jobs AS j
          WHERE j.incident_id = i.id AND j.feature = 'incident_triage'
          ORDER BY j.created_at DESC LIMIT 1) END,
        'urgency_changes', CASE WHEN v_role = 'parent' THEN '[]'::jsonb ELSE COALESCE((
          SELECT jsonb_agg(jsonb_build_object('old_urgency', c.old_urgency, 'new_urgency', c.new_urgency,
                                              'source', c.source, 'reason', c.reason, 'created_at', c.created_at)
                           ORDER BY c.created_at)
          FROM public.incident_urgency_change_logs AS c WHERE c.incident_id = i.id), '[]'::jsonb) END) AS item
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

REVOKE ALL ON FUNCTION public.app_internal_child_age_months(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_get_incident_for_triage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_record_incident_triage(uuid, integer, text, text, text, text, jsonb, jsonb, text, text, integer, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_override_incident_urgency(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_get_incident_for_triage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_record_incident_triage(uuid, integer, text, text, text, text, jsonb, jsonb, text, text, integer, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_override_incident_urgency(uuid, text, text, text) TO authenticated;

COMMIT;
