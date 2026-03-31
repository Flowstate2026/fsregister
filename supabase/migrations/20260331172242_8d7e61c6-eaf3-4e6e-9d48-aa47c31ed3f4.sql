-- Allow owners to delete class enrollments (needed for archiving students)
CREATE POLICY "Users can delete enrollments for own school"
ON public.class_enrollments FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM students s
  WHERE s.id = class_enrollments.student_id
  AND s.school_id = get_user_school_id(auth.uid())
));