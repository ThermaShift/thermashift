/**
 * Run all scenarios sequentially. Report pass/fail summary at end.
 *
 * Usage:
 *   node seed.js                          # one-time setup
 *   node mock-customer-control.js &       # in another shell, for action webhook tests
 *   node run-scenarios.js                 # runs everything
 *   node run-scenarios.js --only s-1,s-2  # run subset
 */

import { run as runGradual } from './scenarios/gradual-temp-rise.js';
import { run as runCritical } from './scenarios/critical-spike.js';
import { run as runIsolation } from './scenarios/tenant-isolation.js';
import { run as runEconomizer } from './scenarios/economizer-trigger.js';
import { run as runRecovery } from './scenarios/recovery.js';
import { run as runConflict } from './scenarios/conflicting-sensors.js';
import { run as runOffline } from './scenarios/sensor-offline.js';
import { run as runOscillate } from './scenarios/oscillating.js';
import { run as runQuietHours } from './scenarios/quiet-hours-critical.js';
import { run as runNoPerms } from './scenarios/no-permission-rules.js';
import { run as runAutoApproveOK } from './scenarios/auto-approve-within.js';
import { run as runAutoApproveFail } from './scenarios/auto-approve-exceeds.js';
import { run as runMultiSensor } from './scenarios/multi-sensor-incident.js';

const SCENARIOS = [
  { id: 's-1', name: 'gradual temp rise', fn: runGradual },
  { id: 's-2', name: 'critical spike', fn: runCritical },
  { id: 's-3', name: 'economizer trigger', fn: runEconomizer },
  { id: 's-4', name: 'recovery', fn: runRecovery },
  { id: 's-5', name: 'conflicting sensors', fn: runConflict },
  { id: 's-6', name: 'sensor offline mid-incident', fn: runOffline },
  { id: 's-7', name: 'oscillating around threshold', fn: runOscillate },
  { id: 's-8', name: 'quiet hours critical bypass', fn: runQuietHours },
  { id: 's-9', name: 'no permission rules', fn: runNoPerms },
  { id: 's-10', name: 'auto-approve within bounds', fn: runAutoApproveOK },
  { id: 's-11', name: 'auto-approve exceeds bounds', fn: runAutoApproveFail },
  { id: 's-12', name: 'multi-sensor incident', fn: runMultiSensor },
  { id: 'iso', name: 'tenant isolation', fn: runIsolation },
];

async function main() {
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const onlyIds = onlyArg ? new Set(onlyArg.split('=')[1].split(',')) : null;
  const toRun = onlyIds ? SCENARIOS.filter(s => onlyIds.has(s.id)) : SCENARIOS;

  console.log(`\n=== Running ${toRun.length} scenarios ===\n`);
  const results = [];
  for (const sc of toRun) {
    console.log(`\n──── ${sc.id}: ${sc.name} ────`);
    const t0 = Date.now();
    try {
      const r = await sc.fn();
      r.elapsed_ms = Date.now() - t0;
      results.push(r);
      console.log(`  → ${r.pass ? '✓ PASS' : '✗ FAIL'} in ${r.elapsed_ms}ms${r.reason ? ` (${r.reason})` : ''}`);
    } catch (e) {
      results.push({ pass: false, name: sc.id, reason: 'threw: ' + e.message, elapsed_ms: Date.now() - t0 });
      console.log(`  → ✗ FAIL (threw: ${e.message})`);
    }
  }

  console.log('\n\n=== SUMMARY ===');
  const passed = results.filter(r => r.pass).length;
  const failedAiWiring = results.filter(r => !r.pass && r.expectedFailUntilAiWired).length;
  const failedReal = results.filter(r => !r.pass && !r.expectedFailUntilAiWired).length;
  console.log(`  ${passed} passed, ${failedReal} real failures, ${failedAiWiring} expected-fail (AI auto-action not wired yet)`);
  console.log(`  ${results.length} scenarios total`);
  for (const r of results) {
    const marker = r.pass ? '✓' : (r.expectedFailUntilAiWired ? '⊘' : '✗');
    console.log(`  ${marker}  ${r.name}  ${r.reason || ''}`);
  }
  console.log('\n  Legend: ✓=pass  ✗=real failure  ⊘=expected fail until advisor→proposeAction wiring (plan §b)');
  process.exit(failedReal > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
