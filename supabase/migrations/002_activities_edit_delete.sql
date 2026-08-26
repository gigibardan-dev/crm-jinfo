-- ============================================
-- supabase/migrations/002_activities_edit_delete.sql
--
-- Migration: Allow comment edit/delete on lead_activities
-- Run in Supabase SQL Editor
--
-- Adaugă RLS policies UPDATE/DELETE pe lead_activities, ca să funcționeze
-- editarea/ștergerea comentariilor din LeadTimeline (owner-ul comentariului
-- sau admin) — vezi src/components/leads/LeadTimeline.tsx.
-- ============================================

-- Allow users to update their own comments, admin can update any
CREATE POLICY "activities_update" ON public.lead_activities
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

-- Allow users to delete their own comments, admin can delete any
CREATE POLICY "activities_delete" ON public.lead_activities
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );
