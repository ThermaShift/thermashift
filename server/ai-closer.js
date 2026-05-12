/**
 * ThermaShift AI Sales Closer — Phase 6
 *
 * When a prospect replies to a cold email, this generates a draft response
 * using Claude Sonnet with tool use. Tools:
 *   - propose_calendly: include the booking link in the reply
 *   - schedule_outbound_call: book a future Vapi call at a specific time
 *   - mark_qualified: prospect is a real lead, escalate to Steve for next step
 *   - mark_not_interested: stop emailing, polite close
 *   - escalate_to_human: defer to Steve (in-person ask, contract, scoping)
 *
 * Drafts are stored in prospect_messages with status='pending_review'.
 * Steve approves → email sends + tools execute.
 */

const MODEL = 'claude-sonnet-4-20250514';
const apiKey = () => process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

const CALENDLY_LINK = 'https://calendly.com/thermashift/consultation';
const VAPI_NUMBER = '(786) 605-6239';

const SYSTEM_PROMPT = `You are Steve Betancur, founder of ThermaShift, replying to a cold-email prospect.

ABOUT THERMASHIFT:
ThermaShift helps data center operators cut cooling costs 15-30% and monetize wasted heat. Four services:
1. Liquid Cooling-as-a-Service (LCaaS) — design + install + ops, $50K-$500K projects
2. Waste Heat Recovery — convert exhaust heat to revenue, $100K-$1M/yr per site
3. Thermal Intelligence Platform — real-time monitoring SaaS, $99-$599/mo
4. ESG / Sustainability Consulting — 179D tax deduction (expires June 30 2026), Duke Energy efficiency rebates, $5K-$50K projects

YOUR ROLE:
- Reply naturally and warmly. You are Steve. Match the prospect's tone — brief if they're brief, detailed if they're curious.
- Move the conversation toward (a) a 15-minute discovery call, OR (b) a complimentary cooling efficiency assessment.
- Use the prospect's specific context (their company, role, the talking point that opened the original email).
- DO NOT pretend the prospect said something they didn't. Read the actual reply text.
- DO NOT use AI giveaways: avoid "I'd be happy to assist", "feel free to reach out", em-dashes everywhere, bullet lists for short answers, the word "delve".

CRITICAL RULES:
1. If the prospect explicitly asks "are you a real person / are you an AI / is this automated" — answer truthfully: "There's automation in our outreach, but I'm reading replies personally and Steve handles every meeting." Then continue the conversation.
2. If the prospect wants to MEET IN PERSON, agrees to a paid project, asks for contracts/SOWs/scoping, or asks about a competitor by name → call escalate_to_human and STOP. Steve handles those personally.
3. If the prospect asks to be removed / unsubscribe / not interested → call mark_not_interested with their reason (if given) and write a brief polite close. No follow-up.
4. If the prospect wants to talk by phone NOW → suggest the Vapi number ${VAPI_NUMBER} or call schedule_outbound_call to book a specific time.
5. If they want to meet/call but no specific time → propose 2-3 specific 30-min slots in the next 5 business days OR offer Calendly via propose_calendly.
6. If the prospect is a real lead asking about pricing/scoping/details → answer 1-2 questions warmly, then escalate to a 15-min call.

REPLY FORMAT:
- Plain text email body, no markdown. 3-5 short paragraphs max. No signature (the system adds it).
- Reference their reply specifically. Read it carefully.
- Always end with a clear next step (a question, a calendar offer, etc.).

OUTPUT — CRITICAL:
You MUST always write reply text in addition to any tool calls. The reply is what the prospect actually sees in their inbox; tool calls are internal bookkeeping. Even when escalating, opting out, or scheduling a call, write 2-4 sentences of human acknowledgment.

Examples of what reply text to write alongside each tool:
- mark_qualified → "Glad this is timely. Quick context on how we typically engage… [2-3 sentences of value framing] Steve will follow up tomorrow with a few times to talk."
- schedule_outbound_call → "Locked in for Friday 2pm ET — I'll call +1 404 555 1234. Talk then." (confirm the specific time + number)
- mark_not_interested → "All good — removed you from my list. Best of luck with the in-house team. If anything changes, my line is open."
- escalate_to_human → "Sounds great — Steve's actually based in Harrisburg and is in Charlotte regularly. He'll reach out directly to find a time that works."
- propose_calendly → "Easiest is to grab a slot here: https://calendly.com/thermashift/consultation — or hit me back with a few times that work for you."`;

