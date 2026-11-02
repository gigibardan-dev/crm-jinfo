-- ============================================
-- supabase/migrations/014_find_leads_by_phone.sql
--
-- Migration: căutare leaduri după telefon, indiferent de format
-- Run in Supabase SQL Editor
--
-- Folosită de importul „Listă de apelare" (POST /api/leads/import cu
-- callListName): un număr din listă care există deja în CRM NU creează lead
-- nou — leadul existent e adăugat în listă (vezi migrarea 013,
-- call_list_members).
--
-- Problema: telefoanele din `leads.phone` sunt salvate în formatul în care
-- au venit din fiecare canal ("+40728870869", "0728 870 869",
-- "0728-870-869", "40728870869"...), deci o comparație exactă ratează
-- dublurile. Comparăm după ULTIMELE 9 CIFRE (numărul național românesc fără
-- prefix), după ce scoatem tot ce nu e cifră.
--
-- SECURITY DEFINER + execuție permisă DOAR pentru service_role (apelată
-- exclusiv din API route-uri cu clientul admin) — nu e expusă browserului.
--
-- Idempotent.
-- ============================================

CREATE OR REPLACE FUNCTION public.find_leads_by_phone_suffix(suffixes TEXT[])
RETURNS TABLE (
  id UUID,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  do_not_call BOOLEAN,
  created_at TIMESTAMPTZ,
  phone_suffix TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.phone, l.first_name, l.last_name, l.do_not_call, l.created_at,
         right(regexp_replace(l.phone, '\D', '', 'g'), 9) AS phone_suffix
  FROM public.leads l
  WHERE l.phone IS NOT NULL
    AND right(regexp_replace(l.phone, '\D', '', 'g'), 9) = ANY (suffixes)
  ORDER BY l.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.find_leads_by_phone_suffix(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_leads_by_phone_suffix(TEXT[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_leads_by_phone_suffix(TEXT[]) TO service_role;

COMMENT ON FUNCTION public.find_leads_by_phone_suffix(TEXT[]) IS 'Leaduri al căror telefon (doar cifrele) se termină cu unul din sufixele de 9 cifre date. Cel mai nou primul. Folosit la importul listelor de apelare AI pentru a evita leadurile duplicate. Vezi migrarea 014.';
