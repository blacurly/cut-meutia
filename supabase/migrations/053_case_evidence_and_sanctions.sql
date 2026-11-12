BEGIN;

UPDATE storage.buckets SET public=false,file_size_limit=10485760,
  allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp']
WHERE id='case-evidence';

CREATE OR REPLACE FUNCTION private.app_can_upload_case_evidence(p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_kind text:=split_part(p_path,'/',1); v_id uuid;
BEGIN
  IF split_part(p_path,'/',2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  v_id:=split_part(p_path,'/',2)::uuid;
  IF v_kind='sanctions' THEN RETURN public.app_current_role()='admin'; END IF;
  IF v_kind='investigations' THEN RETURN public.app_current_role()='admin' AND EXISTS(
    SELECT 1 FROM public.investigations i WHERE i.id=v_id AND i.status<>'completed'); END IF;
  IF v_kind='complaints' THEN RETURN public.app_current_role()='parent' AND EXISTS(
    SELECT 1 FROM public.complaints c WHERE c.id=v_id AND c.submitted_by=auth.uid() AND c.status NOT IN ('resolved','closed'));
  END IF;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.app_can_read_case_evidence(p_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_kind text:=split_part(p_path,'/',1); v_id uuid; v_role text:=public.app_current_role();
BEGIN
  IF split_part(p_path,'/',2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  v_id:=split_part(p_path,'/',2)::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.attachments a WHERE a.bucket='case-evidence'
    AND a.object_path=p_path AND a.status='ready') THEN RETURN false; END IF;
  IF v_role='admin' THEN RETURN true; END IF;
  IF v_kind='complaints' THEN RETURN EXISTS(SELECT 1 FROM public.complaints c WHERE c.id=v_id
    AND (c.submitted_by=auth.uid() OR public.app_is_daycare_manager(c.daycare_id))); END IF;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.app_can_delete_orphan_case_evidence(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT private.app_can_upload_case_evidence(p_path) AND NOT EXISTS(
    SELECT 1 FROM public.attachments a WHERE a.bucket='case-evidence' AND a.object_path=p_path
  );
$function$;
REVOKE ALL ON FUNCTION private.app_can_upload_case_evidence(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_read_case_evidence(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.app_can_delete_orphan_case_evidence(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_upload_case_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_read_case_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.app_can_delete_orphan_case_evidence(text) TO authenticated;

CREATE POLICY case_evidence_scoped_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='case-evidence' AND private.app_can_upload_case_evidence(name));
CREATE POLICY case_evidence_scoped_read ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='case-evidence' AND private.app_can_read_case_evidence(name));
CREATE POLICY case_evidence_orphan_cleanup ON storage.objects FOR DELETE TO authenticated
  USING(bucket_id='case-evidence' AND private.app_can_delete_orphan_case_evidence(name));

CREATE OR REPLACE FUNCTION public.app_attach_complaint_evidence(
  p_complaint_id uuid,p_object_path text,p_mime_type text,p_byte_size bigint,p_sha256 text,p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' OR NOT EXISTS(
    SELECT 1 FROM public.complaints c WHERE c.id=p_complaint_id AND c.submitted_by=auth.uid()
      AND c.status NOT IN ('resolved','closed')) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='complaint_not_found';
  END IF;
  IF p_object_path NOT LIKE 'complaints/'||p_complaint_id::text||'/%'
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp')
     OR p_byte_size NOT BETWEEN 1 AND 10485760 OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='case-evidence' AND name=p_object_path) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_case_evidence';
  END IF;
  INSERT INTO public.attachments(complaint_id,uploaded_by,bucket,object_path,mime_type,byte_size,sha256,status,uploaded_at)
  VALUES(p_complaint_id,auth.uid(),'case-evidence',p_object_path,p_mime_type,p_byte_size,p_sha256,'ready',now())
  RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('complaint.evidence.attach','complaint',p_complaint_id,NULL,
    'Parent attached complaint evidence',NULL,jsonb_build_object('attachment_id',v_id),p_request_id);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_attach_investigation_evidence(
  p_investigation_id uuid,p_object_path text,p_mime_type text,p_byte_size bigint,p_sha256 text,p_request_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' OR NOT EXISTS(
    SELECT 1 FROM public.investigations WHERE id=p_investigation_id AND status<>'completed') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='investigation_not_found';
  END IF;
  IF p_object_path NOT LIKE 'investigations/'||p_investigation_id::text||'/%'
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp')
     OR p_byte_size NOT BETWEEN 1 AND 10485760 OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='case-evidence' AND name=p_object_path) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_case_evidence';
  END IF;
  INSERT INTO public.attachments(investigation_id,uploaded_by,bucket,object_path,mime_type,byte_size,sha256,status,uploaded_at)
  VALUES(p_investigation_id,auth.uid(),'case-evidence',p_object_path,p_mime_type,p_byte_size,p_sha256,'ready',now())
  RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('investigation.evidence.attach','investigation',p_investigation_id,NULL,
    'Admin attached investigation evidence',NULL,jsonb_build_object('attachment_id',v_id),p_request_id);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_create_sanction(
  p_target_user_id uuid,p_target_daycare_id uuid,p_investigation_id uuid,p_sanction_type text,
  p_reason text,p_starts_at timestamptz,p_ends_at timestamptz,p_object_path text,
  p_mime_type text,p_byte_size bigint,p_sha256 text,p_request_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_id uuid; v_audit_id uuid; v_target_user uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF (p_target_user_id IS NULL)=(p_target_daycare_id IS NULL)
     OR p_sanction_type NOT IN ('freeze','block') OR char_length(btrim(COALESCE(p_reason,'')))<10
     OR p_starts_at IS NULL OR (p_ends_at IS NOT NULL AND p_ends_at<=p_starts_at)
     OR p_object_path NOT LIKE 'sanctions/%'
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp')
     OR p_byte_size NOT BETWEEN 1 AND 10485760 OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='case-evidence' AND name=p_object_path)
     OR (p_investigation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.investigations WHERE id=p_investigation_id)) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_sanction';
  END IF;
  IF p_target_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users
    WHERE id=p_target_user_id AND role<>'admin' AND status='active' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_sanction_target';
  END IF;
  IF p_target_daycare_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.daycares WHERE id=p_target_daycare_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_sanction_target';
  END IF;
  INSERT INTO public.account_sanctions(target_user_id,target_daycare_id,investigation_id,sanction_type,
    reason,imposed_by,starts_at,ends_at)
  VALUES(p_target_user_id,p_target_daycare_id,p_investigation_id,p_sanction_type,btrim(p_reason),auth.uid(),p_starts_at,p_ends_at)
  RETURNING id INTO v_id;
  INSERT INTO public.attachments(sanction_id,uploaded_by,bucket,object_path,mime_type,byte_size,sha256,status,uploaded_at)
  VALUES(v_id,auth.uid(),'case-evidence',p_object_path,p_mime_type,p_byte_size,p_sha256,'ready',now());
  PERFORM public.app_internal_audit('account_sanction.create','account_sanction',v_id,p_target_daycare_id,
    p_reason,NULL,jsonb_build_object('type',p_sanction_type,'target_user_id',p_target_user_id,
    'target_daycare_id',p_target_daycare_id,'starts_at',p_starts_at,'ends_at',p_ends_at),p_request_id);
  SELECT id INTO v_audit_id FROM public.audit_logs WHERE request_id=p_request_id
    AND actor_id=auth.uid() AND action='account_sanction.create' ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.admin_actions(admin_id,action_type,audit_log_id,decision_summary)
  VALUES(auth.uid(),'account_sanction.create',v_audit_id,btrim(p_reason));
  v_target_user:=p_target_user_id;
  IF v_target_user IS NOT NULL THEN
    PERFORM public.app_internal_notify(v_target_user,'account_sanctioned','Pembaruan status akun',
      'Akses akun dibatasi sementara. Hubungi dukungan Ayomi bila memerlukan informasi.',
      'urgent','sanction:'||v_id::text,NULL);
  END IF;
  RETURN jsonb_build_object('id',v_id,'sanction_type',p_sanction_type,'starts_at',p_starts_at,'ends_at',p_ends_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_revoke_sanction(p_sanction_id uuid,p_reason text,p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.account_sanctions%ROWTYPE; v_audit_id uuid;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  IF char_length(btrim(COALESCE(p_reason,'')))<5 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='decision_reason_required'; END IF;
  SELECT * INTO v_row FROM public.account_sanctions WHERE id=p_sanction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='sanction_not_found'; END IF;
  IF v_row.revoked_at IS NULL THEN
    UPDATE public.account_sanctions SET revoked_at=now(),revoked_by=auth.uid(),revocation_reason=btrim(p_reason)
      WHERE id=p_sanction_id;
    PERFORM public.app_internal_audit('account_sanction.revoke','account_sanction',p_sanction_id,
      v_row.target_daycare_id,p_reason,jsonb_build_object('revoked_at',NULL),jsonb_build_object('revoked_at',now()),p_request_id);
    SELECT id INTO v_audit_id FROM public.audit_logs WHERE request_id=p_request_id
      AND actor_id=auth.uid() AND action='account_sanction.revoke' ORDER BY created_at DESC LIMIT 1;
    INSERT INTO public.admin_actions(admin_id,action_type,audit_log_id,decision_summary)
    VALUES(auth.uid(),'account_sanction.revoke',v_audit_id,btrim(p_reason));
  END IF;
  RETURN jsonb_build_object('id',p_sanction_id,'revoked_at',COALESCE(v_row.revoked_at,now()));
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_sanctions()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='role_not_allowed'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'target_user_id',s.target_user_id,
    'target_daycare_id',s.target_daycare_id,'investigation_id',s.investigation_id,'sanction_type',s.sanction_type,
    'reason',s.reason,'imposed_by',s.imposed_by,'starts_at',s.starts_at,'ends_at',s.ends_at,
    'revoked_by',s.revoked_by,'revoked_at',s.revoked_at,'revocation_reason',s.revocation_reason,
    'created_at',s.created_at,'evidence',(SELECT jsonb_agg(jsonb_build_object('id',a.id,'path',a.object_path,
      'mime_type',a.mime_type,'byte_size',a.byte_size,'bucket',a.bucket)) FROM public.attachments a
      WHERE a.sanction_id=s.id AND a.status='ready')) ORDER BY s.created_at DESC)
    FROM public.account_sanctions s),'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public'
AS $function$
  SELECT u.role FROM public.users u WHERE u.id=auth.uid() AND u.status='active'
    AND u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.account_sanctions s
      WHERE s.target_user_id=u.id AND s.revoked_at IS NULL AND s.starts_at<=now()
        AND (s.ends_at IS NULL OR now()<s.ends_at))
