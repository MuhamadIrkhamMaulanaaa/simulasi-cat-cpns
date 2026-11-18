/**
 * tests/tier4_scenarios/test_real_world_e2e.js
 * Tier 4 End-to-End User Scenarios: Realistic Full-Workflow System Validation
 */

const fs = require('fs');
const path = require('path');
const {
  createSuite,
  createMockEnvironment,
  createStorage,
  createAuth,
  createExamEngine,
  createScoring,
  loadQuestions,
  loadPackages,
  assert,
  assertEqual,
  assertNotEqual
} = require('../harness');

const suite = createSuite('Tier 4: Realistic End-to-End Application Workflows');

let questions, packages;

suite.beforeEach(() => {
  questions = loadQuestions();
  packages = loadPackages();
});

// Scenario 1: Full Candidate Lifecycle
suite.test('Scenario 1: Full Candidate Lifecycle (Register -> Select Package -> 110 Qs SKD Exam -> Finish -> Result -> History -> Review)', () => {
  const env = createMockEnvironment();
  const storage = createStorage(env);
  const auth = createAuth(storage, env);
  const exam = createExamEngine(storage, questions, packages, env);

  // 1. Registration
  const reg = auth.register({
    nama: 'Budi Prasetyo',
    email: 'budi.prasetyo@catcpns.id',
    noHp: '081234567890',
    formasi: 'Pranata Komputer Ahli Pertama',
    pin: '123456'
  });
  assertEqual(reg.success, true);
  assertEqual(storage.getActiveUser().nama, 'Budi Prasetyo');

  // 2. Select Package & Start
  const state = exam.start('skd_hots', 'cat');
  assertEqual(state.questions.length, 110);
  assertEqual(state.pkg.minutes, 100);

  // 3. Work through 110 questions
  // Let's answer TWK (1-30) correctly (150 pts), TIU (31-65) correctly (175 pts),
  // and TKP (66-110) with highest score (225 pts)
  for (let i = 0; i < state.questions.length; i++) {
    const q = state.questions[i];
    exam.jumpTo(i);
    if (q.group === 'TKP') {
      const bestOpt = Object.keys(q.scores).find((k) => q.scores[k] === 5);
      exam.selectOption(q.id, bestOpt);
    } else {
      exam.selectOption(q.id, q.answer);
    }

    // Mark doubt on question 10 and 20
    if (i === 10 || i === 20) {
      exam.toggleDoubt(q.id);
    }
  }

  // Verify navigation grid stats
  const gridStats = exam.getGridStats();
  assertEqual(gridStats.total, 110);
  assertEqual(gridStats.doubtCount, 2);
  assertEqual(gridStats.answeredConfidentCount, 108);
  assertEqual(gridStats.emptyCount, 0);

  // 4. Finish Exam
  const history = exam.finish();

  // 5. Result Verification
  assertEqual(history.userNama, 'Budi Prasetyo');
  assertEqual(history.totalScore, 550);
  assertEqual(history.scoresByGroup.TWK, 150);
  assertEqual(history.scoresByGroup.TIU, 175);
  assertEqual(history.scoresByGroup.TKP, 225);
  assertEqual(history.passingGrade.passAll, true);
  assertEqual(history.passingGrade.isCompetitive, true);

  // 6. History Saved in Storage
  const userHistory = storage.getHistory(reg.user.id);
  assertEqual(userHistory.length, 1);
  assertEqual(userHistory[0].id, history.id);
  assertEqual(storage.getActiveExamSnapshot(), null);

  // 7. Review Explanations
  const sampleQ = state.questions[0];
  const reviewLedger = userHistory[0].answersLedger[sampleQ.id];
  assertEqual(reviewLedger.chosen, sampleQ.answer);
  assertEqual(reviewLedger.score, 5);
  assert(sampleQ.pembahasan.length > 20);
  assert(sampleQ.hack.length > 10);
});

