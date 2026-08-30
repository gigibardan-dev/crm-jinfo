-- ============================================
-- supabase/migrations/006_notifications_delete.sql
--
-- Migration: Permite ștergerea notificărilor proprii
-- Run in Supabase SQL Editor
--
-- migrarea 001 avea SELECT/INSERT/UPDATE pe `notifications`, dar nu și
-- DELETE — fără o politică RLS explicită, orice DELETE e refuzat implicit.
-- Necesar pt. ștergerea individuală/în grup din /notifications (vezi
-- src/app/(app)/notifications/page.tsx) — userul poate șterge doar
-- notificările lui, la fel ca la UPDATE (marcare citit).
-- ============================================

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
