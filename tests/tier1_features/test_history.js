/**
 * tests/tier1_features/test_history.js
 * Tier 1 Feature Tests: Exam History Persistence & Past Attempt Review (F9, F10)
 */

const {
  createSuite,
  createMockEnvironment,
  createStorage,
  createAuth,
  createExamEngine,
  loadQuestions,
  loadPackages,
  assert,
  assertEqual
} = require('../harness');

const suite = createSuite('Tier 1: Exam History Persistence & Review');

let env, storage, auth, questions, packages, exam;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
  auth = createAuth(storage, env);
  questions = loadQuestions();
  packages = loadPackages();
  exam = createExamEngine(storage, questions, packages, env);
});

// Test 1: Exam.finish saves enriched history entry
suite.test('Exam.finish generates and saves complete ExamHistoryEntry into storage', () => {
  auth.register({
    nama: 'Budi Santoso',
    email: 'budi@santoso.com',
    noHp: '081234567890',
    pin: '123456'
  });

  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  // Answer first 5 questions
  exam.selectOption(qs[0].id, 'A');
  exam.selectOption(qs[1].id, 'B');
  exam.selectOption(qs[2].id, 'C');

  const history = exam.finish();

  assert(history.id.startsWith('HIST-'));
  assertEqual(history.pkgId, 'skd_hots');
  assertEqual(history.userNama, 'Budi Santoso');
  assertEqual(history.metrics.answeredCount, 3);
  assertEqual(history.metrics.totalQuestions, 110);

  // Check saved in storage
  const saved = storage.getHistory();
  assertEqual(saved.length, 1);
  assertEqual(saved[0].id, history.id);
});

// Test 2: Subtest score breakdown in history
suite.test('ExamHistoryEntry contains full subtest score breakdown (TWK, TIU, TKP)', () => {
  exam.start('skd_hots', 'cat');
  const history = exam.finish();

  assert(history.scoresByGroup, 'Must contain scoresByGroup');
  assert('TWK' in history.scoresByGroup);
  assert('TIU' in history.scoresByGroup);
  assert('TKP' in history.scoresByGroup);
  assert(history.maxByGroup.TWK === 150);
  assert(history.maxByGroup.TIU === 175);
  assert(history.maxByGroup.TKP === 225);
});

// Test 3: Passing grade status in history
suite.test('ExamHistoryEntry contains official Passing Grade verdicts', () => {
  exam.start('skd_hots', 'cat');
  const history = exam.finish();

  assert(history.passingGrade, 'Must contain passingGrade evaluation');
  assert(typeof history.passingGrade.passTWK === 'boolean');
  assert(typeof history.passingGrade.passTIU === 'boolean');
  assert(typeof history.passingGrade.passTKP === 'boolean');
  assert(typeof history.passingGrade.passAll === 'boolean');
  assert(typeof history.passingGrade.isCompetitive === 'boolean');
});

// Test 4: Violations telemetry in history
suite.test('ExamHistoryEntry records proctoring violations and integrity status', () => {
  exam.start('skd_hots', 'cat');
  exam.getState().tabSwitches = 2;
  exam.getState().fullscreenExits = 1;

  const history = exam.finish();

  assertEqual(history.violations.tabSwitches, 2);
  assertEqual(history.violations.fullscreenExits, 1);
  assertEqual(history.violations.total, 3);
  assertEqual(history.violations.isClean, false);
});

// Test 5: Compact answers ledger in history
suite.test('ExamHistoryEntry stores compact answers ledger with chosen option and score', () => {
  exam.start('skd_hots', 'cat');
  const firstQ = exam.getState().questions[0];
  exam.selectOption(firstQ.id, firstQ.answer);

  const history = exam.finish();
  const ledgerItem = history.answersLedger[firstQ.id];

  assert(ledgerItem, 'Question must exist in answersLedger');
  assertEqual(ledgerItem.chosen, firstQ.answer);
  assertEqual(ledgerItem.score, 5);
  assertEqual(ledgerItem.correct, true);
});

// Test 6: History persistence across multiple finished exams
suite.test('Multiple finished exams persist sequentially in history ledger', () => {
  exam.start('skd_hots', 'cat');
  const h1 = exam.finish();

  exam.start('fr_bocoran', 'cat');
  const h2 = exam.finish();

  const all = storage.getHistory();
  assertEqual(all.length, 2);
  assertEqual(all[0].id, h2.id, 'Most recent exam should be first');
  assertEqual(all[1].id, h1.id);
});

