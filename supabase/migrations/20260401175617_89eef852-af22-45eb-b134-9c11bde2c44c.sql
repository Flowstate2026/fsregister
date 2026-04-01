
CREATE TABLE public.cancelled_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  class_id UUID,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cancelled_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view school cancelled dates"
ON public.cancelled_dates FOR SELECT TO authenticated
USING (school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Owners can insert cancelled dates"
ON public.cancelled_dates FOR INSERT TO authenticated
WITH CHECK (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete cancelled dates"
ON public.cancelled_dates FOR DELETE TO authenticated
USING (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX idx_cancelled_dates_school ON public.cancelled_dates (school_id, start_date, end_date);
