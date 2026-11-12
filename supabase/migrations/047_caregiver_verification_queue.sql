BEGIN;

CREATE OR REPLACE FUNCTION public.app_admin_list_pending_caregivers()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'member_id',m.id,'user_id',u.id,'full_name',u.full_name,'email',au.email,
    'daycare',jsonb_build_object('id',d.id,'name',d.name),
    'invited_at',m.created_at
  ) ORDER BY m.created_at)
  FROM public.daycare_members m JOIN public.users u ON u.id=m.user_id
  JOIN auth.users au ON au.id=u.id JOIN public.daycares d ON d.id=m.daycare_id
  WHERE m.member_role='caregiver' AND m.status='pending_verification'
    AND m.ended_at IS NULL), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_admin_list_pending_caregivers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_admin_list_pending_caregivers() TO authenticated;

COMMIT;
