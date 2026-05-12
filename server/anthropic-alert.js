/**
 * Anthropic credit / rate-limit alert helper.
 * Every server-side Anthropic call wraps its error path with notifyIfCreditError().
 * Sends at most one email per 24h per feature so we don't spam.
 */
import fs from 'node:fs';
import path from 'node:path';

const ALERT_TO = 'admin@thermashift.net';
const ALERT_FROM = 'ThermaShift Alerts <alerts@thermashift.net>';
const STATE_FILE = path.join(process.cwd(), '.anthropic-alert-state.json');
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h per feature

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}
function saveState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
  catch (e) { console.error('anthropic-alert: could not save state', e.message); }
}

function isCreditOrLimitError(status, body) {
  if (status === 429) return true;
  if (status === 402) return true;
  const t = String(body || '').toLowerCase();
  return /credit\s*balance|insufficient\s*(credit|funds|quota)|billing|out of credits|payment\s*required/i.test(t);
}

async function sendAlertEmail(feature, status, body) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('[anthropic-alert] RESEND_API_KEY missing — cannot send alert');
    return;
  }
  const subject = `⚠️ ThermaShift Anthropic API out of credits — ${feature}`;
  const snippet = String(body || '').slice(0, 600).replace(/[<>]/g, '');
  const html = `
    <h2>Anthropic API credit / rate-limit error</h2>
    <p><strong>Feature affected:</strong> ${feature}</p>
    <p><strong>HTTP status:</strong> ${status}</p>
    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
    <p><strong>Response snippet:</strong></p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;">${snippet}</pre>
    <h3>What to do</h3>
    <ol>
      <li>Top up Anthropic balance: <a href="https://console.anthropic.com/settings/billing">console.anthropic.com/settings/billing</a></li>
      <li>You won't get another alert about this feature for 24 hours.</li>
    </ol>
    <hr/>
    <p style="color:#666;font-size:12px;">Automated alert from chat-proxy. Disable by removing the notifyIfCreditError wrapper.</p>
  `;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_TO], subject, html }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`[anthropic-alert] Resend rejected: ${res.status} — ${t.slice(0, 200)}`);
    } else {
      console.log(`[anthropic-alert] sent credit alert for ${feature}`);
    }
  } catch (e) {
    console.error('[anthropic-alert] send failed:', e.message);
  }
}

/**
 * Call this from every Anthropic error path.
 *   await notifyIfCreditError('alex_chat', res.status, errorBody);
 */
export async function notifyIfCreditError(feature, status, body) {
  if (!isCreditOrLimitError(status, body)) return;
  const state = loadState();
  const last = state[feature] || 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  state[feature] = Date.now();
  saveState(state);
  await sendAlertEmail(feature, status, body);
}
