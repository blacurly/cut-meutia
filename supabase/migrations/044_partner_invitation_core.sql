BEGIN;

CREATE OR REPLACE FUNCTION public.app_admin_list_partners()
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

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', d.id, 'slug', d.slug, 'name', d.name, 'status', d.status,
      'created_at', d.created_at, 'updated_at', d.updated_at,
      'manager', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', u.id, 'full_name', u.full_name, 'status', m.status
      ) END
    ) ORDER BY d.created_at DESC)
    FROM public.daycares AS d
    LEFT JOIN public.daycare_members AS m
      ON m.daycare_id = d.id AND m.member_role = 'manager'
        AND m.status = 'active' AND m.ended_at IS NULL
    LEFT JOIN public.users AS u ON u.id = m.user_id
    WHERE d.deleted_at IS NULL
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_create_partner(
  p_payload jsonb,
  p_manager_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_name text := NULLIF(btrim(p_payload ->> 'name'), '');
  v_description text := NULLIF(btrim(p_payload ->> 'description'), '');
  v_address text := NULLIF(btrim(p_payload ->> 'address'), '');
  v_province text := NULLIF(btrim(p_payload ->> 'province_code'), '');
  v_city text := NULLIF(btrim(p_payload ->> 'city_code'), '');
  v_district text := NULLIF(btrim(p_payload ->> 'district_code'), '');
  v_postal text := NULLIF(btrim(p_payload ->> 'postal_code'), '');
  v_timezone text := NULLIF(btrim(p_payload ->> 'timezone'), '');
  v_phone text := NULLIF(btrim(p_payload ->> 'contact_phone'), '');
  v_capacity integer := CASE
    WHEN p_payload ->> 'daily_capacity' ~ '^[0-9]{1,4}$'
    THEN (p_payload ->> 'daily_capacity')::integer
    ELSE NULL END;
  v_slug text;
  v_daycare_id uuid := gen_random_uuid();
  v_invitation_id uuid;
  v_email text := lower(btrim(COALESCE(p_manager_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'role_not_allowed';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR (p_payload - ARRAY['name','description','address','province_code','city_code',
          'district_code','postal_code','timezone','contact_phone','facilities',
          'opening_hours','daily_capacity']) <> '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_partner_fields';
  END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 200
     OR v_description IS NULL OR char_length(v_description) NOT BETWEEN 20 AND 1500
     OR v_address IS NULL OR char_length(v_address) NOT BETWEEN 5 AND 300
     OR v_province IS NULL OR v_province !~ '^[0-9]{2}$'
     OR v_city IS NULL OR char_length(v_city) NOT BETWEEN 2 AND 20
     OR v_district IS NULL OR char_length(v_district) NOT BETWEEN 2 AND 20
     OR v_timezone IS NULL OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone)
     OR v_phone IS NULL OR v_phone !~ '^\+?[0-9]{8,16}$'
     OR (v_postal IS NOT NULL AND v_postal !~ '^[0-9]{5}$')
     OR v_capacity IS NULL OR v_capacity NOT BETWEEN 1 AND 1000
     OR jsonb_typeof(p_payload -> 'facilities') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_payload -> 'opening_hours') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_partner_profile';
  END IF;
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR p_expires_at > now() + interval '7 days' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_invitation';
  END IF;

  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  IF v_slug = '' THEN v_slug := 'daycare'; END IF;
  IF EXISTS (SELECT 1 FROM public.daycares WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || left(replace(v_daycare_id::text, '-', ''), 8);
  END IF;

  INSERT INTO public.daycares (
    id, slug, name, description, address, province_code, city_code, district_code,
    postal_code, timezone, contact_phone, facilities, opening_hours, public_gallery,
    daily_capacity, status
  ) VALUES (
    v_daycare_id, v_slug, v_name, v_description, v_address, v_province, v_city, v_district,
    v_postal, v_timezone, v_phone, p_payload -> 'facilities', p_payload -> 'opening_hours',
    '[]'::jsonb, v_capacity, 'inactive'
  );

  INSERT INTO public.staff_invitations (
    daycare_id, email, invited_role, token_hash, invited_by, expires_at
  ) VALUES (
    v_daycare_id, v_email, 'manager', p_token_hash, auth.uid(), p_expires_at
  ) RETURNING id INTO v_invitation_id;

  PERFORM public.app_internal_audit(
    'partner.create_and_invite_manager', 'daycare', v_daycare_id, v_daycare_id,
    'Admin created inactive partner daycare and manager invitation', NULL,
    jsonb_build_object('slug', v_slug, 'status', 'inactive',
      'invitation_id', v_invitation_id, 'invited_role', 'manager'),
    p_request_id
  );

  RETURN jsonb_build_object(
    'daycare_id', v_daycare_id, 'slug', v_slug, 'status', 'inactive',
    'invitation_id', v_invitation_id, 'invitation_expires_at', p_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_accept_staff_invitation(
  p_token_hash text,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invitation public.staff_invitations%ROWTYPE;
  v_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_user_role text;
  v_membership_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_invitation_token';
  END IF;

  SELECT * INTO v_invitation
  FROM public.staff_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_not_found';
  END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_revoked';
  END IF;
  IF v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_already_used';
  END IF;
  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_expired';
  END IF;
  IF v_email = '' OR v_email <> lower(v_invitation.email) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_email_mismatch';
  END IF;
  IF v_invitation.invited_role NOT IN ('manager', 'caregiver') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_role_invalid';
  END IF;

  SELECT role INTO v_user_role FROM public.users
  WHERE id = auth.uid() AND status = 'active' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'account_not_active';
  END IF;
  IF v_user_role NOT IN ('parent', v_invitation.invited_role) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'invitation_account_role_conflict';
  END IF;
  IF v_user_role = 'parent' AND EXISTS (
    SELECT 1 FROM public.children WHERE parent_id = auth.uid() AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'invitation_parent_has_children';
  END IF;
  IF v_invitation.invited_role = 'manager' AND EXISTS (
    SELECT 1 FROM public.daycare_members
    WHERE daycare_id = v_invitation.daycare_id AND member_role = 'manager'
      AND status = 'active' AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'daycare_manager_already_assigned';
  END IF;
  PERFORM 1 FROM public.daycares
  WHERE id = v_invitation.daycare_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'invitation_daycare_not_found';
  END IF;

  v_membership_status := CASE WHEN v_invitation.invited_role = 'manager'
    THEN 'active' ELSE 'pending_verification' END;
  UPDATE public.users SET role = v_invitation.invited_role, updated_at = now()
  WHERE id = auth.uid();
  INSERT INTO public.daycare_members (
    daycare_id, user_id, member_role, status, joined_at, verified_by, verified_at
  ) VALUES (
    v_invitation.daycare_id, auth.uid(), v_invitation.invited_role,
    v_membership_status, now(),
    CASE WHEN v_invitation.invited_role = 'manager' THEN v_invitation.invited_by END,
    CASE WHEN v_invitation.invited_role = 'manager' THEN now() END
  );
  IF v_invitation.invited_role = 'manager' THEN
    UPDATE public.daycares SET main_manager_id = auth.uid(), updated_at = now()
    WHERE id = v_invitation.daycare_id AND deleted_at IS NULL;
  END IF;
  UPDATE public.staff_invitations SET accepted_by = auth.uid(), accepted_at = now()
  WHERE id = v_invitation.id;

  PERFORM public.app_internal_audit(
    'staff_invitation.accept', 'staff_invitation', v_invitation.id,
    v_invitation.daycare_id, NULL, NULL,
    jsonb_build_object('user_id', auth.uid(), 'role', v_invitation.invited_role,
      'membership_status', v_membership_status), p_request_id
  );

  RETURN jsonb_build_object(
    'invitation_id', v_invitation.id, 'daycare_id', v_invitation.daycare_id,
    'role', v_invitation.invited_role, 'membership_status', v_membership_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.app_admin_list_partners() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_create_partner(jsonb, text, text, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_accept_staff_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_admin_list_partners() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_create_partner(jsonb, text, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_accept_staff_invitation(text, text) TO authenticated;

COMMIT;
