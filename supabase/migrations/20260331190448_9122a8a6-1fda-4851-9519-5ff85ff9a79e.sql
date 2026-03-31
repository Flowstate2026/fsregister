CREATE POLICY "Owners can delete invites for own school"
ON public.teacher_invites
FOR DELETE
TO authenticated
USING (school_id = get_user_school_id(auth.uid()));