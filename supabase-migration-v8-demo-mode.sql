-- ============================================================
-- ThermaShift v8 Migration — Demo Mode (no-API canned responses)
-- ============================================================
-- Adds an is_demo flag and demo_advisor_response column on
-- monitoring_clients so demo URLs can serve hand-crafted advisor
-- analyses without calling the Claude API.
-- ============================================================

ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS demo_advisor_response JSONB;
ALTER TABLE monitoring_clients ADD COLUMN IF NOT EXISTS demo_chat_disabled_message TEXT;

CREATE INDEX IF NOT EXISTS idx_monitoring_clients_is_demo ON monitoring_clients(is_demo) WHERE is_demo = true;

-- ============================================================
-- DONE!
-- ============================================================
