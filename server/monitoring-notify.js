/**
 * ThermaShift Monitoring SaaS — Phase 3
 * Multi-channel notification dispatcher.
 *
 * Called from monitoring.js when an incident is opened (and on recovery).
 * Channels: email (Resend), SMS (Twilio), voice (Vapi outbound), webhook.
 * Logs every attempt to monitoring_alert_notifications.
 *
 * Quiet hours: critical severity always notifies. Warning/info respects
 * the rule's quiet_hours_start/end window in the client's timezone.
 */

import { sendSMS } from './sms.js';

// Read env at call time, not module load — chat-proxy.js calls dotenv.config()
// AFTER all imports resolve, so capturing at top-level would see undefined.
const RESEND_FROM = 'ThermaShift Alerts <alerts@thermashift.net>';
const env = () => ({
  resendKey: process.env.RESEND_API_KEY,
  vapiKey: process.env.VAPI_PRIVATE_KEY,
  vapiPhoneId: process.env.VAPI_PHONE_NUMBER_ID || process.env.VAPI_PHONE_NUMBER,
});

const SEVERITY_PREFIX = {
  critical: '🚨 CRITICAL',
  warning: '⚠️ WARNING',
  info: 'ℹ️ INFO',
};

// ─── Quiet-hours check ──────────────────────────────────────

/**
 * Returns true if the current time in the client's timezone is inside
 * the rule's quiet-hours window. Critical severity bypasses this entirely.
 */
function inQuietHours(rule, clientTimezone, severity) {
  if (severity === 'critical') return false;
  if (!rule.quiet_hours_start || !rule.quiet_hours_end) return false;
  const tz = clientTimezone || 'America/New_York';

  // current local time HH:MM in client's tz
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = fmt.format(now).split(':').map(Number);
  const nowMin = h * 60 + m;

  const toMin = (s) => {
    const [hh, mm] = s.split(':').map(Number);
    return hh * 60 + (mm || 0);
  };
  const startMin = toMin(rule.quiet_hours_start);
  const endMin = toMin(rule.quiet_hours_end);

  // Window may wrap midnight (e.g. 22:00 → 07:00)
  if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

// ─── Message builders ───────────────────────────────────────

function buildEmail({ severity, rule, sensor, site, client, incident, eventType }) {
  const prefix = SEVERITY_PREFIX[severity] || severity.toUpperCase();
  const verb = eventType === 'recovered' ? 'Resolved' : 'Detected';
  const subject = eventType === 'recovered'
    ? `[Resolved] ${rule.name} at ${site?.name || 'monitored site'}`
    : `[${prefix}] ${rule.name} at ${site?.name || 'monitored site'}`;

  const operator = { above: '>', below: '<', delta: 'Δ', missing: 'no reading' }[rule.rule_type] || '';
  const triggerLine = eventType === 'recovered'
    ? `<p style="font-size:16px;color:#10b981;"><strong>✓ Sensor reading returned to normal.</strong></p>`
    : `<p style="font-size:16px;color:#ef4444;"><strong>${prefix}</strong> — ${sensor?.name || 'sensor'} read <strong>${incident.trigger_value} ${sensor?.unit || ''}</strong> (rule: ${operator} ${rule.threshold_value} ${sensor?.unit || ''})</p>`;

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#334155;font-size:15px;line-height:1.7;">
      <div style="background:#0a1628;color:white;padding:20px;border-radius:8px 8px 0 0;">
        <div style="font-size:12px;letter-spacing:1px;color:#863bff;font-weight:600;">THERMASHIFT MONITORING</div>
        <div style="font-size:22px;margin-top:4px;">${verb}: ${rule.name}</div>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p>Hi ${client?.primary_contact_name || 'there'},</p>
        ${triggerLine}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#64748b;">Site</td><td style="padding:8px 0;"><strong>${site?.name || '—'}</strong>${site?.city ? ', ' + site.city + (site.state ? ', ' + site.state : '') : ''}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Sensor</td><td style="padding:8px 0;"><strong>${sensor?.name || '—'}</strong>${sensor?.location ? ' — ' + sensor.location : ''}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Severity</td><td style="padding:8px 0;"><strong>${severity.toUpperCase()}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Detected</td><td style="padding:8px 0;">${new Date(incident.opened_at).toLocaleString('en-US', { timeZone: client?.timezone || 'America/New_York' })}</td></tr>
          ${eventType === 'recovered' ? `<tr><td style="padding:8px 0;color:#64748b;">Duration</td><td style="padding:8px 0;">${Math.floor((incident.duration_seconds || 0) / 60)}m ${(incident.duration_seconds || 0) % 60}s</td></tr>` : ''}
          ${eventType === 'recovered' ? '' : `<tr><td style="padding:8px 0;color:#64748b;">Peak</td><td style="padding:8px 0;"><strong>${incident.peak_value || incident.trigger_value} ${sensor?.unit || ''}</strong></td></tr>`}
        </table>
        <p style="font-size:13px;color:#64748b;margin-top:24px;">Incident #${incident.id} — Rule #${rule.id} — Sensor #${sensor?.id}</p>
        <p style="font-size:13px;color:#64748b;">— ThermaShift Monitoring</p>
      </div>
    </div>`;
  return { subject, html };
}

function buildSMS({ severity, rule, sensor, site, incident, eventType }) {
  const prefix = severity === 'critical' ? 'CRITICAL' : severity === 'warning' ? 'WARNING' : 'INFO';
  if (eventType === 'recovered') {
    return `[ThermaShift Resolved] ${rule.name} at ${site?.name || 'site'} — sensor back to normal after ${Math.floor((incident.duration_seconds || 0) / 60)}m`;
  }
  return `[ThermaShift ${prefix}] ${rule.name} at ${site?.name || 'site'}: ${sensor?.name || 'sensor'}=${incident.trigger_value}${sensor?.unit || ''} (threshold ${rule.threshold_value})`;
}

function buildVoiceText({ severity, rule, sensor, site, incident, eventType, client }) {
  if (eventType === 'recovered') {
    return `Hi ${client?.primary_contact_name || 'there'}, this is the ThermaShift monitoring system calling to let you know the alert for ${rule.name} at ${site?.name || 'your site'} has resolved. Have a good day.`;
  }
  return `Hi ${client?.primary_contact_name || 'there'}, this is the ThermaShift monitoring system calling with a ${severity} alert. ${rule.name} at ${site?.name || 'your site'} has triggered. The sensor ${sensor?.name || ''} read ${incident.trigger_value} ${sensor?.unit || ''}. Please check your email or dashboard for details.`;
}

// ─── Channel senders ────────────────────────────────────────

async function sendEmail(to, subject, html) {
  const { resendKey } = env();
  if (!resendKey || !to) return { ok: false, error: 'no_resend_key_or_recipient' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });
  if (!res.ok) return { ok: false, error: `resend_${res.status}: ${await res.text()}` };
  const data = await res.json();
  return { ok: true, id: data.id };
}

async function placeVapiCall(to, sayMessage) {
  const { vapiKey, vapiPhoneId } = env();
  if (!vapiKey || !vapiPhoneId || !to) {
    return { ok: false, error: 'vapi_not_configured_or_no_phone' };
  }
  const res = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${vapiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumberId: vapiPhoneId,
      customer: { number: to },
      assistant: {
        firstMessage: sayMessage,
        firstMessageMode: 'assistant-speaks-first-with-model-generated-message',
        voice: { provider: '11labs', voiceId: 'burt' },
        model: { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', maxTokens: 100,
          messages: [{ role: 'system', content: `You are ThermaShift's monitoring system delivering an alert. Say: "${sayMessage}" Then end the call. Do not engage in conversation. If they ask a question, say "Please check your dashboard for details" and end the call.` }],
        },
        endCallFunctionEnabled: true,
        maxDurationSeconds: 60,
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `vapi_${res.status}: ${await res.text()}` };
  const data = await res.json();
  return { ok: true, id: data.id };
}

