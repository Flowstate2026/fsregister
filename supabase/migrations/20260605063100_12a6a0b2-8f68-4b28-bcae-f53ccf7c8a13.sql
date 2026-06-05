
ALTER TABLE public.teacher_invites
  ADD COLUMN IF NOT EXISTS invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS role app_role NOT NULL DEFAULT 'teacher';

CREATE UNIQUE INDEX IF NOT EXISTS teacher_invites_invite_token_key ON public.teacher_invites(invite_token);
