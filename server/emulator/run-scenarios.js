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

const SCENARIOS = [
  { id: 's-1', name: 'gradual temp rise', fn: runGradual },
  { id: 's-2', name: 'critical spike', fn: runCritical },
  { id: 'iso', name: 'tenant isolation', fn: runIsolation },
  // Stubs — files will be added next:
  // { id: 's-3', name: 'economizer trigger', fn: runEconomizer },
  // { id: 's-4', name: 'recovery', fn: runRecovery },
  // { id: 's-5', name: 'conflicting sensors', fn: runConflict },
  // { id: 's-6', name: 'sensor offline mid-incident', fn: runOffline },
  // { id: 's-7', name: 'oscillating around threshold', fn: runOscillate },
  // { id: 's-8', name: 'quiet hours critical bypass', fn: runQuietHours },
  // { id: 's-9', name: 'no permission rules', fn: runNoPerms },
  // { id: 's-10', name: 'auto-approve within bounds', fn: runAutoApproveOK },
  // { id: 's-11', name: 'auto-approve exceeds bounds', fn: runAutoApproveFail },
  // { id: 's-12', name: 'multi-sensor incident', fn: runMultiSensor },
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
  const failed = results.length - passed;
  console.log(`  ${passed} passed, ${failed} failed (${results.length} total)`);
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'}  ${r.name}  ${r.reason || ''}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
