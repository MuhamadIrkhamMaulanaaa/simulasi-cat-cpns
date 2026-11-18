/**
 * tests/run_all_tests.js
 * Master E2E Automated Test Runner for Simulasi CAT CPNS 2027
 * Executes Tiers 1–4, emits TAP format, and enforces coverage thresholds.
 */

const path = require('path');

// Test suite registry grouped by tier
const SUITES = [
  // Tier 1: Feature Coverage
  { tier: 1, file: './tier1_features/test_auth.js' },
  { tier: 1, file: './tier1_features/test_storage.js' },
  { tier: 1, file: './tier1_features/test_exam_engine.js' },
  { tier: 1, file: './tier1_features/test_scoring_pg.js' },
  { tier: 1, file: './tier1_features/test_history.js' },

  // Tier 2: Boundaries & Edge Cases
  { tier: 2, file: './tier2_boundaries/test_auth_boundaries.js' },
  { tier: 2, file: './tier2_boundaries/test_timer_recovery.js' },
  { tier: 2, file: './tier2_boundaries/test_score_boundaries.js' },

  // Tier 3: Cross-Feature Interactions
  { tier: 3, file: './tier3_combinations/test_cross_feature.js' },

  // Tier 4: Real-World Application Scenarios
  { tier: 4, file: './tier4_scenarios/test_real_world_e2e.js' }
];

const THRESHOLDS = {
  1: { name: 'Tier 1 Feature Coverage', min: 55 },
  2: { name: 'Tier 2 Boundaries & Edge Cases', min: 55 },
  3: { name: 'Tier 3 Cross-Feature Interactions', min: 15 },
  4: { name: 'Tier 4 Real-World Application Scenarios', min: 5 },
  total: { name: 'Total Suite Coverage', min: 130 }
};

async function runAll() {
  console.log('TAP version 13');
  const startTime = Date.now();

  let globalIndex = 0;
  const tierStats = {
    1: { total: 0, passed: 0, failed: 0, suites: [] },
    2: { total: 0, passed: 0, failed: 0, suites: [] },
    3: { total: 0, passed: 0, failed: 0, suites: [] },
    4: { total: 0, passed: 0, failed: 0, suites: [] }
  };

  const executedSuites = [];

  for (const entry of SUITES) {
    const suitePath = path.resolve(__dirname, entry.file);
    const suiteModule = require(suitePath);
    const suiteRes = await suiteModule.run();
    executedSuites.push({ tier: entry.tier, file: entry.file, result: suiteRes });

    tierStats[entry.tier].total += suiteRes.total;
    tierStats[entry.tier].passed += suiteRes.passed;
    tierStats[entry.tier].failed += suiteRes.failed;
    tierStats[entry.tier].suites.push(suiteRes);

    for (const testCase of suiteRes.tests) {
      globalIndex++;
      if (testCase.pass) {
        console.log(`ok ${globalIndex} - [T${entry.tier}] ${suiteRes.suiteName} > ${testCase.name} (${testCase.durationMs}ms)`);
      } else {
        console.log(`not ok ${globalIndex} - [T${entry.tier}] ${suiteRes.suiteName} > ${testCase.name} (${testCase.durationMs}ms)`);
        if (testCase.error) {
          console.log(`  ---`);
          console.log(`  message: "${testCase.error.message.replace(/"/g, '\\"')}"`);
          if (testCase.error.stack) {
            const stackLines = testCase.error.stack.split('\n').slice(0, 3).map((l) => '  ' + l.trim());
            console.log(`  stack: |\n${stackLines.join('\n')}`);
          }
          console.log(`  ...`);
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`1..${globalIndex}`);

  // Summary Table
  const totalTests = globalIndex;
  const totalPassed = Object.values(tierStats).reduce((acc, t) => acc + t.passed, 0);
  const totalFailed = Object.values(tierStats).reduce((acc, t) => acc + t.failed, 0);

  console.log('\n================================================================================');
  console.log('              SIMULASI CAT CPNS 2027 — E2E TEST EXECUTION SUMMARY               ');
  console.log('================================================================================');
  console.log(
    'Tier                           | Tests Executed | Passed | Failed | Threshold | Status'
  );
  console.log(
    '-------------------------------|----------------|--------|--------|-----------|-------'
  );

  let thresholdViolations = 0;

  for (let t = 1; t <= 4; t++) {
    const s = tierStats[t];
    const thresh = THRESHOLDS[t].min;
    const met = s.passed >= thresh && s.failed === 0;
    if (!met) thresholdViolations++;
    const status = met ? 'PASSED' : 'FAILED';
    const tierName = THRESHOLDS[t].name.padEnd(30, ' ');
    const countStr = String(s.total).padStart(14, ' ');
    const passStr = String(s.passed).padStart(6, ' ');
    const failStr = String(s.failed).padStart(6, ' ');
    const threshStr = (`>= ${thresh}`).padStart(9, ' ');
    console.log(`${tierName} | ${countStr} | ${passStr} | ${failStr} | ${threshStr} | ${status}`);
  }

  console.log('-------------------------------|----------------|--------|--------|-----------|-------');
  const grandMet = totalPassed >= THRESHOLDS.total.min && totalFailed === 0;
  if (!grandMet) thresholdViolations++;
  const grandStatus = grandMet ? 'PASSED' : 'FAILED';
  const totalName = 'TOTAL SUITE (ALL TIERS)'.padEnd(30, ' ');
  const totalCountStr = String(totalTests).padStart(14, ' ');
  const totalPassStr = String(totalPassed).padStart(6, ' ');
  const totalFailStr = String(totalFailed).padStart(6, ' ');
  const totalThreshStr = (`>= ${THRESHOLDS.total.min}`).padStart(9, ' ');
  console.log(`${totalName} | ${totalCountStr} | ${totalPassStr} | ${totalFailStr} | ${totalThreshStr} | ${grandStatus}`);
  console.log('================================================================================');
  console.log(`Execution Duration: ${totalDuration}ms`);
  console.log(`Overall Verdict:    ${grandMet ? 'ALL TIERS PASS CLEANLY (100% OK)' : 'FAILED'}`);
  console.log('================================================================================\n');

  if (totalFailed > 0 || thresholdViolations > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
