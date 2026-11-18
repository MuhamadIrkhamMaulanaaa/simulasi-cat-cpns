/**
 * tests/tier2_boundaries/test_timer_recovery.js
 * Tier 2 Boundary Tests: Wall-Clock Timer Resilience & Mid-Exam Crash Recovery
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

const suite = createSuite('Tier 2: Timer Resilience & Crash Snapshot Recovery');

let env, storage, questions, packages, exam;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
  questions = loadQuestions();
  packages = loadPackages();
  exam = createExamEngine(storage, questions, packages, env);
});

// 1. Wall-clock timer immunity to background pause
suite.test('Timer derived from Date.now() is immune to background tab throttling', () => {
  exam.start('skd_hots', 'cat');
  const state = exam.getState();
  const originalEnd = state.examEndTime;

  // Simulate background tab freeze: 300 seconds (5 mins) pass in real time
  state.examEndTime = originalEnd - 300 * 1000;
  const rem = exam.updateTime();

  // 6000 - 300 = 5700
  assertEqual(rem, 5700, 'Timer should have decremented exactly 300 seconds');
});

// 2. Timer clamping at 0
suite.test('Timer strictly clamps at 0 seconds and does not produce negative numbers', () => {
  exam.start('skd_hots', 'cat');
  const state = exam.getState();

  // Simulate exam end time past current time
  state.examEndTime = Date.now() - 5000; // 5 seconds expired
  const rem = exam.updateTime();

  assertEqual(rem, 0, 'Remaining time must clamp at 0');
});

// 3. Auto-save snapshot on answer change
suite.test('Auto-save snapshot records latest answer choice immediately', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  exam.selectOption(qs[0].id, 'D');

  const snap = storage.getActiveExamSnapshot();
  assert(snap);
  assertEqual(snap.answers[qs[0].id], 'D');
});

// 4. Auto-save snapshot on doubt change
suite.test('Auto-save snapshot records doubt toggle immediately', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  exam.toggleDoubt(qs[0].id);

  const snap = storage.getActiveExamSnapshot();
  assertEqual(snap.doubts[qs[0].id], true);
});

// 5. Auto-save snapshot on navigation
suite.test('Auto-save snapshot records current question index navigation', () => {
  exam.start('skd_hots', 'cat');

  exam.jumpTo(42);

  const snap = storage.getActiveExamSnapshot();
  assertEqual(snap.currentIdx, 42);
});

// 6. Crash recovery restores package ID
suite.test('Crash recovery restores package ID correctly from snapshot', () => {
  exam.start('skd_p1', 'cat');

  // Simulate browser restart by instantiating new exam engine on same storage
  const newExam = createExamEngine(storage, questions, packages, env);
  const recovered = newExam.recoverSession();

  assertEqual(recovered, true, 'Recovery must succeed');
  assertEqual(newExam.getState().pkg.id, 'skd_p1');
});

// 7. Crash recovery restores remaining time from wall-clock
suite.test('Crash recovery calculates remaining time from original examEndTime without resetting duration', () => {
  exam.start('skd_hots', 'cat');
  const state = exam.getState();
  // 50 minutes left (3000s)
  state.examEndTime = Date.now() + 3000 * 1000;
  exam.saveProgress();

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();

  const rem = freshExam.getState().secondsLeft;
  assert(rem >= 2998 && rem <= 3002, `Expected ~3000s, got ${rem}`);
});

// 8. Crash recovery restores answer map
suite.test('Crash recovery restores full answers map completely', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  exam.selectOption(qs[0].id, 'A');
  exam.selectOption(qs[5].id, 'C');
  exam.selectOption(qs[10].id, 'E');

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();

  const ans = freshExam.getState().answers;
  assertEqual(ans[qs[0].id], 'A');
  assertEqual(ans[qs[5].id], 'C');
  assertEqual(ans[qs[10].id], 'E');
});

// 9. Crash recovery restores doubts map
suite.test('Crash recovery restores doubts map completely', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  exam.toggleDoubt(qs[2].id);
  exam.toggleDoubt(qs[7].id);

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();

  const dbt = freshExam.getState().doubts;
  assertEqual(dbt[qs[2].id], true);
  assertEqual(dbt[qs[7].id], true);
  assertEqual(dbt[qs[0].id], undefined);
});

// 10. Crash recovery restores current question index
suite.test('Crash recovery restores candidate last active question index', () => {
  exam.start('skd_hots', 'cat');
  exam.jumpTo(68);

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();

  assertEqual(freshExam.getState().idx, 68);
});

// 11. Crash recovery with expired time
suite.test('Crash recovery when exam period has fully elapsed marks isActive false and secondsLeft 0', () => {
  exam.start('skd_hots', 'cat');
  exam.getState().examEndTime = Date.now() - 10000; // 10s expired
  exam.saveProgress();

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();

  assertEqual(freshExam.getState().secondsLeft, 0);
  assertEqual(freshExam.getState().isActive, false);
});

// 12. Corrupt snapshot in storage handled gracefully
suite.test('Crash recovery handles corrupt JSON in cat_active_exam_session without throwing', () => {
  env.localStorage.setItem('cat_active_exam_session', '!!!broken_json###');

  const freshExam = createExamEngine(storage, questions, packages, env);
  const ok = freshExam.recoverSession();

  assertEqual(ok, false, 'Corrupt snapshot should return false');
});

// 13. Snapshot with unknown package ID
suite.test('Crash recovery handles unknown package ID safely', () => {
  storage.saveActiveExamSnapshot({
    pkgId: 'non_existent_package_999',
    examEndTime: Date.now() + 60000
  });

  const freshExam = createExamEngine(storage, questions, packages, env);
  const ok = freshExam.recoverSession();

  assertEqual(ok, false);
});

// 14. Clean finish clears snapshot
suite.test('Clean exam submission permanently clears cat_active_exam_session', () => {
  exam.start('skd_hots', 'cat');
  assert(storage.getActiveExamSnapshot() !== null);

  exam.finish();
  assertEqual(storage.getActiveExamSnapshot(), null);

  const freshExam = createExamEngine(storage, questions, packages, env);
  const ok = freshExam.recoverSession();
  assertEqual(ok, false, 'No session should be recoverable after clean finish');
});

// 15. Tab switches violation tracking in snapshot
suite.test('Snapshot records tab switches proctoring violation counts', () => {
  exam.start('skd_hots', 'cat');
  exam.getState().tabSwitches = 5;
  exam.saveProgress();

  const snap = storage.getActiveExamSnapshot();
  assertEqual(snap.tabSwitches, 5);

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();
  assertEqual(freshExam.getState().tabSwitches, 5);
});

// 16. Fullscreen exits violation tracking in snapshot
suite.test('Snapshot records fullscreen exit violation counts', () => {
  exam.start('skd_hots', 'cat');
  exam.getState().fullscreenExits = 3;
  exam.saveProgress();

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();
  assertEqual(freshExam.getState().fullscreenExits, 3);
});

// 17. lastSavedAt timestamp formatting
suite.test('Snapshot contains valid ISO-8601 lastSavedAt timestamp', () => {
  exam.start('skd_hots', 'cat');
  const snap = storage.getActiveExamSnapshot();
  assert(snap.lastSavedAt);
  assert(!isNaN(Date.parse(snap.lastSavedAt)), 'lastSavedAt must be valid date');
});

// 18. Exam finish while in recovered state
suite.test('Exam completed from recovered session correctly saves history and terminates', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;
  exam.selectOption(qs[0].id, 'B');

  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();
  freshExam.selectOption(qs[1].id, 'C');

  const hist = freshExam.finish();
  assertEqual(hist.metrics.answeredCount, 2);
  assertEqual(storage.getActiveExamSnapshot(), null);
  assertEqual(storage.getHistory().length, 1);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
