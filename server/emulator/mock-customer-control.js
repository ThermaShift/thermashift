/**
 * Mock customer control endpoint — pretends to be a customer's cooling-equipment
 * control system that receives ThermaShift's signed action webhooks.
 *
 * Behavior is controlled by query params:
 *   ?response=200       → return 200 with synthetic before/after state
 *   ?response=500       → return 500 (simulate customer system error)
 *   ?response=timeout   → never respond (test our 15-second timeout)
 *   ?response=garbage   → return non-JSON (test parse robustness)
 *
 * Every received request is logged to memory; query `/log` to inspect.
 *
 * Run:
 *   node mock-customer-control.js              # default port 4099
 *   PORT=4099 node mock-customer-control.js
 */

import http from 'http';
import crypto from 'crypto';

const PORT = Number(process.env.PORT || 4099);
const HMAC_SECRET = process.env.HMAC_SECRET || 'test-secret-A';

const requests = []; // memory log

function verifySignature(rawBody, signature, secret) {
  if (!signature) return { ok: false, reason: 'no_signature_header' };
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Constant-time compare to avoid timing leaks (even in mock — habits matter).
  if (signature.length !== expected.length) return { ok: false, reason: 'length_mismatch' };
  return { ok: crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), reason: 'sig_mismatch' };
}

const server = http.createServer((req, res) => {
  // /log endpoint — return what we've received
  if (req.url.startsWith('/log')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: requests.length, requests }, null, 2));
    return;
  }
  if (req.url.startsWith('/log/clear')) {
    requests.length = 0;
    res.writeHead(200); res.end('cleared');
    return;
  }

  // /control endpoint — the action webhook target
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const response = url.searchParams.get('response') || '200';
    const actionId = req.headers['x-thermashift-action-id'];
    const signature = req.headers['x-thermashift-signature'];
    const sigCheck = verifySignature(body, signature, HMAC_SECRET);

    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = { _parse_error: true, raw: body.slice(0, 500) }; }

    const entry = {
      received_at: new Date().toISOString(),
      method: req.method, url: req.url,
      action_id: actionId, signature_valid: sigCheck.ok,
      action_type: parsed?.action_type,
      target_label: parsed?.target_label,
      parameters: parsed?.parameters,
      response_mode: response,
    };
    requests.push(entry);

    if (response === 'timeout') {
      // never respond — caller should timeout
      console.log(`[mock] received ${actionId} action_type=${parsed?.action_type} → simulating timeout`);
      return;
    }
    if (response === '500') {
      console.log(`[mock] received ${actionId} → returning 500`);
      res.writeHead(500); res.end('simulated_customer_system_error');
      return;
    }
    if (response === 'garbage') {
      console.log(`[mock] received ${actionId} → returning garbage`);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('<<not_json>>');
      return;
    }
    // Default: 200 with synthetic state transition
    const before = { speed_percent: 65, supply_temp_f: 76.5 };
    const after = { ...before };
    if (parsed?.action_type === 'set_crac_fan_speed') after.speed_percent = parsed.parameters?.speed_percent ?? before.speed_percent;
    if (parsed?.action_type === 'set_chilled_water_setpoint') after.supply_temp_f = parsed.parameters?.setpoint_f ?? before.supply_temp_f;

    console.log(`[mock] received ${actionId} action=${parsed?.action_type} sig=${sigCheck.ok ? 'valid' : 'INVALID:' + sigCheck.reason} → 200`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      action_id: actionId,
      signature_verified: sigCheck.ok,
      before_state: before,
      after_state: after,
      applied_at: new Date().toISOString(),
    }));
  });
});

server.listen(PORT, () => {
  console.log(`[mock-customer-control] listening on http://localhost:${PORT}`);
  console.log(`  POST /control?response=200|500|timeout|garbage  ← action webhook target`);
  console.log(`  GET  /log                                      ← view received requests`);
  console.log(`  GET  /log/clear                                ← clear the log`);
});
