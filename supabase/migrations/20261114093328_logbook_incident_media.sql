BEGIN;

-- All media buckets stay private. Storage metadata is additionally constrained
-- so a client cannot upload non-image content or oversized files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logbook-originals', 'logbook-originals', false, 4194304, ARRAY['image/jpeg','image/png','image/webp']),
  ('logbook-masked', 'logbook-masked', false, 8388608, ARRAY['image/jpeg','image/png','image/webp']),
  ('incident-evidence', 'incident-evidence', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION private.app_has_current_child_media_consent(p_enrollment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.enrollment_consents c
      ON c.enrollment_id=e.id AND c.parent_id=e.parent_id
    WHERE e.id=p_enrollment_id
      AND c.consent_type='child_data_processing'
      AND c.accepted_at IS NOT NULL AND c.revoked_at IS NULL
      AND c.scope -> 'child_data_processing'='true'::jsonb
  ),false);
$function$;

CREATE OR REPLACE FUNCTION private.app_can_upload_logbook_original(p_activity_id uuid,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.daily_report_activities a
    JOIN public.daily_reports r ON r.id=a.report_id
    JOIN public.enrollments e ON e.id=r.enrollment_id
    WHERE a.id=p_activity_id AND a.deleted_at IS NULL AND a.status='draft'
      AND a.caregiver_id=auth.uid()
      AND public.app_current_role()='caregiver'
      AND public.app_is_current_assigned_caregiver(e.id)
      AND e.status IN ('approved','completed')
      AND private.app_has_current_child_media_consent(e.id)
      AND split_part(p_path,'/',1)=p_activity_id::text
      AND split_part(p_path,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      AND length(p_path)-length(replace(p_path,'/',''))=1
  ),false);
$function$;

CREATE OR REPLACE FUNCTION private.app_can_upload_logbook_variant(p_activity_id uuid,p_child_id uuid,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.daily_report_activities a
    JOIN public.daily_reports r ON r.id=a.report_id
    JOIN public.enrollments e ON e.id=r.enrollment_id
    WHERE a.id=p_activity_id AND a.deleted_at IS NULL AND a.status='draft'
      AND a.caregiver_id=auth.uid()
      AND public.app_current_role()='caregiver'
      AND public.app_is_current_assigned_caregiver(e.id)
      AND e.status IN ('approved','completed') AND e.child_id=p_child_id
      AND private.app_has_current_child_media_consent(e.id)
      AND split_part(p_path,'/',1)=p_activity_id::text
      AND split_part(p_path,'/',2)=p_child_id::text
      AND split_part(p_path,'/',3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      AND length(p_path)-length(replace(p_path,'/',''))=2
  ),false);
$function$;

CREATE OR REPLACE FUNCTION private.app_can_upload_incident_evidence(p_incident_id uuid,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.incident_reports i
    JOIN public.enrollments e ON e.id=i.enrollment_id
    WHERE i.id=p_incident_id AND i.status IN ('new','in_progress')
      AND e.status IN ('approved','completed')
      AND private.app_has_current_child_media_consent(e.id)
      AND (
        (public.app_current_role()='parent' AND e.parent_id=auth.uid())
        OR (public.app_current_role()='caregiver' AND i.reported_by=auth.uid()
            AND public.app_is_current_assigned_caregiver(e.id))
        OR public.app_is_daycare_manager(e.daycare_id)
        OR public.app_current_role()='admin'
      )
      AND split_part(p_path,'/',1)=p_incident_id::text
      AND split_part(p_path,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      AND length(p_path)-length(replace(p_path,'/',''))=1
  ),false);
$function$;

