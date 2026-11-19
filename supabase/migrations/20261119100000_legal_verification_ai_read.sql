-- Legal Verification: AI reads an uploaded daycare document for the Admin.
--
-- Admin presses "Baca dengan AI" in Verifikasi legalitas. The API
-- (lib/api/legal-read.js) loads the document with app_admin_get_document_for_ai,
-- downloads the file, sends it to the OCR service (ayomi-ocr-api), asks the
-- language model for the fields with quotes, checks every quote against the
-- OCR text, and stores the result with app_admin_record_legal_verification_job.
-- The result is only a proposal shown next to the file; the Admin still
-- decides with app_admin_decide_daycare_document.
--
-- Only Admin can record: a manager must not be able to write an "AI says the
-- licence is valid" result for their own document.

BEGIN;

CREATE OR REPLACE FUNCTION public.app_admin_get_document_for_ai(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_document public.daycare_documents%ROWTYPE;
  v_daycare public.daycares%ROWTYPE;
  v_attachment public.attachments%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  SELECT * INTO v_document FROM public.daycare_documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'daycare_document_not_found';
  END IF;
  SELECT * INTO v_daycare FROM public.daycares WHERE id = v_document.daycare_id;
  SELECT * INTO v_attachment FROM public.attachments
  WHERE document_id = p_document_id AND status = 'ready'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'daycare_document_not_found';
  END IF;
  RETURN jsonb_build_object(
    'document', jsonb_build_object('id', v_document.id, 'document_type', v_document.document_type,
      'version', v_document.version, 'document_number', v_document.document_number,
      'issuer', v_document.issuer, 'valid_from', v_document.valid_from,
      'expires_on', v_document.expires_on, 'status', v_document.status),
    'daycare', jsonb_build_object('id', v_daycare.id, 'name', v_daycare.name, 'address', v_daycare.address),
    'attachment', jsonb_build_object('id', v_attachment.id, 'bucket', v_attachment.bucket,
      'object_path', v_attachment.object_path, 'mime_type', v_attachment.mime_type,
      'byte_size', v_attachment.byte_size, 'sha256', v_attachment.sha256)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_record_legal_verification_job(
  p_document_id uuid,
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
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_document public.daycare_documents%ROWTYPE;
  v_job_id uuid;
BEGIN
  IF v_user_id IS NULL OR public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
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
  SELECT * INTO v_document FROM public.daycare_documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'daycare_document_not_found';
  END IF;
  IF p_input_version IS DISTINCT FROM v_document.version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ai_source_changed';
  END IF;
  INSERT INTO public.ai_jobs (
    feature, daycare_id, document_id, provider, model, model_version, prompt_version,
    input_version, input_snapshot, output, status, attempt_number, error_code,
    requested_by, started_at, finished_at, idempotency_key
  ) VALUES (
    'legal_verification', v_document.daycare_id, p_document_id, left(btrim(p_provider), 100),
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
    WHERE idempotency_key = p_idempotency_key AND document_id = p_document_id;
    IF v_job_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_ai_job';
    END IF;
  END IF;
  RETURN v_job_id;
END;
$function$;

-- Latest AI read of a document (succeeded or failed), or null.
CREATE OR REPLACE FUNCTION public.app_admin_get_legal_verification_read(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN (
    SELECT jsonb_build_object('job_id', j.id, 'status', j.status, 'error_code', j.error_code,
      'output', j.output, 'provider', j.provider, 'model', j.model, 'prompt_version', j.prompt_version,
      'document_version', j.input_version, 'started_at', j.started_at, 'finished_at', j.finished_at)
    FROM public.ai_jobs j
    WHERE j.document_id = p_document_id AND j.feature = 'legal_verification'
    ORDER BY j.created_at DESC
    LIMIT 1
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.app_admin_get_document_for_ai(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_record_legal_verification_job(uuid, integer, text, text, text, text, jsonb, jsonb, text, text, integer, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_get_legal_verification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_admin_get_document_for_ai(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_record_legal_verification_job(uuid, integer, text, text, text, text, jsonb, jsonb, text, text, integer, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_get_legal_verification_read(uuid) TO authenticated;

COMMIT;
