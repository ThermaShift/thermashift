-- ============================================================
-- Optional: drop legacy monitoring tables (sensor_readings, clients)
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
-- Background:
--   The pre-Phase-1 monitoring stack used "clients" + "sensor_readings"
--   tables with a different schema (facility_id, rack_name, etc.). The
--   active SaaS now uses monitoring_clients / monitoring_sensors / etc.
--   The legacy code (Monitor.jsx, ClientPortal.jsx, ClientAuth.jsx) was
--   removed in commit Phase 4 cleanup.
--
-- Safe to run if:
--   - You no longer need the "Steve PC Test" entry from April 1
--   - You're not running the old PC monitoring agent that wrote sensor_readings
-- ============================================================

DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- After running, monitoring tables remaining:
--   leads, conversations, audits, proposals, invoices, payments, subscriptions
--   call_logs, follow_ups
--   outreach_prospects, outreach_emails
--   monitoring_clients, monitoring_sites, monitoring_sensors,
--   monitoring_readings, monitoring_alert_rules, monitoring_incidents,
--   monitoring_alert_notifications, monitoring_subscriptions
