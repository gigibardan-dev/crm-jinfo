-- ============================================
-- supabase/migrations/009_rename_lost_stage.sql
--
-- Migration: Redenumire etapă „Pierdut" → „Fără Succes"
-- Run in Supabase SQL Editor
--
-- Cerută explicit: agenții evită să marcheze leadurile ca „Pierdut" —
-- termenul se simte ca un eșec personal, nu doar ca un rezultat normal de
-- vânzări. Redenumim DOAR eticheta afișată (`pipeline_stages.name`) —
-- slug-ul rămâne `lost` (neschimbat peste tot în cod: TERMINAL_STATUSES,
-- round-robin, digest, rapoarte, RLS etc.), deci nu e nevoie de nicio
-- migrare de date pe `leads.status` și nimic nu se rupe.
--
-- Kanban, dropdown-ul de status, filtrele și /reports citesc numele direct
-- din DB — se actualizează automat peste tot. Câteva etichete scrise direct
-- în cod (Dashboard, pagina Agenți, modalul de marcare) sunt actualizate
-- separat, în același commit.
-- ============================================

UPDATE public.pipeline_stages SET name = 'Fără Succes' WHERE slug = 'lost';
