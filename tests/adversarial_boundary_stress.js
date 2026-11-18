/**
 * tests/adversarial_boundary_stress.js
 * Empirical Adversarial Stress Harness for Boundary & Corner Cases
 * Created by challenger_e2e_2
 */

const {
  createMockEnvironment,
  createStorage,
  createAuth,
  createScoring,
  createExamEngine,
  loadQuestions,
  loadPackages,
  assert,
  assertEqual,
  assertNotEqual,
  assertDeepEqual
} = require('./harness');

console.log('================================================================');
console.log('      ADVERSARIAL BOUNDARY & CORNER CASE STRESS HARNESS        ');
console.log('================================================================');

let totalChallenges = 0;
let passedChallenges = 0;
let failedChallenges = 0;
const failureDetails = [];

function challenge(name, fn) {
  totalChallenges++;
  try {
    fn();
    passedChallenges++;
    console.log(`  [PASS] #${totalChallenges}: ${name}`);
  } catch (err) {
    failedChallenges++;
    console.error(`  [FAIL] #${totalChallenges}: ${name}`);
    console.error(`         Reason: ${err.message}`);
    failureDetails.push({ name, error: err.message, stack: err.stack });
  }
}

// -------------------------------------------------------------
// SECTION 1: EXHAUSTIVE PASSING GRADE BOUNDARIES & COMBINATIONS
// -------------------------------------------------------------
console.log('\n--- Section 1: Passing Grade Boundary Matrix & Combinations ---');

const scoring = createScoring();

// 1.1 TWK boundary sweep
challenge('TWK 64 vs 65 boundary', () => {
  const at64 = scoring.evaluatePassingGrade({ TWK: 64, TIU: 80, TKP: 166 });
  assertEqual(at64.passTWK, false, 'TWK 64 must fail passTWK');
  assertEqual(at64.passAll, false, 'TWK 64 must fail passAll');

  const at65 = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(at65.passTWK, true, 'TWK 65 must pass passTWK');
  assertEqual(at65.passAll, true, 'TWK 65 with valid TIU & TKP must pass passAll');
});

// 1.2 TIU boundary sweep
challenge('TIU 79 vs 80 boundary', () => {
  const at79 = scoring.evaluatePassingGrade({ TWK: 65, TIU: 79, TKP: 166 });
  assertEqual(at79.passTIU, false, 'TIU 79 must fail passTIU');
  assertEqual(at79.passAll, false, 'TIU 79 must fail passAll');

  const at80 = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(at80.passTIU, true, 'TIU 80 must pass passTIU');
  assertEqual(at80.passAll, true, 'TIU 80 with valid TWK & TKP must pass passAll');
});

// 1.3 TKP boundary sweep
challenge('TKP 165 vs 166 boundary', () => {
  const at165 = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 165 });
  assertEqual(at165.passTKP, false, 'TKP 165 must fail passTKP');
  assertEqual(at165.passAll, false, 'TKP 165 must fail passAll');

  const at166 = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(at166.passTKP, true, 'TKP 166 must pass passTKP');
  assertEqual(at166.passAll, true, 'TKP 166 with valid TWK & TIU must pass passAll');
});

// 1.4 High total with one failed subtest MUST NOT passAll and MUST NOT be competitive
challenge('High total score (485) with subtest failure (TWK=60) is NOT passAll and NOT competitive', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 60, TIU: 200, TKP: 225 });
  assertEqual(pg.total, 485);
  assertEqual(pg.passTWK, false);
  assertEqual(pg.passAll, false);
  assertEqual(pg.isCompetitive, false, 'Must not be competitive if passAll is false');
});

