-- ============================================================
-- ThermaShift v2 Migration — New features
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================

-- ─── ADD LEAD SCORE TO LEADS ────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- ─── CALL LOGS (Vapi voice call transcripts) ───────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  vapi_call_id TEXT UNIQUE,
  lead_id BIGINT REFERENCES leads(id),
  lead_email TEXT,
  lead_phone TEXT,
  phone_number TEXT,
  direction TEXT DEFAULT 'inbound',
  duration_seconds INTEGER,
  status TEXT DEFAULT 'completed',
  summary TEXT,
  transcript JSONB,
  recording_url TEXT,
  assistant_id TEXT,
  ended_reason TEXT,
  cost NUMERIC
);

-- ─── FOLLOW-UPS (automated email sequences) ────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id BIGINT REFERENCES leads(id),
  lead_email TEXT NOT NULL,
  audit_id BIGINT REFERENCES audits(id),
  sequence_number INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- ─── RLS FOR NEW TABLES ────────────────────────────────────
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_call_logs" ON call_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_follow_ups" ON follow_ups FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_call_logs_lead ON call_logs(lead_email);
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi ON call_logs(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_email);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score);

-- ============================================================
-- DONE! New tables: call_logs, follow_ups. New column: leads.lead_score
-- ============================================================
