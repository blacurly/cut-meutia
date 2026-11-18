-- Logbook Drafter: record each AI draft request in ai_jobs.
--
-- The API (lib/api/logbook-draft.js) reads the caregiver's own draft
-- activity, runs the language model on the server, and then calls this
-- function to store the job (input snapshot, model, prompt version, output or
-- error code). ai_jobs has no INSERT grant for clients, so the write goes
-- through this SECURITY DEFINER function, which repeats the ownership checks.
-- A succeeded job is linked from daily_report_activities.draft_ai_job_id. The
-- activity text itself is never changed here: the caregiver reviews the draft
-- and saves it with app_save_daily_activity (logged in report_change_logs).

BEGIN;

CREATE OR REPLACE FUNCTION public.app_record_logbook_draft_job(
  p_activity_id uuid,
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
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_activity public.daily_report_activities%ROWTYPE;
  v_enrollment_id uuid;
  v_job_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'activity_not_owned';
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

  SELECT * INTO v_activity
  FROM public.daily_report_activities
  WHERE id = p_activity_id
  FOR UPDATE;
  IF NOT FOUND OR v_activity.caregiver_id <> v_user_id OR v_activity.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'activity_not_owned';
  END IF;
  IF v_activity.status <> 'draft' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'sent_activity_is_immutable';
  END IF;
  SELECT r.enrollment_id INTO v_enrollment_id
  FROM public.daily_reports AS r
  WHERE r.id = v_activity.report_id;
  IF NOT COALESCE(public.app_is_current_assigned_caregiver(v_enrollment_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'active_caregiver_assignment_required';
  END IF;
  IF p_input_version IS DISTINCT FROM v_activity.version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ai_source_changed';
  END IF;

  INSERT INTO public.ai_jobs (
    feature, activity_id, provider, model, model_version, prompt_version,
    input_version, input_snapshot, output, status, attempt_number, error_code,
    requested_by, started_at, finished_at, idempotency_key
  ) VALUES (
    'logbook_draft', p_activity_id, left(btrim(p_provider), 100), left(btrim(p_model), 200),
    left(COALESCE(NULLIF(btrim(p_model_version), ''), 'not_reported'), 200),
    left(btrim(p_prompt_version), 100), p_input_version::text, p_input_snapshot, p_output,
    p_status, GREATEST(COALESCE(p_attempt_number, 1), 1),
    CASE WHEN p_status = 'failed' THEN left(btrim(p_error_code), 100) ELSE NULL END,
    v_user_id, COALESCE(p_started_at, now()), now(), p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id
    FROM public.ai_jobs
    WHERE idempotency_key = p_idempotency_key AND requested_by = v_user_id AND activity_id = p_activity_id;
    IF v_job_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ai_job';
    END IF;
  END IF;

  IF p_status = 'succeeded' THEN
    UPDATE public.daily_report_activities
    SET draft_ai_job_id = v_job_id
    WHERE id = p_activity_id;
  END IF;
  RETURN v_job_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.app_record_logbook_draft_job(uuid, integer, text, text, text, text, jsonb, jsonb, text, text, integer, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_record_logbook_draft_job(uuid, integer, text, text, text, text, jsonb, jsonb, text, text, integer, timestamptz, text) TO authenticated;

COMMIT;
