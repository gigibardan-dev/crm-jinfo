-- ============================================
-- supabase/migrations/004_stagnant_lead_alerts.sql
--
-- Migration: Alerte pentru lead-uri stagnante (follow-up reminders)
-- Run in Supabase SQL Editor
--
-- Adaugă `leads.last_interaction_at` — momentul ultimei „interacțiuni
-- reale" pe un lead, definită strict ca: ultimul comentariu SAU ultima
-- schimbare de status (NU orice tip de activitate — vezi mai jos de ce
-- e o coloană separată de `last_activity_at`, care există deja).
--
-- Diferența față de `last_activity_at` (existent, din 001_initial_schema):
-- acela se actualizează la ORICE tip de activitate (alocare, editare,
-- setare reminder, sistem etc.), deci un admin care doar realocă un lead
-- l-ar face să pară „proaspăt" fără ca agentul să fi făcut vreun pas
-- concret cu clientul. `last_interaction_at` rămâne strict la comentarii
-- și schimbări de status, ca alerta de lead stagnant să însemne exact
-- ce trebuie: „niciun follow-up real de X ore".
--
-- Frontend: src/lib/utils/stagnantLeads.ts (prag + is_terminal check),
-- src/components/leads/StagnantBadge.tsx (indicator pe card/rând),
-- src/components/dashboard/StagnantLeadsWidget.tsx (widget dashboard).
-- ============================================

-- 1. Coloană nouă, NOT NULL (default now() pt. eventuale insert-uri
--    concurente în timpul migrării — backfill-ul de mai jos o corectează).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Backfill: ultimul comentariu/schimbare de status existent(ă) pt.
--    fiecare lead, altfel data creării. Nu atinge lead-urile care abia
--    au primit valoarea implicită now() prin ALTER de mai sus (concurent).
UPDATE public.leads l
SET last_interaction_at = COALESCE(
  (SELECT MAX(a.created_at) FROM public.lead_activities a
   WHERE a.lead_id = l.id AND a.type IN ('comment', 'status_change')),
  l.created_at
);

-- 3. Trigger: ține coloana la zi automat, la fiecare comentariu nou sau
--    schimbare de status — SECURITY DEFINER, ca update-ul pe `leads` să nu
--    depindă de RLS-ul rolului care a inserat activitatea (același
--    pattern ca `handle_lead_activity()` din 001_initial_schema).
CREATE OR REPLACE FUNCTION public.handle_lead_interaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('comment', 'status_change') THEN
    UPDATE public.leads
    SET last_interaction_at = NEW.created_at
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_lead_interaction_timestamp
  AFTER INSERT ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_interaction();

-- 4. Index — folosit de query-ul de lead-uri stagnante (filtrare pe prag
--    de timp, vezi StagnantLeadsWidget) și de sortarea implicită.
CREATE INDEX IF NOT EXISTS idx_leads_last_interaction_at ON public.leads(last_interaction_at);

COMMENT ON COLUMN public.leads.last_interaction_at IS 'Ultima interacțiune reală pe lead (comentariu sau schimbare de status), sau data creării dacă nu există niciuna — folosit strict pt. alertele de lead stagnant. Diferă de last_activity_at (actualizat la orice tip de activitate, folosit pt. afișare generală "ultima activitate").';
