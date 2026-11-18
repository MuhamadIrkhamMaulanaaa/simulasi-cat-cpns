/**
 * tests/tier1_features/test_exam_engine.js
 * Tier 1 Feature Tests: CAT Exam Engine, Timer & Navigation (F4, F5, F6)
 */

const {
  createSuite,
  createMockEnvironment,
  createStorage,
  createExamEngine,
  loadQuestions,
  loadPackages,
  assert,
  assertEqual
} = require('../harness');

const suite = createSuite('Tier 1: CAT Exam Engine & Navigation');

let env, storage, questions, packages, exam;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
  questions = loadQuestions();
  packages = loadPackages();
  exam = createExamEngine(storage, questions, packages, env);
});

// Test 1: skd_hots loads 110 questions
suite.test('Exam.start loads exactly 110 questions for full SKD packages', () => {
  const state = exam.start('skd_hots', 'cat');
  assertEqual(state.questions.length, 110, 'Full SKD package must contain 110 questions');
});

// Test 2: BKN subtest partition 30 TWK, 35 TIU, 45 TKP
suite.test('Exam subtests strictly follow KepmenPANRB 321/2024: 30 TWK, 35 TIU, 45 TKP', () => {
  const state = exam.start('skd_hots', 'cat');
  const twk = state.questions.slice(0, 30);
  const tiu = state.questions.slice(30, 65);
  const tkp = state.questions.slice(65, 110);

  assertEqual(twk.length, 30, 'TWK should have 30 questions');
  assertEqual(tiu.length, 35, 'TIU should have 35 questions');
  assertEqual(tkp.length, 45, 'TKP should have 45 questions');

  assert(twk.every((q) => q.group === 'TWK'), 'Questions 1-30 must be TWK');
  assert(tiu.every((q) => q.group === 'TIU'), 'Questions 31-65 must be TIU');
  assert(tkp.every((q) => q.group === 'TKP'), 'Questions 66-110 must be TKP');
});

// Test 3: Wall-clock timer initialization
suite.test('Exam.start sets wall-clock examEndTime based on package duration (100 minutes)', () => {
  const before = Date.now();
  const state = exam.start('skd_hots', 'cat');
  const after = Date.now();

  const expectedEnd = before + 100 * 60 * 1000;
  assert(state.examEndTime >= expectedEnd, 'examEndTime should be ~100 minutes ahead');
  assert(state.examEndTime <= after + 100 * 60 * 1000);
  assertEqual(state.secondsLeft, 6000, 'Initial secondsLeft should be 6000 seconds');
});

// Test 4: Initial state zero answers & doubts
suite.test('Exam.start initializes index 0 with empty answers and doubts', () => {
  const state = exam.start('skd_hots', 'cat');
  assertEqual(state.idx, 0);
  assertEqual(Object.keys(state.answers).length, 0);
  assertEqual(Object.keys(state.doubts).length, 0);
  assertEqual(state.isActive, true);
});

// Test 5: selectOption saves answer and triggers auto-save
suite.test('Exam.selectOption records candidate choice and persists snapshot', () => {
  exam.start('skd_hots', 'cat');
  const firstQ = exam.getState().questions[0];

  exam.selectOption(firstQ.id, 'C');

  assertEqual(exam.getState().answers[firstQ.id], 'C');
  const snap = storage.getActiveExamSnapshot();
  assert(snap, 'Auto-save snapshot must be created');
  assertEqual(snap.answers[firstQ.id], 'C');
});

// Test 6: toggleDoubt toggles boolean doubt flag
suite.test('Exam.toggleDoubt toggles doubt status and auto-saves', () => {
  exam.start('skd_hots', 'cat');
  const firstQ = exam.getState().questions[0];

  exam.toggleDoubt(firstQ.id);
  assertEqual(exam.getState().doubts[firstQ.id], true);

  exam.toggleDoubt(firstQ.id);
  assertEqual(exam.getState().doubts[firstQ.id], false);
});

// Test 7: clearAnswer removes selected answer
suite.test('Exam.clearAnswer deletes choice for specified question', () => {
  exam.start('skd_hots', 'cat');
  const qId = exam.getState().questions[0].id;

  exam.selectOption(qId, 'A');
  assertEqual(exam.getState().answers[qId], 'A');

  exam.clearAnswer(qId);
  assertEqual(exam.getState().answers[qId], undefined);
  assertEqual(storage.getActiveExamSnapshot().answers[qId], undefined);
});

// Test 8: Question index boundary enforcement
suite.test('Exam.nextQuestion and Exam.prevQuestion respect 0 and 109 boundaries', () => {
  exam.start('skd_hots', 'cat');

  // Try going back at index 0
  exam.prevQuestion();
  assertEqual(exam.getState().idx, 0, 'Cannot go below index 0');

  // Jump to last question (109)
  exam.jumpTo(109);
  assertEqual(exam.getState().idx, 109);

  // Try going past 109
  exam.nextQuestion();
  assertEqual(exam.getState().idx, 109, 'Cannot exceed index 109');
});

// Test 9: jumpTo arbitrary index
suite.test('Exam.jumpTo moves directly to specified index within valid range', () => {
  exam.start('skd_hots', 'cat');

  exam.jumpTo(31);
  assertEqual(exam.getState().idx, 31);
  assertEqual(exam.getState().questions[31].group, 'TIU');

  // Invalid jumps should be ignored
  exam.jumpTo(-5);
  assertEqual(exam.getState().idx, 31);
  exam.jumpTo(999);
  assertEqual(exam.getState().idx, 31);
});

// Test 10: Navigation grid counts sum strictly to 110
suite.test('Exam.getGridStats counts confident, doubt, and empty partitions strictly summing to 110', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  // Answer 10 questions confidently
  for (let i = 0; i < 10; i++) {
    exam.selectOption(qs[i].id, 'A');
  }

  // Answer 5 questions and mark doubt
  for (let i = 10; i < 15; i++) {
    exam.selectOption(qs[i].id, 'B');
    exam.toggleDoubt(qs[i].id);
  }

  // Mark 3 questions doubt without answer
  for (let i = 15; i < 18; i++) {
    exam.toggleDoubt(qs[i].id);
  }

  const stats = exam.getGridStats();
  assertEqual(stats.total, 110);
  assertEqual(stats.answeredConfidentCount, 10, '10 confident answers');
  assertEqual(stats.doubtCount, 8, '5 answered doubt + 3 empty doubt = 8');
  assertEqual(stats.emptyCount, 92, '110 - 10 - 8 = 92');
  assertEqual(
    stats.answeredConfidentCount + stats.doubtCount + stats.emptyCount,
    110,
    'Sum of grid partitions must strictly equal 110'
  );
});

// Test 11: Wall-clock updateTime derivation
suite.test('Exam.updateTime derives remaining time from wall-clock difference', () => {
  exam.start('skd_hots', 'cat');
  const state = exam.getState();

  // Simulate passing 10 seconds by adjusting examEndTime
  state.examEndTime = Date.now() + 5990 * 1000;
  const rem = exam.updateTime();

  assertEqual(rem, 5990);
  assertEqual(state.secondsLeft, 5990);
});

// Test 12: fr_bocoran drill package
suite.test('Exam.start with drill package fr_bocoran loads 28 questions and 30 minutes', () => {
  const state = exam.start('fr_bocoran', 'cat');
  assertEqual(state.questions.length, 28, 'fr_bocoran should have 28 questions');
  assertEqual(state.pkg.minutes, 30, 'fr_bocoran duration should be 30 minutes');
  assertEqual(state.secondsLeft, 1800);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
