#!/usr/bin/env node
/**
 * Pull recent routine_outputs from Supabase and print them.
 *
 * Usage:
 *   node server/read-routine-outputs.js                  # last 5 reports
 *   node server/read-routine-outputs.js --limit 20       # last 20
 *   node server/read-routine-outputs.js --routine trig_XYZ  # one specific routine
 *   node server/read-routine-outputs.js --raw            # print raw JSON instead
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://auqklthrpvsqyelfjood.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  return process.argv[i + 1];
}

async function main() {
  const limit = Number(arg('--limit', '5'));
  const routine = arg('--routine', null);
  const raw = process.argv.includes('--raw');

  let q = `?select=*&order=fired_at.desc&limit=${limit}`;
  if (routine) q += `&routine_id=eq.${encodeURIComponent(routine)}`;

  const r = await fetch(`${SUPABASE_URL}/rest/v1/routine_outputs${q}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) {
    console.error(`Failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  const rows = await r.json();
  if (!rows.length) { console.log('(no routine outputs yet)'); return; }

  if (raw) { console.log(JSON.stringify(rows, null, 2)); return; }

  for (const row of rows) {
    console.log('═'.repeat(72));
    console.log(`Fired:   ${row.fired_at}`);
    console.log(`Routine: ${row.routine_name}  (${row.routine_id})`);
    console.log(`Status:  ${row.status}`);
    if (row.metadata) console.log(`Metadata: ${JSON.stringify(row.metadata)}`);
    console.log('─'.repeat(72));
    console.log(row.report || '(no report content)');
    console.log();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
