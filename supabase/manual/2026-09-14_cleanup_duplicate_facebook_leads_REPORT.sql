-- supabase/manual/2026-09-14_cleanup_duplicate_facebook_leads_REPORT.sql
--
-- PARTEA 1 din 2 — RAPORT, doar SELECT, nimic nu se modifică. Rulează-l
-- primul în Supabase SQL Editor și uită-te pe rezultat înainte de PARTEA 2
-- (_APPLY.sql), care chiar șterge rânduri.
--
-- Vezi claude/fix-duplicate-facebook-leads-2026-09-14.md din proiect pt.
-- context complet. Pe scurt: leaduri din sincronizarea Facebook au fost
-- importate de mai multe ori (același `fb_lead_id`, mai multe rânduri în
-- `leads`) — cauza exactă (o singură rulare de sync a găsit rândul duplicat
-- de mai multe ori în Google Sheets, verificarea de deduplicare din cod
-- fiind doar împotriva bazei de date, nu și în cadrul aceleiași rulări) e
-- fixată acum în cod (upsert + constrângere UNIQUE, migrarea 012), dar
-- duplicatele deja existente trebuie curățate manual o dată.
--
-- IMPORTANT: rulează asta ÎNAINTE de migrarea 012 — aia adaugă o
-- constrângere UNIQUE care eșuează dacă mai există duplicate în tabel.
--
-- Cum alege „originalul" de păstrat, per grup de duplicate (același
-- fb_lead_id): scor, nu doar „cel mai vechi" orb —
--   +100 dacă status-ul nu mai e „new" (s-a mișcat în pipeline)
--   +50  dacă are agent alocat (assigned_to)
--   +10 per activitate REALĂ (notă/apel/email/schimbare status etc. — nu
--        nota automată „Lead importat automat din Google Sheets...")
--   +5  per reminder legat de el
-- La egalitate (cazul obișnuit — niciuna din copii n-a fost atinsă de
-- nimeni), câștigă cel mai vechi (created_at), exact cum ai cerut, pt. că
-- probabil ăla a apucat să fie procesat/văzut primul.

CREATE TEMP TABLE fb_dupe_groups AS
SELECT
  l.id,
  (l.source_raw_data -> 'facebook' ->> 'id') AS fb_id,
  l.created_at,
  l.first_name,
  l.last_name,
  l.email,
  l.phone,
  l.status,
  l.assigned_to,
  (
    CASE WHEN l.status <> 'new' THEN 100 ELSE 0 END
    + CASE WHEN l.assigned_to IS NOT NULL THEN 50 ELSE 0 END
    + COALESCE((
        SELECT COUNT(*) FROM public.lead_activities la
        WHERE la.lead_id = l.id
          AND NOT (la.type = 'system' AND la.content LIKE 'Lead importat automat%')
      ), 0) * 10
    + COALESCE((SELECT COUNT(*) FROM public.reminders r WHERE r.lead_id = l.id), 0) * 5
  ) AS score
FROM public.leads l
WHERE l.source_raw_data -> 'facebook' ->> 'id' IS NOT NULL;

-- păstrăm doar grupurile care chiar au duplicate (2+ leaduri cu același fb_id)
DELETE FROM fb_dupe_groups g
WHERE (SELECT COUNT(*) FROM fb_dupe_groups g2 WHERE g2.fb_id = g.fb_id) < 2;

CREATE TEMP TABLE fb_dupe_keepers AS
SELECT DISTINCT ON (fb_id) id AS keeper_id, fb_id
FROM fb_dupe_groups
ORDER BY fb_id, score DESC, created_at ASC, id ASC;

-- ── Raport rezumat: câte grupuri, câte leaduri s-ar șterge ──
SELECT
  COUNT(DISTINCT fb_id) AS grupuri_duplicate,
  COUNT(*) AS total_leaduri_in_grupuri,
  COUNT(*) - COUNT(DISTINCT fb_id) AS leaduri_care_s_ar_sterge
FROM fb_dupe_groups;

-- ── Raport detaliat: un rând per lead, marcat păstrat/șters ──
-- „va_fi_sters=true” + „assigned_to” populat = un agent are momentan cardul
-- ăsta în lista lui și îl va pierde la curățare — dacă vezi nume aici pe
-- care nu te așteptai să le vezi, anunță agentul înainte, sau exclude acel
-- grup manual din PARTEA 2.
SELECT
  g.fb_id,
  g.id AS lead_id,
  (k.keeper_id = g.id) AS este_pastrat,
  (k.keeper_id <> g.id) AS va_fi_sters,
  g.created_at,
  g.first_name,
  g.last_name,
  g.email,
  g.phone,
  g.status,
  g.assigned_to,
  g.score
FROM fb_dupe_groups g
JOIN fb_dupe_keepers k USING (fb_id)
ORDER BY g.fb_id, este_pastrat DESC, g.created_at;
