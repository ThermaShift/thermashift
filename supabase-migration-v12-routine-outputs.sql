-- ============================================================
-- ThermaShift v12 Migration — Routine Output Capture
-- Run once in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
-- Stores the final reports produced by remote claude.ai routines
-- (the June 8 launch-readiness check, future periodic warmup checks,
-- etc.) so the conversation output isn't trapped behind the
-- claude.ai auth wall.
--
-- Routines INSERT one row per fire. We READ via REST any time.
-- ============================================================

CREATE TABLE IF NOT EXISTS routine_outputs (
  id BIGSERIAL PRIMARY KEY,
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  routine_id TEXT,                  -- e.g. trig_01Rz9a9YWrRbAPGefrVpdUD7
  routine_name TEXT,                -- human-readable name
  status TEXT DEFAULT 'completed',  -- 'completed' | 'failed' | 'partial'
  report TEXT,                      -- the full markdown report
  metadata JSONB                    -- arbitrary structured data: parsed metrics, errors, etc.
);

CREATE INDEX IF NOT EXISTS idx_routine_outputs_fired_at ON routine_outputs (fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_routine_outputs_routine_id ON routine_outputs (routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_outputs_routine_name ON routine_outputs (routine_name);

-- RLS — allow anon to insert + select (this is internal ops telemetry,
-- no PII, no customer data; the anon key is already used by routines).
ALTER TABLE routine_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routine_outputs_insert ON routine_outputs;
CREATE POLICY routine_outputs_insert ON routine_outputs FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS routine_outputs_select ON routine_outputs;
CREATE POLICY routine_outputs_select ON routine_outputs FOR SELECT TO anon USING (true);

-- (no UPDATE or DELETE policies — rows are immutable telemetry)
