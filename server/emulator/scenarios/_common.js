/**
 * Shared helpers for scenarios. Keeps each scenario file short.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';
const BASE_URL = process.env.THERMASHIFT_BASE_URL || 'https://thermashift.net';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.THERMASHIFT_ADMIN_PASSWORD;

export async function sb(table, method, body, q = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${q}`, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export async function findClient(prefix) {
  const rows = await sb('monitoring_clients', 'GET', null, `?company=like.${encodeURIComponent(prefix + '%')}&limit=1`);
  return rows?.[0];
}

export async function findSensor(clientId, externalId) {
  const rows = await sb('monitoring_sensors', 'GET', null, `?client_id=eq.${clientId}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`);
  return rows?.[0];
}

/**
 * Force-run the alert evaluator now. Requires admin password in env.
 * If no password is set, falls back to sleep(60s) to wait for the cron.
 */
export async function evaluateNow(log = console.log) {
  if (!ADMIN_PASSWORD) {
    log('  (no ADMIN_PASSWORD set — waiting 65s for cron)');
    await new Promise(r => setTimeout(r, 65_000));
    return null;
  }
  const r = await fetch(`${BASE_URL}/api/monitoring/evaluate-now`, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + Buffer.from('admin:' + ADMIN_PASSWORD).toString('base64') },
  });
  if (!r.ok) {
    log(`  evaluate-now failed: ${r.status} — falling back to 65s sleep`);
    await new Promise(rr => setTimeout(rr, 65_000));
    return null;
  }
  return r.json();
}

/**
 * Sleep helper.
 */
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Standard result builder.
 */
export function result({ pass, name, reason, details, expectedFailUntilAiWired }) {
  return { pass, name, reason: reason || null, details: details || null, expectedFailUntilAiWired: !!expectedFailUntilAiWired };
}
