-- ============================================
-- supabase/migrations/013_ai_calls.sql
--
-- Migration: Agent AI de apelare (Vapi + Twilio) — Pasul 1 (MVP)
-- Run in Supabase SQL Editor
--
-- Vezi planul complet: claude/agent-ai-apeluri-plan.md (proiect Claude).
--
-- Ce adaugă:
--   1. call_campaigns     — o campanie = un asistent Vapi (MVP: câte un
--                           asistent per campanie, fără variabile în prompt).
--                           Coloanele auto_call_enabled / fb_match_* sunt
--                           pregătite pentru Pasul 2 (apelare automată),
--                           nefolosite încă de cod.
--   2. call_lists         — liste de apelare cu nume („Listă apelare X").
--   3. call_list_members  — legătura listă ↔ lead. Un lead poate fi în mai
--                           multe liste (ex: lead Facebook pt. Egipt, inclus
--                           apoi și în lista pt. Revelion) — fără duplicat.
--   4. ai_calls           — un rând per apel: status, transcript, rezumat,
--                           înregistrare, date structurate extrase de Vapi,
--                           cost, durată + raportul brut complet.
--   5. leads.ai_call_*    — „Calificare AI": câmp SEPARAT de etapa din
--                           pipeline. Leadul rămâne în etapa lui (ex: Nou),
--                           calificarea arată rezultatul ULTIMULUI apel AI.
--                           Istoricul complet stă în ai_calls.
--   6. leads.do_not_call  — clientul a cerut să nu mai fie sunat; exclus din
--                           orice selecție viitoare de apelare.
--   7. lead_activities    — tip nou `ai_call` (eveniment în timeline).
--   8. lead_sources       — sursă nouă `lista_apelare` pt. numerele importate
--                           din liste care nu există deja ca lead.
--
-- RLS: Admin/Manager — acces complet. Agenții — DOAR citire, și doar pe
-- apelurile leadurilor alocate lor (văd tot ce a făcut AI-ul, dar nu pot
-- porni apeluri). Webhook-ul Vapi scrie cu clientul service-role (admin.ts),
-- care ocolește RLS — nu are nevoie de policy de INSERT/UPDATE.
--
-- Idempotent — sigur de rulat de mai multe ori.
-- ============================================

-- --------------------------------------------
-- 1. CAMPANII (un asistent Vapi per campanie)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vapi_assistant_id TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Pasul 2 (apelare automată) — pregătit, nefolosit încă
  auto_call_enabled BOOLEAN NOT NULL DEFAULT false,
  fb_match_campaign TEXT,
  fb_match_form TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS call_campaigns_updated_at ON public.call_campaigns;
CREATE TRIGGER call_campaigns_updated_at
  BEFORE UPDATE ON public.call_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------
-- 2. LISTE DE APELARE
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  campaign_id UUID REFERENCES public.call_campaigns(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_list_members (
  list_id UUID NOT NULL REFERENCES public.call_lists(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, lead_id)
);

CREATE INDEX IF NOT EXISTS call_list_members_lead_idx ON public.call_list_members (lead_id);

-- --------------------------------------------
-- 3. APELURI AI
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.call_campaigns(id) ON DELETE SET NULL,
  list_id UUID REFERENCES public.call_lists(id) ON DELETE SET NULL,
  -- Numărul efectiv sunat (E.164), păstrat separat de leads.phone — dacă
  -- telefonul leadului se schimbă ulterior, istoricul rămâne corect.
  phone_number TEXT NOT NULL,
  vapi_call_id TEXT UNIQUE,
  -- queued → ringing → in_progress → ended | failed | cancelled
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ringing', 'in_progress', 'ended', 'failed', 'cancelled')),
  -- Rezultatul calculat din datele structurate (aceleași valori ca leads.ai_call_status)
  result TEXT,
  ended_reason TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INT,
  cost NUMERIC(10, 4),
  summary TEXT,
  transcript TEXT,
  recording_url TEXT,
  structured_data JSONB,
  raw_report JSONB,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_calls_lead_idx ON public.ai_calls (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_status_idx ON public.ai_calls (status, created_at);
CREATE INDEX IF NOT EXISTS ai_calls_campaign_idx ON public.ai_calls (campaign_id);

DROP TRIGGER IF EXISTS ai_calls_updated_at ON public.ai_calls;
CREATE TRIGGER ai_calls_updated_at
  BEFORE UPDATE ON public.ai_calls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------
-- 4. LEADS — Calificare AI + do_not_call
-- --------------------------------------------
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_call_status TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_call_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_last_call_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_last_call_id UUID REFERENCES public.ai_calls(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS do_not_call BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_ai_call_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_ai_call_status_check CHECK (
  ai_call_status IS NULL OR ai_call_status IN (
    'queued', 'in_progress',
    'hot', 'interested', 'other_request', 'callback',
    'not_interested', 'no_answer', 'invalid', 'failed'
  )
);

CREATE INDEX IF NOT EXISTS leads_ai_call_status_idx ON public.leads (ai_call_status);

COMMENT ON COLUMN public.leads.ai_call_status IS 'Calificare AI — rezultatul ULTIMULUI apel Vapi. Separat de status (etapa pipeline). NULL = neapelat. Vezi migrarea 013.';
COMMENT ON COLUMN public.leads.do_not_call IS 'Clientul a cerut să nu mai fie sunat — exclus din orice selecție de apelare AI.';

-- --------------------------------------------
-- 5. LEAD ACTIVITIES — tip nou `ai_call`
-- --------------------------------------------
-- Constrângerea CHECK a fost creată inline în 001 → numele implicit Postgres
-- este lead_activities_type_check.
ALTER TABLE public.lead_activities DROP CONSTRAINT IF EXISTS lead_activities_type_check;
ALTER TABLE public.lead_activities ADD CONSTRAINT lead_activities_type_check CHECK (type IN (
  'status_change', 'comment', 'assignment', 'reminder_set',
  'email_sent', 'call_logged', 'system', 'edit', 'ai_call'
));

-- --------------------------------------------
-- 6. LEAD SOURCES — „Listă apelare"
-- --------------------------------------------
INSERT INTO public.lead_sources (name, slug, icon)
VALUES ('Listă apelare', 'lista_apelare', NULL)
ON CONFLICT (slug) DO NOTHING;

-- --------------------------------------------
-- 7. RLS
-- --------------------------------------------
ALTER TABLE public.call_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

-- Campanii: toți autentificații văd (numele campaniei apare în panoul de
-- apel al agentului); doar admin/manager modifică.
DROP POLICY IF EXISTS "call_campaigns_select" ON public.call_campaigns;
CREATE POLICY "call_campaigns_select" ON public.call_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "call_campaigns_write" ON public.call_campaigns;
CREATE POLICY "call_campaigns_write" ON public.call_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Liste: doar admin/manager (agenții nu pornesc apeluri).
DROP POLICY IF EXISTS "call_lists_admin_manager" ON public.call_lists;
CREATE POLICY "call_lists_admin_manager" ON public.call_lists
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

DROP POLICY IF EXISTS "call_list_members_admin_manager" ON public.call_list_members;
CREATE POLICY "call_list_members_admin_manager" ON public.call_list_members
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- Apeluri: admin/manager văd tot; agentul vede apelurile leadurilor sale.
DROP POLICY IF EXISTS "ai_calls_select" ON public.ai_calls;
CREATE POLICY "ai_calls_select" ON public.ai_calls
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = ai_calls.lead_id
      AND leads.assigned_to = auth.uid()
    )
  );

-- Scriere doar admin/manager (pornire / anulare din UI). Webhook-ul folosește
-- service-role și nu trece prin RLS.
DROP POLICY IF EXISTS "ai_calls_write" ON public.ai_calls;
CREATE POLICY "ai_calls_write" ON public.ai_calls
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());
