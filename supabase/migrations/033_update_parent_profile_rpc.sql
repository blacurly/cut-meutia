BEGIN;

CREATE OR REPLACE FUNCTION public.app_update_parent_profile(
  p_full_name text,
  p_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_phone text := NULLIF(btrim(p_phone), '');
BEGIN
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = v_parent_id
      AND u.role = 'parent'
      AND u.status = 'active'
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'parent_account_not_active';
  END IF;

  IF p_full_name IS NULL
     OR char_length(btrim(p_full_name)) < 2
     OR char_length(btrim(p_full_name)) > 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_parent_name';
  END IF;

  IF v_phone IS NOT NULL AND v_phone !~ '^8[0-9]{8,11}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_parent_phone';
  END IF;

  UPDATE public.users
  SET full_name = btrim(p_full_name),
      phone = v_phone,
      updated_at = now()
  WHERE id = v_parent_id
    AND role = 'parent'
    AND status = 'active'
    AND deleted_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.app_update_parent_profile(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_update_parent_profile(text, text)
  TO authenticated;

COMMIT;
