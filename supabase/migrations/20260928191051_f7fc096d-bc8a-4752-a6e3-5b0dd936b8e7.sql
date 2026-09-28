CREATE POLICY "Owners can delete school classes" ON public.classes FOR DELETE TO authenticated
USING (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

CREATE OR REPLACE FUNCTION public.delete_class(_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school uuid;
BEGIN
  SELECT school_id INTO _school FROM public.classes WHERE id = _class_id;
  IF _school IS NULL OR _school <> get_user_school_id(auth.uid()) OR NOT has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Class not found or access denied';
  END IF;
  DELETE FROM public.attendance_records WHERE class_id = _class_id;
  DELETE FROM public.class_enrollments WHERE class_id = _class_id;
  DELETE FROM public.activity_log WHERE class_id = _class_id;
  DELETE FROM public.cancelled_dates WHERE class_id = _class_id;
  DELETE FROM public.classes WHERE id = _class_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.delete_class(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_class(uuid) TO authenticated;