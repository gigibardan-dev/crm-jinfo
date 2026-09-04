-- 010_digest_opt_out.sql
--
-- Excludere per-user din digestul zilnic automat, controlată DOAR de admin
-- (nu self-service — vezi discuția din chat: sunt 1-2 acționari/manageri
-- care nu trebuie să primească digestul în mod curent). Nu afectează
-- trimiterea manuală de test (/api/email/test) și nu afectează switch-ul
-- general „Notificări automate” (email_notifications_enabled, 007) — e un
-- filtru suplimentar, per persoană, aplicat de /api/cron/daily-digest.
--
-- Urmează exact pattern-ul lui `available_for_autoassign` (005): coloană pe
-- profiles, ADD COLUMN IF NOT EXISTS ca migrarea să fie idempotentă.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receives_digest BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.receives_digest IS 'Primește digestul zilnic automat (cron). Editabil DOAR de admin din Setări → Utilizatori — nu e self-service, spre deosebire de available_for_autoassign. Nu afectează trimiterea manuală de test.';
