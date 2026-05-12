/**
 * AI Upsell-to-Sales Escalation — Phase 7G
 *
 * Periodic scan: detect recurring incident patterns that suggest a paid
 * project opportunity (LCaaS, waste heat, ESG, platform expansion).
 * Generate an AI pitch summarizing the pattern and recommended service.
 * Save as sales_escalations row, status='pending_client'.
 *
 * Client sees the suggestion in their Cooling AI tab. If they click "Yes,
 * send me a quote", we route into the existing AI Closer pipeline as a
 * draft proposal that Steve approves before sending.
 *
 * Cron: runs every 6 hours via setInterval in chat-proxy.js
 */

const MODEL = 'claude-sonnet-4-20250514';
const apiKey = () => process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

const PITCH_PROMPT = `You are ThermaShift's AI Cooling Advisor identifying upsell opportunities.

A client has been experiencing a recurring incident pattern. Your job:
1. Decide which ThermaShift service best addresses it (or none)
2. Estimate value range (low-high in USD)
3. Write a 2-3 sentence pitch the client will see in their dashboard

THERMASHIFT SERVICES:
- LCaaS (Liquid Cooling-as-a-Service): retrofitting cooling infrastructure for hot aisles consistently >80°F or planning AI/GPU density. Project: $50K-$500K.
- Waste Heat Recovery: monetize wasted heat (greenhouses, district heating). Generates $100K-$1M/yr per site.
- Platform Expansion: more sensors / predictive ML. $99-$599/mo recurring.
- ESG Consulting: Section 179D tax deductions, Duke Energy rebates. $5K-$50K projects.

OUTPUT JSON only, no markdown fences:
{
  "service": "LCaaS|Waste Heat Recovery|Platform Expansion|ESG Consulting|null",
  "estimated_value_low": <number>,
  "estimated_value_high": <number>,
  "pitch": "2-3 sentences the client sees, conversational, references their pattern, ends with question"
}

If nothing fits, return service: null.`;