// 1.5 Competitive boundary 429 vs 430
challenge('Competitive cutoff strictly requires total >= 430 and passAll = true', () => {
  const at429 = scoring.evaluatePassingGrade({ TWK: 100, TIU: 140, TKP: 189 });
  assertEqual(at429.total, 429);
  assertEqual(at429.passAll, true);
  assertEqual(at429.isCompetitive, false, '429 is not competitive');

  const at430 = scoring.evaluatePassingGrade({ TWK: 100, TIU: 140, TKP: 190 });
  assertEqual(at430.total, 430);
  assertEqual(at430.passAll, true);
  assertEqual(at430.isCompetitive, true, '430 is competitive');
});

// 1.6 Full Combinatorial Matrix of Subtest Pass/Fail states (2^3 = 8 states)
challenge('Exhaustive 2^3 subtest state truth table verification', () => {
  const combinations = [
    { twk: 64, tiu: 79, tkp: 165, expected: false }, // F, F, F
    { twk: 64, tiu: 79, tkp: 166, expected: false }, // F, F, T
    { twk: 64, tiu: 80, tkp: 165, expected: false }, // F, T, F
    { twk: 64, tiu: 80, tkp: 166, expected: false }, // F, T, T
    { twk: 65, tiu: 79, tkp: 165, expected: false }, // T, F, F
    { twk: 65, tiu: 79, tkp: 166, expected: false }, // T, F, T
    { twk: 65, tiu: 80, tkp: 165, expected: false }, // T, T, F
    { twk: 65, tiu: 80, tkp: 166, expected: true }   // T, T, T (ONLY pass state)
  ];

  for (const c of combinations) {
    const res = scoring.evaluatePassingGrade({ TWK: c.twk, TIU: c.tiu, TKP: c.tkp });
    assertEqual(
      res.passAll,
      c.expected,
      `State TWK=${c.twk}, TIU=${c.tiu}, TKP=${c.tkp} expected passAll=${c.expected}, got ${res.passAll}`
    );
  }
});

// 1.7 Non-SKD package passing grade bypass
challenge('Non-SKD package (isFullSKD=false) bypasses passing grade constraints even with 0 points', () => {
  const drillPg = scoring.evaluatePassingGrade({ TWK: 0, TIU: 0, TKP: 0 }, false);
  assertEqual(drillPg.passAll, true, 'Drill package must return passAll=true');
  assertEqual(drillPg.isCompetitive, false, 'Drill package is not competitive');
});

// 1.8 NaN and undefined score handling
challenge('Scoring handles NaN, null, and empty score objects safely without exceptions', () => {
  const nanPg = scoring.evaluatePassingGrade({ TWK: NaN, TIU: null, TKP: undefined });
  assertEqual(nanPg.passTWK, false);
  assertEqual(nanPg.passTIU, false);
  assertEqual(nanPg.passTKP, false);
  assertEqual(nanPg.passAll, false);
  assertEqual(nanPg.isCompetitive, false);

  const emptyPg = scoring.evaluatePassingGrade({});
  assertEqual(emptyPg.passAll, false);
  assertEqual(emptyPg.total, 0);
});

// 1.9 Negative scores are safely rejected by passing grade evaluation
challenge('Negative scores strictly evaluate to passAll = false', () => {
  const negPg = scoring.evaluatePassingGrade({ TWK: -10, TIU: 80, TKP: 166 });
  assertEqual(negPg.passTWK, false);
  assertEqual(negPg.passAll, false);
});

// -------------------------------------------------------------
// SECTION 2: BKN TIE-BREAKER HIERARCHY STRESS TESTING
// -------------------------------------------------------------
console.log('\n--- Section 2: BKN Tie-Breaker Hierarchy Stress Testing ---');

