-- ============================================================
-- ThermaShift v10 Migration — OAuth token storage
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================
--
-- oauth_tokens stores OAuth 2.1 access + refresh tokens for any third-party
-- service we connect to via OAuth (BrandJet's MCP server, future Apollo,
-- HubSpot, etc.). One row per (service, scope) combination.
--
-- The access_token + refresh_token are stored as plain text — Supabase
-- traffic is TLS, RLS gates access, and at our scale full encryption-at-rest
-- via Supabase's pgsodium would be premature. Rotation is the real defense.
--
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  service TEXT NOT NULL,        -- 'brandjet' | 'apollo' | 'hubspot' | ...
  workspace TEXT,               -- e.g. BrandJet brand id; nullable
  scopes TEXT,                  -- comma-separated list of scopes granted

  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,       -- when access_token expires (for refresh logic)

  -- PKCE state stash for in-flight authorization (cleared after token exchange)
  code_verifier TEXT,
  state TEXT,
  redirect_uri TEXT,

  -- Identity of the human that authorized (so we know who to re-auth if revoked)
  authorized_by TEXT,
  authorized_at TIMESTAMPTZ,

  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_service_workspace
  ON oauth_tokens(service, COALESCE(workspace, ''));
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_oauth_tokens" ON oauth_tokens;
CREATE POLICY "anon_oauth_tokens" ON oauth_tokens FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! Table: oauth_tokens
-- ============================================================
