/**
 * AI Advisor Conversational Interface — Phase 7F
 *
 * Multi-turn chat between a Pro client and the AI Cooling Advisor.
 * Persists message history in advisor_chats so conversations survive
 * across page reloads. Each chat is optionally tied to an incident
 * for context.
 *
 * Endpoints (wired in chat-proxy.js):
 *   GET    /api/monitoring/client/advisor/chats           — list
 *   GET    /api/monitoring/client/advisor/chats/:id       — single thread
 *   POST   /api/monitoring/client/advisor/chats           — start new
 *   POST   /api/monitoring/client/advisor/chats/:id/msg   — send message
 */

const MODEL = 'claude-sonnet-4-20250514';
const apiKey = () => process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

const SYSTEM_PROMPT = `You are ThermaShift's AI Cooling Advisor in a multi-turn conversation with a Pro-tier client.

CLIENT CONTEXT:
The client is a paying Pro-tier subscriber ($599/mo). They have access to AI auto-action capability — when they ask "can you do X", you can answer yes if X is a cooling action they could approve in their dashboard.

YOUR ROLE:
- Think like a senior data center cooling engineer, not a chatbot.
- Reference their actual data when relevant. If they ask about a sensor or incident, the system will provide that context in the conversation.
- Be specific. Give numbers. Quantify dollar impact when possible.
- Match their tone — terse if they're terse, detailed if they want depth.
- Don't end every message with "is there anything else?" — let the conversation breathe.

WHAT YOU CAN DO IN THIS CHAT (mention these naturally when relevant):
- Analyze any sensor's recent readings
- Explain why an incident triggered and what to do about it
- Recommend a specific cooling action (set fan speed, lower CW setpoint, increase pump VFD, etc.) — the client can approve it in the Cooling AI tab
- Forecast based on outside-air trends, time-of-day patterns
- Compare their numbers to industry baselines

THERMASHIFT SERVICES (only mention if directly relevant):
- LCaaS (Liquid Cooling-as-a-Service) — for sustained hot aisles >80°F or AI/GPU density
- Waste Heat Recovery — for facilities with consistent high heat output, $100K-$1M/yr revenue potential
- Platform expansion — more sensors, predictive ML
- ESG Consulting — Section 179D tax deductions, Duke Energy rebates

RULES:
- If they ask a question outside cooling/data centers, redirect: "I'm focused on cooling. Want to dig into <relevant cooling topic>?"
- If they ask "are you AI?": yes, you're Claude (Anthropic) integrated as ThermaShift's AI Cooling Advisor. Don't pretend otherwise.
- If they want a human (sales, support), say "Steve handles that — I can flag it for him" and the system will escalate.
- Never make up specific dollar values you don't have data to support.`;

function buildContextPreamble(client, incident, recentReadings) {
  let ctx = `CLIENT: ${client.company} (tier: ${client.tier})\n`;
  if (incident) {
    ctx += `\nCURRENT INCIDENT:\n  ${incident.summary}\n  Status: ${incident.status}\n  Severity: ${incident.severity}\n  Trigger value: ${incident.trigger_value} (threshold: ${incident.trigger_threshold})\n  Peak: ${incident.peak_value || incident.trigger_value}\n  Opened: ${incident.opened_at}\n`;
  }
  if (recentReadings?.length) {
    const vals = recentReadings.map(r => Number(r.value));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    ctx += `\nRECENT READINGS (${recentReadings.length} samples):\n  latest: ${vals[vals.length - 1]}\n  avg: ${avg.toFixed(1)}\n  min: ${Math.min(...vals)}, max: ${Math.max(...vals)}\n`;
  }
  return ctx;
}

export async function listChats(sb, clientId) {
  return await sb('advisor_chats', 'GET', null,
    `?client_id=eq.${clientId}&order=updated_at.desc&limit=50`);
}

export async function getChat(sb, clientId, chatId) {
  const rows = await sb('advisor_chats', 'GET', null,
    `?id=eq.${chatId}&client_id=eq.${clientId}&limit=1`);
  return rows?.[0] || null;
}

export async function startChat(sb, clientId, { incident_id, title }) {
  const [chat] = await sb('advisor_chats', 'POST', {
    client_id: clientId,
    incident_id: incident_id || null,
    title: title || (incident_id ? `Incident #${incident_id}` : 'New conversation'),
    messages: [],
    message_count: 0,
  });
  return chat;
}

export async function sendMessage(sb, clientId, chatId, userMessage) {
  const chat = await getChat(sb, clientId, chatId);
  if (!chat) throw new Error('chat_not_found');

  // Demo mode: don't call Claude, return a polite canned redirect to a sales conversation
  const clientRows = await sb('monitoring_clients', 'GET', null, `?id=eq.${clientId}&limit=1`);
  const clientRow = clientRows?.[0];
  if (clientRow?.is_demo) {
    const cannedReply = clientRow.demo_chat_disabled_message
      || `This is a public demo — interactive AI chat is reserved for paying Pro-tier clients. The conversation above shows what a real client interaction looks like.\n\nWant to see this on YOUR data center's data? Reply to this message in any sales conversation, or contact Steve at steve@thermashift.net for a 30-min consultation. We can have a real Pro-tier instance running for you within 24 hours.`;

    const newHistory = [
      ...(chat.messages || []),
      { role: 'user', content: userMessage, ts: new Date().toISOString() },
      { role: 'assistant', content: cannedReply, ts: new Date().toISOString() },
    ];
    await sb('advisor_chats', 'PATCH', {
      messages: newHistory,
      message_count: newHistory.length,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, `?id=eq.${chatId}`);
    return { reply: cannedReply, message_count: newHistory.length, demo_mode: true };
  }

  // Pull fresh context if there's an incident
  let incident = null, recentReadings = [];
  if (chat.incident_id) {
    const incidents = await sb('monitoring_incidents', 'GET', null, `?id=eq.${chat.incident_id}&limit=1`);
    incident = incidents?.[0];
    if (incident?.sensor_id) {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      recentReadings = await sb('monitoring_readings', 'GET', null,
        `?sensor_id=eq.${incident.sensor_id}&recorded_at=gte.${since}&order=recorded_at.asc&limit=200`);
    }
  }

  const clients = await sb('monitoring_clients', 'GET', null, `?id=eq.${clientId}&limit=1`);
  const client = clients?.[0] || { company: 'Client', tier: 'pro' };

  const contextNote = buildContextPreamble(client, incident, recentReadings);

  // Build messages for Claude
  const history = (chat.messages || []).map(m => ({ role: m.role, content: m.content }));
  const messages = [
    ...(history.length === 0 ? [{ role: 'user', content: contextNote + '\n\n' + userMessage }] : history.concat([{ role: 'user', content: userMessage }])),
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const assistantText = data.content?.[0]?.text || '(empty response)';

  // Append both messages, persist
  const newHistory = [
    ...(chat.messages || []),
    { role: 'user', content: userMessage, ts: new Date().toISOString() },
    { role: 'assistant', content: assistantText, ts: new Date().toISOString() },
  ];
  await sb('advisor_chats', 'PATCH', {
    messages: newHistory,
    message_count: newHistory.length,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, `?id=eq.${chatId}`);

  return { reply: assistantText, message_count: newHistory.length, usage: data.usage };
}