challenge('BKN tie-breaker ranking with multiple candidates having identical total scores', () => {
  // 4 candidates all with total 420
  const candidates = [
    { nama: 'Cand_LowTKP', total: 420, scores: { TKP: 175, TIU: 145, TWK: 100 } },
    { nama: 'Cand_HighTKP', total: 420, scores: { TKP: 195, TIU: 125, TWK: 100 } },
    { nama: 'Cand_MidTKP_HighTIU', total: 420, scores: { TKP: 185, TIU: 135, TWK: 100 } },
    { nama: 'Cand_MidTKP_LowTIU', total: 420, scores: { TKP: 185, TIU: 125, TWK: 110 } }
  ];

  // Canonical BKN sort function
  const bknSort = (list) => {
    return [...list].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.scores.TKP !== a.scores.TKP) return b.scores.TKP - a.scores.TKP;
      if (b.scores.TIU !== a.scores.TIU) return b.scores.TIU - a.scores.TIU;
      return b.scores.TWK - a.scores.TWK;
    });
  };

  const sorted = bknSort(candidates);
  // Expected order:
  // 1. Cand_HighTKP (TKP 195)
  // 2. Cand_MidTKP_HighTIU (TKP 185, TIU 135)
  // 3. Cand_MidTKP_LowTIU (TKP 185, TIU 125)
  // 4. Cand_LowTKP (TKP 175)
  assertEqual(sorted[0].nama, 'Cand_HighTKP');
  assertEqual(sorted[1].nama, 'Cand_MidTKP_HighTIU');
  assertEqual(sorted[2].nama, 'Cand_MidTKP_LowTIU');
  assertEqual(sorted[3].nama, 'Cand_LowTKP');
});

// -------------------------------------------------------------
// SECTION 3: TIMER RESILIENCE, ACCURACY, CLAMPING & RECOVERY
// -------------------------------------------------------------
console.log('\n--- Section 3: Timer Accuracy, Clamping & Recovery ---');

const env = createMockEnvironment();
const storage = createStorage(env);
const questions = loadQuestions();
const packages = loadPackages();

challenge('Timer duration initialization: 100 minutes = exactly 6000 seconds', () => {
  const exam = createExamEngine(storage, questions, packages, env);
  exam.start('skd_hots', 'cat');
  const state = exam.getState();
  assertEqual(state.secondsLeft, 6000, 'Initial secondsLeft must be 6000');
  assertEqual(state.pkg.minutes, 100);
});

challenge('Timer countdown accuracy under simulated progressive time jumps', () => {
  const exam = createExamEngine(storage, questions, packages, env);
  exam.start('skd_hots', 'cat');
  const initialEnd = exam.getState().examEndTime;

  // Jump 1: 15 minutes passed (900s)
  exam.getState().examEndTime = initialEnd - 900 * 1000;
  assertEqual(exam.updateTime(), 5100);

  // Jump 2: 60 minutes passed (3600s)
  exam.getState().examEndTime = initialEnd - 3600 * 1000;
  assertEqual(exam.updateTime(), 2400);

  // Jump 3: 99.5 minutes passed (5970s)
  exam.getState().examEndTime = initialEnd - 5970 * 1000;
  assertEqual(exam.updateTime(), 30);
});

challenge('Timer strictly clamps at 0 seconds when time has expired (no negative numbers)', () => {
  const exam = createExamEngine(storage, questions, packages, env);
  exam.start('skd_hots', 'cat');

  // Past time by 1s, 60s, 3600s
  for (const deltaSec of [1, 60, 3600, 86400]) {
    exam.getState().examEndTime = Date.now() - deltaSec * 1000;
    const rem = exam.updateTime();
    assertEqual(rem, 0, `Remaining time must clamp at 0 for delta -${deltaSec}s`);
  }
});

challenge('Crash snapshot recovery retains accurate remaining time without resetting', () => {
  const exam1 = createExamEngine(storage, questions, packages, env);
  exam1.start('skd_hots', 'cat');

  // Simulate 40 minutes spent, 60 minutes left (3600s)
  exam1.getState().examEndTime = Date.now() + 3600 * 1000;
  exam1.selectOption(exam1.getState().questions[5].id, 'C');

  // New browser session
  const exam2 = createExamEngine(storage, questions, packages, env);
  const ok = exam2.recoverSession();
  assertEqual(ok, true);

  const rem = exam2.getState().secondsLeft;
  assert(rem >= 3598 && rem <= 3602, `Remaining time should be ~3600s, got ${rem}`);
  assertEqual(exam2.getState().answers[exam1.getState().questions[5].id], 'C');
});

