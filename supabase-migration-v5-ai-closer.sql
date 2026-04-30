-- ============================================================
-- ThermaShift v5 Migration — AI Sales Closer (Phase 6)
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
-- Adds prospect_messages (inbound + outbound email thread storage),
-- scheduled_calls (queue for AI-driven outbound Vapi calls), and a few
-- columns on outreach_prospects to track phone + qualification.
-- ============================================================

-- ─── EXTEND outreach_prospects ──────────────────────────────
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- ─── PROSPECT MESSAGES (full email thread, both directions) ─
CREATE TABLE IF NOT EXISTS prospect_messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  prospect_id BIGINT REFERENCES outreach_prospects(id) ON DELETE CASCADE,
  prospect_email TEXT NOT NULL,
  direction TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  body_html TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  thread_id TEXT,
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_reasoning TEXT,
  ai_tool_calls JSONB,
  status TEXT DEFAULT 'received',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  resend_id TEXT,
  received_at TIMESTAMPTZ
);

-- ─── SCHEDULED CALLS (AI-booked outbound Vapi calls) ────────
CREATE TABLE IF NOT EXISTS scheduled_calls (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  prospect_id BIGINT REFERENCES outreach_prospects(id) ON DELETE CASCADE,
  prospect_email TEXT NOT NULL,
  prospect_phone TEXT NOT NULL,
  prospect_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  context_summary TEXT,
  vapi_call_id TEXT,
  placed_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  result_summary TEXT,
  error TEXT
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE prospect_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_prospect_messages" ON prospect_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_scheduled_calls" ON scheduled_calls FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prospect_messages_prospect ON prospect_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_messages_email ON prospect_messages(prospect_email);
CREATE INDEX IF NOT EXISTS idx_prospect_messages_thread ON prospect_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_prospect_messages_status ON prospect_messages(status);
CREATE INDEX IF NOT EXISTS idx_prospect_messages_message_id ON prospect_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_prospect_messages_direction ON prospect_messages(direction);

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_prospect ON scheduled_calls(prospect_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduled ON scheduled_calls(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_qualified ON outreach_prospects(qualified_at);

-- ============================================================
-- DONE!
-- New tables: prospect_messages, scheduled_calls
-- New columns on outreach_prospects: phone, qualified_at, escalated_at, escalation_reason
-- ============================================================