const TOOLS = [
  {
    name: 'propose_calendly',
    description: 'Include the Calendly booking link in this reply when the prospect wants to schedule a call but has no preferred time.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'schedule_outbound_call',
    description: 'Book a specific outbound call from Steve to this prospect at a given UTC time. Use only when the prospect proposes or accepts a specific time and gave a phone number (or we have one on file). The system will dial them automatically at that time using our voice agent.',
    input_schema: {
      type: 'object',
      properties: {
        scheduled_at_utc: { type: 'string', description: 'ISO 8601 UTC timestamp, e.g. 2026-05-02T18:00:00Z' },
        phone: { type: 'string', description: 'Prospect phone in E.164 (e.g. +14045551212). If unknown, omit and ask in the reply.' },
        context_summary: { type: 'string', description: 'One paragraph the voice agent should know walking into the call: their role, what they care about, what we already discussed.' },
      },
      required: ['scheduled_at_utc', 'context_summary'],
    },
  },
  {
    name: 'mark_qualified',
    description: 'Mark this prospect as a qualified lead — they have shown buying intent (asked pricing, expressed timeline, named a budget, asked for proposal). Steve gets notified to take it from here.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Why they look qualified (1-2 sentences quoting their reply).' } },
      required: ['reason'],
    },
  },
  {
    name: 'mark_not_interested',
    description: 'Mark prospect as not interested — they explicitly declined, opted out, or said wrong fit. Future emails to this prospect are cancelled.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'What they said.' } },
      required: ['reason'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Hand off to Steve — used for in-person meeting requests, contract/SOW asks, custom scoping, complex technical questions, or anything sensitive.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Why escalating.' } },
      required: ['reason'],
    },
  },
];

// ─── Build context for Claude ───────────────────────────────

function buildThreadContext(prospect, thread) {
  const lines = [
    `PROSPECT:`,
    `  Name: ${prospect.first_name || ''} ${prospect.last_name || ''}`,
    `  Email: ${prospect.email}`,
    `  Title: ${prospect.title || 'unknown'}`,
    `  Company: ${prospect.company || 'unknown'}`,
    `  LinkedIn: ${prospect.linkedin_url || 'n/a'}`,
    `  Phone on file: ${prospect.phone || 'NONE — must ask if scheduling a call'}`,
    `  Region: ${prospect.region || 'unknown'}`,
    `  Original-email talking point: ${prospect.talking_point || '(none)'}`,
    `  Current pipeline status: ${prospect.status || 'unknown'}`,
    ``,
    `EMAIL THREAD (oldest first):`,
  ];
  for (const m of thread) {
    const who = m.direction === 'inbound' ? `THEM (${m.received_at || m.created_at})`
              : (m.ai_generated ? `ME (AI draft, ${m.created_at})` : `ME (${m.created_at})`);
    lines.push(`\n--- ${who} ---`);
    if (m.subject) lines.push(`Subject: ${m.subject}`);
    lines.push(m.body || m.body_html || '(empty)');
  }
  lines.push('\n\nBased on the latest inbound message above, draft a reply.');
  return lines.join('\n');
}

// ─── Generate reply with Claude ─────────────────────────────

export async function generateReply(prospect, thread) {
  const userPrompt = buildThreadContext(prospect, thread);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    (await import('./anthropic-alert.js')).notifyIfCreditError('ai_closer', res.status, errText).catch(() => {});
    throw new Error(`Anthropic API: ${res.status} ${errText}`);
  }
  const data = await res.json();

  const tool_calls = [];
  let reply_text = '';
  for (const block of data.content || []) {
    if (block.type === 'tool_use') {
      tool_calls.push({ name: block.name, input: block.input });
    } else if (block.type === 'text') {
      reply_text += block.text;
    }
  }

  // Safety net: Claude sometimes invokes a tool and returns no reply text, leaving the
  // prospect without a response. Inject a sensible fallback so a human-readable message
  // always sends.
  reply_text = reply_text.trim();
  if (!reply_text && tool_calls.length > 0) {
    const firstName = (prospect.first_name || '').trim() || 'there';
    const tool = tool_calls[0].name;
    const fallbacks = {
      mark_not_interested: `Hi ${firstName},\n\nAll good — I've removed you from my list. Best of luck with the in-house team. If anything ever changes, my line is always open.\n\nSteve`,
      escalate_to_human: `Hi ${firstName},\n\nSounds great. I'm based in Harrisburg and in Charlotte regularly — I'll reach out directly to find a time that works for both of us.\n\nSteve`,
      mark_qualified: `Hi ${firstName},\n\nThanks for the reply. There's a lot we could dig into here — I'll follow up tomorrow with a few specific times that work for a 15-minute call so we can scope the right next step.\n\nSteve`,
      schedule_outbound_call: `Hi ${firstName},\n\nLocked in. I'll call you at the time and number you provided. Looking forward to it.\n\nSteve`,
      propose_calendly: `Hi ${firstName},\n\nEasiest way is to grab a slot here: https://calendly.com/thermashift/consultation — or hit me back with a few times that work and I'll book it.\n\nSteve`,
    };
    reply_text = fallbacks[tool] || `Hi ${firstName},\n\nGot it — I'll be in touch shortly.\n\nSteve`;
  }

  return {
    reply_text,
    tool_calls,
    raw_usage: data.usage || null,
    stop_reason: data.stop_reason,
  };
}

// ─── Email signature appended on send ───────────────────────

export const EMAIL_SIGNATURE_HTML = `
<br><br>
<div style="font-family:-apple-system,sans-serif;font-size:13px;color:#64748b;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:18px;">
  Steve Betancur<br>
  ThermaShift — Cooling Intelligence. Environmental Impact.<br>
  <a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a> · (786) 605-6239
</div>`;

export const EMAIL_SIGNATURE_TEXT = `
\n--\nSteve Betancur\nThermaShift — Cooling Intelligence. Environmental Impact.\nthermashift.net | (786) 605-6239`;
