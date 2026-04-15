-- ============================================================
-- ThermaShift v3 Migration — Cold Email Outreach System
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================

-- ─── OUTREACH PROSPECTS ─────────────────────────────────────
CREATE TABLE outreach_prospects (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  linkedin_url TEXT,
  region TEXT DEFAULT 'Southeast US',
  talking_point TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'queued',
  replied_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  notes TEXT
);

-- ─── OUTREACH EMAILS (sequence tracking) ────────────────────
CREATE TABLE outreach_emails (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  prospect_id BIGINT REFERENCES outreach_prospects(id),
  prospect_email TEXT NOT NULL,
  template TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  resend_id TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE outreach_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_outreach_prospects" ON outreach_prospects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_outreach_emails" ON outreach_emails FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_outreach_prospects_email ON outreach_prospects(email);
CREATE INDEX idx_outreach_prospects_status ON outreach_prospects(status);
CREATE INDEX idx_outreach_emails_status ON outreach_emails(status);
CREATE INDEX idx_outreach_emails_scheduled ON outreach_emails(scheduled_at);
CREATE INDEX idx_outreach_emails_prospect ON outreach_emails(prospect_id);

-- ============================================================
-- DONE! Tables: outreach_prospects, outreach_emails
-- ============================================================