// Scenario 2: Interrupted Exam Crash Recovery
suite.test('Scenario 2: Interrupted Exam Crash Recovery (Login -> Start -> Answer 15 Qs -> Simulate Crash -> Recover Snapshot -> Complete -> Finish)', () => {
  const env = createMockEnvironment();
  const storage = createStorage(env);
  const auth = createAuth(storage, env);

  // 1. Login
  auth.register({
    nama: 'Crash Test Candidate',
    email: 'crashtest@catcpns.id',
    noHp: '081399887766',
    pin: '998877'
  });

  // 2. Start Exam
  let examInstance = createExamEngine(storage, questions, packages, env);
  examInstance.start('skd_hots', 'cat');
  const qs = examInstance.getState().questions;

  // 3. Answer 15 questions and flag 2 doubts
  for (let i = 0; i < 15; i++) {
    examInstance.jumpTo(i);
    examInstance.selectOption(qs[i].id, 'A');
    if (i === 3 || i === 7) examInstance.toggleDoubt(qs[i].id);
  }

  // Simulate 15 minutes elapsed
  const savedEndTime = Date.now() + 5100 * 1000;
  examInstance.getState().examEndTime = savedEndTime;
  examInstance.saveProgress();

  // 4. Simulate Sudden Browser Crash / Restart
  // Re-instantiate engine from storage without memory state
  const recoveredEngine = createExamEngine(storage, questions, packages, env);
  const didRecover = recoveredEngine.recoverSession();
  assertEqual(didRecover, true, 'Engine must successfully recover active session');

  const recState = recoveredEngine.getState();
  assertEqual(recState.pkg.id, 'skd_hots');
  assertEqual(recState.idx, 14, 'Should restore candidate to question 14');
  assertEqual(Object.keys(recState.answers).length, 15, 'All 15 answers must be restored');
  assertEqual(recState.doubts[qs[3].id], true, 'Doubt flag on Q3 restored');
  assertEqual(recState.doubts[qs[7].id], true, 'Doubt flag on Q7 restored');
  assert(recState.secondsLeft >= 5098 && recState.secondsLeft <= 5102, 'Remaining time restored from wall-clock');

  // 5. Complete remaining questions and finish
  for (let i = 15; i < 110; i++) {
    recoveredEngine.selectOption(qs[i].id, 'B');
  }

  const finalHistory = recoveredEngine.finish();
  assertEqual(finalHistory.metrics.answeredCount, 110);
  assertEqual(finalHistory.metrics.emptyCount, 0);
  assertEqual(storage.getActiveExamSnapshot(), null, 'Snapshot deleted on clean finish');
  assertEqual(storage.getHistory().length, 1);
});

// Scenario 3: Multi-Candidate Device Sharing
suite.test('Scenario 3: Multi-Candidate Device Sharing (Candidate A completes -> Logout -> Candidate B registers & completes -> Profile and History Isolation)', () => {
  const env = createMockEnvironment();
  const storage = createStorage(env);
  const auth = createAuth(storage, env);

  // 1. Candidate A registers and completes Exam
  const candA = auth.register({
    nama: 'Ahmad Fauzi',
    email: 'ahmad@fauzi.id',
    noHp: '081111222333',
    pin: '111222'
  }).user;

  let examA = createExamEngine(storage, questions, packages, env);
  examA.start('skd_hots', 'cat');
  examA.selectOption(examA.getState().questions[0].id, 'A');
  examA.finish();

  assertEqual(storage.getHistory(candA.id).length, 1);

  // 2. Candidate A logs out
  auth.logout();
  assertEqual(storage.getActiveSession(), null);
  assertEqual(storage.getActiveUser(), null);

  // 3. Candidate B registers on same computer
  const candB = auth.register({
    nama: 'Bella Safira',
    email: 'bella@safira.id',
    noHp: '082222333444',
    pin: '333444'
  }).user;
  assertEqual(storage.getActiveUser().nama, 'Bella Safira');

  let examB = createExamEngine(storage, questions, packages, env);
  examB.start('skd_p1', 'cat');
  examB.selectOption(examB.getState().questions[0].id, 'C');
  examB.finish();

  // 4. Verify History Isolation
  const histA = storage.getHistory(candA.id);
  const histB = storage.getHistory(candB.id);

  assertEqual(histA.length, 1);
  assertEqual(histA[0].userNama, 'Ahmad Fauzi');
  assertEqual(histA[0].pkgId, 'skd_hots');

  assertEqual(histB.length, 1);
  assertEqual(histB[0].userNama, 'Bella Safira');
  assertEqual(histB[0].pkgId, 'skd_p1');

  // 5. Candidate B logs out, Candidate A logs back in
  auth.logout();
  const loginA = auth.login({ identifier: '081111222333', pin: '111222' });
  assertEqual(loginA.success, true);
  assertEqual(storage.getActiveUser().nama, 'Ahmad Fauzi');
  assertEqual(storage.getHistory(storage.getActiveUser().id).length, 1);
});

