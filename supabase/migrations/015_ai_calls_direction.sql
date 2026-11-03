-- ============================================
-- supabase/migrations/015_ai_calls_direction.sql
--
-- Migration: direcția apelurilor AI (ieșit / primit)
-- Run in Supabase SQL Editor
--
-- Până acum `ai_calls` conținea doar apelurile pornite din CRM. Când un
-- client sună ÎNAPOI la numărul Twilio, răspunde asistentul Vapi setat pe
-- număr (Inbound Settings), iar raportul de final ajunge la webhook prin
-- Server URL-ul numărului. Webhook-ul creează atunci un rând nou cu
-- direction = 'inbound', legat de leadul găsit după telefon (sau de un lead
-- nou, sursa „Telefon").
--
-- Rapoartele separă cele două direcții: rata de răspuns / costul pe lead
-- se calculează doar pe apelurile ieșite, iar apelurile primite apar ca
-- „Au sunat înapoi".
--
-- Idempotent.
-- ============================================

ALTER TABLE public.ai_calls ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';

ALTER TABLE public.ai_calls DROP CONSTRAINT IF EXISTS ai_calls_direction_check;
ALTER TABLE public.ai_calls ADD CONSTRAINT ai_calls_direction_check CHECK (direction IN ('outbound', 'inbound'));

CREATE INDEX IF NOT EXISTS ai_calls_direction_idx ON public.ai_calls (direction, created_at DESC);

COMMENT ON COLUMN public.ai_calls.direction IS 'outbound = apel pornit din CRM; inbound = clientul a sunat la numărul agentului AI (creat de webhook din raportul de final). Vezi migrarea 015.';