challenge('Crash snapshot recovery on expired exam sets isActive to false', () => {
  const exam1 = createExamEngine(storage, questions, packages, env);
  exam1.start('skd_hots', 'cat');
  // Expired 5 minutes ago
  exam1.getState().examEndTime = Date.now() - 300 * 1000;
  exam1.saveProgress();

  const exam2 = createExamEngine(storage, questions, packages, env);
  const ok = exam2.recoverSession();
  assertEqual(ok, true);
  assertEqual(exam2.getState().secondsLeft, 0);
  assertEqual(exam2.getState().isActive, false, 'Expired exam must be inactive');
});

// -------------------------------------------------------------
// SECTION 4: STORAGE BOUNDARIES & CORRUPT DATA HANDLING
// -------------------------------------------------------------
console.log('\n--- Section 4: Storage Boundaries & Corruption Immunity ---');

challenge('Storage pruning strictly enforces 50-item cap on history entries', () => {
  const testEnv = createMockEnvironment();
  const testStorage = createStorage(testEnv);

  for (let i = 1; i <= 65; i++) {
    testStorage.saveHistoryEntry({
      id: `HIST-${i}`,
      userId: 'TEST-USER',
      totalScore: 300 + i,
      timestamp: new Date().toISOString()
    });
  }

  const hist = testStorage.getHistory();
  assertEqual(hist.length, 50, 'History must be capped at 50 entries');
  assertEqual(hist[0].id, 'HIST-65', 'Most recent attempt must be at index 0');
  assertEqual(hist[49].id, 'HIST-16', 'Oldest retained attempt must be HIST-16');
});

challenge('Storage handles corrupt JSON in all localStorage keys without throwing', () => {
  const corruptEnv = createMockEnvironment();
  const corruptStorage = createStorage(corruptEnv);

  corruptEnv.localStorage.setItem('cat_users_db', '<<<NOT JSON>>>');
  corruptEnv.localStorage.setItem('cat_active_session', '<<<NOT JSON>>>');
  corruptEnv.localStorage.setItem('cat_active_exam_session', '<<<NOT JSON>>>');
  corruptEnv.localStorage.setItem('cat_exam_history', '<<<NOT JSON>>>');

  assertDeepEqual(corruptStorage.getUsers(), {});
  assertEqual(corruptStorage.getUserById('any'), null);
  assertEqual(corruptStorage.getActiveSession(), null);
  assertEqual(corruptStorage.getActiveUser(), null);
  assertEqual(corruptStorage.getActiveExamSnapshot(), null);
  assertDeepEqual(corruptStorage.getHistory(), []);
});

challenge('Storage getUserById with non-existent user returns null gracefully', () => {
  assertEqual(storage.getUserById('non-existent-user-id-999'), null);
});

// -------------------------------------------------------------
// SECTION 5: AUTHENTICATION BOUNDARIES & VALIDATIONS
// -------------------------------------------------------------
console.log('\n--- Section 5: Authentication Boundaries & Validations ---');

const auth = createAuth(storage, env);

challenge('Auth registration rejects name boundaries: empty, 1 char, 2 chars; accepts 3 chars', () => {
  const r0 = auth.register({ nama: '', email: 'valid@cat.id', noHp: '081234567800', pin: '123456' });
  assertEqual(r0.success, false);

  const r1 = auth.register({ nama: 'A', email: 'valid@cat.id', noHp: '081234567800', pin: '123456' });
  assertEqual(r1.success, false);

  const r2 = auth.register({ nama: 'AB', email: 'valid@cat.id', noHp: '081234567800', pin: '123456' });
  assertEqual(r2.success, false);

  const r3 = auth.register({ nama: 'ABC', email: 'valid@cat.id', noHp: '081234567800', pin: '123456' });
  assertEqual(r3.success, true, 'Name with 3 characters should be accepted');
});

