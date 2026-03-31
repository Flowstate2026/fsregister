
-- Function to anonymise a student's personal data (right to erasure)
-- Keeps attendance records for aggregate stats but removes PII
CREATE OR REPLACE FUNCTION public.anonymise_student(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _school_id uuid;
BEGIN
  -- Verify the student belongs to the caller's school
  SELECT school_id INTO _school_id FROM public.students WHERE id = _student_id;
  IF _school_id IS NULL OR _school_id != get_user_school_id(auth.uid()) THEN
    RAISE EXCEPTION 'Student not found or access denied';
  END IF;
  
  -- Delete student notes
  DELETE FROM public.student_notes WHERE student_id = _student_id;
  
  -- Remove class enrollments
  DELETE FROM public.class_enrollments WHERE student_id = _student_id;
  
  -- Anonymise the student record but keep it for attendance aggregate integrity
  UPDATE public.students SET
    first_name = 'Deleted',
    last_name = 'Student',
    date_of_birth = NULL,
    parent_email = NULL,
    archived = true
  WHERE id = _student_id;
END;
$$;
