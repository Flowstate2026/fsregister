
CREATE TABLE public.school_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id)
);

ALTER TABLE public.school_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own school webhooks"
  ON public.school_webhooks FOR SELECT
  TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert own school webhooks"
  ON public.school_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update own school webhooks"
  ON public.school_webhooks FOR UPDATE
  TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'))
  WITH CHECK (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete own school webhooks"
  ON public.school_webhooks FOR DELETE
  TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(), 'owner'));
