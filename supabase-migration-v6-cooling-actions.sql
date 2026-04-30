-- ============================================================
-- ThermaShift v6 Migration — AI Auto-Action MVP (Phase 7A, Pro tier)
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
-- Adds the action lifecycle (proposed → approved → executed → audited)
-- so AI can suggest cooling adjustments and Pro-tier clients can either
-- approve them manually or set rules for AI to act autonomously.
-- ============================================================

-- ─── EXTEND monitoring_clients with action settings ─────────
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS action_webhook_url TEXT;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS action_webhook_secret TEXT;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS actions_enabled BOOLEAN DEFAULT FALSE;

-- ─── COOLING ACTIONS — proposals + executions in one lifecycle ─
CREATE TABLE IF NOT EXISTS cooling_actions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  site_id BIGINT REFERENCES monitoring_sites(id) ON DELETE SET NULL,
  incident_id BIGINT REFERENCES monitoring_incidents(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_label TEXT,
  parameters JSONB NOT NULL,
  reasoning TEXT,
  proposed_by TEXT DEFAULT 'ai',
  status TEXT DEFAULT 'proposed',
  requires_permission BOOLEAN DEFAULT TRUE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  executed_at TIMESTAMPTZ,
  webhook_status_code INTEGER,
  webhook_response TEXT,
  error TEXT,
  before_state JSONB,
  after_state JSONB,
  expires_at TIMESTAMPTZ
);

-- ─── PERMISSION RULES — auto-approval per action_type / site ────
CREATE TABLE IF NOT EXISTS cooling_action_permissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  site_id BIGINT REFERENCES monitoring_sites(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  auto_approve BOOLEAN DEFAULT FALSE,
  max_severity TEXT DEFAULT 'critical',
  parameter_constraints JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  notes TEXT
);

-- ─── IMMUTABLE AUDIT LOG — every action-related event recorded ──
CREATE TABLE IF NOT EXISTS cooling_action_audit (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE SET NULL,
  cooling_action_id BIGINT REFERENCES cooling_actions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  actor_ip TEXT,
  details JSONB,
  before_state JSONB,
  after_state JSONB
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE cooling_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_action_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_cooling_actions" ON cooling_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_cooling_action_permissions" ON cooling_action_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_cooling_action_audit" ON cooling_action_audit FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cooling_actions_client ON cooling_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_cooling_actions_status ON cooling_actions(status);
CREATE INDEX IF NOT EXISTS idx_cooling_actions_created ON cooling_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cooling_actions_incident ON cooling_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_cooling_actions_type ON cooling_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_cooling_perms_client_type ON cooling_action_permissions(client_id, action_type);

CREATE INDEX IF NOT EXISTS idx_cooling_audit_action ON cooling_action_audit(cooling_action_id);
CREATE INDEX IF NOT EXISTS idx_cooling_audit_client ON cooling_action_audit(client_id);
CREATE INDEX IF NOT EXISTS idx_cooling_audit_created ON cooling_action_audit(created_at DESC);

-- ============================================================
-- DONE!
-- New tables: cooling_actions, cooling_action_permissions, cooling_action_audit
-- New columns on monitoring_clients: action_webhook_url, action_webhook_secret, actions_enabled
-- ============================================================
