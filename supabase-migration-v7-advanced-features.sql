-- ============================================================
-- ThermaShift v7 Migration — Phase 7B/7C/7F/7G + Phase 5 (Stripe)
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
-- Adds:
--   • Composite alert rules + time-of-day + cross-sensor refs (Phase 7C)
--   • Per-client saved dashboard layouts (Phase 7B)
--   • Advisor chat threads (Phase 7F)
--   • Sales escalation suggestions (Phase 7G)
--   • Stripe subscription metadata (Phase 5)
-- ============================================================

-- ─── EXTEND monitoring_alert_rules for composite + time-of-day ──
ALTER TABLE monitoring_alert_rules ADD COLUMN IF NOT EXISTS composite_logic TEXT;
ALTER TABLE monitoring_alert_rules ADD COLUMN IF NOT EXISTS conditions JSONB;
ALTER TABLE monitoring_alert_rules ADD COLUMN IF NOT EXISTS active_days_of_week INTEGER[];
ALTER TABLE monitoring_alert_rules ADD COLUMN IF NOT EXISTS active_hour_start INTEGER;
ALTER TABLE monitoring_alert_rules ADD COLUMN IF NOT EXISTS active_hour_end INTEGER;
ALTER TABLE monitoring_alert_rules ADD COLUMN IF NOT EXISTS related_sensor_ids BIGINT[];

-- ─── CLIENT DASHBOARDS (Phase 7B) ───────────────────────────
CREATE TABLE IF NOT EXISTS client_dashboards (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  layout JSONB NOT NULL,
  widgets JSONB NOT NULL,
  shared_with TEXT[]
);

-- ─── ADVISOR CHAT (Phase 7F) ────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_chats (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  incident_id BIGINT REFERENCES monitoring_incidents(id) ON DELETE SET NULL,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ
);

-- ─── SALES ESCALATIONS (Phase 7G) ──────────────────────────
CREATE TABLE IF NOT EXISTS sales_escalations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  trigger_pattern TEXT,
  related_incident_ids BIGINT[],
  recommended_service TEXT,
  estimated_value_low NUMERIC,
  estimated_value_high NUMERIC,
  ai_pitch_summary TEXT,
  status TEXT DEFAULT 'pending_client',
  client_decision TEXT,
  client_decided_at TIMESTAMPTZ,
  steve_notified_at TIMESTAMPTZ,
  closer_draft_id BIGINT REFERENCES prospect_messages(id) ON DELETE SET NULL,
  notes TEXT
);

-- ─── STRIPE INTEGRATION (Phase 5) ──────────────────────────
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Stripe events log for idempotency + audit
CREATE TABLE IF NOT EXISTS stripe_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  stripe_event_id TEXT UNIQUE,
  event_type TEXT,
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE SET NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE client_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_client_dashboards" ON client_dashboards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_advisor_chats" ON advisor_chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_sales_escalations" ON sales_escalations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_stripe_events" ON stripe_events FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_client_dashboards_client ON client_dashboards(client_id);
CREATE INDEX IF NOT EXISTS idx_advisor_chats_client ON advisor_chats(client_id);
CREATE INDEX IF NOT EXISTS idx_advisor_chats_incident ON advisor_chats(incident_id);
CREATE INDEX IF NOT EXISTS idx_sales_escalations_client ON sales_escalations(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_escalations_status ON sales_escalations(status);
CREATE INDEX IF NOT EXISTS idx_stripe_events_id ON stripe_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed);
CREATE INDEX IF NOT EXISTS idx_monitoring_clients_stripe_cust ON monitoring_clients(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_clients_stripe_sub ON monitoring_clients(stripe_subscription_id);

-- ============================================================
-- DONE!
-- ============================================================
