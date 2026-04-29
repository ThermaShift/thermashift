-- ============================================================
-- ThermaShift v4 Migration — Monitoring SaaS (Phase 1: Schema)
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
-- All tables prefixed with monitoring_ to avoid name collision with
-- any pre-existing clients/sites/sensors tables in the project.
-- Vendor-agnostic ingestion (Monnit, SensorPush, Disruptive, custom).
-- ============================================================

-- ─── MONITORING CLIENTS (paying SaaS customers) ─────────────
CREATE TABLE IF NOT EXISTS monitoring_clients (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id BIGINT REFERENCES leads(id),
  company TEXT NOT NULL,
  primary_contact_name TEXT,
  primary_contact_email TEXT NOT NULL,
  primary_contact_phone TEXT,
  billing_email TEXT,
  status TEXT DEFAULT 'active',
  tier TEXT DEFAULT 'watch',
  api_key TEXT UNIQUE,
  timezone TEXT DEFAULT 'America/New_York',
  notes TEXT
);

-- ─── MONITORING SITES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitoring_sites (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  facility_type TEXT,
  square_footage INTEGER,
  rack_count INTEGER,
  notes TEXT
);

-- ─── MONITORING SENSORS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitoring_sensors (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  site_id BIGINT REFERENCES monitoring_sites(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  external_id TEXT,
  vendor TEXT,
  name TEXT NOT NULL,
  sensor_type TEXT NOT NULL,
  unit TEXT,
  location TEXT,
  zone TEXT,
  installed_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  last_reading_at TIMESTAMPTZ,
  last_reading_value NUMERIC,
  metadata JSONB
);

-- ─── MONITORING READINGS (time-series) ──────────────────────
CREATE TABLE IF NOT EXISTS monitoring_readings (
  id BIGSERIAL PRIMARY KEY,
  sensor_id BIGINT REFERENCES monitoring_sensors(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  raw_payload JSONB,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MONITORING ALERT RULES ─────────────────────────────────
CREATE TABLE IF NOT EXISTS monitoring_alert_rules (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  sensor_id BIGINT REFERENCES monitoring_sensors(id) ON DELETE CASCADE,
  site_id BIGINT REFERENCES monitoring_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  threshold_value NUMERIC,
  threshold_window_minutes INTEGER DEFAULT 5,
  delta_value NUMERIC,
  missing_after_minutes INTEGER,
  severity TEXT DEFAULT 'warning',
  debounce_count INTEGER DEFAULT 2,
  active BOOLEAN DEFAULT TRUE,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  notify_voice BOOLEAN DEFAULT FALSE,
  notify_webhook_url TEXT,
  quiet_hours_start TIME,
  quiet_hours_end TIME
);

-- ─── MONITORING INCIDENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS monitoring_incidents (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  alert_rule_id BIGINT REFERENCES monitoring_alert_rules(id) ON DELETE SET NULL,
  sensor_id BIGINT REFERENCES monitoring_sensors(id) ON DELETE SET NULL,
  site_id BIGINT REFERENCES monitoring_sites(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open',
  severity TEXT DEFAULT 'warning',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  acked_at TIMESTAMPTZ,
  acked_by TEXT,
  resolved_at TIMESTAMPTZ,
  trigger_value NUMERIC,
  trigger_threshold NUMERIC,
  peak_value NUMERIC,
  duration_seconds INTEGER,
  summary TEXT,
  notes TEXT
);

-- ─── MONITORING ALERT NOTIFICATIONS (audit log) ─────────────
CREATE TABLE IF NOT EXISTS monitoring_alert_notifications (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  incident_id BIGINT REFERENCES monitoring_incidents(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  provider_id TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT
);

-- ─── MONITORING SUBSCRIPTIONS (Stripe SaaS billing) ─────────
CREATE TABLE IF NOT EXISTS monitoring_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_id BIGINT REFERENCES monitoring_clients(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'trialing',
  monthly_amount NUMERIC NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE monitoring_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_monitoring_clients" ON monitoring_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_sites" ON monitoring_sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_sensors" ON monitoring_sensors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_readings" ON monitoring_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_alert_rules" ON monitoring_alert_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_incidents" ON monitoring_incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_alert_notifications" ON monitoring_alert_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_monitoring_subscriptions" ON monitoring_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_monitoring_clients_email ON monitoring_clients(primary_contact_email);
CREATE INDEX IF NOT EXISTS idx_monitoring_clients_status ON monitoring_clients(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_clients_api_key ON monitoring_clients(api_key);

CREATE INDEX IF NOT EXISTS idx_monitoring_sites_client ON monitoring_sites(client_id);

CREATE INDEX IF NOT EXISTS idx_monitoring_sensors_site ON monitoring_sensors(site_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_sensors_client ON monitoring_sensors(client_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_sensors_external ON monitoring_sensors(external_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_sensors_active ON monitoring_sensors(active);

CREATE INDEX IF NOT EXISTS idx_monitoring_readings_sensor_time ON monitoring_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_readings_client_time ON monitoring_readings(client_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_readings_recorded ON monitoring_readings(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_client ON monitoring_alert_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_sensor ON monitoring_alert_rules(sensor_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_active ON monitoring_alert_rules(active);

CREATE INDEX IF NOT EXISTS idx_monitoring_incidents_client ON monitoring_incidents(client_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_incidents_status ON monitoring_incidents(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_incidents_opened ON monitoring_incidents(opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_alert_notifications_incident ON monitoring_alert_notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_notifications_status ON monitoring_alert_notifications(status);

CREATE INDEX IF NOT EXISTS idx_monitoring_subs_client ON monitoring_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_subs_status ON monitoring_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_subs_stripe ON monitoring_subscriptions(stripe_subscription_id);

-- ============================================================
-- DONE!
-- 8 new tables, all prefixed monitoring_ to avoid collisions.
-- ============================================================
