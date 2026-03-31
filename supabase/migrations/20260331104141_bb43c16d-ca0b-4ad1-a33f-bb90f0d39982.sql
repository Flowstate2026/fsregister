
CREATE POLICY "Owners can update own school"
ON public.schools FOR UPDATE TO authenticated
USING (id = get_user_school_id(auth.uid()))
WITH CHECK (id = get_user_school_id(auth.uid()));
