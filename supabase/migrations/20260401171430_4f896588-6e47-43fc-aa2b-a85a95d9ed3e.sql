
-- Add event_type column
ALTER TABLE public.school_webhooks 
ADD COLUMN event_type text NOT NULL DEFAULT 'general';

-- Drop the existing unique constraint on school_id (isOneToOne)
ALTER TABLE public.school_webhooks DROP CONSTRAINT IF EXISTS school_webhooks_school_id_key;

-- Add unique constraint per school + event type
ALTER TABLE public.school_webhooks ADD CONSTRAINT school_webhooks_school_event_unique UNIQUE (school_id, event_type);
