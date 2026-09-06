-- 011_facebook_field_mappings.sql
--
-- Mapare manuală de coloane pt. sincronizarea Facebook → Google Sheets → CRM
-- (src/app/api/leads/sync/facebook-sheets/route.ts), pt. formulare construite
-- cu întrebări CUSTOM (text liber) în loc de câmpul standard Meta pt.
-- nume/email/telefon — Meta exportă atunci un header derivat din eticheta
-- întrebării (ex: „nume_complet", „număr_de_telefon"), nu numele standard, și
-- recunoașterea automată din FIELD_ALIASES (import-facebook.ts) poate rata.
--
-- Un rând per filă din Sheet (`sheet_tab` = numele filei = form_name din
-- Facebook). Câmpurile *_header sunt NULL implicit = „lasă recunoașterea
-- automată să decidă" — adminul completează DOAR câmpurile pe care
-- auto-detectarea nu le-a găsit (vezi Setări → Mapare formulare Facebook).

CREATE TABLE IF NOT EXISTS public.facebook_form_field_mappings (
  sheet_tab TEXT PRIMARY KEY,
  full_name_header TEXT,
  email_header TEXT,
  phone_header TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.facebook_form_field_mappings ENABLE ROW LEVEL SECURITY;

-- Același pattern ca app_settings (005): SELECT pt. orice user autentificat,
-- scriere pt. admin/manager la nivel de RLS — restricționat suplimentar la
-- DOAR admin în ruta API (src/app/api/leads/facebook-mapping/route.ts),
-- la fel cum e deja făcut pt. /api/email/settings.
CREATE POLICY "facebook_form_field_mappings_select" ON public.facebook_form_field_mappings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "facebook_form_field_mappings_upsert_admin_manager" ON public.facebook_form_field_mappings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "facebook_form_field_mappings_update_admin_manager" ON public.facebook_form_field_mappings
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager());

COMMENT ON TABLE public.facebook_form_field_mappings IS 'Suprascriere manuală, per filă din Google Sheets (= formular Facebook), a coloanei care conține numele/emailul/telefonul — pt. formulare cu întrebări custom pe care recunoașterea automată din FIELD_ALIASES nu le prinde. NULL = auto-detectare.';
