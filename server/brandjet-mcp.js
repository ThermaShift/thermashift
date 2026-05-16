/**
 * BrandJet MCP integration via OAuth 2.1 + PKCE.
 *
 * BrandJet's REST API auth scheme isn't documented yet, but their MCP server
 * is fully spec-compliant and available at https://mcp.brandjet.ai/mcp.
 * This module:
 *   1. Discovers OAuth metadata from .well-known endpoints
 *   2. Registers a dynamic client (DCR per RFC 7591) — done once, cached
 *   3. Starts a browser auth flow with PKCE
 *   4. Exchanges code for tokens, stores in oauth_tokens table
 *   5. Refreshes tokens automatically
 *   6. Calls MCP tools via JSON-RPC 2.0 over HTTP (Streamable HTTP transport)
 *
 * Public helpers (after connect):
 *   - pushLead({company, contact_email, ...})  — creates a lead in BrandJet
 *   - listCampaigns()                           — lists user's campaigns
 *   - addLeadToCampaign(campaignId, leadId)     — enrolls lead in campaign
 *   - isConnected()                             — boolean
 *
 * Setup flow (one-time):
 *   1. Steve hits GET /api/admin/brandjet/connect
 *   2. Server registers client (cached after first call) + generates PKCE
 *   3. Server redirects Steve's browser to BrandJet auth page
 *   4. Steve clicks Allow
 *   5. BrandJet redirects to /api/admin/brandjet/oauth-callback with code
 *   6. Server exchanges code for tokens, stores in oauth_tokens
 *   7. Done forever (refresh tokens are handled automatically)
 */

import crypto from 'node:crypto';

const MCP_SERVER = 'https://mcp.brandjet.ai/mcp';
const ISSUER = 'https://mcp.brandjet.ai';
const REDIRECT_URI = 'https://thermashift.net/api/admin/brandjet/oauth-callback';

// Scopes we need for our use case (push leads + manage campaigns + read replies)
const REQUESTED_SCOPES = [
  'leads:read',
  'leads:write',
  'campaigns:read',
  'campaigns:write',
  'unibox:read',
  'brands:read',
  'email_accounts:read',
].join(' ');

// ─── Supabase token storage ──────────────────────────────────────────

// Inject the sb() helper at module init time
let _sb;
export function configureMcp(sbHelper) { _sb = sbHelper; }

async function storeTokens({ access_token, refresh_token, expires_in, scope, authorized_by }) {
  if (!_sb) throw new Error('MCP module not configured — call configureMcp(sb) first');
  const expires_at = expires_in
    ? new Date(Date.now() + (expires_in - 60) * 1000).toISOString()
    : null;
  const existing = await _sb('oauth_tokens', 'GET', null, "?service=eq.brandjet&limit=1");
  const row = {
    service: 'brandjet',
    access_token, refresh_token,
    token_type: 'Bearer',
    expires_at, scopes: scope || REQUESTED_SCOPES,
    authorized_by, authorized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    code_verifier: null, state: null,
  };
  if (existing && existing.length) {
    await _sb('oauth_tokens', 'PATCH', row, `?id=eq.${existing[0].id}`);
  } else {
    await _sb('oauth_tokens', 'POST', { ...row, created_at: new Date().toISOString() });
  }
}

async function getStoredTokens() {
  if (!_sb) return null;
  const rows = await _sb('oauth_tokens', 'GET', null, "?service=eq.brandjet&limit=1");
  return rows?.[0] || null;
}

// Stash in-flight PKCE state (code_verifier + state) between /connect and /callback.
// Re-uses the same row that will eventually hold the tokens.
async function storePkceState({ code_verifier, state, client_id, client_secret }) {
  if (!_sb) throw new Error('MCP module not configured');
  const existing = await _sb('oauth_tokens', 'GET', null, "?service=eq.brandjet&limit=1");
  const row = {
    service: 'brandjet',
    code_verifier, state, redirect_uri: REDIRECT_URI,
    notes: JSON.stringify({ client_id, client_secret }),
    updated_at: new Date().toISOString(),
  };
  if (existing && existing.length) {
    await _sb('oauth_tokens', 'PATCH', row, `?id=eq.${existing[0].id}`);
  } else {
    await _sb('oauth_tokens', 'POST', { ...row, access_token: 'pending', created_at: new Date().toISOString() });
  }
}

