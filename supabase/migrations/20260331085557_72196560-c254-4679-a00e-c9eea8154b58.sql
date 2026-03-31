
-- Add logo_url column to schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for school logos
INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to school-logos bucket
CREATE POLICY "Users can upload school logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'school-logos');

-- Allow public read access
CREATE POLICY "Public can view school logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'school-logos');

-- Create teacher_invites table for step 3
CREATE TABLE IF NOT EXISTS public.teacher_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert invites for own school"
ON public.teacher_invites FOR INSERT TO authenticated
WITH CHECK (school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Users can view invites for own school"
ON public.teacher_invites FOR SELECT TO authenticated
USING (school_id = get_user_school_id(auth.uid()));
