BEGIN;

CREATE OR REPLACE FUNCTION public.app_manager_list_staff(p_daycare_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'member_id', m.id, 'user_id', u.id, 'full_name', u.full_name,
    'email', au.email, 'role', m.member_role, 'status', m.status,
    'joined_at', m.joined_at, 'verified_at', m.verified_at
  ) ORDER BY m.created_at DESC)
  FROM public.daycare_members m JOIN public.users u ON u.id=m.user_id
  JOIN auth.users au ON au.id=u.id
  WHERE m.daycare_id=p_daycare_id AND m.ended_at IS NULL), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_invite_caregiver(
  p_daycare_id uuid, p_email text, p_token_hash text, p_expires_at timestamptz,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF lower(btrim(COALESCE(p_email,''))) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR p_expires_at > now() + interval '7 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_invitation';
  END IF;
  UPDATE public.staff_invitations SET revoked_at=now()
  WHERE daycare_id=p_daycare_id AND lower(email)=lower(btrim(p_email))
    AND invited_role='caregiver' AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.staff_invitations(daycare_id,email,invited_role,token_hash,invited_by,expires_at)
  VALUES(p_daycare_id,lower(btrim(p_email)),'caregiver',p_token_hash,auth.uid(),p_expires_at)
  RETURNING id INTO v_id;
  PERFORM public.app_internal_audit('caregiver.invitation.create','staff_invitation',v_id,
    p_daycare_id,NULL,NULL,jsonb_build_object('email',lower(btrim(p_email)),
      'role','caregiver','expires_at',p_expires_at),p_request_id);
  RETURN jsonb_build_object('invitation_id',v_id,'email',lower(btrim(p_email)),
    'role','caregiver','expires_at',p_expires_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_end_caregiver(
  p_daycare_id uuid,p_member_id uuid,p_reason text,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_before text;
BEGIN
  IF NOT COALESCE(public.app_is_daycare_manager(p_daycare_id), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'manager_scope_required';
  END IF;
  IF char_length(btrim(COALESCE(p_reason,''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'decision_reason_required';
  END IF;
  UPDATE public.daycare_members SET status='inactive',ended_at=now(),updated_at=now()
  WHERE id=p_member_id AND daycare_id=p_daycare_id AND member_role='caregiver'
    AND ended_at IS NULL RETURNING status INTO v_before;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'staff_member_not_found'; END IF;
  PERFORM public.app_internal_audit('caregiver.membership.end','daycare_member',p_member_id,
    p_daycare_id,p_reason,jsonb_build_object('status',v_before),
    jsonb_build_object('status','inactive'),p_request_id);
  RETURN jsonb_build_object('member_id',p_member_id,'status','inactive');
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_pending_prices()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', p.id,'version',p.version,'service_amount',p.service_amount,'currency',p.currency,
    'late_pickup_terms',p.late_pickup_terms,'created_at',p.created_at,
    'offering',jsonb_build_object('id',o.id,'name',o.name,'service_type',o.service_type,
      'description',o.description,'daycare_id',d.id,'daycare_name',d.name),
    'proposed_by',jsonb_build_object('id',u.id,'full_name',u.full_name)
  ) ORDER BY p.created_at)
  FROM public.service_price_versions p JOIN public.service_offerings o ON o.id=p.offering_id
  JOIN public.daycares d ON d.id=o.daycare_id JOIN public.users u ON u.id=p.proposed_by
  WHERE p.status='pending'), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_verify_caregiver(
  p_member_id uuid,p_decision text,p_reason text,p_request_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_member public.daycare_members%ROWTYPE;
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected')
     OR char_length(btrim(COALESCE(p_reason,''))) < 5 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_caregiver_decision';
  END IF;
  SELECT * INTO v_member FROM public.daycare_members WHERE id=p_member_id FOR UPDATE;
  IF NOT FOUND OR v_member.member_role <> 'caregiver' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'staff_member_not_found';
  END IF;
  IF v_member.status <> 'pending_verification' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'caregiver_not_pending_verification';
  END IF;
  UPDATE public.daycare_members SET status=CASE WHEN p_decision='approved' THEN 'active' ELSE 'inactive' END,
    verified_by=auth.uid(),verified_at=now(),ended_at=CASE WHEN p_decision='rejected' THEN now() ELSE NULL END,
    updated_at=now() WHERE id=p_member_id;
  PERFORM public.app_internal_audit('caregiver.verify','daycare_member',p_member_id,
    v_member.daycare_id,p_reason,jsonb_build_object('status',v_member.status),
    jsonb_build_object('decision',p_decision),p_request_id);
  RETURN jsonb_build_object('member_id',p_member_id,'decision',p_decision,
    'status',CASE WHEN p_decision='approved' THEN 'active' ELSE 'inactive' END);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_manager_list_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_invite_caregiver(uuid,text,text,timestamptz,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_manager_end_caregiver(uuid,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_list_pending_prices() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_verify_caregiver(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_manager_list_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_invite_caregiver(uuid,text,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_manager_end_caregiver(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_pending_prices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_verify_caregiver(uuid,text,text,text) TO authenticated;

COMMIT;
