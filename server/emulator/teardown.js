/**
 * Destroy all TEST_* tenants and their dependents.
 *
 * ON DELETE CASCADE on the schema handles sites/sensors/readings/incidents/
 * notifications/actions/audit. We just need to delete the client rows.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function sb(table, method, body, q = '') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${q}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function main() {
  console.log('=== ThermaShift emulator teardown ===');
  const clients = await sb(
    'monitoring_clients', 'GET', null,
    '?company=like.TEST_*&select=id,company,api_key',
  );
  if (!clients?.length) {
    console.log('No TEST_* clients found. Nothing to clean up.');
    return;
  }
  console.log(`Found ${clients.length} test client(s) to delete:`);
  for (const c of clients) console.log(`  - id=${c.id} "${c.company}"`);
  for (const c of clients) {
    await sb('monitoring_clients', 'DELETE', null, `?id=eq.${c.id}`);
    console.log(`  ✓ deleted client ${c.id}`);
  }
  console.log('=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
