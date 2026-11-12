BEGIN;

CREATE OR REPLACE FUNCTION public.app_parent_list_pickup_authorizations(p_child_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='parent_account_not_active';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.children c WHERE c.child_id=p_child_id
    AND c.parent_id=auth.uid() AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='child_not_owned';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',id,'enrollment_id',enrollment_id,'name',name,'phone',phone,'relationship',relationship,
    'permission_type',permission_type,'valid_from',valid_from,'valid_until',valid_until,
    'revoked_at',revoked_at,'consumed_at',consumed_at,'created_at',created_at)
    ORDER BY created_at DESC) FROM public.authorized_pickups WHERE child_id=p_child_id),'[]'::jsonb);
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
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='parent_account_not_active';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.children c WHERE c.child_id=p_child_id
    AND c.parent_id=auth.uid() AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='child_not_owned';
  END IF;
  IF char_length(btrim(COALESCE(p_name,''))) NOT BETWEEN 2 AND 100
     OR p_phone IS NULL OR p_phone !~ '^8[0-9]{8,11}$'
     OR char_length(btrim(COALESCE(p_relationship,''))) NOT BETWEEN 2 AND 60
     OR p_permission_type IS NULL OR p_permission_type NOT IN ('standing','one_time')
     OR p_valid_from IS NULL OR (p_valid_until IS NOT NULL AND p_valid_until<p_valid_from)
     OR (p_permission_type='one_time' AND (p_enrollment_id IS NULL OR p_valid_until IS NULL OR p_valid_until<=now()))
     OR (p_enrollment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.enrollments e
       WHERE e.id=p_enrollment_id AND e.child_id=p_child_id AND e.parent_id=auth.uid())) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_pickup_authorization';
  END IF;
  INSERT INTO public.authorized_pickups(child_id,created_by,enrollment_id,name,phone,relationship,
    permission_type,valid_from,valid_until)
  VALUES(p_child_id,auth.uid(),p_enrollment_id,btrim(p_name),p_phone,btrim(p_relationship),
    p_permission_type,p_valid_from,p_valid_until) RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('pickup_authorization.create','authorized_pickup',v_id,
    NULL,NULL,NULL,jsonb_build_object('child_id',p_child_id,'permission_type',p_permission_type,
      'enrollment_id',p_enrollment_id,'valid_from',p_valid_from,'valid_until',p_valid_until),p_request_id);
  RETURN jsonb_build_object('id',v_id,'child_id',p_child_id,'permission_type',p_permission_type,
    'valid_from',p_valid_from,'valid_until',p_valid_until);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_parent_revoke_pickup_authorization(p_authorization_id uuid,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.authorized_pickups%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='parent_account_not_active';
  END IF;
  SELECT * INTO v_row FROM public.authorized_pickups
  WHERE id=p_authorization_id AND created_by=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='pickup_authorization_not_found'; END IF;
  IF v_row.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='pickup_authorization_already_consumed';
  END IF;
  IF v_row.revoked_at IS NULL THEN
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
DECLARE v_enrollment public.enrollments%ROWTYPE; v_role text:=public.app_current_role();
BEGIN
  SELECT * INTO v_enrollment FROM public.enrollments WHERE id=p_enrollment_id;
  IF NOT FOUND OR NOT ((v_role='parent' AND v_enrollment.parent_id=auth.uid())
    OR public.app_is_daycare_manager(v_enrollment.daycare_id) OR v_role='admin') THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='enrollment_not_found';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'collector',p.collector_snapshot,
    'verification_status',p.verification_status,'verification_note',p.verification_note,
    'verified_at',p.verified_at,'handed_over_at',p.handed_over_at,'late_minutes',p.late_minutes,
    'attachments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'mime_type',a.mime_type,
      'byte_size',a.byte_size,'path',a.object_path,'bucket',a.bucket) ORDER BY a.created_at)
      FROM public.attachments a WHERE a.pickup_id=p.id AND a.status='ready'),'[]'::jsonb))
    ORDER BY p.created_at) FROM public.pickup_records p WHERE p.enrollment_id=p_enrollment_id),'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_parent_list_pickup_authorizations(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_parent_create_pickup_authorization(uuid,text,text,text,text,timestamptz,timestamptz,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_parent_revoke_pickup_authorization(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.app_list_enrollment_pickups(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.app_parent_list_pickup_authorizations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_create_pickup_authorization(uuid,text,text,text,text,timestamptz,timestamptz,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_parent_revoke_pickup_authorization(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_enrollment_pickups(uuid) TO authenticated;

COMMIT;
