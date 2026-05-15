-- ============================================================
-- ThermaShift v9 Migration — Intent-based Lead Scoring
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
--
-- intent_companies stores the output of server/intent-scraper.js — companies
-- that match our ICP and are showing buying intent (hiring, funding, AI/GPU
-- announcements). Each row is one company, scored 0-100, bucketed
-- HOT/WARM/COLD/SKIP. We promote rows to outreach_prospects only when an
-- enriched contact is available (via BrandJet enrichment or manual).
--
-- Idempotent: run on a fresh DB or on top of existing data.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS intent_companies (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Identity
  company TEXT NOT NULL,
  domain TEXT,
  country TEXT,         -- 'us' | 'gb' | 'ie' | 'ca' | 'au'

  -- Scoring
  score INT NOT NULL DEFAULT 0,
  bucket TEXT NOT NULL,  -- 'HOT' (80-100) | 'WARM' (60-79) | 'COLD' (40-59) | 'SKIP' (<40)

  -- Raw signals (for explainability + audit)
  hiring_signals JSONB DEFAULT '[]'::jsonb,
  news_signals JSONB DEFAULT '[]'::jsonb,
  geo_bonus INT DEFAULT 0,
  urgency_bonus INT DEFAULT 0,   -- e.g. Section 179D US bonus

  signal_summary TEXT,           -- Human-readable one-liner for the dashboard

  -- Lifecycle status
  status TEXT DEFAULT 'new',     -- 'new' | 'exported' | 'in_campaign' | 'replied' | 'qualified' | 'disqualified' | 'skipped'
  exported_at TIMESTAMPTZ,
  brandjet_lead_id TEXT,

  -- Last time the scraper touched this row
  last_scored_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_companies_name_country
  ON intent_companies(lower(company), country);
CREATE INDEX IF NOT EXISTS idx_intent_companies_score ON intent_companies(score DESC);
CREATE INDEX IF NOT EXISTS idx_intent_companies_bucket ON intent_companies(bucket);
CREATE INDEX IF NOT EXISTS idx_intent_companies_status ON intent_companies(status);
CREATE INDEX IF NOT EXISTS idx_intent_companies_last_scored ON intent_companies(last_scored_at DESC);

ALTER TABLE intent_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_intent_companies" ON intent_companies;
CREATE POLICY "anon_intent_companies" ON intent_companies FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! Table: intent_companies
-- ============================================================
