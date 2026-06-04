
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  student_id UUID NOT NULL,
  class_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('enrolled','unenrolled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_school_created ON public.activity_log(school_id, created_at DESC);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view school activity"
  ON public.activity_log FOR SELECT
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Users can insert own activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_id = public.get_user_school_id(auth.uid())
  );
