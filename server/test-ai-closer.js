// End-to-end test of the AI sales closer.
// Simulates an inbound prospect reply, triggers Claude draft generation,
// inspects the draft, then cleans up.
// Run on VPS: node server/test-ai-closer.js
import 'dotenv/config';
import { generateReply } from './ai-closer.js';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

async function sb(t, m, b, q = '') {
  const r = await fetch(`${SUPABASE_URL}/${t}${q}`, {
    method: m,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: b ? JSON.stringify(b) : undefined,
  });
  if (!r.ok) throw new Error(`${m} ${t}: ${r.status} ${await r.text()}`);
  return r.json();
}

const SCENARIOS = [
  {
    name: 'Curious — wants more info',
    inbound: "Hi Steve, thanks for reaching out. We're actually exploring liquid cooling for some of our higher density racks. Can you share more about how your service works and rough pricing?",
    expectTool: null,
  },
  {
    name: 'Wants a call this week',
    inbound: "Hi Steve, this is interesting. Are you free for a 15-min call this Friday around 2pm ET? My number is +14045551234.",
    expectTool: 'schedule_outbound_call',
  },
  {
    name: 'Asks if AI',
    inbound: "Hi, quick question — am I talking to a real person or is this AI?",
    expectTool: null,
  },
  {
    name: 'Not interested',
    inbound: "Please remove me from this list. We have an in-house team handling cooling.",
    expectTool: 'mark_not_interested',
  },
  {
    name: 'Wants in-person meeting (escalation)',
    inbound: "Sure, let's grab coffee in person next time you're in Charlotte. We're at the University Research Park.",
    expectTool: 'escalate_to_human',
  },
];

async function main() {
  console.log('\n▶ AI Sales Closer end-to-end test\n');

  // Use one real existing prospect for context
  const all = await sb('outreach_prospects', 'GET', null, '?email=eq.cwrathall@google.com&limit=1');
  let prospect = all?.[0];
  if (!prospect) {
    console.log('  No prospect cwrathall@google.com — using first available with linkedin_url');
    const fallback = await sb('outreach_prospects', 'GET', null, '?linkedin_url=neq.&limit=1');
    prospect = fallback?.[0];
  }
  if (!prospect) {
    throw new Error('No prospects in DB. Load some via load-prospects.js first.');
  }
  console.log(`Using prospect: ${prospect.first_name} ${prospect.last_name} (${prospect.company}, ${prospect.email})\n`);

  for (const scenario of SCENARIOS) {
    console.log(`\n━━━ Scenario: "${scenario.name}" ━━━`);
    console.log(`THEM: ${scenario.inbound}`);

    const fakeThread = [
      {
        direction: 'outbound',
        subject: `${prospect.company} — cooling efficiency question`,
        body: `Hi ${prospect.first_name}, I run ThermaShift — we help data centers cut cooling costs 15-30%. Curious if your facility has any thermal pain points worth a 10-min look. ${prospect.talking_point || ''}`,
        ai_generated: false,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        direction: 'inbound',
        body: scenario.inbound,
        received_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    try {
      const draft = await generateReply(prospect, fakeThread);
      console.log(`\nME (AI draft):\n${draft.reply_text}`);
      if (draft.tool_calls.length > 0) {
        console.log(`\n[Tool calls: ${draft.tool_calls.map(t => t.name).join(', ')}]`);
        for (const t of draft.tool_calls) console.log(`  ${t.name}:`, JSON.stringify(t.input));
      }
      if (scenario.expectTool && !draft.tool_calls.find(t => t.name === scenario.expectTool)) {
        console.log(`  ⚠️  Expected tool "${scenario.expectTool}" not invoked`);
      } else if (scenario.expectTool) {
        console.log(`  ✓ Expected tool "${scenario.expectTool}" invoked`);
      }
    } catch (e) {
      console.log(`  ✗ ERROR: ${e.message}`);
    }
  }

  console.log('\n\n✅ All scenarios processed.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
