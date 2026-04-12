
-- Add email field to schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS email text;

-- Note tokens for parent access (no login required)
CREATE TABLE public.note_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  note_id uuid NOT NULL REFERENCES public.student_notes(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.note_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read tokens (parent page uses anon key)
CREATE POLICY "Anyone can read note tokens"
  ON public.note_tokens FOR SELECT
  USING (true);

-- Authenticated users in the same school can create tokens
CREATE POLICY "Authenticated users can create note tokens"
  ON public.note_tokens FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_notes sn
      JOIN public.students s ON s.id = sn.student_id
      WHERE sn.id = note_tokens.note_id
        AND s.school_id = get_user_school_id(auth.uid())
    )
  );

-- Parent replies
CREATE TABLE public.parent_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.student_notes(id) ON DELETE CASCADE,
  reply_text text NOT NULL,
  parent_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can insert replies (parents don't log in)
CREATE POLICY "Anyone can insert parent replies"
  ON public.parent_replies FOR INSERT
  WITH CHECK (true);

-- Authenticated users can view replies for their school's students
CREATE POLICY "Users can view replies for their school students"
  ON public.parent_replies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_notes sn
      JOIN public.students s ON s.id = sn.student_id
      WHERE sn.id = parent_replies.note_id
        AND s.school_id = get_user_school_id(auth.uid())
    )
  );

CREATE INDEX idx_note_tokens_token ON public.note_tokens(token);
CREATE INDEX idx_note_tokens_note_id ON public.note_tokens(note_id);
CREATE INDEX idx_parent_replies_note_id ON public.parent_replies(note_id);
