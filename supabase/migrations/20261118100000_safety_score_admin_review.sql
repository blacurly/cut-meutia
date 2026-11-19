-- Safety Score reviewed by Admin from approved daycare documents.
--
-- Admin marks each component (legal, sop, staff, facility) as pass / partial /
-- fail / unknown, writes a reason, and picks the approved documents used as
-- evidence. The database checks that evidence and computes the score with the
-- same formula as lib/safety-score.js:
--   score = 40×legal + 25×sop + 20×staff + 15×facility (pass 1, partial 0.5, fail 0)
-- Rules from docs/keputusan-mvp-dan-kontrak-ai-v1.md section 6.2:
--   * any "unknown" component: no score is stored;
--   * legal not "pass": the score can be saved as a draft but never published;
--   * pass/partial need approved, unexpired documents of that component;
--   * the public page hides a score once its evidence expires or is replaced.
-- AI scoring later writes rows with source 'ai' and an ai_job_id.

ALTER TABLE public.daycare_safety_scores ALTER COLUMN ai_job_id DROP NOT NULL;
ALTER TABLE public.daycare_safety_scores ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai';
ALTER TABLE public.daycare_safety_scores DROP CONSTRAINT IF EXISTS daycare_safety_scores_source_check;
ALTER TABLE public.daycare_safety_scores ADD CONSTRAINT daycare_safety_scores_source_check
  CHECK (source IN ('ai', 'admin') AND (source = 'admin' OR ai_job_id IS NOT NULL));