async function getPkceState() {
  const row = await getStoredTokens();
  if (!row) return null;
  let extra = {};
  try { extra = row.notes ? JSON.parse(row.notes) : {}; } catch { /* ignore */ }
  return {
    code_verifier: row.code_verifier,
    state: row.state,
    client_id: extra.client_id,
    client_secret: extra.client_secret,
  };
}

// ─── OAuth flow primitives ───────────────────────────────────────────

function generatePkce() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function registerClient() {
  const r = await fetch(ISSUER + '/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'ThermaShift Backend',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: REQUESTED_SCOPES,
    }),
  });
  if (!r.ok) throw new Error(`DCR failed: ${r.status} ${await r.text()}`);
  return r.json();
}

/**
 * Start the OAuth flow. Returns the URL to redirect Steve's browser to.
 * Caller (the /connect endpoint) should res.redirect(url).
 */
export async function startAuthFlow(authorizedBy) {
  // Cached client? Re-use; otherwise DCR.
  const existing = await getPkceState();
  let client_id = existing?.client_id;
  let client_secret = existing?.client_secret;
  if (!client_id) {
    const reg = await registerClient();
    client_id = reg.client_id;
    client_secret = reg.client_secret;
  }

  const { verifier, challenge } = generatePkce();
  const state = crypto.randomBytes(24).toString('base64url');

  await storePkceState({ code_verifier: verifier, state, client_id, client_secret });

  const url = new URL(ISSUER + '/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', REQUESTED_SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return { url: url.toString(), authorizedBy };
}

/**
 * Handle the OAuth callback. Exchanges code for tokens, stores them.
 */
export async function handleCallback({ code, state }) {
  const stored = await getPkceState();
  if (!stored) throw new Error('No PKCE state — auth flow not started or expired');
  if (stored.state !== state) throw new Error('State mismatch — possible CSRF');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: stored.client_id,
    code_verifier: stored.code_verifier,
  });
  if (stored.client_secret) body.set('client_secret', stored.client_secret);

  const r = await fetch(ISSUER + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
  const tokens = await r.json();

  await storeTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    scope: tokens.scope,
    authorized_by: 'admin',
  });
  return { connected: true, scopes: tokens.scope };
}

async function refreshAccessToken() {
  const row = await getStoredTokens();
  if (!row?.refresh_token) throw new Error('No refresh token — re-authorization required');
  let creds = {};
  try { creds = row.notes ? JSON.parse(row.notes) : {}; } catch { /* */ }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
    client_id: creds.client_id,
  });
  if (creds.client_secret) body.set('client_secret', creds.client_secret);

  const r = await fetch(ISSUER + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!r.ok) throw new Error(`Refresh failed: ${r.status} ${await r.text()}`);
  const tokens = await r.json();
  await storeTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || row.refresh_token, // some servers don't rotate
    expires_in: tokens.expires_in,
    scope: tokens.scope || row.scopes,
    authorized_by: row.authorized_by,
  });
  return tokens.access_token;
}

async function getAccessToken() {
  const row = await getStoredTokens();
  if (!row || row.access_token === 'pending') return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return await refreshAccessToken();
  }
  return row.access_token;
}

export async function isConnected() {
  const t = await getAccessToken().catch(() => null);
  return !!t;
}

// ─── MCP JSON-RPC client ─────────────────────────────────────────────

let _rpcId = 1;
// MCP session state — initialize handshake gives us a session id we have to
// echo on every subsequent request (Streamable HTTP transport).
let _session = { id: null, initialized: false };

function parseEnvelope(text) {
  try { return JSON.parse(text); }
  catch {
    // SSE-style: stitch all `data: ...` lines into a single JSON blob
    const dataLines = text.split('\n').filter(l => l.startsWith('data: '));
    const joined = dataLines.map(l => l.slice(6)).join('');
    return JSON.parse(joined);
  }
}

