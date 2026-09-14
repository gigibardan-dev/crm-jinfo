-- supabase/manual/2026-09-14_cleanup_duplicate_facebook_leads_APPLY.sql
--
-- PARTEA 2 din 2 — CHIAR ȘTERGE rânduri. Rulează asta DOAR după ce ai
-- văzut raportul din _REPORT.sql (PARTEA 1) și ești de acord cu ce se
-- păstrează/șterge. Recalculează singur grupurile/scorurile — nu depinde
-- de sesiunea în care ai rulat raportul, deci le poți rula în execuții
-- separate în SQL Editor fără probleme.
--
-- Ce face, în ordine, într-o singură tranzacție (totul sau nimic):
--   1. Identifică din nou grupurile de duplicate + scorul (vezi _REPORT.sql
--      pt. explicația scorului).
--   2. Mută pe „originalul" păstrat (keeper) activitatea REALĂ (notițe,
--      apeluri, schimbări de status etc.) și reminderele de pe copiile care
--      urmează să fie șterse — nimic din ce a lucrat cineva nu se pierde,
--      doar se regăsește acum pe leadul păstrat, cu o mențiune că vine de
--      pe un duplicat șters. Nota automată „Lead importat automat din
--      Google Sheets..." NU se mută (ar fi doar zgomot repetat) — dispare
--      odată cu leadul duplicat (ON DELETE CASCADE).
--   3. Șterge leadurile duplicate (nu și keeper-ul).
--
-- IMPORTANT: rulează asta ÎNAINTE de migrarea 012 (care adaugă
-- constrângerea UNIQUE — eșuează dacă mai există duplicate).
--
-- După ce rulează cu succes, verifică din nou cu _REPORT.sql —
-- „grupuri_duplicate” ar trebui să iasă 0.

BEGIN;

CREATE TEMP TABLE fb_dupe_groups AS
SELECT
  l.id,
  (l.source_raw_data -> 'facebook' ->> 'id') AS fb_id,
  l.created_at,
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

DELETE FROM fb_dupe_groups g
WHERE (SELECT COUNT(*) FROM fb_dupe_groups g2 WHERE g2.fb_id = g.fb_id) < 2;

CREATE TEMP TABLE fb_dupe_keepers AS
SELECT DISTINCT ON (fb_id) id AS keeper_id, fb_id
FROM fb_dupe_groups
ORDER BY fb_id, score DESC, created_at ASC, id ASC;

-- Reparentează activitatea reală de pe pierzători → keeper (cu mențiune de unde vine)
UPDATE public.lead_activities la
SET lead_id = k.keeper_id,
    content = COALESCE(la.content, '') || E'\n\n[Mutat automat de pe un lead Facebook duplicat al aceluiași fb_lead_id, șters la curățarea din 14 sept. 2026 — vezi claude/fix-duplicate-facebook-leads-2026-09-14.md]'
FROM fb_dupe_groups g
JOIN fb_dupe_keepers k USING (fb_id)
WHERE la.lead_id = g.id
  AND g.id <> k.keeper_id
  AND NOT (la.type = 'system' AND la.content LIKE 'Lead importat automat%');

-- Reparentează reminderele de pe pierzători → keeper
UPDATE public.reminders r
SET lead_id = k.keeper_id
FROM fb_dupe_groups g
JOIN fb_dupe_keepers k USING (fb_id)
WHERE r.lead_id = g.id
  AND g.id <> k.keeper_id;

-- Reparentează atașamentele de pe pierzători → keeper
UPDATE public.lead_attachments a
SET lead_id = k.keeper_id
FROM fb_dupe_groups g
JOIN fb_dupe_keepers k USING (fb_id)
WHERE a.lead_id = g.id
  AND g.id <> k.keeper_id;

-- Reparentează notificările deja trimise (istoric) de pe pierzători → keeper
UPDATE public.notifications n
SET lead_id = k.keeper_id
FROM fb_dupe_groups g
JOIN fb_dupe_keepers k USING (fb_id)
WHERE n.lead_id = g.id
  AND g.id <> k.keeper_id;

-- Șterge leadurile duplicate (nu keeper-ul) — ce a rămas nereparentat
-- (nota automată de import, eventual alte rânduri legate) dispare cu ele
-- via ON DELETE CASCADE.
DELETE FROM public.leads
WHERE id IN (
  SELECT g.id FROM fb_dupe_groups g
  JOIN fb_dupe_keepers k USING (fb_id)
  WHERE g.id <> k.keeper_id
);

COMMIT;
