-- ============================================
-- supabase/migrations/008_no_response_stage.sql
--
-- Migration: Etapă nouă „Nu a Răspuns" în pipeline
-- Run in Supabase SQL Editor
--
-- Cerută explicit: cazuri în care clientul a fost contactat dar nu
-- răspunde — trebuie urmărit (revenit la el) până trece în Necalificat
-- sau alt status, nu rămâne „blocat" vizual pe Contactat/Ofertă Trimisă.
--
-- Poziționată între „Contactat" (3) și „Ofertă Trimisă" (4) — deplasăm
-- toate etapele de la 4 în sus cu +1 și inserăm noua etapă pe poziția 4.
-- Restul aplicației (Kanban, dropdown de status, filtre, /reports) citește
-- `pipeline_stages` direct din DB, ordonat după `display_order` — nu sunt
-- necesare alte schimbări de cod pt. ca etapa nouă să apară peste tot.
--
-- `is_terminal = false` — un lead „Nu a Răspuns" NU e închis, deci intră
-- automat în alertele de lead stagnant existente (StagnantLeadsWidget,
-- migrarea 004) dacă nu are nicio interacțiune de peste 48h/96h, exact ca
-- restul etapelor active — nu a fost nevoie de nicio logică nouă pt. asta.
--
-- Idempotent — sigur de rulat de mai multe ori (verifică întâi dacă etapa
-- există deja, ca să nu deplaseze de două ori celelalte etape).
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE slug = 'no_response') THEN
    UPDATE public.pipeline_stages SET display_order = display_order + 1 WHERE display_order >= 4;

    INSERT INTO public.pipeline_stages (name, slug, display_order, color, is_terminal, is_default)
    VALUES ('Nu a Răspuns', 'no_response', 4, '#eab308', false, false);
  END IF;
END $$;
