
CREATE POLICY "Users can view roles in their school"
ON public.user_roles
FOR SELECT
TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));