async function rawRequest(method, params, { isNotification = false } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('not_connected');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${token}`,
  };
  if (_session.id) headers['Mcp-Session-Id'] = _session.id;

  const body = isNotification
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id: _rpcId++, method, params };

  const r = await fetch(MCP_SERVER, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Capture session id assigned during initialize
  const newSessionId = r.headers.get('mcp-session-id');
  if (newSessionId && !_session.id) _session.id = newSessionId;

  if (isNotification) return null; // notifications return 202 with empty body

  if (r.status === 401) throw new Error('mcp_unauthorized');

  const text = await r.text();
  if (!r.ok) throw new Error(`MCP ${method}: ${r.status} ${text.slice(0, 300)}`);
  const envelope = parseEnvelope(text);
  if (envelope.error) throw new Error(`MCP error ${envelope.error.code}: ${envelope.error.message}`);
  return envelope.result;
}

async function ensureInitialized() {
  if (_session.initialized) return;

  // Reset session so initialize gets a fresh one
  _session = { id: null, initialized: false };

  const initResult = await rawRequest('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: { tools: {} },
    clientInfo: { name: 'ThermaShift Backend', version: '1.0.0' },
  });
  if (!_session.id) {
    // Some servers omit the session-id header for stateless mode; tolerate.
    console.warn('[brandjet-mcp] no Mcp-Session-Id returned; proceeding stateless');
  }
  // Send the `initialized` notification (no response expected)
  await rawRequest('notifications/initialized', {}, { isNotification: true }).catch(() => {});
  _session.initialized = true;
  return initResult;
}

async function mcpCall(method, params, opts = { retried: false, initRetried: false }) {
  try {
    await ensureInitialized();
    return await rawRequest(method, params);
  } catch (e) {
    if (e.message === 'mcp_unauthorized' && !opts.retried) {
      await refreshAccessToken();
      _session = { id: null, initialized: false }; // re-handshake on new token
      return mcpCall(method, params, { ...opts, retried: true });
    }
    // "Server not initialized" — reset session and try once more
    if (/not initialized/i.test(e.message) && !opts.initRetried) {
      _session = { id: null, initialized: false };
      return mcpCall(method, params, { ...opts, initRetried: true });
    }
    throw e;
  }
}

async function callTool(name, args = {}) {
  return mcpCall('tools/call', { name, arguments: args });
}

// ─── High-level helpers ──────────────────────────────────────────────
//
// Tool names confirmed against BrandJet's live MCP server (2026-05-15 smoke
// test returned 75 tools). All BrandJet tools are prefixed brandjet_*.
// Campaign ops require the brand to be "switched" first (per-session state),
// which is handled lazily in ensureBrandSelected().

let _currentBrandId = null;

async function ensureBrandSelected() {
  if (_currentBrandId) return _currentBrandId;
  // Pick the only brand (Tier 1 = 1 brand) on first need
  const result = await callTool('brandjet_list_brands', {});
  // MCP tools return content as an array of items; BrandJet wraps payload in result.content[0].text (JSON)
  const brand = extractFirstBrand(result);
  if (!brand?.id) throw new Error('No BrandJet brand found on this account');
  await callTool('brandjet_switch_brand', { brandId: brand.id });
  _currentBrandId = brand.id;
  return _currentBrandId;
}

function extractFirstBrand(toolResult) {
  // BrandJet's MCP wraps payloads in {content: [{type: 'text', text: '<json>'}]}.
  // We try to parse the inner JSON. If the shape differs, return null.
  try {
    const content = toolResult?.content || [];
    const text = content[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return parsed.brands?.[0] || parsed.data?.[0] || parsed[0] || parsed;
  } catch {
    return null;
  }
}

/** List all brands accessible to the user. */
export async function listBrands() {
  return callTool('brandjet_list_brands', {});
}

/** List campaigns for the active brand. */
export async function listCampaigns() {
  await ensureBrandSelected();
  return callTool('brandjet_get_campaigns', {});
}

/** Get leads already in lead lists. */
export async function listLeads(limit = 50) {
  await ensureBrandSelected();
  return callTool('brandjet_get_leads', { limit });
}

/** List all lead lists (collections of leads grouped for campaign assignment). */
export async function listLeadLists() {
  await ensureBrandSelected();
  return callTool('brandjet_get_lead_lists', {});
}

/**
 * Create a new lead OR add to an existing lead list.
 * action = 'create_list' to make a new list, 'add_to_list' to add to existing.
 * `lead` is the contact/company data.
 */
export async function pushLead({ action = 'add_to_list', leadListId, listName, lead }) {
  await ensureBrandSelected();
  const args = { action, lead };
  if (leadListId) args.leadListId = leadListId;
  if (listName) args.listName = listName;
  return callTool('brandjet_create_lead', args);
}

/** List available MCP tools. Returns the raw tools/list result. */
export async function listTools() {
  return mcpCall('tools/list', {});
}