$function$;

CREATE OR REPLACE FUNCTION private.app_daycare_has_active_sanction(p_daycare_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.account_sanctions s WHERE s.target_daycare_id=p_daycare_id
    AND s.revoked_at IS NULL AND s.starts_at<=now() AND (s.ends_at IS NULL OR now()<s.ends_at))
$function$;
REVOKE ALL ON FUNCTION private.app_daycare_has_active_sanction(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.app_is_daycare_manager(p_daycare_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.daycares d JOIN public.daycare_members m
    ON m.daycare_id=d.id AND m.user_id=auth.uid() AND m.member_role='manager' AND m.status='active'
    JOIN public.users u ON u.id=m.user_id AND u.role='manager' AND u.status='active'
    WHERE d.id=p_daycare_id AND d.main_manager_id=auth.uid()
      AND NOT private.app_daycare_has_active_sanction(p_daycare_id) AND NOT EXISTS(
      SELECT 1 FROM public.account_sanctions s WHERE s.target_user_id=u.id
        AND s.revoked_at IS NULL AND s.starts_at<=now() AND (s.ends_at IS NULL OR now()<s.ends_at)))
$function$;

CREATE OR REPLACE FUNCTION public.app_is_active_daycare_member(p_daycare_id uuid,p_member_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public'
AS $function$
  SELECT CASE WHEN p_member_role NOT IN ('manager','caregiver') THEN false ELSE EXISTS(
    SELECT 1 FROM public.daycare_members m JOIN public.users u ON u.id=m.user_id
    WHERE m.daycare_id=p_daycare_id AND m.user_id=auth.uid() AND m.member_role=p_member_role
      AND m.status='active' AND u.role=p_member_role AND u.status='active'
      AND NOT private.app_daycare_has_active_sanction(p_daycare_id)
      AND NOT EXISTS(SELECT 1 FROM public.account_sanctions s WHERE s.target_user_id=u.id
        AND s.revoked_at IS NULL AND s.starts_at<=now() AND (s.ends_at IS NULL OR now()<s.ends_at))) END
$function$;

CREATE OR REPLACE FUNCTION public.app_is_current_assigned_caregiver(p_enrollment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.caregiver_assignments a JOIN public.enrollments e ON e.id=a.enrollment_id
    JOIN public.daycare_members m ON m.daycare_id=e.daycare_id AND m.user_id=a.caregiver_id
      AND m.member_role='caregiver' AND m.status='active'
    JOIN public.users u ON u.id=a.caregiver_id AND u.role='caregiver' AND u.status='active'
    WHERE a.enrollment_id=p_enrollment_id AND a.caregiver_id=auth.uid()
      AND a.starts_at<=now() AND a.ends_at>now() AND (a.ended_early_at IS NULL OR a.ended_early_at>now())
      AND NOT private.app_daycare_has_active_sanction(e.daycare_id)
      AND NOT EXISTS(SELECT 1 FROM public.account_sanctions s WHERE s.target_user_id=u.id
        AND s.revoked_at IS NULL AND s.starts_at<=now() AND (s.ends_at IS NULL OR now()<s.ends_at)))
$function$;

CREATE OR REPLACE FUNCTION public.app_can_confirm_daycare_pickup(p_daycare_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
  SELECT NOT private.app_daycare_has_active_sanction(p_daycare_id) AND (
    COALESCE(public.app_is_daycare_manager(p_daycare_id),false)
    OR (public.app_current_role()='caregiver' AND EXISTS(
      SELECT 1 FROM public.daycare_members m
      JOIN public.daycare_delegations d ON d.daycare_id=m.daycare_id AND d.grantee_id=m.user_id
      JOIN public.delegation_permissions dp ON dp.delegation_id=d.id
      WHERE m.daycare_id=p_daycare_id AND m.user_id=auth.uid()
        AND m.member_role='caregiver' AND m.status='active' AND m.ended_at IS NULL
        AND d.revoked_at IS NULL AND d.starts_at<=now() AND now()<d.ends_at AND dp.permission='confirm_pickup'
    ))
  );
$function$;

REVOKE ALL ON FUNCTION public.app_attach_complaint_evidence(uuid,text,text,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_attach_investigation_evidence(uuid,text,text,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_create_sanction(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_revoke_sanction(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_admin_list_sanctions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_attach_complaint_evidence(uuid,text,text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_attach_investigation_evidence(uuid,text,text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_create_sanction(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_revoke_sanction(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_sanctions() TO authenticated;

COMMIT;
