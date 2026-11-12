BEGIN;

-- Legal documents stay in a private bucket. Managers can upload/read/delete
-- only within their own daycare folder; Admin can read files for review.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']
WHERE id = 'daycare-documents';

CREATE POLICY daycare_documents_manager_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'daycare-documents'
    AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.app_is_daycare_manager(((storage.foldername(name))[1])::uuid)
      ELSE false END
  );

CREATE POLICY daycare_documents_manager_or_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'daycare-documents'
    AND (public.app_current_role() = 'admin'
      OR CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.app_is_daycare_manager(((storage.foldername(name))[1])::uuid)
        ELSE false END)
  );

CREATE POLICY daycare_documents_manager_cleanup ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'daycare-documents'
    AND CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.app_is_daycare_manager(((storage.foldername(name))[1])::uuid)
      ELSE false END
  );

CREATE OR REPLACE FUNCTION public.app_manager_get_partner_onboarding(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_daycare public.daycares%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  SELECT * INTO v_daycare FROM public.daycares
  WHERE id = p_daycare_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'partner_not_found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_daycare.id, 'slug', v_daycare.slug, 'name', v_daycare.name,
    'description', v_daycare.description, 'address', v_daycare.address,
    'province_code', v_daycare.province_code, 'city_code', v_daycare.city_code,
    'district_code', v_daycare.district_code, 'postal_code', v_daycare.postal_code,
    'timezone', v_daycare.timezone, 'contact_phone', v_daycare.contact_phone,
    'facilities', v_daycare.facilities, 'opening_hours', v_daycare.opening_hours,
    'daily_capacity', v_daycare.daily_capacity, 'status', v_daycare.status,
    'offerings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'service_type', o.service_type,
        'description', o.description, 'min_age_months', o.min_age_months,
        'max_age_months', o.max_age_months, 'is_active', o.is_active,
        'published_price_id', o.published_price_id,
        'prices', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'version', p.version, 'service_amount', p.service_amount,
          'currency', p.currency, 'status', p.status,
          'decision_reason', p.decision_reason, 'effective_from', p.effective_from,
          'created_at', p.created_at) ORDER BY p.version DESC)
          FROM public.service_price_versions AS p WHERE p.offering_id = o.id), '[]'::jsonb)
      ) ORDER BY o.created_at)
      FROM public.service_offerings AS o WHERE o.daycare_id = p_daycare_id
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'document_type', d.document_type, 'version', d.version,
        'document_number', d.document_number, 'issuer', d.issuer,
        'valid_from', d.valid_from, 'expires_on', d.expires_on,
        'status', d.status, 'published_at', d.published_at,
        'created_at', d.created_at,
        'decision', (SELECT v.decision FROM public.daycare_verifications AS v
          WHERE v.document_id = d.id ORDER BY v.created_at DESC LIMIT 1),
        'reason', (SELECT v.reason FROM public.daycare_verifications AS v
          WHERE v.document_id = d.id ORDER BY v.created_at DESC LIMIT 1)
      ) ORDER BY d.created_at DESC)
      FROM public.daycare_documents AS d WHERE d.daycare_id = p_daycare_id
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_update_partner_profile(
  p_daycare_id uuid,
  p_payload jsonb,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_before jsonb;
  v_name text := NULLIF(btrim(p_payload ->> 'name'), '');
  v_description text := NULLIF(btrim(p_payload ->> 'description'), '');
  v_address text := NULLIF(btrim(p_payload ->> 'address'), '');
  v_phone text := NULLIF(btrim(p_payload ->> 'contact_phone'), '');
  v_capacity integer;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR (p_payload - ARRAY['name','description','address','contact_phone','facilities','opening_hours','daily_capacity']) <> '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_partner_fields';
  END IF;
  IF p_payload ->> 'daily_capacity' ~ '^[0-9]{1,4}$' THEN
    v_capacity := (p_payload ->> 'daily_capacity')::integer;
  END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 200
     OR v_description IS NULL OR char_length(v_description) NOT BETWEEN 20 AND 1500
     OR v_address IS NULL OR char_length(v_address) NOT BETWEEN 5 AND 300
     OR v_phone IS NULL OR v_phone !~ '^\+?[0-9]{8,16}$'
     OR v_capacity IS NULL OR v_capacity NOT BETWEEN 1 AND 1000
     OR jsonb_typeof(p_payload -> 'facilities') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_payload -> 'opening_hours') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_partner_profile';
  END IF;

  SELECT jsonb_build_object('name', name, 'description', description, 'address', address,
    'contact_phone', contact_phone, 'facilities', facilities,
    'opening_hours', opening_hours, 'daily_capacity', daily_capacity)
  INTO v_before FROM public.daycares WHERE id = p_daycare_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'partner_not_found';
  END IF;

  UPDATE public.daycares SET name = v_name, description = v_description,
    address = v_address, contact_phone = v_phone, facilities = p_payload -> 'facilities',
    opening_hours = p_payload -> 'opening_hours', daily_capacity = v_capacity, updated_at = now()
  WHERE id = p_daycare_id;
  PERFORM public.app_internal_audit('partner.profile.update', 'daycare', p_daycare_id,
    p_daycare_id, NULL, v_before, p_payload, p_request_id);
  RETURN public.app_manager_get_partner_onboarding(p_daycare_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_update_partner_status(
  p_daycare_id uuid, p_status text, p_reason text, p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_before text;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active','inactive','suspended') OR char_length(btrim(COALESCE(p_reason,''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_partner_status';
  END IF;
  SELECT status INTO v_before FROM public.daycares
  WHERE id = p_daycare_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'partner_not_found';
  END IF;
  UPDATE public.daycares SET status = p_status, updated_at = now() WHERE id = p_daycare_id;
  PERFORM public.app_internal_audit('partner.status.update', 'daycare', p_daycare_id,
    p_daycare_id, p_reason, jsonb_build_object('status', v_before),
    jsonb_build_object('status', p_status), p_request_id);
  RETURN jsonb_build_object('daycare_id', p_daycare_id, 'status', p_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_list_offerings(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', o.id, 'name', o.name, 'service_type', o.service_type,
    'description', o.description, 'min_age_months', o.min_age_months,
    'max_age_months', o.max_age_months, 'is_active', o.is_active,
    'published_price_id', o.published_price_id,
    'prices', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'version', p.version, 'service_amount', p.service_amount,
      'currency', p.currency, 'status', p.status, 'decision_reason', p.decision_reason,
      'effective_from', p.effective_from, 'created_at', p.created_at)
      ORDER BY p.version DESC) FROM public.service_price_versions AS p WHERE p.offering_id = o.id), '[]'::jsonb)
  ) ORDER BY o.created_at) FROM public.service_offerings AS o WHERE o.daycare_id = p_daycare_id), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_save_offering(
  p_daycare_id uuid, p_offering_id uuid, p_payload jsonb, p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_offering_id uuid := p_offering_id;
  v_name text := NULLIF(btrim(p_payload ->> 'name'), '');
  v_type text := p_payload ->> 'service_type';
  v_description text := NULLIF(btrim(p_payload ->> 'description'), '');
  v_min_age integer;
  v_max_age integer;
  v_amount bigint;
  v_late jsonb := COALESCE(p_payload -> 'late_pickup_terms', '{}'::jsonb);
  v_version integer;
  v_price_id uuid;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR (p_payload - ARRAY['name','service_type','description','min_age_months','max_age_months','is_active','service_amount','late_pickup_terms']) <> '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_offering';
  END IF;
  IF p_payload ->> 'min_age_months' ~ '^\d{1,2}$' THEN v_min_age := (p_payload ->> 'min_age_months')::integer; END IF;
  IF p_payload ->> 'max_age_months' ~ '^\d{1,2}$' THEN v_max_age := (p_payload ->> 'max_age_months')::integer; END IF;
  IF p_payload ->> 'service_amount' ~ '^\d{1,12}$' THEN v_amount := (p_payload ->> 'service_amount')::bigint; END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 100
     OR v_type IS NULL OR v_type NOT IN ('daily','monthly')
     OR v_description IS NULL OR char_length(v_description) NOT BETWEEN 10 AND 1500
     OR v_min_age IS NULL OR v_max_age IS NULL OR v_min_age < 0 OR v_max_age < v_min_age OR v_max_age > 84
     OR v_amount IS NULL OR v_amount < 1
     OR jsonb_typeof(v_late) <> 'object'
     OR jsonb_typeof(p_payload -> 'is_active') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_offering';
  END IF;

  IF v_offering_id IS NULL THEN
    INSERT INTO public.service_offerings(daycare_id, name, service_type, description,
      min_age_months, max_age_months, is_active)
    VALUES (p_daycare_id, v_name, v_type, v_description, v_min_age, v_max_age,
      (p_payload ->> 'is_active')::boolean)
    RETURNING id INTO v_offering_id;
  ELSE
    PERFORM 1 FROM public.service_offerings
    WHERE id = v_offering_id AND daycare_id = p_daycare_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'offering_not_found'; END IF;
    UPDATE public.service_offerings SET name = v_name, service_type = v_type,
      description = v_description, min_age_months = v_min_age, max_age_months = v_max_age,
      is_active = (p_payload ->> 'is_active')::boolean, updated_at = now()
    WHERE id = v_offering_id;
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM public.service_price_versions WHERE offering_id = v_offering_id;
  INSERT INTO public.service_price_versions(offering_id, version, service_amount,
    currency, late_pickup_terms, status, proposed_by)
  VALUES (v_offering_id, v_version, v_amount, 'IDR', v_late, 'pending', auth.uid())
  RETURNING id INTO v_price_id;
  PERFORM public.app_internal_audit('service_offering.propose', 'service_offering',
    v_offering_id, p_daycare_id, NULL, NULL,
    jsonb_build_object('price_version_id', v_price_id, 'version', v_version,
      'amount', v_amount, 'status', 'pending'), p_request_id);
  RETURN jsonb_build_object('offering_id', v_offering_id,
    'price_version_id', v_price_id, 'price_version', v_version, 'price_status', 'pending');
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_decide_service_price(
  p_price_version_id uuid, p_decision text, p_reason text, p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_price public.service_price_versions%ROWTYPE; v_offering public.service_offerings%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR char_length(btrim(COALESCE(p_reason,''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_price_decision';
  END IF;
  SELECT * INTO v_price FROM public.service_price_versions
  WHERE id = p_price_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'price_version_not_found'; END IF;
  IF v_price.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'price_version_not_pending';
  END IF;
  SELECT * INTO v_offering FROM public.service_offerings
  WHERE id = v_price.offering_id FOR UPDATE;
  IF p_decision = 'approved' AND v_offering.published_price_id IS NOT NULL THEN
    UPDATE public.service_price_versions SET status = 'superseded', updated_at = now()
    WHERE id = v_offering.published_price_id AND status = 'approved';
  END IF;
  UPDATE public.service_price_versions SET status = p_decision, decided_by = auth.uid(),
    decided_at = now(), decision_reason = btrim(p_reason),
    effective_from = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END, updated_at = now()
  WHERE id = p_price_version_id;
  IF p_decision = 'approved' THEN
    UPDATE public.service_offerings SET published_price_id = p_price_version_id, updated_at = now()
    WHERE id = v_offering.id;
  END IF;
  PERFORM public.app_internal_audit('service_price.decide', 'service_price_version',
    p_price_version_id, v_offering.daycare_id, p_reason,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', p_decision), p_request_id);
  RETURN jsonb_build_object('price_version_id', p_price_version_id, 'decision', p_decision);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_list_documents(p_daycare_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', d.id, 'document_type', d.document_type, 'version', d.version,
    'document_number', d.document_number, 'issuer', d.issuer,
    'valid_from', d.valid_from, 'expires_on', d.expires_on, 'status', d.status,
    'published_at', d.published_at, 'created_at', d.created_at,
    'decision', (SELECT v.decision FROM public.daycare_verifications v
      WHERE v.document_id = d.id ORDER BY v.created_at DESC LIMIT 1),
    'reason', (SELECT v.reason FROM public.daycare_verifications v
      WHERE v.document_id = d.id ORDER BY v.created_at DESC LIMIT 1)
  ) ORDER BY d.created_at DESC) FROM public.daycare_documents d WHERE d.daycare_id=p_daycare_id), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_submit_daycare_document(
  p_daycare_id uuid, p_document_type text, p_document_number text, p_issuer text,
  p_valid_from date, p_expires_on date, p_object_path text, p_mime_type text,
  p_byte_size bigint, p_sha256 text, p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_version integer; v_document_id uuid; v_supersedes uuid;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF p_document_type IS NULL OR p_document_type !~ '^[a-z][a-z0-9_]{1,39}$'
     OR (p_document_number IS NOT NULL AND char_length(p_document_number) > 100)
     OR (p_issuer IS NOT NULL AND char_length(p_issuer) > 200)
     OR (p_valid_from IS NOT NULL AND p_expires_on IS NOT NULL AND p_expires_on < p_valid_from)
     OR p_object_path IS NULL OR p_object_path NOT LIKE p_daycare_id::text || '/%'
     OR p_mime_type IS NULL OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png')
     OR p_byte_size IS NULL OR p_byte_size NOT BETWEEN 1 AND 15728640
     OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_daycare_document';
  END IF;
  SELECT id INTO v_supersedes FROM public.daycare_documents
  WHERE daycare_id = p_daycare_id AND document_type = p_document_type
  ORDER BY version DESC LIMIT 1;
  SELECT COALESCE(max(version),0)+1 INTO v_version FROM public.daycare_documents
  WHERE daycare_id=p_daycare_id AND document_type=p_document_type;
  INSERT INTO public.daycare_documents(daycare_id,document_type,version,document_number,
    issuer,valid_from,expires_on,submitted_by,status,supersedes_id)
  VALUES(p_daycare_id,p_document_type,v_version,NULLIF(btrim(p_document_number),''),
    NULLIF(btrim(p_issuer),''),p_valid_from,p_expires_on,auth.uid(),'pending',v_supersedes)
  RETURNING id INTO v_document_id;
  INSERT INTO public.attachments(document_id,uploaded_by,bucket,object_path,mime_type,
    byte_size,sha256,status,uploaded_at)
  VALUES(v_document_id,auth.uid(),'daycare-documents',p_object_path,p_mime_type,
    p_byte_size,p_sha256,'ready',now());
  PERFORM public.app_internal_audit('daycare_document.submit','daycare_document',v_document_id,
    p_daycare_id,NULL,NULL,jsonb_build_object('type',p_document_type,'version',v_version,
      'status','pending'),p_request_id);
  RETURN jsonb_build_object('id',v_document_id,'version',v_version,'status','pending');
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_daycare_documents(p_daycare_id uuid DEFAULT NULL)
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
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', d.id, 'daycare', jsonb_build_object('id', c.id,'name',c.name),
    'document_type',d.document_type,'version',d.version,'document_number',d.document_number,
    'issuer',d.issuer,'valid_from',d.valid_from,'expires_on',d.expires_on,
    'status',d.status,'created_at',d.created_at,
    'file_available',EXISTS(SELECT 1 FROM public.attachments a WHERE a.document_id=d.id AND a.status='ready')
  ) ORDER BY d.created_at DESC) FROM public.daycare_documents d
    JOIN public.daycares c ON c.id=d.daycare_id
    WHERE (p_daycare_id IS NULL OR d.daycare_id=p_daycare_id)), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_decide_daycare_document(
  p_document_id uuid,p_decision text,p_reason text,p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_document public.daycare_documents%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected','revision_required')
     OR char_length(btrim(COALESCE(p_reason,''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_document_decision';
  END IF;
  SELECT * INTO v_document FROM public.daycare_documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'daycare_document_not_found'; END IF;
  IF v_document.status NOT IN ('pending','rejected') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'daycare_document_not_pending';
  END IF;
  IF p_decision='approved' THEN
    UPDATE public.daycare_documents SET status='superseded',updated_at=now()
    WHERE daycare_id=v_document.daycare_id AND document_type=v_document.document_type
      AND status='approved' AND id<>p_document_id;
  END IF;
  UPDATE public.daycare_documents SET status=CASE WHEN p_decision='approved' THEN 'approved' ELSE 'rejected' END,
    published_at=CASE WHEN p_decision='approved' THEN now() ELSE NULL END,updated_at=now()
  WHERE id=p_document_id;
  INSERT INTO public.daycare_verifications(document_id,decision,reviewed_by,reviewed_at,reason)
  VALUES(p_document_id,p_decision,auth.uid(),now(),btrim(p_reason));
  PERFORM public.app_internal_audit('daycare_document.decide','daycare_document',p_document_id,
    v_document.daycare_id,p_reason,jsonb_build_object('status',v_document.status),
    jsonb_build_object('decision',p_decision),p_request_id);
  RETURN jsonb_build_object('document_id',p_document_id,'decision',p_decision);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_get_daycare_document_file(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_daycare_id uuid; v_path text; v_mime text;
BEGIN
  SELECT d.daycare_id,a.object_path,a.mime_type INTO v_daycare_id,v_path,v_mime
  FROM public.daycare_documents d JOIN public.attachments a ON a.document_id=d.id AND a.status='ready'
  WHERE d.id=p_document_id ORDER BY a.created_at DESC LIMIT 1;
  IF NOT FOUND OR (public.app_current_role() IS DISTINCT FROM 'admin'
     AND NOT COALESCE(public.app_is_daycare_manager(v_daycare_id),false)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'daycare_document_not_found';
  END IF;
  RETURN jsonb_build_object('bucket','daycare-documents','path',v_path,'mime_type',v_mime);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_manager_get_partner_onboarding(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_update_partner_profile(uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_update_partner_status(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_list_offerings(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_save_offering(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_decide_service_price(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_list_documents(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_submit_daycare_document(uuid,text,text,text,date,date,text,text,bigint,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_list_daycare_documents(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_decide_daycare_document(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_get_daycare_document_file(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_manager_get_partner_onboarding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_update_partner_profile(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_update_partner_status(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_list_offerings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_save_offering(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_decide_service_price(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_list_documents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_submit_daycare_document(uuid,text,text,text,date,date,text,text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_daycare_documents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_decide_daycare_document(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_daycare_document_file(uuid) TO authenticated;

COMMIT;
