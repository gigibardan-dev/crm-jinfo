-- ============================================
-- supabase/migrations/003_won_deal_details.sql
--
-- Migration: Detalii extinse pentru lead-uri câștigate
-- Run in Supabase SQL Editor
--
-- Extinde modalul „Lead câștigat" (WonValueModal) cu câmpuri opționale
-- suplimentare, pe lângă `won_value` existent (redenumit doar vizual în
-- UI ca „Sumă totală încasată (EUR)" — coloana rămâne neschimbată, deci
-- migrarea de mai jos e pur aditivă, fără niciun risc pentru datele
-- existente):
--   - order_number      — Număr comandă în sistem
--   - contract_number   — Număr contract
--   - invoice_number    — Număr factură
--   - total_amount_ron  — Sumă totală încasată, în RON (won_value = EUR)
--   - commission_eur    — Comision, în EUR
--   - commission_ron    — Comision, în RON
-- Toate opționale (NULL by default), completate doar la marcarea unui
-- lead ca "won" — vezi src/lib/types/wonDetails.ts.
-- ============================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS contract_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS total_amount_ron NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_ron NUMERIC;

COMMENT ON COLUMN public.leads.won_value IS 'Sumă totală încasată (EUR) — completat la marcarea lead-ului ca „won". Vezi și total_amount_ron, commission_eur/ron.';
COMMENT ON COLUMN public.leads.total_amount_ron IS 'Sumă totală încasată (RON) — opțional, alături de won_value (EUR).';
COMMENT ON COLUMN public.leads.commission_eur IS 'Comision agenție (EUR) — opțional.';
COMMENT ON COLUMN public.leads.commission_ron IS 'Comision agenție (RON) — opțional.';
COMMENT ON COLUMN public.leads.order_number IS 'Număr comandă în sistemul intern — opțional.';
COMMENT ON COLUMN public.leads.contract_number IS 'Număr contract — opțional.';
COMMENT ON COLUMN public.leads.invoice_number IS 'Număr factură — opțional.';
