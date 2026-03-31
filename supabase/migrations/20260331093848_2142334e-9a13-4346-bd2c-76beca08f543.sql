
CREATE TABLE public.gdpr_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  school_id uuid,
  privacy_policy_accepted boolean NOT NULL DEFAULT false,
  lawful_basis_confirmed boolean NOT NULL DEFAULT false,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text
);

ALTER TABLE public.gdpr_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own consent" ON public.gdpr_consent_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own consent" ON public.gdpr_consent_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
