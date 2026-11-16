BEGIN;

-- Read-only RPCs the portals need (no table or policy changes):
--   app_caregiver_list_assignments  Pengasuh: enrollments currently assigned
--                                   to them, to write the daily logbook.
--   app_admin_list_payments         Admin: transactions waiting for a manual
--                                   payment confirmation.

CREATE OR REPLACE FUNCTION public.app_caregiver_list_assignments()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item ORDER BY starts_at DESC) FROM (
      SELECT a.starts_at, jsonb_build_object(
        'assignment_id', a.id,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'enrollment', jsonb_build_object(
          'id', e.id,
          'reference', upper(left(replace(e.id::text, '-', ''), 8)),
          'status', e.status,
          'service_date', e.service_date,
          'child', jsonb_build_object('child_id', e.child_id, 'full_name', e.child_snapshot ->> 'full_name',
                                      'birth_date', e.child_snapshot ->> 'birth_date'),
          'daycare', jsonb_build_object('id', d.id, 'name', d.name),
          'offering', jsonb_build_object('id', o.id, 'name', o.name)
        )
      ) AS item
      FROM public.caregiver_assignments AS a
      JOIN public.enrollments AS e ON e.id = a.enrollment_id
      JOIN public.daycares AS d ON d.id = e.daycare_id
      LEFT JOIN public.service_offerings AS o ON o.id = e.offering_id
      WHERE a.caregiver_id = auth.uid()
        AND a.starts_at <= now() AND a.ends_at > now()
        AND (a.ended_early_at IS NULL OR a.ended_early_at > now())
        AND e.status IN ('approved', 'completed')
        AND public.app_is_current_assigned_caregiver(e.id)
      LIMIT 200
    ) AS rows
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_list_payments(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF public.app_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_role_required';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('created', 'pending', 'succeeded', 'failed', 'expired') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_payment_status';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
      SELECT t.created_at, jsonb_build_object(
        'id', t.id,
        'method', t.method,
        'amount', t.amount,
        'currency', t.currency,
        'status', t.status,
        'provider', t.provider,
        'created_at', t.created_at,
        'expires_at', t.expires_at,
        'paid_at', t.paid_at,
        'enrollment', jsonb_build_object(
          'id', e.id,
          'reference', upper(left(replace(e.id::text, '-', ''), 8)),
          'status', e.status,
          'service_date', e.service_date,
          'child_name', e.child_snapshot ->> 'full_name'
        ),
        'daycare', jsonb_build_object('id', d.id, 'name', d.name),
        'parent', jsonb_build_object('id', u.id, 'full_name', u.full_name)
      ) AS item
      FROM public.transactions AS t
      JOIN public.charges AS c ON c.id = t.charge_id
      JOIN public.enrollments AS e ON e.id = c.enrollment_id
      JOIN public.daycares AS d ON d.id = e.daycare_id
      JOIN public.users AS u ON u.id = e.parent_id
      WHERE (p_status IS NULL AND t.status IN ('created', 'pending')) OR t.status = p_status
      ORDER BY t.created_at DESC
      LIMIT 200
    ) AS rows
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_caregiver_list_assignments() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_admin_list_payments(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_caregiver_list_assignments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_list_payments(text) TO authenticated;

COMMIT;