// Scenario 4: Passing Grade Boundary Matrix
suite.test('Scenario 4: Passing Grade Boundary Matrix (Candidate 1: TWK 64 Fail; Candidate 2: TIU 79 Fail; Candidate 3: TKP 165 Fail; Candidate 4: 65/80/166 Exactly Pass; Candidate 5: Perfect 550 Pass)', () => {
  const scoring = createScoring();

  // Matrix:
  const matrix = [
    {
      label: 'Candidate 1 (TWK 64 Fail)',
      scores: { TWK: 64, TIU: 110, TKP: 180 },
      expected: { passTWK: false, passTIU: true, passTKP: true, passAll: false, isCompetitive: false }
    },
    {
      label: 'Candidate 2 (TIU 79 Fail)',
      scores: { TWK: 85, TIU: 79, TKP: 185 },
      expected: { passTWK: true, passTIU: false, passTKP: true, passAll: false, isCompetitive: false }
    },
    {
      label: 'Candidate 3 (TKP 165 Fail)',
      scores: { TWK: 90, TIU: 120, TKP: 165 },
      expected: { passTWK: true, passTIU: true, passTKP: false, passAll: false, isCompetitive: false }
    },
    {
      label: 'Candidate 4 (Exact Passing Grade: 65/80/166)',
      scores: { TWK: 65, TIU: 80, TKP: 166 },
      expected: { passTWK: true, passTIU: true, passTKP: true, passAll: true, isCompetitive: false }
    },
    {
      label: 'Candidate 5 (Perfect Score: 150/175/225 = 550)',
      scores: { TWK: 150, TIU: 175, TKP: 225 },
      expected: { passTWK: true, passTIU: true, passTKP: true, passAll: true, isCompetitive: true }
    }
  ];

  for (const c of matrix) {
    const verdict = scoring.evaluatePassingGrade(c.scores);
    assertEqual(verdict.passTWK, c.expected.passTWK, `${c.label} passTWK mismatch`);
    assertEqual(verdict.passTIU, c.expected.passTIU, `${c.label} passTIU mismatch`);
    assertEqual(verdict.passTKP, c.expected.passTKP, `${c.label} passTKP mismatch`);
    assertEqual(verdict.passAll, c.expected.passAll, `${c.label} passAll mismatch`);
    assertEqual(verdict.isCompetitive, c.expected.isCompetitive, `${c.label} isCompetitive mismatch`);
  }
});

// Scenario 5: Mobile Viewport Responsiveness & Asset Parity
suite.test('Scenario 5: Mobile Viewport Responsiveness & Deployment Asset Parity', () => {
  const rootDir = path.resolve(__dirname, '../../');

  // 1. Root Deployment Parity: _headers and Cloudflare Workers SPA config
  const headersPath = path.join(rootDir, '_headers');
  const redirectsPath = path.join(rootDir, '_redirects');
  const cfWranglerPath = path.join(rootDir, 'wrangler.jsonc');

  assert(fs.existsSync(headersPath), '_headers must exist at root for Cloudflare security headers');
  assert(!fs.existsSync(redirectsPath), '_redirects must not exist at root on Workers (avoids Wrangler error 100324)');

  const headersContent = fs.readFileSync(headersPath, 'utf8');
  assert(headersContent.includes('X-Frame-Options: SAMEORIGIN'), '_headers must include security frame options');
  assert(headersContent.includes('X-Content-Type-Options: nosniff'), '_headers must include nosniff');

  assert(fs.existsSync(cfWranglerPath), 'wrangler.jsonc must exist at root for Cloudflare Workers');
  const cfWranglerCfg = JSON.parse(fs.readFileSync(cfWranglerPath, 'utf8'));
  assert(cfWranglerCfg.assets && cfWranglerCfg.assets.directory === '.', 'wrangler.jsonc assets.directory must be .');
  assert(cfWranglerCfg.assets && cfWranglerCfg.assets.not_found_handling === 'single-page-application', 'wrangler.jsonc must enable single-page-application fallback');

  // 2. Vercel & Wrangler config parity
  const vercelPath = path.join(rootDir, 'vercel.json');
  assert(fs.existsSync(vercelPath), 'vercel.json must exist');
  const vercelCfg = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  assert(vercelCfg.routes && vercelCfg.routes.some((r) => r.dest === '/index.html'));

  // 3. Design Tokens & Mobile Responsive CSS Inspection
  const tokensPath = path.join(rootDir, 'css/tokens.css');
  assert(fs.existsSync(tokensPath), 'css/tokens.css must exist');
  const tokensContent = fs.readFileSync(tokensPath, 'utf8');
  assert(tokensContent.includes('--color-primary') || tokensContent.includes('--primary'), 'Tokens must define primary color');

  const examCssPath = path.join(rootDir, 'css/exam.css');
  assert(fs.existsSync(examCssPath), 'css/exam.css must exist');
  const examCssContent = fs.readFileSync(examCssPath, 'utf8');

  // Must NOT contain the monolithic hardcoded 310px !important grid lock
  assert(
    !examCssContent.includes('minmax(0, 1fr) 310px !important'),
    'css/exam.css must NOT contain hardcoded minmax(0, 1fr) 310px !important'
  );

  // Must contain responsive media query for mobile/tablet screens
  assert(
    examCssContent.includes('@media') || examCssContent.includes('minmax') || examCssContent.includes('grid-template-columns'),
    'css/exam.css must contain responsive grid rules'
  );
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
