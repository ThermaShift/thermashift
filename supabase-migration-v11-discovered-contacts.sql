-- ============================================================
-- ThermaShift v11 Migration — Discovered Contacts (BrandJet enrichment)
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
--
-- discovered_contacts stores decision-makers found via BrandJet's lead
-- database. One row per person. Links optionally to an intent_companies
-- row when the contact is at a company we already identified via Adzuna
-- (this cross-reference is the high-precision signal: company shows hiring
-- intent AND we have a real decision-maker there).
--
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS discovered_contacts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source attribution
  source TEXT NOT NULL DEFAULT 'brandjet',    -- 'brandjet' | 'apollo' | 'hunter' | 'manual'
  source_external_id TEXT,                    -- BrandJet's lead id (mvj_...)

  -- Person
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  job_level TEXT,                              -- VP | Director | Manager | C-Level | Owner
  job_function TEXT,                           -- Operations | Facilities | Sustainability | ...
  linkedin_url TEXT,
  profile_picture_url TEXT,
  headline TEXT,                               -- LinkedIn-style headline

  -- Company
  company TEXT,
  company_domain TEXT,
  company_size TEXT,
  industry TEXT,
  country TEXT,
  city TEXT,

  -- Contact info
  email TEXT,
  email_status TEXT,                           -- 'verified' | 'unverified' | 'risky' | 'unknown'
  email_revealed_at TIMESTAMPTZ,
  phone_number TEXT,
  phone_revealed_at TIMESTAMPTZ,

  -- Cross-reference to our intent_companies (high-precision signal)
  intent_company_id BIGINT REFERENCES intent_companies(id) ON DELETE SET NULL,

  -- Scoring
  score INT NOT NULL DEFAULT 0,
  bucket TEXT NOT NULL DEFAULT 'NEW',          -- HOT | WARM | COLD | SKIP | NEW
  score_breakdown JSONB DEFAULT '{}'::jsonb,   -- How the score was assembled

  -- Lifecycle
  status TEXT DEFAULT 'new',                   -- new | reviewed | pushed_to_brandjet | in_campaign | replied | qualified | disqualified
  brandjet_lead_list_id TEXT,                  -- After push, the BJ lead list this person is in
  brandjet_lead_id TEXT,
  pushed_at TIMESTAMPTZ,

  -- Credit accounting
  credits_spent INT DEFAULT 0,

  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_contacts_source_id
  ON discovered_contacts(source, COALESCE(source_external_id, ''));
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_email ON discovered_contacts(lower(email));
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_company ON discovered_contacts(lower(company));
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_score ON discovered_contacts(score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_status ON discovered_contacts(status);
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_intent ON discovered_contacts(intent_company_id);

ALTER TABLE discovered_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_discovered_contacts" ON discovered_contacts;
CREATE POLICY "anon_discovered_contacts" ON discovered_contacts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! Table: discovered_contacts
-- ============================================================