CREATE OR REPLACE FUNCTION private.app_can_delete_orphan_logbook_original(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT CASE WHEN split_part(p_path,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_logbook_original(split_part(p_path,'/',1)::uuid,p_path)
      AND NOT EXISTS (SELECT 1 FROM public.attachments a
        WHERE a.bucket='logbook-originals' AND a.object_path=p_path)
    ELSE false END;
$function$;

CREATE OR REPLACE FUNCTION private.app_can_delete_orphan_logbook_variant(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT CASE WHEN split_part(p_path,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND split_part(p_path,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_logbook_variant(
        split_part(p_path,'/',1)::uuid,split_part(p_path,'/',2)::uuid,p_path)
      AND NOT EXISTS (SELECT 1 FROM public.attachment_variants v
        WHERE v.bucket='logbook-masked' AND v.object_path=p_path)
    ELSE false END;
$function$;

CREATE OR REPLACE FUNCTION private.app_can_delete_orphan_incident_evidence(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT CASE WHEN split_part(p_path,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_incident_evidence(split_part(p_path,'/',1)::uuid,p_path)
      AND NOT EXISTS (SELECT 1 FROM public.attachments a
        WHERE a.bucket='incident-evidence' AND a.object_path=p_path)
    ELSE false END;
$function$;

CREATE OR REPLACE FUNCTION private.app_can_staff_read_logbook_variant(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.attachment_variants v
    JOIN public.attachments a ON a.id=v.attachment_id
    JOIN public.daily_report_activities act ON act.id=a.activity_id
    JOIN public.daily_reports r ON r.id=act.report_id
    JOIN public.enrollments e ON e.id=r.enrollment_id
    WHERE v.bucket='logbook-masked' AND v.object_path=p_path
      AND v.status IN ('processing','ready') AND a.status='ready'
      AND act.deleted_at IS NULL
      AND private.app_has_current_child_media_consent(e.id)
      AND (
        public.app_current_role()='admin'
        OR public.app_is_daycare_manager(e.daycare_id)
        OR (act.caregiver_id=auth.uid() AND public.app_is_current_assigned_caregiver(e.id))
      )
  ),false);
$function$;

REVOKE ALL ON FUNCTION private.app_has_current_child_media_consent(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_upload_logbook_original(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_upload_logbook_variant(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_upload_incident_evidence(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_delete_orphan_logbook_original(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_delete_orphan_logbook_variant(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_delete_orphan_incident_evidence(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_staff_read_logbook_variant(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_upload_logbook_original(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_upload_logbook_variant(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_upload_incident_evidence(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_delete_orphan_logbook_original(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_delete_orphan_logbook_variant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_delete_orphan_incident_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_staff_read_logbook_variant(text) TO authenticated;

DROP POLICY IF EXISTS logbook_originals_scoped_upload ON storage.objects;
CREATE POLICY logbook_originals_scoped_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='logbook-originals'
  AND CASE WHEN split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_logbook_original(split_part(name,'/',1)::uuid,name)
    ELSE false END
);
DROP POLICY IF EXISTS logbook_originals_orphan_cleanup ON storage.objects;
CREATE POLICY logbook_originals_orphan_cleanup ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='logbook-originals' AND private.app_can_delete_orphan_logbook_original(name));

DROP POLICY IF EXISTS logbook_variants_scoped_upload ON storage.objects;
CREATE POLICY logbook_variants_scoped_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='logbook-masked'
  AND CASE WHEN split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_logbook_variant(
      split_part(name,'/',1)::uuid,split_part(name,'/',2)::uuid,name)
    ELSE false END
);
DROP POLICY IF EXISTS logbook_variants_staff_review_read ON storage.objects;
CREATE POLICY logbook_variants_staff_review_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='logbook-masked' AND private.app_can_staff_read_logbook_variant(name));
DROP POLICY IF EXISTS logbook_variants_orphan_cleanup ON storage.objects;
CREATE POLICY logbook_variants_orphan_cleanup ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='logbook-masked' AND private.app_can_delete_orphan_logbook_variant(name));

DROP POLICY IF EXISTS incident_evidence_scoped_upload ON storage.objects;
CREATE POLICY incident_evidence_scoped_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='incident-evidence'
  AND CASE WHEN split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_incident_evidence(split_part(name,'/',1)::uuid,name)
    ELSE false END
);
DROP POLICY IF EXISTS incident_evidence_orphan_cleanup ON storage.objects;
CREATE POLICY incident_evidence_orphan_cleanup ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='incident-evidence' AND private.app_can_delete_orphan_incident_evidence(name));

CREATE OR REPLACE FUNCTION public.app_record_activity_photo(
  p_activity_id uuid,p_child_id uuid,p_original_path text,p_original_mime text,
  p_original_size bigint,p_original_sha256 text,p_variant_path text,
  p_variant_sha256 text,p_model_version text,p_quality_flags jsonb,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_attachment_id uuid; v_variant_id uuid; v_daycare_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='not_authenticated'; END IF;
  IF p_request_id IS NULL OR char_length(btrim(p_request_id)) NOT BETWEEN 12 AND 100
     OR p_original_mime IS NULL OR p_original_size IS NULL OR p_original_sha256 IS NULL
     OR p_variant_sha256 IS NULL OR p_model_version IS NULL
     OR p_original_mime NOT IN ('image/jpeg','image/png','image/webp')
     OR p_original_size NOT BETWEEN 1 AND 4194304
     OR p_original_sha256 !~ '^[0-9a-f]{64}$'
     OR p_variant_sha256 !~ '^[0-9a-f]{64}$'
     OR char_length(btrim(p_model_version)) NOT BETWEEN 1 AND 100
     OR jsonb_typeof(COALESCE(p_quality_flags,'[]'::jsonb))<>'array'
     OR octet_length(COALESCE(p_quality_flags,'[]'::jsonb)::text)>4000
     OR NOT private.app_can_upload_logbook_original(p_activity_id,p_original_path)
     OR NOT private.app_can_upload_logbook_variant(p_activity_id,p_child_id,p_variant_path)
     OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='logbook-originals' AND name=p_original_path)
     OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='logbook-masked' AND name=p_variant_path) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_activity_photo';
  END IF;
  SELECT e.daycare_id INTO v_daycare_id
  FROM public.daily_report_activities a
  JOIN public.daily_reports r ON r.id=a.report_id
  JOIN public.enrollments e ON e.id=r.enrollment_id
  WHERE a.id=p_activity_id AND e.child_id=p_child_id;

  INSERT INTO public.attachments(activity_id,uploaded_by,bucket,object_path,mime_type,byte_size,sha256,status,uploaded_at)
  VALUES(p_activity_id,auth.uid(),'logbook-originals',p_original_path,p_original_mime,
    p_original_size,p_original_sha256,'ready',now())
  RETURNING id INTO v_attachment_id;

  INSERT INTO public.attachment_variants(
    attachment_id,variant_type,audience_child_id,bucket,object_path,sha256,status)
  VALUES(v_attachment_id,'masked',p_child_id,'logbook-masked',p_variant_path,p_variant_sha256,'processing')
  RETURNING id INTO v_variant_id;

  PERFORM public.app_internal_audit('logbook.photo.attach','daily_report_activity',p_activity_id,v_daycare_id,
    'Caregiver uploaded original and generated child-focused variant',NULL,
    jsonb_build_object('attachment_id',v_attachment_id,'variant_id',v_variant_id,
      'model_version',p_model_version,'quality_flags',COALESCE(p_quality_flags,'[]'::jsonb)),p_request_id);
  RETURN jsonb_build_object('attachment_id',v_attachment_id,'variant_id',v_variant_id,'status','processing');
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_review_activity_photo_variant(
  p_variant_id uuid,p_decision text,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_variant public.attachment_variants%ROWTYPE;
  v_activity_id uuid; v_daycare_id uuid; v_role text:=public.app_current_role();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='not_authenticated'; END IF;
  IF p_request_id IS NULL OR char_length(btrim(p_request_id)) NOT BETWEEN 12 AND 100
     OR p_decision IS NULL OR p_decision NOT IN ('ready','failed') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_photo_review';
  END IF;
  SELECT v.* INTO v_variant
  FROM public.attachment_variants v
  JOIN public.attachments a ON a.id=v.attachment_id
  JOIN public.daily_report_activities act ON act.id=a.activity_id
  WHERE v.id=p_variant_id AND v.bucket='logbook-masked'
    AND act.status='draft' AND act.deleted_at IS NULL
  FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='photo_variant_not_found'; END IF;
  SELECT a.activity_id,e.daycare_id INTO v_activity_id,v_daycare_id
  FROM public.attachments a
  JOIN public.daily_report_activities act ON act.id=a.activity_id
  JOIN public.daily_reports r ON r.id=act.report_id
  JOIN public.enrollments e ON e.id=r.enrollment_id
  WHERE a.id=v_variant.attachment_id;
  IF NOT FOUND OR v_variant.status<>'processing'
     OR NOT (v_role='admin' OR public.app_is_daycare_manager(v_daycare_id)
       OR (v_role='caregiver' AND EXISTS(
         SELECT 1 FROM public.daily_report_activities a
         JOIN public.daily_reports r ON r.id=a.report_id
         WHERE a.id=v_activity_id AND a.caregiver_id=auth.uid()
           AND public.app_is_current_assigned_caregiver(r.enrollment_id)))) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='photo_review_scope_required';
  END IF;
  UPDATE public.attachment_variants
  SET status=p_decision,reviewed_by=auth.uid(),reviewed_at=now()
  WHERE id=p_variant_id;
  PERFORM public.app_internal_audit('logbook.photo.review','attachment_variant',p_variant_id,v_daycare_id,
    'Authorized staff reviewed child-focused logbook photo',
    jsonb_build_object('status',v_variant.status),
    jsonb_build_object('status',p_decision,'activity_id',v_activity_id),p_request_id);
  RETURN jsonb_build_object('id',p_variant_id,'status',p_decision,'reviewed_at',now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_activity_photos(p_activity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_activity public.daily_report_activities%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE; v_role text:=public.app_current_role();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='not_authenticated'; END IF;
  SELECT * INTO v_activity FROM public.daily_report_activities
  WHERE id=p_activity_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='activity_not_found'; END IF;
  SELECT e.* INTO v_enrollment
  FROM public.daily_reports r JOIN public.enrollments e ON e.id=r.enrollment_id
  WHERE r.id=v_activity.report_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='activity_not_found'; END IF;
  IF (CASE v_role
    WHEN 'parent' THEN v_enrollment.parent_id<>auth.uid() OR v_enrollment.status NOT IN ('approved','completed') OR v_activity.status<>'sent'
    WHEN 'manager' THEN NOT public.app_is_daycare_manager(v_enrollment.daycare_id)
    WHEN 'caregiver' THEN v_activity.caregiver_id<>auth.uid()
      OR NOT public.app_is_current_assigned_caregiver(v_enrollment.id)
    WHEN 'admin' THEN false
    ELSE true END) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='activity_not_found';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',a.id,'mime_type',a.mime_type,'byte_size',a.byte_size,
      'variants',COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id',v.id,'audience_child_id',v.audience_child_id,
          'variant_type',v.variant_type,'status',v.status,'bucket',v.bucket,'path',v.object_path)
          ORDER BY v.created_at)
        FROM public.attachment_variants v
        WHERE v.attachment_id=a.id AND v.audience_child_id=v_enrollment.child_id
          AND (v_role<>'parent' OR v.status='ready')
      ),'[]'::jsonb))
      ORDER BY a.created_at)
    FROM public.attachments a
    WHERE a.activity_id=p_activity_id AND a.bucket='logbook-originals' AND a.status='ready'
  ),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_attach_incident_evidence(
  p_incident_id uuid,p_object_path text,p_mime_type text,p_byte_size bigint,p_sha256 text,p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid; v_daycare_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='not_authenticated'; END IF;
  IF p_request_id IS NULL OR char_length(btrim(p_request_id)) NOT BETWEEN 12 AND 100
     OR p_mime_type IS NULL OR p_byte_size IS NULL OR p_sha256 IS NULL
     OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp')
     OR p_byte_size NOT BETWEEN 1 AND 10485760 OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR NOT private.app_can_upload_incident_evidence(p_incident_id,p_object_path)
     OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='incident-evidence' AND name=p_object_path) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_incident_evidence';
  END IF;
  SELECT e.daycare_id INTO v_daycare_id
  FROM public.incident_reports i JOIN public.enrollments e ON e.id=i.enrollment_id
  WHERE i.id=p_incident_id;
  INSERT INTO public.attachments(incident_id,uploaded_by,bucket,object_path,mime_type,byte_size,sha256,status,uploaded_at)
  VALUES(p_incident_id,auth.uid(),'incident-evidence',p_object_path,p_mime_type,p_byte_size,p_sha256,'ready',now())
  RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('incident.evidence.attach','incident',p_incident_id,v_daycare_id,
    'Authorized user attached incident evidence',NULL,
    jsonb_build_object('attachment_id',v_id,'mime_type',p_mime_type,'byte_size',p_byte_size),p_request_id);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_incident_evidence(p_incident_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_role text:=public.app_current_role();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='not_authenticated'; END IF;
  IF v_role IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.incident_reports i
    JOIN public.enrollments e ON e.id=i.enrollment_id
    WHERE i.id=p_incident_id AND CASE v_role
      WHEN 'parent' THEN e.parent_id=auth.uid() AND e.status IN ('approved','completed')
      WHEN 'manager' THEN public.app_is_daycare_manager(e.daycare_id)
      WHEN 'admin' THEN true
      ELSE false END
  ) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='incident_not_found'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id',a.id,'bucket',a.bucket,'path',a.object_path,
      'mime_type',a.mime_type,'byte_size',a.byte_size) ORDER BY a.created_at)
    FROM public.attachments a
    WHERE a.incident_id=p_incident_id AND a.bucket='incident-evidence' AND a.status='ready'
  ),'[]'::jsonb);
END;
$function$;

-- Normal logbook entries are publishable only after 1-3 child-specific photo
-- variants have passed staff review. Urgent reports may be sent without photos.
CREATE OR REPLACE FUNCTION private.app_require_ready_logbook_photos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_child_id uuid; v_ready_count integer;
BEGIN
  IF NEW.status='sent' AND NOT COALESCE(NEW.is_urgent,false) THEN
    SELECT e.child_id INTO v_child_id
    FROM public.daily_reports r JOIN public.enrollments e ON e.id=r.enrollment_id
    WHERE r.id=NEW.report_id;
    SELECT count(DISTINCT a.id)::integer INTO v_ready_count
    FROM public.attachments a JOIN public.attachment_variants v ON v.attachment_id=a.id
    WHERE a.activity_id=NEW.id AND a.bucket='logbook-originals' AND a.status='ready'
      AND v.bucket='logbook-masked' AND v.variant_type='masked' AND v.status='ready'
      AND v.audience_child_id=v_child_id;
    IF v_ready_count NOT BETWEEN 1 AND 3 THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='logbook_requires_1_to_3_reviewed_photos';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS daily_activity_requires_ready_photos ON public.daily_report_activities;
CREATE TRIGGER daily_activity_requires_ready_photos
BEFORE INSERT OR UPDATE OF status,is_urgent ON public.daily_report_activities
FOR EACH ROW EXECUTE FUNCTION private.app_require_ready_logbook_photos();

REVOKE ALL ON FUNCTION private.app_require_ready_logbook_photos() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.app_record_activity_photo(uuid,uuid,text,text,bigint,text,text,text,text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_review_activity_photo_variant(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_list_activity_photos(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_attach_incident_evidence(uuid,text,text,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_list_incident_evidence(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_record_activity_photo(uuid,uuid,text,text,bigint,text,text,text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_review_activity_photo_variant(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_activity_photos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_attach_incident_evidence(uuid,text,text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_incident_evidence(uuid) TO authenticated;

COMMIT;