challenge('Auth registration phone length boundaries: 9 fails, 10 passes, 13 passes, 14 fails', () => {
  const p9 = auth.register({ nama: 'Valid Name', email: 'p9@cat.id', noHp: '081234567', pin: '123456' }); // 9 digits
  assertEqual(p9.success, false, '9-digit phone must fail');

  const p10 = auth.register({ nama: 'Valid Name', email: 'p10@cat.id', noHp: '0812345678', pin: '123456' }); // 10 digits
  assertEqual(p10.success, true, '10-digit phone must pass');

  const p13 = auth.register({ nama: 'Valid Name', email: 'p13@cat.id', noHp: '0812345678901', pin: '123456' }); // 13 digits
  assertEqual(p13.success, true, '13-digit phone must pass');

  const p14 = auth.register({ nama: 'Valid Name', email: 'p14@cat.id', noHp: '08123456789012', pin: '123456' }); // 14 digits
  assertEqual(p14.success, false, '14-digit phone must fail');
});

challenge('Auth registration PIN length boundaries: 5 fails, 6 passes, 7 fails, letters fail', () => {
  const pin5 = auth.register({ nama: 'Valid Name', email: 'pin5@cat.id', noHp: '081234567811', pin: '12345' });
  assertEqual(pin5.success, false);

  const pin7 = auth.register({ nama: 'Valid Name', email: 'pin7@cat.id', noHp: '081234567812', pin: '1234567' });
  assertEqual(pin7.success, false);

  const pinAlpha = auth.register({ nama: 'Valid Name', email: 'pina@cat.id', noHp: '081234567813', pin: '12345A' });
  assertEqual(pinAlpha.success, false);

  const pin6 = auth.register({ nama: 'Valid Name', email: 'pin6@cat.id', noHp: '081234567814', pin: '654321' });
  assertEqual(pin6.success, true);
});

challenge('Auth login multi-identifier support (email, phone, noPeserta) with whitespace resilience', () => {
  const reg = auth.register({ nama: 'Multi Id Candidate', email: 'multi@cat.id', noHp: '081234567820', pin: '987654' });
  assertEqual(reg.success, true);
  auth.logout();

  // Login via email
  const l1 = auth.login({ identifier: '   multi@cat.id   ', pin: '987654' });
  assertEqual(l1.success, true);
  auth.logout();

  // Login via phone
  const l2 = auth.login({ identifier: '081234567820', pin: '987654' });
  assertEqual(l2.success, true);
  auth.logout();

  // Login via noPeserta
  const l3 = auth.login({ identifier: reg.user.noPeserta, pin: '987654' });
  assertEqual(l3.success, true);
});

challenge('Exam finish duration captures elapsed time when timer loop ticks', () => {
  const exam = createExamEngine(storage, questions, packages, env);
  exam.start('skd_hots', 'cat');
  const initialEnd = exam.getState().examEndTime;

  // Advance time: 30 minutes pass (1800s)
  exam.getState().examEndTime = initialEnd - 1800 * 1000;
  exam.updateTime(); // Simulated timer tick from setInterval

  const hist = exam.finish();
  assertEqual(hist.durationSeconds, 1800, 'durationSeconds accurately reflects elapsed time');
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL ADVERSARIAL CHALLENGES: ${totalChallenges}`);
console.log(`PASSED: ${passedChallenges}`);
console.log(`FAILED: ${failedChallenges}`);
console.log('================================================================');

if (failedChallenges > 0) {
  console.error('\nFAILURE DETAILS:');
  for (const f of failureDetails) {
    console.error(`- ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\nALL ADVERSARIAL CHALLENGES VERIFIED EMPIRICALLY! ZERO BUGS FOUND.');
  process.exit(0);
}
