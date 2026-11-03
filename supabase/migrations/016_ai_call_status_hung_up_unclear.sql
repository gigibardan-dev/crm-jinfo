-- ============================================
-- supabase/migrations/016_ai_call_status_hung_up_unclear.sql
--
-- Migration: Calificare AI mai corectă — două valori noi + recalculare
-- Run in Supabase SQL Editor
--
-- Problema: un apel de 7–8 secunde, în care clientul a închis fără să spună
-- nimic, ieșea „Interesat". Cauza: Structured Output-ul e completat de un LLM
-- care „ghicește" valori (ex. interesat = „nesigur") chiar dacă discuția n-a
-- avut loc, iar regula veche trata „nesigur" / lipsa datelor ca „Interesat".
--
-- De acum (lib/voice/classify.ts):
--   - hung_up  „A închis repede" — a răspuns, dar a spus sub 3 cuvinte;
--   - unclear  „Neclar"          — a vorbit, dar fără un „da" / „nu" clar
--                                   (de ascultat de un om);
--   - „Interesat" cere un „da" explicit ȘI o discuție reală.
--
-- Partea 2 recalculează apelurile deja făcute, după aceleași reguli (pe
-- conversația salvată în raw_report), și sincronizează badge-ul de pe lead.
--
-- Idempotent.
-- ============================================

-- 1. Valorile noi în constrângerea de pe leads
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_ai_call_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_ai_call_status_check CHECK (
  ai_call_status IS NULL OR ai_call_status IN (
    'queued', 'in_progress',
    'hot', 'interested', 'other_request', 'callback',
    'not_interested', 'no_answer', 'hung_up', 'unclear', 'invalid', 'failed'
  )
);

-- 2. Recalculare pentru apelurile deja încheiate
WITH speech AS (
  SELECT
    c.id,
    COALESCE((
      SELECT SUM(cardinality(regexp_split_to_array(btrim(m->>'message'), '\s+')))
      FROM jsonb_array_elements(COALESCE(c.raw_report->'artifact'->'messages', '[]'::jsonb)) m
      WHERE m->>'role' = 'user' AND btrim(COALESCE(m->>'message', '')) <> ''
    ), 0) AS words,
    lower(COALESCE(c.structured_data->>'interesat', '')) AS interesat
  FROM public.ai_calls c
  WHERE c.status = 'ended'
    AND c.raw_report IS NOT NULL
    AND c.result IN ('hot', 'interested', 'other_request', 'callback', 'not_interested')
    AND COALESCE(lower(c.structured_data->>'nu_mai_suna'), '') NOT IN ('true', 'da')
)
UPDATE public.ai_calls c
SET result = CASE
  WHEN s.words = 0 THEN 'hung_up'
  WHEN s.words < 3 AND s.interesat = 'nu' THEN 'not_interested'
  WHEN s.words < 3 THEN 'hung_up'
  -- discuție reală, dar „Interesat" fără un „da" explicit → Neclar
  WHEN c.result = 'interested' AND s.interesat NOT IN ('da', 'true', 'yes') THEN 'unclear'
  ELSE c.result
END
FROM speech s
WHERE s.id = c.id;

-- 3. Badge-ul de pe lead = rezultatul ultimului apel
UPDATE public.leads l
SET ai_call_status = c.result
FROM public.ai_calls c
WHERE l.ai_last_call_id = c.id
  AND c.result IS NOT NULL
  AND l.ai_call_status IS DISTINCT FROM c.result
  AND l.ai_call_status NOT IN ('queued', 'in_progress');
