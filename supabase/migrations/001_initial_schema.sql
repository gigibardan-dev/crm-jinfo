-- ============================================
-- supabase/migrations/001_initial_schema.sql
--
-- JinfoTours CRM — Complete Database Schema
-- Run this in Supabase SQL Editor
--
-- Creează schema completă inițială: helper functions (get_user_role,
-- is_admin), tabelele profiles/leads/lead_activities/reminders/
-- notifications/pipeline_stages/lead_sources/lead_attachments, RLS
-- policies pe rol (admin/manager/agent) și seed data (pipeline stages +
-- lead sources implicite).
-- ============================================

-- ============================================
-- 1. HELPER FUNCTIONS
-- ============================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 2. TABLES
-- ============================================

-- Profiles (extends Supabase Auth)
-- Accounts are created ONLY by Admin (no self-registration)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pipeline Stages (configurable by admin)
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL,
  color TEXT DEFAULT '#94a3b8',
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead Sources (configurable by admin)
CREATE TABLE public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  webhook_key TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  
  -- Source
  source TEXT NOT NULL,
  source_detail TEXT,
  source_raw_data JSONB,
  
  -- Travel request
  destination TEXT,
  travel_date_from DATE,
  travel_date_to DATE,
  nr_adults INT DEFAULT 1,
  nr_children INT DEFAULT 0,
  children_ages TEXT,
  budget_range TEXT,
  trip_type TEXT,
  message TEXT,
  
  -- Pipeline
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags TEXT[] DEFAULT '{}',
  
  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id),
  
  -- Tracking
  first_response_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  next_followup_at TIMESTAMPTZ,
  
  -- Closure
  lost_reason TEXT,
  won_value NUMERIC,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead Activities / Timeline
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN (
    'status_change', 'comment', 'assignment', 'reminder_set',
    'email_sent', 'call_logged', 'system', 'edit'
  )),
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reminders
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  remind_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'lead_assigned', 'reminder_due', 'lead_new', 'mention', 'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lead Attachments
CREATE TABLE public.lead_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. INDEXES
-- ============================================

-- Leads indexes
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_priority ON public.leads(priority);
CREATE INDEX idx_leads_next_followup ON public.leads(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_leads_email ON public.leads(email) WHERE email IS NOT NULL;
CREATE INDEX idx_leads_phone ON public.leads(phone) WHERE phone IS NOT NULL;

-- Activities indexes
CREATE INDEX idx_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_activities_created_at ON public.lead_activities(created_at DESC);

-- Reminders indexes
CREATE INDEX idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX idx_reminders_remind_at ON public.reminders(remind_at) WHERE is_completed = false;
CREATE INDEX idx_reminders_lead_id ON public.reminders(lead_id);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Pipeline stages order
CREATE INDEX idx_pipeline_stages_order ON public.pipeline_stages(display_order);

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update last_activity_at when activity is inserted
CREATE OR REPLACE FUNCTION public.handle_lead_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads 
  SET last_activity_at = now()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_lead_activity_timestamp
  AFTER INSERT ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_activity();

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

-- Everyone can read active profiles (needed for assignment dropdowns, etc.)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can insert profiles
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update any profile; users can update their own (limited fields handled in app)
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR id = auth.uid()
  );

-- Only admin can delete (deactivate) profiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- LEADS ----

-- Agent sees only assigned leads; admin/manager see all
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager()
    OR assigned_to = auth.uid()
  );

-- Agent can insert (walk-in/phone); admin/manager can insert
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Agent can update own leads; admin/manager can update all
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_manager()
    OR assigned_to = auth.uid()
  );

-- Only admin can delete leads
CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- LEAD ACTIVITIES ----

-- Agent sees activities on own leads; admin/manager see all
CREATE POLICY "activities_select" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_activities.lead_id 
      AND leads.assigned_to = auth.uid()
    )
  );

-- Anyone can insert activities (on leads they can see)
CREATE POLICY "activities_insert" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_id 
      AND leads.assigned_to = auth.uid()
    )
  );

