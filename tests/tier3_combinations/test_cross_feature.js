/**
 * tests/tier3_combinations/test_cross_feature.js
 * Tier 3 Cross-Feature Combination Tests: Pairwise Interactions across Auth, Exam, Storage & History
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
  assertEqual,
  assertNotEqual
} = require('../harness');

const suite = createSuite('Tier 3: Cross-Feature Pairwise Combinations');

let env, storage, auth, questions, packages, exam;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
  auth = createAuth(storage, env);
  questions = loadQuestions();
  packages = loadPackages();
  exam = createExamEngine(storage, questions, packages, env);
});

// 1. Auth + Exam Engine: Candidate identity binding
suite.test('Auth + Exam: Registered candidate details are bound to active exam session', () => {
  const reg = auth.register({
    nama: 'Rizky Ramadhan',
    email: 'rizky@cat.id',
    noHp: '081234567899',
    pin: '123456'
  });

  exam.start('skd_hots', 'cat');
  const snap = storage.getActiveExamSnapshot();

  assertEqual(snap.userId, reg.user.id);
  const activeUser = storage.getActiveUser();
  assertEqual(activeUser.nama, 'Rizky Ramadhan');
});

// 2. Auth + Exam Finish: History entry identity tagging
suite.test('Auth + Exam Finish: Completed exam history tags active candidate metadata', () => {
  auth.register({
    nama: 'Nadia Salsabila',
    email: 'nadia@cat.id',
    noHp: '085612345678',
    pin: '654321'
  });

  exam.start('skd_hots', 'cat');
  const history = exam.finish();

  assertEqual(history.userNama, 'Nadia Salsabila');
  assertEqual(history.userNoPeserta, '27-01-085612345678');
  assert(history.userId.startsWith('USR-'));
});

// 3. Storage + Auto-save: Isolation between snapshot and user database
suite.test('Storage + Auto-save: Saving active exam snapshot does not alter cat_users_db', () => {
  auth.register({ nama: 'Yoga', email: 'yoga@cat.id', noHp: '087812345678', pin: '111111' });
  const usersBefore = JSON.stringify(storage.getUsers());

  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;
  exam.selectOption(qs[0].id, 'A');
  exam.selectOption(qs[1].id, 'B');

  const usersAfter = JSON.stringify(storage.getUsers());
  assertEqual(usersBefore, usersAfter, 'User database must remain unchanged during auto-save');
});

// 4. Auto-save + Logout: Logout preserves exam snapshot and candidate account
suite.test('Auto-save + Logout: Logging out during exam clears session pointer but preserves snapshot', () => {
  auth.register({ nama: 'Zulfikar', email: 'zul@cat.id', noHp: '081912345678', pin: '222222' });
  exam.start('skd_hots', 'cat');
  exam.selectOption(exam.getState().questions[0].id, 'E');

  auth.logout();
  assertEqual(storage.getActiveSession(), null);

  // Active exam snapshot must remain in storage
  const snap = storage.getActiveExamSnapshot();
  assert(snap, 'Snapshot must persist after logout');
  assertEqual(snap.answers[exam.getState().questions[0].id], 'E');
});

// 5. Multi-User Session Switching: Independent accounts and sessions
suite.test('Multi-User Session Switching: User A and User B maintain completely isolated states', () => {
  // User A
  auth.register({ nama: 'User Alpha', email: 'alpha@cat.id', noHp: '081100000001', pin: '111111' });
  exam.start('skd_hots', 'cat');
  exam.selectOption(exam.getState().questions[0].id, 'A');
  exam.finish();
  auth.logout();

  // User B
  auth.register({ nama: 'User Beta', email: 'beta@cat.id', noHp: '081100000002', pin: '222222' });
  exam.start('skd_p1', 'cat');
  exam.selectOption(exam.getState().questions[0].id, 'C');
  exam.finish();

  const alphaHistory = storage.getHistory().filter((h) => h.userNama === 'User Alpha');
  const betaHistory = storage.getHistory().filter((h) => h.userNama === 'User Beta');

  assertEqual(alphaHistory.length, 1);
  assertEqual(alphaHistory[0].pkgId, 'skd_hots');
  assertEqual(betaHistory.length, 1);
  assertEqual(betaHistory[0].pkgId, 'skd_p1');
});

// 6. Storage + Scoring + History: Accuracy pipeline
suite.test('Storage + Scoring + History: Exam finish accurately passes calculated scores to history store', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  // Answer first 3 TWK questions correctly (15 points)
  for (let i = 0; i < 3; i++) {
    exam.selectOption(qs[i].id, qs[i].answer);
  }

  const hist = exam.finish();
  assertEqual(hist.scoresByGroup.TWK, 15);
  assertEqual(hist.totalScore, 15);

  const stored = storage.getHistory()[0];
  assertEqual(stored.scoresByGroup.TWK, 15);
  assertEqual(stored.totalScore, 15);
});

// 7. History + Review Mode: Restores original answers
suite.test('History + Review: Reviewing completed attempt displays original answers from ledger', () => {
  exam.start('skd_hots', 'cat');
  const q0 = exam.getState().questions[0];
  const q1 = exam.getState().questions[1];

  exam.selectOption(q0.id, 'B');
  exam.selectOption(q1.id, 'D');

  const history = exam.finish();

  const retrieved = storage.getHistory()[0];
  assertEqual(retrieved.answersLedger[q0.id].chosen, 'B');
  assertEqual(retrieved.answersLedger[q1.id].chosen, 'D');
});

// 8. Review Mode + Doubt Flag preservation
suite.test('Review Mode + Doubt Flag: Preserves doubt statuses in review ledger', () => {
  exam.start('skd_hots', 'cat');
  const q0 = exam.getState().questions[0];

  exam.selectOption(q0.id, 'C');
  exam.toggleDoubt(q0.id);

  const history = exam.finish();
  assertEqual(history.metrics.doubtCount, 1);
  assertEqual(history.metrics.answeredCount, 1);
});

// 9. Exam Engine: Rapid Answer Switching consistency
suite.test('Exam Engine: Rapid answer mutations preserve consistent snapshot and memory state', () => {
  exam.start('skd_hots', 'cat');
  const qId = exam.getState().questions[0].id;

  exam.selectOption(qId, 'A');
  exam.selectOption(qId, 'B');
  exam.selectOption(qId, 'C');
  exam.clearAnswer(qId);
  exam.selectOption(qId, 'E');

  assertEqual(exam.getState().answers[qId], 'E');
  const snap = storage.getActiveExamSnapshot();
  assertEqual(snap.answers[qId], 'E');
});

// 10. Timer Pause/Resume across simulated reload
suite.test('Timer + Storage: Simulated reload at t=30min restores 70min remaining time', () => {
  exam.start('skd_hots', 'cat');
  const state = exam.getState();

  // Advance time by 30 minutes (1800s)
  state.examEndTime = Date.now() + 4200 * 1000;
  exam.selectOption(state.questions[0].id, 'A');
  exam.saveProgress();

  // Reload
  const freshExam = createExamEngine(storage, questions, packages, env);
  freshExam.recoverSession();

  const rem = freshExam.getState().secondsLeft;
  assert(rem >= 4198 && rem <= 4202, `Expected ~4200s, got ${rem}`);
  assertEqual(freshExam.getState().answers[state.questions[0].id], 'A');
});

// 11. History Retrieval filtered by userId
suite.test('History Retrieval: Filtered query returns only target candidate history', () => {
  storage.saveHistoryEntry({ id: 'H-1', userId: 'USER-1', totalScore: 350 });
  storage.saveHistoryEntry({ id: 'H-2', userId: 'USER-2', totalScore: 450 });
  storage.saveHistoryEntry({ id: 'H-3', userId: 'USER-1', totalScore: 380 });

  const user1Hist = storage.getHistory('USER-1');
  assertEqual(user1Hist.length, 2);
  assert(user1Hist.every((h) => h.userId === 'USER-1'));

  const user2Hist = storage.getHistory('USER-2');
  assertEqual(user2Hist.length, 1);
  assertEqual(user2Hist[0].userId, 'USER-2');
});

// 12. Exam finish cleans up snapshot
suite.test('Exam Engine + Storage: Finishing exam atomically saves history and removes snapshot', () => {
  exam.start('skd_hots', 'cat');
  assert(storage.getActiveExamSnapshot() !== null);
  assertEqual(storage.getHistory().length, 0);

  exam.finish();

  assertEqual(storage.getActiveExamSnapshot(), null);
  assertEqual(storage.getHistory().length, 1);
});

// 13. Anonymous candidate exam completion
suite.test('Anonymous Candidate: Candidate without registration completes exam with ANON identity', () => {
  exam.start('skd_hots', 'cat');
  const hist = exam.finish();

  assertEqual(hist.userId, 'ANON');
  assertEqual(hist.userNama, 'Peserta Mandiri');
  assertEqual(storage.getHistory().length, 1);
});

// 14. Legacy Profile Migration + Exam Engine interaction
suite.test('Legacy Migration + Exam Engine: Migrated candidate seamlessly starts exam', () => {
  env.localStorage.setItem(
    'cat_cpns_user_profile',
    JSON.stringify({
      id: 'LEG-1',
      nama: 'Legacy Irkham',
      noHp: '087784800668'
    })
  );

  storage.migrateLegacy();
  const activeUser = storage.getActiveUser();
  assertEqual(activeUser.nama, 'Legacy Irkham');

  exam.start('skd_hots', 'cat');
  const hist = exam.finish();

  assertEqual(hist.userNama, 'Legacy Irkham');
  assertEqual(hist.userId, 'LEG-1');
});

// 15. Doubt and Clear toggles preserve mathematical invariant
suite.test('Grid Navigation: Rapid doubt and clear actions maintain partition invariant (confident + doubt + empty = 110)', () => {
  exam.start('skd_hots', 'cat');
  const qs = exam.getState().questions;

  for (let i = 0; i < 20; i++) {
    exam.selectOption(qs[i].id, 'A');
    if (i % 2 === 0) exam.toggleDoubt(qs[i].id);
    if (i % 5 === 0) exam.clearAnswer(qs[i].id);
  }

  const stats = exam.getGridStats();
  assertEqual(
    stats.answeredConfidentCount + stats.doubtCount + stats.emptyCount,
    110,
    'Sum of grid partitions must strictly equal 110'
  );
});

// 16. Proctoring violations track without affecting academic score
suite.test('Proctoring Telemetry + Score: Violations flag isClean=false without mutating academic score', () => {
  exam.start('skd_hots', 'cat');
  const q0 = exam.getState().questions[0];
  exam.selectOption(q0.id, q0.answer); // 5 points

  exam.getState().tabSwitches = 4;
  exam.getState().fullscreenExits = 2;

  const history = exam.finish();

  assertEqual(history.violations.total, 6);
  assertEqual(history.violations.isClean, false);
  assertEqual(history.scoresByGroup.TWK, 5, 'Violations do not deduct academic points');
});

// 17. Anti-copy, contextmenu ("Ask AI"/"Copy"), selection & shortcut lock during active exam
suite.test('Proctor Security: Blocks right-click, copy, selection & devtools shortcuts during active exam', () => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');

  const screenExamEl = env.document.createElement('div');
  screenExamEl.id = 'screenExam';
  screenExamEl.classList.add('hidden');
  env.document.body.appendChild(screenExamEl);

  const toastEl = env.document.createElement('div');
  toastEl.id = 'proctorSecurityToast';
  toastEl.classList.add('hidden');
  const toastTextEl = env.document.createElement('span');
  toastTextEl.id = 'proctorSecurityToastText';
  toastEl.appendChild(toastTextEl);
  env.document.body.appendChild(toastEl);

  let clearedRanges = 0;
  env.window.getSelection = () => ({
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: screenExamEl,
    removeAllRanges() { clearedRanges++; }
  });
  env.window.Exam = exam;

  const proctorSrc = fs.readFileSync(path.resolve(__dirname, '../../js/proctor.js'), 'utf8');
  const sandbox = {
    window: env.window,
    document: env.document,
    navigator: env.window.navigator,
    setTimeout: env.window.setTimeout,
    clearTimeout: env.window.clearTimeout,
    setInterval: env.window.setInterval,
    clearInterval: env.window.clearInterval,
    Date,
    Math,
    JSON,
    console
  };
  vm.runInNewContext(proctorSrc, sandbox);
  const Proctor = sandbox.window.Proctor;

  const makeEvt = (type, extra = {}) => {
    const evt = {
      type,
      target: screenExamEl,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      ...extra
    };
    return evt;
  };

  // Before exam starts: allowed
  const preCtxEvt = makeEvt('contextmenu');
  env.document.dispatchEvent(preCtxEvt);
  assertEqual(Proctor.isExamCopyProtected(), false, 'Protection inactive on landing');
  assertEqual(preCtxEvt.defaultPrevented, false, 'Context menu allowed before exam');

  // Start active CAT exam & enter exam screen
  exam.start('skd_hots', 'cat');
  screenExamEl.classList.remove('hidden');
  assertEqual(Proctor.syncCopyProtection(), true, 'syncCopyProtection enables lock during active CAT');
  assert(env.document.body.classList.contains('exam-copy-locked'), 'body gets exam-copy-locked class');

  const ctxEvt = makeEvt('contextmenu');
  env.document.dispatchEvent(ctxEvt);
  assertEqual(ctxEvt.defaultPrevented, true, 'Right-click contextmenu must be blocked during CAT exam');
  assertEqual(toastEl.classList.contains('hidden'), false, 'Security toast displays on blocked right-click');

  let clipboardValue = null;
  const copyEvt = makeEvt('copy', {
    clipboardData: { setData(_, val) { clipboardValue = val; } }
  });
  env.document.dispatchEvent(copyEvt);
  assertEqual(copyEvt.defaultPrevented, true, 'Copy event blocked during CAT exam');
  assert(typeof clipboardValue === 'string' && clipboardValue.length > 0, 'Clipboard payload overwritten');

  const selEvt = makeEvt('selectstart');
  env.document.dispatchEvent(selEvt);
  assertEqual(selEvt.defaultPrevented, true, 'Text selection start blocked during CAT exam');

  const dragEvt = makeEvt('dragstart');
  env.document.dispatchEvent(dragEvt);
  assertEqual(dragEvt.defaultPrevented, true, 'Drag start blocked during CAT exam');

  ['c', 'a', 'u', 'p', 's'].forEach((k) => {
    const keyEvt = makeEvt('keydown', { key: k, ctrlKey: true });
    env.document.dispatchEvent(keyEvt);
    assertEqual(keyEvt.defaultPrevented, true, `Ctrl+${k.toUpperCase()} blocked during exam`);
  });

  const f12Evt = makeEvt('keydown', { key: 'F12', keyCode: 123 });
  env.document.dispatchEvent(f12Evt);
  assertEqual(f12Evt.defaultPrevented, true, 'F12 blocked during exam');

  const devtoolsEvt = makeEvt('keydown', { key: 'I', ctrlKey: true, shiftKey: true });
  env.document.dispatchEvent(devtoolsEvt);
  assertEqual(devtoolsEvt.defaultPrevented, true, 'Ctrl+Shift+I blocked during exam');
  assert(clearedRanges > 0, 'Selection ranges actively cleared');

  // After finishing exam: unlocked
  exam.finish();
  screenExamEl.classList.add('hidden');
  assertEqual(Proctor.syncCopyProtection(), false, 'Protection turns off when exam finishes');
  assertEqual(env.document.body.classList.contains('exam-copy-locked'), false, 'body removes exam-copy-locked');
  assertEqual(toastEl.classList.contains('hidden'), true, 'Security toast hides cleanly on exit');

  const postCtxEvt = makeEvt('contextmenu');
  env.document.dispatchEvent(postCtxEvt);
  assertEqual(postCtxEvt.defaultPrevented, false, 'Context menu restored after exam finish');
});

// 18. Study mode locked while Review mode allows copying explanations
suite.test('Proctor Security: Blocks copy in Study mode and unlocks in Review mode + CSS guard exists', () => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');

  const screenExamEl = env.document.createElement('div');
  screenExamEl.id = 'screenExam';
  env.document.body.appendChild(screenExamEl);

  env.window.Exam = exam;
  const proctorSrc = fs.readFileSync(path.resolve(__dirname, '../../js/proctor.js'), 'utf8');
  const sandbox = {
    window: env.window,
    document: env.document,
    navigator: env.window.navigator,
    setTimeout: env.window.setTimeout,
    clearTimeout: env.window.clearTimeout,
    setInterval: env.window.setInterval,
    clearInterval: env.window.clearInterval,
    Date,
    Math,
    JSON,
    console
  };
  vm.runInNewContext(proctorSrc, sandbox);
  const Proctor = sandbox.window.Proctor;

  exam.start('skd_hots', 'study');
  assertEqual(Proctor.isExamCopyProtected(), true, 'Study mode active exam protects question text');

  const history = exam.finish();
  exam.enterReviewMode({
    pkg: exam.getState().pkg,
    questionsList: history ? loadQuestions().slice(0, 10) : [],
    answersMap: {},
    onlyMistakes: false
  });
  assertEqual(Proctor.syncCopyProtection(), false, 'Review mode unlocks copy/right-click');

  const examCss = fs.readFileSync(path.resolve(__dirname, '../../css/exam.css'), 'utf8');
  assert(examCss.includes('body.exam-copy-locked #screenExam'), 'CSS lock selector present in css/exam.css');
  assert(examCss.includes('user-select: none !important'), 'CSS enforces user-select: none during active exam');
  assert(examCss.includes('-webkit-touch-callout: none !important'), 'CSS disables mobile touch callout during exam');
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
