BEGIN;

-- Trigger checks must see the just-inserted pickup row even when the acting
-- Caregiver cannot query pickup_records directly under RLS.
CREATE OR REPLACE FUNCTION public.app_guard_completed_requires_pickup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
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
REVOKE ALL ON FUNCTION public.app_guard_completed_requires_pickup() FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