-- Document type -> Safety Score component. Keep in sync with lib/document-types.js
-- (a test compares the two).
CREATE OR REPLACE FUNCTION public.app_safety_criterion_for_document(p_document_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE p_document_type
    WHEN 'operational_license' THEN 'legal'
    WHEN 'business_license' THEN 'legal'
    WHEN 'safety_sop' THEN 'sop'
    WHEN 'staff_certificate' THEN 'staff'
    WHEN 'facility_inspection' THEN 'facility'
  END
$function$;

-- Everything Admin needs to review one daycare: its documents (approved ones
-- can be evidence, pending ones are shown so Admin knows what is waiting) and
-- the latest score versions.
CREATE OR REPLACE FUNCTION public.app_admin_get_safety_review(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_daycare public.daycares%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  SELECT * INTO v_daycare FROM public.daycares WHERE id = p_daycare_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'safety_daycare_not_found';
  END IF;
  RETURN jsonb_build_object(
    'daycare', jsonb_build_object('id', v_daycare.id, 'name', v_daycare.name,
      'address', v_daycare.address, 'status', v_daycare.status),
    'as_of', v_today,
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'document_type', d.document_type,
        'criterion', public.app_safety_criterion_for_document(d.document_type),
        'version', d.version, 'document_number', d.document_number, 'issuer', d.issuer,
        'valid_from', d.valid_from, 'expires_on', d.expires_on, 'status', d.status,
        'approved_at', d.published_at,
        'expired', d.expires_on IS NOT NULL AND d.expires_on < v_today
      ) ORDER BY d.document_type, d.version DESC)
      FROM public.daycare_documents d
      WHERE d.daycare_id = p_daycare_id AND d.status IN ('approved', 'pending')), '[]'::jsonb),
    'scores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'score', s.score, 'status', s.status, 'source', s.source,
        'formula_version', s.formula_version, 'explanation', s.explanation,
        'reviewed_at', s.reviewed_at, 'published_at', s.published_at, 'created_at', s.created_at
      ) ORDER BY s.created_at DESC)
      FROM (SELECT * FROM public.daycare_safety_scores
            WHERE daycare_id = p_daycare_id ORDER BY created_at DESC LIMIT 10) s), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_save_safety_score(
  p_daycare_id uuid,
  p_criteria jsonb,
  p_publish boolean,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_item jsonb;
  v_id text;
  v_status text;
  v_reason text;
  v_doc_text text;
  v_doc public.daycare_documents%ROWTYPE;
  v_docs jsonb;
  v_seen text[] := '{}';
  v_score numeric := 0;
  v_legal text;
  v_unknown boolean := false;
  v_criteria jsonb := '[]'::jsonb;
  v_blockers jsonb;
  v_status_out text;
  v_score_id uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daycares WHERE id = p_daycare_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'safety_daycare_not_found';
  END IF;
  IF p_publish IS NULL OR jsonb_typeof(p_criteria) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_criteria) <> 4 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_safety_score';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_criteria) LOOP
    v_id := v_item ->> 'id';
    v_status := v_item ->> 'status';
    v_reason := btrim(COALESCE(v_item ->> 'reason', ''));
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR v_id IS NULL OR v_id NOT IN ('legal', 'sop', 'staff', 'facility') OR v_id = ANY (v_seen)
       OR v_status IS NULL OR v_status NOT IN ('pass', 'partial', 'fail', 'unknown')
       OR char_length(v_reason) NOT BETWEEN 5 AND 500
       OR jsonb_typeof(COALESCE(v_item -> 'document_ids', '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(COALESCE(v_item -> 'document_ids', '[]'::jsonb)) > 10 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_safety_score';
    END IF;
    v_seen := v_seen || v_id;

    v_docs := '[]'::jsonb;
    FOR v_doc_text IN
      SELECT DISTINCT value #>> '{}' FROM jsonb_array_elements(COALESCE(v_item -> 'document_ids', '[]'::jsonb))
    LOOP
      IF v_doc_text IS NULL
         OR v_doc_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_safety_evidence';
      END IF;
      SELECT * INTO v_doc FROM public.daycare_documents
      WHERE id = v_doc_text::uuid AND daycare_id = p_daycare_id;
      -- Expired documents may support a "fail" (e.g. an expired licence), not a pass.
      IF NOT FOUND OR v_doc.status <> 'approved'
         OR public.app_safety_criterion_for_document(v_doc.document_type) IS DISTINCT FROM v_id
         OR (v_status IN ('pass', 'partial') AND v_doc.expires_on IS NOT NULL AND v_doc.expires_on < v_today) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_safety_evidence';
      END IF;
      v_docs := v_docs || jsonb_build_object('id', v_doc.id, 'document_type', v_doc.document_type,
        'version', v_doc.version, 'expires_on', v_doc.expires_on);
    END LOOP;
    IF v_status IN ('pass', 'partial') AND jsonb_array_length(v_docs) = 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_safety_evidence';
    END IF;

    IF v_status = 'unknown' THEN v_unknown := true; END IF;
    IF v_id = 'legal' THEN v_legal := v_status; END IF;
    v_score := v_score
      + (CASE v_id WHEN 'legal' THEN 40 WHEN 'sop' THEN 25 WHEN 'staff' THEN 20 ELSE 15 END)
      * (CASE v_status WHEN 'pass' THEN 1 WHEN 'partial' THEN 0.5 ELSE 0 END);
    v_criteria := v_criteria || jsonb_build_object('id', v_id, 'status', v_status,
      'reason', v_reason, 'evidence', v_docs);
  END LOOP;

  IF v_unknown THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'safety_score_incomplete';
  END IF;
  IF p_publish AND v_legal <> 'pass' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'safety_score_publication_blocked';
  END IF;
  v_blockers := CASE WHEN v_legal <> 'pass' THEN '["LEGAL_NOT_PASSED"]'::jsonb ELSE '[]'::jsonb END;
  v_status_out := CASE WHEN p_publish THEN 'published' ELSE 'pending_review' END;

  -- A new version replaces older drafts; publishing also replaces the live score
  -- (one published score per daycare, enforced by a unique index).
  UPDATE public.daycare_safety_scores SET status = 'superseded'
  WHERE daycare_id = p_daycare_id AND (status = 'pending_review' OR (p_publish AND status = 'published'));

  INSERT INTO public.daycare_safety_scores (daycare_id, ai_job_id, score, formula_version,
    input_snapshot, explanation, status, reviewed_by, reviewed_at, published_at, source)
  VALUES (p_daycare_id, NULL, v_score, 'safety-v1-draft',
    jsonb_build_object('as_of', v_today,
      'weights', jsonb_build_object('legal', 40, 'sop', 25, 'staff', 20, 'facility', 15),
      'criteria', v_criteria),
    jsonb_build_object('criteria', (SELECT jsonb_agg(jsonb_build_object('id', c ->> 'id',
        'status', c ->> 'status', 'reason', c ->> 'reason')) FROM jsonb_array_elements(v_criteria) c),
      'coverage', 1, 'blockers', v_blockers),
    v_status_out, auth.uid(), now(), CASE WHEN p_publish THEN now() END, 'admin')
  RETURNING id INTO v_score_id;

  PERFORM public.app_internal_audit(
    CASE WHEN p_publish THEN 'safety_score.publish' ELSE 'safety_score.draft' END,
    'daycare_safety_score', v_score_id, p_daycare_id, NULL, NULL,
    jsonb_build_object('score', v_score, 'status', v_status_out, 'blockers', v_blockers), p_request_id);

  RETURN jsonb_build_object('id', v_score_id, 'score', v_score, 'status', v_status_out, 'blockers', v_blockers);
END;
$function$;

-- Takes a published score off the public page (wrong evidence, complaint, ...).
CREATE OR REPLACE FUNCTION public.app_admin_withdraw_safety_score(
  p_daycare_id uuid,
  p_reason text,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_score_id uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_safety_score';
  END IF;
  UPDATE public.daycare_safety_scores SET status = 'superseded'
  WHERE daycare_id = p_daycare_id AND status = 'published'
  RETURNING id INTO v_score_id;
  IF v_score_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'safety_score_not_found';
  END IF;
  PERFORM public.app_internal_audit('safety_score.withdraw', 'daycare_safety_score', v_score_id,
    p_daycare_id, p_reason, jsonb_build_object('status', 'published'),
    jsonb_build_object('status', 'superseded'), p_request_id);
  RETURN jsonb_build_object('id', v_score_id, 'status', 'superseded');
END;
$function$;

-- Public read: the published score of an active daycare. When any evidence
-- behind a pass/partial has expired or was replaced, the score is withheld
-- ("current": false) until Admin reviews it again.
CREATE OR REPLACE FUNCTION public.app_get_public_safety_score(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_score public.daycare_safety_scores%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_current boolean;
  v_valid_until date;
BEGIN
  SELECT s.* INTO v_score
  FROM public.daycare_safety_scores s
  JOIN public.daycares d ON d.id = s.daycare_id
  WHERE s.daycare_id = p_daycare_id AND s.status = 'published'
    AND d.status = 'active' AND d.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT bool_and(doc.id IS NOT NULL AND doc.status = 'approved'
           AND (doc.expires_on IS NULL OR doc.expires_on >= v_today)),
         min(doc.expires_on)
  INTO v_current, v_valid_until
  FROM jsonb_array_elements(v_score.input_snapshot -> 'criteria') c
  CROSS JOIN LATERAL jsonb_array_elements(c -> 'evidence') e
  LEFT JOIN public.daycare_documents doc ON doc.id = (e ->> 'id')::uuid
  WHERE c ->> 'status' IN ('pass', 'partial');

  IF NOT COALESCE(v_current, false) THEN
    RETURN jsonb_build_object('current', false, 'published_at', v_score.published_at);
  END IF;
  RETURN jsonb_build_object(
    'current', true,
    'score', v_score.score,
    'formula_version', v_score.formula_version,
    'source', v_score.source,
    'as_of', v_score.input_snapshot -> 'as_of',
    'published_at', v_score.published_at,
    'valid_until', v_valid_until,
    'criteria', v_score.explanation -> 'criteria'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.app_safety_criterion_for_document(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_admin_get_safety_review(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_save_safety_score(uuid, jsonb, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_withdraw_safety_score(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_get_public_safety_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_get_safety_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_save_safety_score(uuid, jsonb, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_withdraw_safety_score(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_public_safety_score(uuid) TO anon, authenticated;