// Test 7: Multi-candidate history isolation
suite.test('Candidate history is strictly isolated by userId in multi-candidate environment', () => {
  // Candidate 1
  const u1 = auth.register({
    nama: 'User Satu',
    email: 'user1@test.com',
    noHp: '081111111111',
    pin: '111111'
  }).user;
  exam.start('skd_hots', 'cat');
  exam.finish();

  // Candidate 2
  auth.logout();
  const u2 = auth.register({
    nama: 'User Dua',
    email: 'user2@test.com',
    noHp: '082222222222',
    pin: '222222'
  }).user;
  exam.start('fr_bocoran', 'cat');
  exam.finish();

  const u1History = storage.getHistory(u1.id);
  const u2History = storage.getHistory(u2.id);

  assertEqual(u1History.length, 1);
  assertEqual(u1History[0].userNama, 'User Satu');
  assertEqual(u1History[0].pkgId, 'skd_hots');

  assertEqual(u2History.length, 1);
  assertEqual(u2History[0].userNama, 'User Dua');
  assertEqual(u2History[0].pkgId, 'fr_bocoran');
});

// Test 8: Duration spent tracking
suite.test('Exam history accurately records durationSeconds spent during the exam', () => {
  exam.start('skd_hots', 'cat');
  // Simulate 120 seconds elapsed
  exam.getState().secondsLeft = 5880;

  const history = exam.finish();
  assertEqual(history.durationSeconds, 120);
  assertEqual(history.allocatedSeconds, 6000);
});

// Test 9: Active exam snapshot cleared upon finish
suite.test('Storage.clearActiveExamSnapshot is invoked when exam completes', () => {
  exam.start('skd_hots', 'cat');
  assert(storage.getActiveExamSnapshot() !== null, 'Snapshot should exist while in progress');

  exam.finish();
  assertEqual(storage.getActiveExamSnapshot(), null, 'Snapshot must be cleared on finish');
});

// Test 10: Review reconstruction joins answersLedger with static question bank
suite.test('Past attempt review mode reconstructs questions with candidate choices and explanations', () => {
  exam.start('skd_hots', 'cat');
  const q0 = exam.getState().questions[0];
  const q1 = exam.getState().questions[1];

  // q0 correct, q1 wrong
  exam.selectOption(q0.id, q0.answer);
  exam.selectOption(q1.id, q1.answer === 'A' ? 'B' : 'A');

  const history = exam.finish();

  // Reconstruct review
  const reconstructed = exam.getState().questions.map((q) => {
    const entry = history.answersLedger[q.id];
    return {
      id: q.id,
      stem: q.stem,
      options: q.options,
      chosen: entry ? entry.chosen : null,
      correctAnswer: q.answer,
      score: entry ? entry.score : 0,
      pembahasan: q.pembahasan,
      hack: q.hack
    };
  });

  assertEqual(reconstructed.length, 110);
  assertEqual(reconstructed[0].chosen, q0.answer);
  assertEqual(reconstructed[0].score, 5);
  assert(reconstructed[0].pembahasan.length > 10);
  assert(reconstructed[0].hack.length > 5);
});

// Test 11: Review onlyMistakes filters questions with score < 5
suite.test('Review mode with onlyMistakes filters questions where candidate score is less than 5', () => {
  exam.start('skd_hots', 'cat');
  const q0 = exam.getState().questions[0];
  const q1 = exam.getState().questions[1];

  // q0 correct (5 pts), q1 wrong (0 pts)
  exam.selectOption(q0.id, q0.answer);
  exam.selectOption(q1.id, q1.answer === 'A' ? 'B' : 'A');

  const history = exam.finish();

  const mistakes = exam.getState().questions.filter((q) => {
    const entry = history.answersLedger[q.id];
    return !entry || entry.score < 5;
  });

  // Since only 1 question had score 5, 109 questions have score < 5
  assertEqual(mistakes.length, 109);
  assert(mistakes.some((m) => m.id === q1.id), 'Wrong answer must be in mistakes list');
  assert(!mistakes.some((m) => m.id === q0.id), 'Correct answer must NOT be in mistakes list');
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
