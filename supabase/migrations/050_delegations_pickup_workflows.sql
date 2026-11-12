BEGIN;

-- Late minutes are unknown until the daycare schedule and grace period are
-- configured. NULL means “not calculated”, never a hidden zero-fee decision.
ALTER TABLE public.pickup_records ALTER COLUMN late_minutes DROP NOT NULL;
UPDATE storage.buckets SET public=false,file_size_limit=8388608,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] WHERE id='pickup-evidence';

CREATE OR REPLACE FUNCTION public.app_can_confirm_daycare_pickup(p_daycare_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT COALESCE(public.app_is_daycare_manager(p_daycare_id),false)
    OR (public.app_current_role()='caregiver' AND EXISTS(
      SELECT 1 FROM public.daycare_members m
      JOIN public.daycare_delegations d ON d.daycare_id=m.daycare_id AND d.grantee_id=m.user_id
      JOIN public.delegation_permissions dp ON dp.delegation_id=d.id
      WHERE m.daycare_id=p_daycare_id AND m.user_id=auth.uid()
        AND m.member_role='caregiver' AND m.status='active' AND m.ended_at IS NULL
        AND d.revoked_at IS NULL AND d.starts_at<=now() AND now()<d.ends_at
        AND dp.permission='confirm_pickup'
    ));
$function$;
REVOKE ALL ON FUNCTION public.app_can_confirm_daycare_pickup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_can_confirm_daycare_pickup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.app_can_upload_pickup_evidence(p_daycare_id uuid,p_enrollment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.app_can_confirm_daycare_pickup(p_daycare_id) AND EXISTS(
    SELECT 1 FROM public.enrollments e WHERE e.id=p_enrollment_id AND e.daycare_id=p_daycare_id
      AND e.status='approved' AND e.checked_in_at IS NOT NULL AND e.service_date<=CURRENT_DATE
  );
$function$;

CREATE OR REPLACE FUNCTION private.app_can_delete_orphan_pickup_evidence(p_daycare_id uuid,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT public.app_can_confirm_daycare_pickup(p_daycare_id) AND NOT EXISTS(
    SELECT 1 FROM public.attachments a WHERE a.bucket='pickup-evidence' AND a.object_path=p_path
  );
$function$;
REVOKE ALL ON FUNCTION private.app_can_upload_pickup_evidence(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_delete_orphan_pickup_evidence(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_upload_pickup_evidence(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_delete_orphan_pickup_evidence(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.app_manager_list_delegations(p_daycare_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id),false) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='manager_scope_required';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',d.id,'grantee_id',d.grantee_id,'grantee_name',u.full_name,
    'starts_at',d.starts_at,'ends_at',d.ends_at,'reason',d.reason,
    'revoked_at',d.revoked_at,'revocation_reason',d.revocation_reason,
    'permissions',COALESCE((SELECT jsonb_agg(dp.permission ORDER BY dp.permission)
      FROM public.delegation_permissions dp WHERE dp.delegation_id=d.id),'[]'::jsonb)
  ) ORDER BY d.created_at DESC) FROM public.daycare_delegations d
    JOIN public.users u ON u.id=d.grantee_id WHERE d.daycare_id=p_daycare_id),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_create_delegation(
  p_daycare_id uuid,p_grantee_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,
  p_permissions text[],p_reason text,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid; v_allowed constant text[]:=ARRAY['manage_caregivers','manage_assignments','manage_daily_reports','confirm_pickup'];
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id),false) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='manager_scope_required';
  END IF;
  IF p_grantee_id IS NULL OR p_grantee_id=auth.uid() OR p_starts_at IS NULL OR p_ends_at IS NULL
     OR p_starts_at>=p_ends_at OR p_ends_at<=now()
     OR char_length(btrim(COALESCE(p_reason,'')))<5
     OR p_permissions IS NULL OR cardinality(p_permissions)=0
     OR EXISTS(SELECT 1 FROM unnest(p_permissions) x WHERE x IS NULL OR NOT (x=ANY(v_allowed))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_delegation';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.daycare_members m WHERE m.daycare_id=p_daycare_id
    AND m.user_id=p_grantee_id AND m.member_role='caregiver' AND m.status='active'
    AND m.ended_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='caregiver_not_active_member';
  END IF;
  INSERT INTO public.daycare_delegations(daycare_id,grantor_id,grantee_id,starts_at,ends_at,reason)
  VALUES(p_daycare_id,auth.uid(),p_grantee_id,p_starts_at,p_ends_at,btrim(p_reason)) RETURNING id INTO v_id;
  INSERT INTO public.delegation_permissions(delegation_id,permission)
  SELECT v_id,x FROM (SELECT DISTINCT unnest(p_permissions) x) q;
  PERFORM public.app_internal_audit('daycare_delegation.create','daycare_delegation',v_id,
    p_daycare_id,p_reason,NULL,jsonb_build_object('grantee_id',p_grantee_id,
    'starts_at',p_starts_at,'ends_at',p_ends_at,'permissions',p_permissions),p_request_id);
  RETURN jsonb_build_object('id',v_id,'daycare_id',p_daycare_id,'grantee_id',p_grantee_id,
    'starts_at',p_starts_at,'ends_at',p_ends_at,'permissions',p_permissions);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_revoke_delegation(
  p_daycare_id uuid,p_delegation_id uuid,p_reason text,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.daycare_delegations%ROWTYPE;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id),false) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='manager_scope_required';
  END IF;
  IF char_length(btrim(COALESCE(p_reason,'')))<5 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='decision_reason_required';
  END IF;
  SELECT * INTO v_row FROM public.daycare_delegations
  WHERE id=p_delegation_id AND daycare_id=p_daycare_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='delegation_not_found'; END IF;
  IF v_row.revoked_at IS NULL THEN
    UPDATE public.daycare_delegations SET revoked_at=now(),revoked_by=auth.uid(),
      revocation_reason=btrim(p_reason) WHERE id=p_delegation_id;
    PERFORM public.app_internal_audit('daycare_delegation.revoke','daycare_delegation',p_delegation_id,
      p_daycare_id,p_reason,jsonb_build_object('revoked_at',NULL),
      jsonb_build_object('revoked_at',now()),p_request_id);
  END IF;
  RETURN jsonb_build_object('id',p_delegation_id,'revoked_at',COALESCE(v_row.revoked_at,now()));
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_list_pickup_authorizations(p_child_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.children c WHERE c.child_id=p_child_id
    AND c.parent_id=auth.uid() AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='child_not_owned';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',id,'enrollment_id',enrollment_id,'name',name,'phone',phone,
    'relationship',relationship,'permission_type',permission_type,'valid_from',valid_from,
    'valid_until',valid_until,'revoked_at',revoked_at,'consumed_at',consumed_at,
    'created_at',created_at) ORDER BY created_at DESC)
    FROM public.authorized_pickups WHERE child_id=p_child_id),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_create_pickup_authorization(
  p_child_id uuid,p_name text,p_phone text,p_relationship text,p_permission_type text,
  p_valid_from timestamptz,p_valid_until timestamptz,p_enrollment_id uuid,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.children c WHERE c.child_id=p_child_id
    AND c.parent_id=auth.uid() AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='child_not_owned';
  END IF;
  IF char_length(btrim(COALESCE(p_name,''))) NOT BETWEEN 2 AND 100
     OR p_phone IS NULL OR p_phone !~ '^\+?[0-9]{8,16}$'
     OR char_length(btrim(COALESCE(p_relationship,''))) NOT BETWEEN 2 AND 60
     OR p_permission_type IS NULL OR p_permission_type NOT IN ('standing','one_time')
     OR p_valid_from IS NULL OR (p_valid_until IS NOT NULL AND p_valid_until<p_valid_from)
     OR (p_permission_type='one_time' AND (p_enrollment_id IS NULL OR p_valid_until IS NULL))
     OR (p_enrollment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.enrollments e
       WHERE e.id=p_enrollment_id AND e.child_id=p_child_id AND e.parent_id=auth.uid())) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pickup_authorization';
  END IF;
  INSERT INTO public.authorized_pickups(child_id,created_by,enrollment_id,name,phone,relationship,
    permission_type,valid_from,valid_until)
  VALUES(p_child_id,auth.uid(),p_enrollment_id,btrim(p_name),p_phone,
    btrim(p_relationship),p_permission_type,p_valid_from,p_valid_until) RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('pickup_authorization.create','authorized_pickup',v_id,
    NULL,NULL,NULL,jsonb_build_object('child_id',p_child_id,'permission_type',p_permission_type,
      'enrollment_id',p_enrollment_id,'valid_from',p_valid_from,'valid_until',p_valid_until),p_request_id);
  RETURN jsonb_build_object('id',v_id,'child_id',p_child_id,'permission_type',p_permission_type,
    'valid_from',p_valid_from,'valid_until',p_valid_until);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_revoke_pickup_authorization(
  p_authorization_id uuid,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.authorized_pickups%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.authorized_pickups
  WHERE id=p_authorization_id AND created_by=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='pickup_authorization_not_found'; END IF;
  IF v_row.revoked_at IS NULL AND v_row.consumed_at IS NULL THEN
    UPDATE public.authorized_pickups SET revoked_at=now() WHERE id=p_authorization_id;
    PERFORM public.app_internal_audit('pickup_authorization.revoke','authorized_pickup',p_authorization_id,
      NULL,NULL,NULL,jsonb_build_object('revoked_at',NULL),jsonb_build_object('revoked_at',now()),p_request_id);
  END IF;
  RETURN jsonb_build_object('id',p_authorization_id,'revoked_at',COALESCE(v_row.revoked_at,now()));
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_list_enrollment_pickups(p_enrollment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_enrollment public.enrollments%ROWTYPE;
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id=p_enrollment_id;
  IF NOT FOUND OR (v_enrollment.parent_id<>auth.uid()
    AND NOT COALESCE(public.app_is_daycare_manager(v_enrollment.daycare_id),false)
    AND public.app_current_role() IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='enrollment_not_found';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,
    'collector',p.collector_snapshot,'verification_status',p.verification_status,
    'verification_note',p.verification_note,'verified_at',p.verified_at,
    'handed_over_at',p.handed_over_at,'late_minutes',p.late_minutes,
    'attachments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'mime_type',a.mime_type,
      'byte_size',a.byte_size) ORDER BY a.created_at) FROM public.attachments a
      WHERE a.pickup_id=p.id AND a.status='ready'),'[]'::jsonb)) ORDER BY p.created_at)
      FROM public.pickup_records p WHERE p.enrollment_id=p_enrollment_id),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_record_enrollment_pickup(
  p_enrollment_id uuid,p_authorization_id uuid,p_collector_snapshot jsonb,
  p_verification_status text,p_verification_note text,
  p_object_path text,p_mime_type text,p_byte_size bigint,p_sha256 text,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_authorization public.authorized_pickups%ROWTYPE;
  v_effective_authorization_id uuid:=p_authorization_id;
  v_pickup_id uuid;
  v_actor_role text:=public.app_current_role();
  v_success boolean;
BEGIN
  IF p_request_id IS NULL OR char_length(btrim(p_request_id)) NOT BETWEEN 12 AND 100 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_request_id';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id=p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='enrollment_not_found'; END IF;
  IF NOT public.app_can_confirm_daycare_pickup(v_enrollment.daycare_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pickup_scope_required';
  END IF;
  IF v_enrollment.status<>'approved' OR v_enrollment.checked_in_at IS NULL
     OR v_enrollment.service_date>CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='enrollment_cannot_complete';
  END IF;
  IF p_verification_status IS NULL OR p_verification_status NOT IN ('failed','verified')
     OR char_length(btrim(COALESCE(p_verification_note,'')))<5
     OR p_collector_snapshot IS NULL OR jsonb_typeof(p_collector_snapshot)<>'object'
     OR (p_collector_snapshot-ARRAY['name','phone','relationship','source'])<>'{}'::jsonb
     OR char_length(btrim(COALESCE(p_collector_snapshot->>'name',''))) NOT BETWEEN 2 AND 100
     OR COALESCE(p_collector_snapshot->>'phone','') !~ '^\+?[0-9]{8,16}$'
     OR char_length(btrim(COALESCE(p_collector_snapshot->>'relationship',''))) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pickup_record';
  END IF;
  v_success:=p_verification_status='verified';
  IF p_collector_snapshot->>'source' NOT IN ('parent','authorized','unknown') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pickup_record';
  END IF;
  IF p_authorization_id IS NULL THEN
    IF v_success AND p_collector_snapshot->>'source'<>'parent' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='pickup_authorization_required';
    END IF;
    IF v_success AND NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=v_enrollment.parent_id
      AND u.full_name=btrim(p_collector_snapshot->>'name')
      AND regexp_replace(u.phone,'[^0-9]','','g')=regexp_replace(p_collector_snapshot->>'phone','[^0-9]','','g')) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='pickup_identity_mismatch';
    END IF;
  ELSE
    SELECT * INTO v_authorization FROM public.authorized_pickups
    WHERE id=p_authorization_id AND child_id=v_enrollment.child_id FOR UPDATE;
    IF NOT FOUND THEN
      IF v_success THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pickup_authorization_invalid';
      ELSE v_effective_authorization_id:=NULL; END IF;
    END IF;
    IF FOUND AND v_success AND (v_authorization.revoked_at IS NOT NULL OR v_authorization.consumed_at IS NOT NULL
      OR v_authorization.valid_from>now() OR (v_authorization.valid_until IS NOT NULL AND v_authorization.valid_until<now())
      OR (v_authorization.enrollment_id IS NOT NULL AND v_authorization.enrollment_id<>p_enrollment_id)
      OR btrim(v_authorization.name)<>btrim(p_collector_snapshot->>'name')
      OR regexp_replace(v_authorization.phone,'[^0-9]','','g')<>regexp_replace(p_collector_snapshot->>'phone','[^0-9]','','g')) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='pickup_authorization_invalid';
    END IF;
  END IF;
  IF v_success AND (p_object_path IS NULL OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp')
    OR p_byte_size IS NULL OR p_byte_size NOT BETWEEN 1 AND 8388608
    OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
    OR p_object_path NOT LIKE v_enrollment.daycare_id::text||'/'||p_enrollment_id::text||'/%'
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='pickup-evidence' AND name=p_object_path)) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='pickup_evidence_required';
  END IF;

  INSERT INTO public.pickup_records(enrollment_id,authorization_id,collector_snapshot,
    verification_status,verification_note,confirmed_by,verified_at,handed_over_at,late_minutes,request_id)
  VALUES(p_enrollment_id,v_effective_authorization_id,p_collector_snapshot,p_verification_status,
    btrim(p_verification_note),auth.uid(),now(),CASE WHEN v_success THEN now() END,
    NULL,p_request_id) RETURNING id INTO v_pickup_id;
  IF v_success THEN
    INSERT INTO public.attachments(pickup_id,uploaded_by,bucket,object_path,mime_type,
      byte_size,sha256,status,uploaded_at)
    VALUES(v_pickup_id,auth.uid(),'pickup-evidence',p_object_path,p_mime_type,
      p_byte_size,p_sha256,'ready',now());
    IF v_effective_authorization_id IS NOT NULL AND v_authorization.permission_type='one_time' THEN
      UPDATE public.authorized_pickups SET consumed_at=now() WHERE id=v_effective_authorization_id;
    END IF;
    UPDATE public.enrollments SET status='completed',completed_at=now(),version=version+1
      WHERE id=p_enrollment_id;
    INSERT INTO public.enrollment_status_logs(enrollment_id,from_status,to_status,actor_id,actor_type,reason,request_id)
    VALUES(p_enrollment_id,'approved','completed',auth.uid(),'user',btrim(p_verification_note),p_request_id);
    PERFORM public.app_internal_notify(v_enrollment.parent_id,'enrollment_completed',
      'Penjemputan terverifikasi','Anak telah diserahkan dan layanan selesai.','normal',
      'pickup-completed:'||p_enrollment_id::text,p_enrollment_id);
  END IF;
  PERFORM public.app_internal_audit('enrollment.pickup','pickup_record',v_pickup_id,
    v_enrollment.daycare_id,btrim(p_verification_note),NULL,
    jsonb_build_object('enrollment_id',p_enrollment_id,'verification_status',p_verification_status,
      'handed_over_at',CASE WHEN v_success THEN now() END,'authorization_id',v_effective_authorization_id),p_request_id);
  RETURN jsonb_build_object('id',v_pickup_id,'enrollment_id',p_enrollment_id,
    'verification_status',p_verification_status,'completed',v_success);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_guard_completed_requires_pickup()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NOT EXISTS(SELECT 1 FROM public.pickup_records p WHERE p.enrollment_id=NEW.id
       AND p.verification_status='verified' AND p.handed_over_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='pickup_verification_required';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER enrollments_completed_requires_verified_pickup
  BEFORE UPDATE OF status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.app_guard_completed_requires_pickup();

CREATE POLICY pickup_evidence_manager_or_delegated_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK(bucket_id='pickup-evidence' AND CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_upload_pickup_evidence(((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid) ELSE false END);
CREATE POLICY pickup_evidence_scoped_read ON storage.objects
  FOR SELECT TO authenticated USING(bucket_id='pickup-evidence'
    AND public.app_can_read_pickup_storage_object(bucket_id,name));
CREATE POLICY pickup_evidence_manager_cleanup ON storage.objects
  FOR DELETE TO authenticated USING(bucket_id='pickup-evidence' AND CASE
    WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.app_can_delete_orphan_pickup_evidence(((storage.foldername(name))[1])::uuid,name) ELSE false END);

REVOKE ALL ON FUNCTION public.app_manager_list_delegations(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_manager_create_delegation(uuid,uuid,timestamptz,timestamptz,text[],text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_manager_revoke_delegation(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_parent_list_pickup_authorizations(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_parent_create_pickup_authorization(uuid,text,text,text,text,timestamptz,timestamptz,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_parent_revoke_pickup_authorization(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_list_enrollment_pickups(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_record_enrollment_pickup(uuid,uuid,jsonb,text,text,text,text,bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_manager_list_delegations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_create_delegation(uuid,uuid,timestamptz,timestamptz,text[],text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_revoke_delegation(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_list_pickup_authorizations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_create_pickup_authorization(uuid,text,text,text,text,timestamptz,timestamptz,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_revoke_pickup_authorization(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_enrollment_pickups(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_record_enrollment_pickup(uuid,uuid,jsonb,text,text,text,text,bigint,text,text) TO authenticated;

COMMIT;
