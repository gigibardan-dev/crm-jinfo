-- ============================================
-- supabase/migrations/005_round_robin_auto_assign.sql
--
-- Migration: Alocare automată a lead-urilor noi (Round-Robin)
-- Run in Supabase SQL Editor
--
-- Design (vezi și claude/alocare-automata-round-robin.md):
--
-- 1. Switch global — tabelul generic `app_settings` (key/value), cheia
--    'auto_assign_enabled'. Pornește OFF (false) — activarea e o decizie
--    explicită a unui admin/manager, nu implicită la deploy.
--
-- 2. Disponibilitate per agent — `profiles.available_for_autoassign`,
--    DEFAULT true (toți agenții/managerii activi participă din prima la
--    rotație când switch-ul e pornit; fiecare își poate opri propria
--    disponibilitate, ex. concediu — vezi RLS `profiles_update` existent,
--    care deja permite `id = auth.uid()`).
--
-- 3. Eligibilitate canal — `leads.eligible_for_auto_assign`, DEFAULT false
--    (opt-in explicit per canal de intrare, nu opt-out). Doar canalele care
--    reprezintă lead-uri noi, organice, intrate în sistem — „prin formular,
--    webhook sau sincronizare” per cerința inițială — setează true la
--    insert:
--      - src/app/api/leads/inbound/route.ts        (webhook/formular extern)
--      - src/app/api/leads/inbound-email/route.ts  (forward email → AI parse)
--      - src/app/api/leads/sync/facebook-sheets/route.ts (sincronizare cron)
--    Rămân la default (false) — deci NEexcluse din auto-assign — cele două
--    canale considerate „bulk intern”, care nu trebuie redistribuite automat:
--      - src/app/api/leads/import/route.ts          (import manual XLSX/CSV)
--      - src/app/(app)/leads/new/page.tsx pt. admin/manager (rămâne mereu
--        nealocat, comportament stabilit deja — vezi migrarea a549b16)
--    Lead-ul manual al unui AGENT nu ajunge niciodată aici — se auto-alocă
--    lui însuși la insert (assigned_to already set), deci trigger-ul de mai
--    jos nu are ce face (prima condiție `assigned_to IS NOT NULL` opreste).
--
-- 4. Algoritm — „cel mai vechi alocat” (least-recently-assigned): dintre
--    agenții/managerii activi ȘI disponibili, cel a cărui ultimă alocare
--    (MAX(assigned_at) pe leads-urile lui) e cea mai veche; cei fără nicio
--    alocare vreodată (NULL) vin primii. Fără cursor/index stocat — se
--    auto-corectează la orice schimbare a pool-ului de agenți, fără stare
--    de întreținut.
--
-- 5. Non-retroactivitate: trigger-ul rulează AFTER INSERT pe `leads` — nu
--    atinge niciodată rânduri existente, deci lead-urile deja nealocate
--    când switch-ul e activat rămân nealocate, exact cum s-a cerut.
-- ============================================

-- ---------- 1. Switch global (app_settings) ----------

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.app_settings (key, value)
VALUES ('auto_assign_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "app_settings_update_admin_manager" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager());

CREATE POLICY "app_settings_insert_admin_manager" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager());

COMMENT ON TABLE public.app_settings IS 'Setări globale ale aplicației, tip cheie/valoare (JSONB). Cheie curentă: auto_assign_enabled (bool) — switch-ul de alocare automată round-robin.';

-- ---------- 2. Disponibilitate per agent ----------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available_for_autoassign BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.available_for_autoassign IS 'Disponibil pentru alocare automată round-robin (fiecare user își poate opri/porni propriul status; adminul poate suprascrie pe oricine din /settings). Nu are efect pt. rolul admin — nu e inclus în pool.';

-- ---------- 3. Eligibilitate canal ----------

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS eligible_for_auto_assign BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.eligible_for_auto_assign IS 'True doar pt. lead-uri intrate prin canale organice (webhook, email, sincronizare) — vezi antetul migrării 005. Import-ul manual și lead-ul creat manual de admin/manager rămân false (nu intră în round-robin).';

-- ---------- 4. Trigger de alocare ----------

CREATE OR REPLACE FUNCTION public.assign_lead_round_robin()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_agent_id UUID;
  v_agent_name TEXT;
BEGIN
  -- Doar lead-uri nealocate, venite dintr-un canal eligibil.
  IF NEW.assigned_to IS NOT NULL OR NOT NEW.eligible_for_auto_assign THEN
    RETURN NEW;
  END IF;

  SELECT (value #>> '{}')::boolean INTO v_enabled
  FROM public.app_settings WHERE key = 'auto_assign_enabled';

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- „Cel mai vechi alocat” dintre agenți+manageri activi și disponibili.
  -- Cei fără nicio alocare vreodată (NULL) vin primii (NULLS FIRST).
  SELECT p.id, p.full_name INTO v_agent_id, v_agent_name
  FROM public.profiles p
  WHERE p.role IN ('agent', 'manager')
    AND p.is_active = true
    AND p.available_for_autoassign = true
  ORDER BY (
    SELECT MAX(l.assigned_at) FROM public.leads l WHERE l.assigned_to = p.id
  ) NULLS FIRST, p.id
  LIMIT 1;

  -- Niciun agent disponibil — plasă de siguranță, lead-ul rămâne nealocat.
  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.leads
  SET assigned_to = v_agent_id, assigned_at = now(), status = 'assigned'
  WHERE id = NEW.id;

  INSERT INTO public.lead_activities (lead_id, user_id, type, content, metadata)
  VALUES (
    NEW.id, NULL, 'assignment',
    'Lead alocat automat către ' || v_agent_name || ' prin Round-Robin',
    jsonb_build_object('assigned_to', v_agent_id, 'method', 'round_robin')
  );

  INSERT INTO public.notifications (user_id, type, title, body, lead_id)
  VALUES (
    v_agent_id, 'lead_assigned', 'Lead nou alocat',
    trim(both ' ' from coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''))
      || ' — ' || coalesce(NEW.destination, 'fără destinație'),
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_assign_lead_round_robin
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_lead_round_robin();

-- Index folosit de subquery-ul MAX(assigned_at) din algoritmul de mai sus,
-- care rulează la fiecare lead nou eligibil.
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_assigned_at ON public.leads(assigned_to, assigned_at);