-- ---- REMINDERS ----

-- Users see their own reminders
CREATE POLICY "reminders_select" ON public.reminders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager());

-- Users can create reminders for themselves
CREATE POLICY "reminders_insert" ON public.reminders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own reminders
CREATE POLICY "reminders_update" ON public.reminders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own reminders
CREATE POLICY "reminders_delete" ON public.reminders
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- NOTIFICATIONS ----

-- Users see their own notifications
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- System/admin can insert notifications (via service role or function)
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can update their own (mark as read)
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ---- PIPELINE STAGES ----

-- Everyone can read pipeline stages
CREATE POLICY "pipeline_stages_select" ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can modify pipeline stages
CREATE POLICY "pipeline_stages_insert_admin" ON public.pipeline_stages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "pipeline_stages_update_admin" ON public.pipeline_stages
  FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "pipeline_stages_delete_admin" ON public.pipeline_stages
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- LEAD SOURCES ----

-- Everyone can read lead sources
CREATE POLICY "lead_sources_select" ON public.lead_sources
  FOR SELECT TO authenticated
  USING (true);

-- Only admin can modify lead sources
CREATE POLICY "lead_sources_insert_admin" ON public.lead_sources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "lead_sources_update_admin" ON public.lead_sources
  FOR UPDATE TO authenticated
  USING (public.is_admin());

-- ---- LEAD ATTACHMENTS ----

-- Same visibility as leads
CREATE POLICY "attachments_select" ON public.lead_attachments
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_attachments.lead_id 
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "attachments_insert" ON public.lead_attachments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "attachments_delete" ON public.lead_attachments
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================
-- 6. SEED DATA
-- ============================================

-- Pipeline Stages
INSERT INTO public.pipeline_stages (name, slug, display_order, color, is_terminal, is_default) VALUES
  ('Nou / Nealocat',    'new',              1,  '#94a3b8', false, true),
  ('Alocat',            'assigned',         2,  '#60a5fa', false, false),
  ('Contactat',         'contacted',        3,  '#818cf8', false, false),
  ('Ofertă Trimisă',    'quote_sent',       4,  '#f59e0b', false, false),
  ('Follow-up',         'follow_up',        5,  '#fb923c', false, false),
  ('Ofertă Acceptată',  'quote_accepted',   6,  '#34d399', false, false),
  ('Rezervare în Curs', 'booking_pending',  7,  '#2dd4bf', false, false),
  ('Plată Primită',     'payment_received', 8,  '#a78bfa', false, false),
  ('Confirmat',         'confirmed',        9,  '#22c55e', false, false),
  ('Câștigat',          'won',              10, '#16a34a', true,  false),
  ('Pierdut',           'lost',             11, '#ef4444', true,  false),
  ('Necalificat',       'unqualified',      12, '#6b7280', true,  false);

-- Lead Sources
INSERT INTO public.lead_sources (name, slug, icon) VALUES
  ('Facebook Ads',    'facebook',     '📘'),
  ('TikTok Ads',      'tiktok',       '🎵'),
  ('Google Ads',      'google',       '🔍'),
  ('Formular Site',   'website_form', '🌐'),
  ('JinfoCruise.ro',  'jinfocruise',  '🚢'),
  ('Chat AI Site',    'chat_ai',      '🤖'),
  ('Email',           'email',        '✉️'),
  ('Walk-in Agenție', 'walk_in',      '🏢'),
  ('Telefon',         'phone',        '📞'),
  ('Recomandare',     'referral',     '🤝'),
  ('Altele',          'other',        '📌');

-- ============================================
-- 7. STORAGE BUCKET
-- ============================================

-- Create storage bucket for lead attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-attachments', 'lead-attachments', false);

-- Storage RLS: authenticated users can upload
CREATE POLICY "attachments_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-attachments');

-- Storage RLS: authenticated users can read
CREATE POLICY "attachments_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-attachments');

-- ============================================
-- 8. REALTIME
-- ============================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activities;
