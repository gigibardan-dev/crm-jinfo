-- 012_facebook_lead_dedup.sql
--
-- Protecție la nivel de bază de date împotriva leadurilor Facebook
-- duplicate — vezi discuția din chat (ex: iancuanamaria2000@gmail.com
-- importat de 4 ori, toate cu ACELAȘI facebook lead id) și
-- claude/fix-duplicate-facebook-leads-2026-09-14.md din proiect.
--
-- Confirmat: un singur cron (cron-job.org, la 10 minute) apelează
-- endpoint-ul — NU mai multe scheduler-e suprapuse, cum bănuiam inițial.
-- Cauza reală: sincronizarea (route.ts) verifică „citește ce id-uri
-- Facebook există deja în DB → inserează ce pare nou" o singură dată per
-- filă, la începutul rulării — dacă Google Sheets conține MAI MULTE rânduri
-- noi cu ACELAȘI id Facebook în ACEEAȘI rulare (Meta re-trimite/duplică
-- uneori un lead în foaie, la interval scurt — nu un bug de-al nostru),
-- toate treceau testul „nu e încă în DB" (niciuna nu era, la momentul
-- citirii) și erau inserate împreună, în același `.insert()`. Nu era nevoie
-- de nicio suprapunere de cereri pt. asta — un singur cron, o singură
-- rulare, ajunge dacă foaia are 2-3 rânduri duplicate deodată.
--
-- Fix-ul de cod (upsert cu ON CONFLICT ... DO NOTHING) elimină problema
-- asta doar dacă există o constrângere UNIQUE reală pe care Postgres să se
-- bazeze — de-aia migrarea asta, NU doar schimbarea din route.ts. Funcționează
-- și pt. duplicate „în aceeași cerere" (ON CONFLICT DO NOTHING gestionează
-- corect coliziuni în cadrul aceluiași INSERT multi-rând), nu doar pt. cele
-- din cereri separate.
--
-- ⚠️ RULEAZĂ ÎNTÂI supabase/manual/2026-09-14_cleanup_duplicate_facebook_leads_REPORT.sql
-- și _APPLY.sql (curăță duplicatele deja existente) — migrarea asta
-- eșuează la ALTER TABLE ... ADD CONSTRAINT dacă mai există duplicate.
--
-- Coloană generată (STORED) care extrage id-ul stabil Facebook din
-- source_raw_data->facebook->>id (vezi shape-ul salvat în route.ts, pas 5).
-- GENERATED, nu se poate insera direct în ea — se calculează automat din
-- source_raw_data la fiecare INSERT/UPDATE.
ALTER TABLE public.leads
  ADD COLUMN facebook_lead_id TEXT GENERATED ALWAYS AS (source_raw_data -> 'facebook' ->> 'id') STORED;

-- UNIQUE, NU parțial — Postgres nu compară NULL cu NULL, deci leadurile din
-- alte surse (sau fără id Facebook în raw data) pot avea oricâte NULL-uri,
-- constrângerea se aplică doar când coloana chiar are o valoare. Asta
-- permite folosirea directă a `.upsert(..., { onConflict: 'facebook_lead_id',
-- ignoreDuplicates: true })` din route.ts, fără WHERE suplimentar pe target.
ALTER TABLE public.leads
  ADD CONSTRAINT leads_facebook_lead_id_key UNIQUE (facebook_lead_id);

COMMENT ON COLUMN public.leads.facebook_lead_id IS 'Extras automat din source_raw_data->facebook->>id. UNIQUE — previne dublurile de sincronizare Facebook la nivel de bază de date, indiferent de câte scheduler-e/pingere apelează endpoint-ul de sync concurent. Vezi migrarea 012 și route.ts.';
