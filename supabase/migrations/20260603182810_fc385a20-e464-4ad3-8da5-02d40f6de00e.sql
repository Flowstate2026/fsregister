-- Clear stale school_id from any user_metadata pointing to a non-existent school
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'school_id'
WHERE raw_user_meta_data ? 'school_id'
  AND NULLIF(raw_user_meta_data->>'school_id', '') IS NOT NULL
  AND (raw_user_meta_data->>'school_id')::uuid NOT IN (SELECT id FROM public.schools);

-- RPC for the authenticated user to clear their own stale school_id from metadata
CREATE OR REPLACE FUNCTION public.clear_stale_school_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'school_id'
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_stale_school_id() TO authenticated;