async function generatePitch(pattern, incidents) {
  const summary = `RECURRING INCIDENT PATTERN: ${pattern.description}\n\n`
    + `Incidents in last 30 days: ${incidents.length}\n`
    + `Affected sensor IDs: ${pattern.sensor_ids.join(', ')}\n`
    + `Avg peak value: ${pattern.avg_peak.toFixed(1)} (threshold: ${pattern.threshold})\n`
    + `Avg duration when open: ${Math.floor(pattern.avg_duration / 60)} minutes\n`
    + `Total cumulative downtime: ${Math.floor(pattern.total_duration / 60)} minutes`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 600,
      system: PITCH_PROMPT,
      messages: [{ role: 'user', content: summary }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    (await import('./anthropic-alert.js')).notifyIfCreditError('sales_escalation', res.status, errText).catch(() => {});
    throw new Error(`Anthropic: ${res.status} ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('non-JSON response');
  return JSON.parse(m[0]);
}

// ─── Pattern detection ──────────────────────────────────────

function detectPatterns(incidents) {
  // Group by alert_rule_id
  const byRule = {};
  for (const i of incidents) {
    const k = i.alert_rule_id;
    if (!k) continue;
    byRule[k] = byRule[k] || [];
    byRule[k].push(i);
  }
  const patterns = [];
  for (const [ruleId, list] of Object.entries(byRule)) {
    if (list.length < 5) continue; // require at least 5 incidents in window
    const peaks = list.map(i => Number(i.peak_value || i.trigger_value)).filter(v => !isNaN(v));
    const durations = list.map(i => Number(i.duration_seconds || 0)).filter(v => v > 0);
    if (!peaks.length) continue;
    patterns.push({
      alert_rule_id: ruleId,
      incident_ids: list.map(i => i.id),
      sensor_ids: [...new Set(list.map(i => i.sensor_id).filter(Boolean))],
      severity: list[0].severity,
      avg_peak: peaks.reduce((a, b) => a + b, 0) / peaks.length,
      threshold: list[0].trigger_threshold,
      avg_duration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      total_duration: durations.reduce((a, b) => a + b, 0),
      description: `${list.length} ${list[0].severity} incidents on rule "${list[0].summary?.split(':')[0] || ruleId}" in last 30 days`,
    });
  }
  return patterns;
}

// ─── Main entrypoint (cron) ─────────────────────────────────

export async function scanForEscalations(sb) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const incidents = await sb('monitoring_incidents', 'GET', null,
    `?opened_at=gte.${since}&order=opened_at.desc&limit=2000`);
  if (!incidents?.length) return { scanned: 0, escalations_created: 0 };

  // Group by client
  const byClient = {};
  for (const i of incidents) {
    if (!i.client_id) continue;
    byClient[i.client_id] = byClient[i.client_id] || [];
    byClient[i.client_id].push(i);
  }

  let created = 0;
  for (const [clientId, list] of Object.entries(byClient)) {
    const patterns = detectPatterns(list);
    for (const pat of patterns) {
      // Skip if we already have a pending or recent escalation for this rule
      const existing = await sb('sales_escalations', 'GET', null,
        `?client_id=eq.${clientId}&trigger_pattern=like.*rule_${pat.alert_rule_id}*&order=created_at.desc&limit=1`);
      if (existing?.[0] && (Date.now() - new Date(existing[0].created_at).getTime()) < 14 * 24 * 60 * 60 * 1000) {
        continue; // less than 14 days since last escalation for this rule
      }

      try {
        const pitch = await generatePitch(pat, list.filter(i => i.alert_rule_id == pat.alert_rule_id));
        if (!pitch.service) continue; // AI didn't think there was a fit

        await sb('sales_escalations', 'POST', {
          client_id: Number(clientId),
          trigger_pattern: `rule_${pat.alert_rule_id}: ${pat.description}`,
          related_incident_ids: pat.incident_ids,
          recommended_service: pitch.service,
          estimated_value_low: pitch.estimated_value_low,
          estimated_value_high: pitch.estimated_value_high,
          ai_pitch_summary: pitch.pitch,
          status: 'pending_client',
        });
        created++;
      } catch (e) {
        console.error(`escalation pitch failed for client=${clientId} rule=${pat.alert_rule_id}:`, e.message);
      }
    }
  }
  return { scanned: incidents.length, escalations_created: created };
}

// ─── Client decision handler ────────────────────────────────

export async function clientDecideEscalation(sb, escalationId, clientId, decision, notes) {
  const rows = await sb('sales_escalations', 'GET', null,
    `?id=eq.${escalationId}&client_id=eq.${clientId}&limit=1`);
  const esc = rows?.[0];
  if (!esc) throw new Error('escalation_not_found');

  await sb('sales_escalations', 'PATCH', {
    status: decision === 'yes' ? 'sent_to_steve' : 'declined',
    client_decision: decision,
    client_decided_at: new Date().toISOString(),
    notes: notes || esc.notes,
    updated_at: new Date().toISOString(),
  }, `?id=eq.${escalationId}`);

  if (decision === 'yes') {
    // Notify Steve via email (uses existing Resend infrastructure)
    const clients = await sb('monitoring_clients', 'GET', null, `?id=eq.${clientId}&limit=1`);
    const client = clients?.[0];
    const apiKeyR = process.env.RESEND_API_KEY;
    if (apiKeyR && client) {
      const subject = `[Sales Lead] ${client.company} requested ${esc.recommended_service} quote`;
      const html = `
        <div style="font-family:sans-serif;max-width:640px;color:#334155;line-height:1.6;">
          <p><strong>${client.company}</strong> (Pro tier client) has accepted an AI-suggested upsell.</p>
          <p><strong>Service:</strong> ${esc.recommended_service}<br>
          <strong>Value range:</strong> $${esc.estimated_value_low?.toLocaleString()} – $${esc.estimated_value_high?.toLocaleString()}</p>
          <p><strong>AI pitch they accepted:</strong></p>
          <blockquote style="border-left:3px solid #863bff;padding:10px 14px;background:#f8fafc;font-style:italic;">${esc.ai_pitch_summary}</blockquote>
          <p><strong>Pattern detected:</strong> ${esc.trigger_pattern}</p>
          <p><strong>Contact:</strong> ${client.primary_contact_name || ''} &lt;${client.primary_contact_email}&gt;${client.primary_contact_phone ? ' · ' + client.primary_contact_phone : ''}</p>
          <p>Take it from here. Recommend reaching out within 24 hours while they're warm.</p>
        </div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKeyR}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ThermaShift Sales <alerts@thermashift.net>',
          to: ['admin@thermashift.net'],
          reply_to: client.primary_contact_email,
          subject, html,
        }),
      }).catch(err => console.error('escalation notify failed:', err.message));

      await sb('sales_escalations', 'PATCH',
        { steve_notified_at: new Date().toISOString() }, `?id=eq.${escalationId}`);
    }
  }

  return { ok: true, status: decision === 'yes' ? 'sent_to_steve' : 'declined' };
}
