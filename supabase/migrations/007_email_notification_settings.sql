-- ============================================
-- supabase/migrations/007_email_notification_settings.sql
--
-- Migration: Control notificări email — switch general + mod testare
-- Run in Supabase SQL Editor
--
-- Extinde tabelul generic `app_settings` (creat în migrarea 005) cu trei
-- chei noi, cerute explicit de admin ca infrastructură pt. viitoarele
-- trimiteri automate (digest zilnic, alerte) — vezi
-- src/lib/email/emailSettings.ts + src/lib/email/sendMail.ts
-- (`sendNotificationMail`):
--
-- - 'email_notifications_enabled' (bool, implicit FALSE) — switch general.
--   Cât timp e oprit, `sendNotificationMail()` NU trimite nimic (viitorul
--   digest/alerte rămân „construite dar tăcute" până e pornit explicit).
--   NU afectează /api/email/test — testul manual din Setări rămâne mereu
--   disponibil adminului, indiferent de switch, ca să poată verifica
--   conexiunea SMTP oricând.
-- - 'email_test_mode_enabled' (bool, implicit TRUE — safe by default) —
--   cât timp e pornit, `sendNotificationMail()` redirecționează ORICE
--   email (inclusiv viitoarele notificări automate) către
--   'email_test_recipient', indiferent de destinatarul real, cu banner
--   vizibil în corpul mailului. Echivalent EMAIL_OVERRIDE_TO (variabila de
--   mediu deja folosită de sendMail()), dar controlabil live din UI
--   (Setări → Email), fără redeploy — utilizatorul poate porni/opri
--   testarea singur, oricând, chiar din browser.
-- - 'email_test_recipient' (text, implicit "online@jinfotours.ro") —
--   adresa de test, editabilă din Setări.
--
-- Update pe aceste chei: RLS-ul deja existent pe app_settings
-- (`app_settings_update_admin_manager`, migrarea 005) permite admin SAU
-- manager la nivel de tabel — dar singurul cod care scrie aceste chei
-- (src/app/api/email/settings/route.ts) verifică explicit rol admin
-- (nu și manager), deci în practică doar adminul le poate schimba, din UI.
-- ============================================

INSERT INTO public.app_settings (key, value) VALUES
  ('email_notifications_enabled', 'false'::jsonb),
  ('email_test_mode_enabled', 'true'::jsonb),
  ('email_test_recipient', '"online@jinfotours.ro"'::jsonb)
ON CONFLICT (key) DO NOTHING;
