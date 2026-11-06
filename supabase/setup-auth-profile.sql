-- Run once in Supabase SQL Editor before enabling public Parent registration.
-- Public signup always creates a Parent. Role is deliberately not read from
-- user-supplied Auth metadata.

CREATE OR REPLACE FUNCTION public.create_parent_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, role, full_name, phone, status)
  VALUES (
    NEW.id,
    'parent',
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), ''),
    'active'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_parent_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_parent_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_parent_profile_for_auth_user();

GRANT SELECT ON TABLE public.users TO authenticated;
DROP POLICY IF EXISTS users_select_own_profile ON public.users;
CREATE POLICY users_select_own_profile
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));
