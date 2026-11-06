BEGIN;

CREATE OR REPLACE FUNCTION public.app_create_parent_child(
  p_full_name text,
  p_birth_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_parent_id uuid := auth.uid();
  v_child_id uuid;
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
     OR char_length(btrim(p_full_name)) > 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_name';
  END IF;

  IF p_birth_date IS NULL OR p_birth_date > CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_child_birth_date';
  END IF;

  INSERT INTO public.children (parent_id, full_name, birth_date, status)
  VALUES (v_parent_id, btrim(p_full_name), p_birth_date, 'active')
  RETURNING child_id INTO v_child_id;

  -- Start with an empty health profile; health details are entered separately.
  INSERT INTO public.child_health_profiles (child_id, updated_by)
  VALUES (v_child_id, v_parent_id);

  RETURN v_child_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.app_create_parent_child(text, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_create_parent_child(text, date)
  TO authenticated;

COMMIT;
