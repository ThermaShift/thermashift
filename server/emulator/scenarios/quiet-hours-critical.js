/**
 * Scenario s-8: Critical alert bypasses quiet hours.
 *
 * Set a quiet_hours window covering "now" on the warning rule. Trigger a
 * warning-severity violation — expect notification SUPPRESSED. Then trigger
 * a critical violation — expect notification fires (critical bypasses).
 *
 * Validates the quiet-hours suppression logic + critical bypass per the
 * existing monitoring-notify.js implementation.
 */

import { injectReading } from '../inject.js';
import { sb, findClient, evaluateNow, sleep, result } from './_common.js';

export async function run({ log = console.log } = {}) {
  log('=== Scenario s-8: quiet hours critical bypass ===');
  const client = await findClient('TEST_A');
  if (!client) return result({ pass: false, name: 's-8', reason: 'TEST_A not seeded' });

  // Find the warning rule and patch quiet hours to cover NOW
  const warningRule = (await sb('monitoring_alert_rules', 'GET', null,
    `?client_id=eq.${client.id}&name=eq.${encodeURIComponent('Charlotte CRAC1 warning')}&limit=1`))?.[0];
  if (!warningRule) return result({ pass: false, name: 's-8', reason: 'warning rule missing' });

  const nowH = new Date().getHours();
  const startH = ((nowH - 1) + 24) % 24;
  const endH = (nowH + 2) % 24;
  log(`Patching quiet_hours to ${String(startH).padStart(2, '0')}:00-${String(endH).padStart(2, '0')}:00 (covers now)`);
  await sb('monitoring_alert_rules', 'PATCH',
    { quiet_hours_start: `${String(startH).padStart(2, '0')}:00`, quiet_hours_end: `${String(endH).padStart(2, '0')}:00`, updated_at: new Date().toISOString() },
    `?id=eq.${warningRule.id}`);

  // Trigger warning — expect suppressed
  log('Inject 80°F (warning threshold = 78°F)');
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_charlotte_crac1_supply', value: 80, unit: '°F' });
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_charlotte_crac1_supply', value: 80.5, unit: '°F' });
  await evaluateNow(log);
  await sleep(2000);

  // Trigger critical — expect bypass
  log('Inject 90°F (critical threshold = 85°F)');
  await injectReading({ vendor: 'generic', apiKey: client.api_key, externalId: 'test_a_charlotte_crac1_supply', value: 90, unit: '°F' });
  await evaluateNow(log);
  await sleep(2000);

  // Check audit: warning incident's notifications should be suppressed_quiet_hours;
  // critical incident's notifications should be delivered/queued.
  const recentNotifs = await sb('monitoring_alert_notifications', 'GET', null,
    `?client_id=eq.${client.id}&order=created_at.desc&limit=10`);
  const suppressed = (recentNotifs || []).filter(n => /suppressed|quiet/i.test(n.status || ''));
  const delivered = (recentNotifs || []).filter(n => /sent|queued|delivered/i.test(n.status || ''));

  log(`  suppressed-quiet-hours notifications: ${suppressed.length}`);
  log(`  delivered/queued notifications: ${delivered.length}`);

  // Cleanup: clear the quiet hours so future scenarios aren't affected
  await sb('monitoring_alert_rules', 'PATCH',
    { quiet_hours_start: null, quiet_hours_end: null, updated_at: new Date().toISOString() },
    `?id=eq.${warningRule.id}`);

  if (delivered.length === 0) {
    return result({ pass: false, name: 's-8', reason: 'critical alert was suppressed by quiet hours — bypass broken' });
  }
  if (suppressed.length === 0) {
    return result({ pass: false, name: 's-8',
      reason: 'no warning notification was suppressed — quiet hours suppression may not be wired',
      details: { recent_notifications: recentNotifs?.slice(0, 5) } });
  }
  return result({ pass: true, name: 's-8', details: { suppressed: suppressed.length, delivered: delivered.length } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => { console.log(r); process.exit(r.pass ? 0 : 1); });
}
