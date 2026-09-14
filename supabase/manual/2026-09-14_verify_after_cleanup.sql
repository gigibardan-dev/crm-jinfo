-- supabase/manual/2026-09-14_verify_after_cleanup.sql
--
-- Doar SELECT, nimic nu se modifică. Rulează asta DUPĂ ce ai rulat
-- _APPLY.sql + migrarea 012, ca să confirmi cu cifre exacte (nu doar
-- „arată cam puțin") — vezi discuția din chat despre numărul de pe
-- dashboard (139) vs. „Număr de clienți potențiali” din Meta Ads Manager
-- (204, pe doar 5 formulare curent active).

-- 1) Au mai rămas grupuri de duplicate? Ar trebui 0 rânduri — dacă apare
-- ceva aici, fie _APPLY.sql n-a rulat complet, fie au apărut duplicate NOI
-- după curățare (ex: cron-ul a mai rulat cu codul vechi înainte de deploy).
SELECT
  source_raw_data -> 'facebook' ->> 'id' AS fb_id,
  COUNT(*) AS cate_copii
FROM public.leads
WHERE source_raw_data -> 'facebook' ->> 'id' IS NOT NULL
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY 2 DESC;

-- 2) Total leaduri Facebook în CRM, per formular (sheet_tab) — de comparat
-- cu coloana „Număr de clienți potențiali” din Ads Manager. NU ar trebui să
-- iasă identic: Ads Manager numără orice livrare brută către Sheet
-- (inclusiv exact livrările duplicate pe care tocmai le-am curățat, plus
-- orice test/lead incomplet), pe când aici numărăm doar ce a ajuns efectiv
-- ca lead unic în CRM — normal să fie mai mic, întrebarea e „cât” de mic.
SELECT
  source_raw_data ->> 'sheet_tab' AS formular,
  COUNT(*) AS leaduri_unice_in_crm,
  MIN(created_at) AS cel_mai_vechi,
  MAX(created_at) AS cel_mai_nou
FROM public.leads
WHERE source = 'facebook'
GROUP BY 1
ORDER BY 2 DESC;

-- 3) Totalul din dashboard (139) descompus pe toate sursele — ca să vezi
-- exact din ce se compune, nu doar Facebook.
SELECT source, COUNT(*) AS leaduri
FROM public.leads
GROUP BY 1
ORDER BY 2 DESC;

-- 4) Reper de timp — de când există leaduri în CRM (util ca să judeci dacă
-- 139 e puțin sau normal pt. perioada acoperită).
SELECT MIN(created_at) AS cel_mai_vechi_lead, MAX(created_at) AS cel_mai_nou_lead, COUNT(*) AS total
FROM public.leads;