async function postWebhook(url, payload) {
  if (!url) return { ok: false, error: 'no_webhook_url' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: `webhook_${res.status}` };
  return { ok: true };
}

// ─── Main entrypoint ────────────────────────────────────────

/**
 * Notify the client about an incident change.
 * eventType: 'triggered' | 'recovered'
 * Returns array of { channel, status, recipient, error? }.
 */
export async function notifyIncident(sb, incident, rule, sensor, site, client, eventType = 'triggered') {
  const severity = incident.severity || rule.severity || 'warning';
  const results = [];

  // Quiet hours: skip everything except critical
  if (inQuietHours(rule, client?.timezone, severity)) {
    console.log(`Notification suppressed (quiet hours): incident=${incident.id}, severity=${severity}`);
    return [{ channel: 'all', status: 'suppressed_quiet_hours' }];
  }

  // Build content variants
  const emailContent = buildEmail({ severity, rule, sensor, site, client, incident, eventType });
  const smsText = buildSMS({ severity, rule, sensor, site, incident, eventType });
  const voiceText = buildVoiceText({ severity, rule, sensor, site, incident, eventType, client });

  // Email
  if (rule.notify_email && client?.primary_contact_email) {
    const r = await sendEmail(client.primary_contact_email, emailContent.subject, emailContent.html);
    results.push({ channel: 'email', recipient: client.primary_contact_email, ok: r.ok, error: r.error, provider_id: r.id });
  }

  // SMS
  if (rule.notify_sms && client?.primary_contact_phone) {
    try {
      const r = await sendSMS(client.primary_contact_phone, smsText);
      results.push({ channel: 'sms', recipient: client.primary_contact_phone, ok: !!r, provider_id: r?.sid });
    } catch (e) {
      results.push({ channel: 'sms', recipient: client.primary_contact_phone, ok: false, error: e.message });
    }
  }

  // Voice (Vapi)
  if (rule.notify_voice && client?.primary_contact_phone) {
    const r = await placeVapiCall(client.primary_contact_phone, voiceText);
    results.push({ channel: 'voice', recipient: client.primary_contact_phone, ok: r.ok, error: r.error, provider_id: r.id });
  }

  // Webhook
  if (rule.notify_webhook_url) {
    const r = await postWebhook(rule.notify_webhook_url, {
      event: eventType,
      incident_id: incident.id,
      rule: { id: rule.id, name: rule.name, severity },
      sensor: sensor && { id: sensor.id, name: sensor.name, external_id: sensor.external_id, value: incident.trigger_value, unit: sensor.unit },
      site: site && { id: site.id, name: site.name, city: site.city, state: site.state },
      opened_at: incident.opened_at,
      resolved_at: incident.resolved_at,
    });
    results.push({ channel: 'webhook', recipient: rule.notify_webhook_url, ok: r.ok, error: r.error });
  }

  // Log every attempt to monitoring_alert_notifications
  for (const r of results) {
    try {
      await sb('monitoring_alert_notifications', 'POST', {
        incident_id: incident.id,
        client_id: incident.client_id,
        channel: r.channel,
        recipient: r.recipient || '',
        status: r.ok ? 'sent' : 'failed',
        provider_id: r.provider_id || null,
        sent_at: r.ok ? new Date().toISOString() : null,
        error: r.error || null,
      });
    } catch (e) { /* log table errors shouldn't break the chain */ }
  }

  return results;
}
