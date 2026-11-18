/**
 * tests/tier1_features/test_storage.js
 * Tier 1 Feature Tests: Persistence Layer & Data Schemas (F1, F6, F9)
 */

const {
  createSuite,
  createMockEnvironment,
  createStorage,
  assert,
  assertEqual,
  assertDeepEqual
} = require('../harness');

const suite = createSuite('Tier 1: Persistence Layer & Schemas');

let env, storage;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
});

// Test 1: Empty initial state
suite.test('Storage.getUsers returns empty object on clean storage', () => {
  const users = storage.getUsers();
  assertDeepEqual(users, {});
});

// Test 2: Save and retrieve user
suite.test('Storage.saveUser persists user record in cat_users_db', () => {
  const user = {
    id: 'USR-1001',
    nama: 'Aisyah Putri',
    email: 'aisyah@example.com',
    noHp: '081234567890',
    noPeserta: '27-01-081234567890',
    pin: '123456'
  };

  storage.saveUser(user);

  const users = storage.getUsers();
  assertEqual(Object.keys(users).length, 1);
  assertEqual(users['USR-1001'].nama, 'Aisyah Putri');
  assert(users['USR-1001'].updatedAt, 'Should set updatedAt timestamp');
});

// Test 3: getUserById
suite.test('Storage.getUserById returns matching user or null', () => {
  storage.saveUser({ id: 'USR-1', nama: 'User 1' });
  storage.saveUser({ id: 'USR-2', nama: 'User 2' });

  const found = storage.getUserById('USR-2');
  assert(found, 'Should find USR-2');
  assertEqual(found.nama, 'User 2');

  const notFound = storage.getUserById('USR-999');
  assertEqual(notFound, null);
});

// Test 4: Update user
suite.test('Storage.saveUser merges updates without losing existing properties', () => {
  storage.saveUser({ id: 'USR-1', nama: 'Old Name', email: 'user@cat.id', pin: '111111' });
  storage.saveUser({ id: 'USR-1', nama: 'New Name' });

  const updated = storage.getUserById('USR-1');
  assertEqual(updated.nama, 'New Name');
  assertEqual(updated.email, 'user@cat.id');
  assertEqual(updated.pin, '111111');
});

// Test 5: Active session roundtrip
suite.test('Storage.setActiveSession and getActiveSession roundtrip', () => {
  assertEqual(storage.getActiveSession(), null);

  const session = { userId: 'USR-100', loginAt: new Date().toISOString() };
  storage.setActiveSession(session);

  const retrieved = storage.getActiveSession();
  assert(retrieved);
  assertEqual(retrieved.userId, 'USR-100');
});

// Test 6: Clear active session
suite.test('Storage.clearActiveSession clears session key', () => {
  storage.setActiveSession({ userId: 'USR-100', loginAt: new Date().toISOString() });
  storage.clearActiveSession();
  assertEqual(storage.getActiveSession(), null);
});

// Test 7: getActiveUser
suite.test('Storage.getActiveUser resolves user linked to active session', () => {
  storage.saveUser({ id: 'USR-777', nama: 'Active Candidate', noPeserta: '27-01-08777' });
  storage.setActiveSession({ userId: 'USR-777', loginAt: new Date().toISOString() });

  const active = storage.getActiveUser();
  assert(active);
  assertEqual(active.nama, 'Active Candidate');
  assertEqual(active.noPeserta, '27-01-08777');
});

// Test 8: Active exam snapshot roundtrip
suite.test('Storage.saveActiveExamSnapshot and getActiveExamSnapshot roundtrip', () => {
  assertEqual(storage.getActiveExamSnapshot(), null);

  const snapshot = {
    pkgId: 'skd_hots',
    mode: 'cat',
    userId: 'USR-777',
    examEndTime: Date.now() + 60000,
    answers: { TWK_1: 'A', TWK_2: 'B' },
    doubts: { TWK_1: true },
    currentIdx: 2
  };
  storage.saveActiveExamSnapshot(snapshot);

  const recovered = storage.getActiveExamSnapshot();
  assert(recovered);
  assertEqual(recovered.pkgId, 'skd_hots');
  assertEqual(recovered.answers.TWK_1, 'A');
  assertEqual(recovered.doubts.TWK_1, true);
  assertEqual(recovered.currentIdx, 2);
});

// Test 9: Clear active exam snapshot
suite.test('Storage.clearActiveExamSnapshot removes active exam session', () => {
  storage.saveActiveExamSnapshot({ pkgId: 'skd_hots', answers: {} });
  storage.clearActiveExamSnapshot();
  assertEqual(storage.getActiveExamSnapshot(), null);
});

// Test 10: History entry persistence
suite.test('Storage.saveHistoryEntry persists exam records to cat_exam_history', () => {
  assertEqual(storage.getHistory().length, 0);

  const entry = {
    id: 'HIST-001',
    userId: 'USR-1',
    pkgId: 'skd_hots',
    pkgTitle: 'Tryout SKD HOTS',
    totalScore: 450,
    maxScore: 550,
    scoresByGroup: { TWK: 110, TIU: 140, TKP: 200 }
  };
  storage.saveHistoryEntry(entry);

  const list = storage.getHistory();
  assertEqual(list.length, 1);
  assertEqual(list[0].id, 'HIST-001');
  assertEqual(list[0].totalScore, 450);
});

// Test 11: History filtered by userId
suite.test('Storage.getHistory(userId) filters records by specific user', () => {
  storage.saveHistoryEntry({ id: 'H1', userId: 'USR-A', totalScore: 300 });
  storage.saveHistoryEntry({ id: 'H2', userId: 'USR-B', totalScore: 400 });
  storage.saveHistoryEntry({ id: 'H3', userId: 'USR-A', totalScore: 420 });

  const userAHistory = storage.getHistory('USR-A');
  assertEqual(userAHistory.length, 2);
  assertEqual(userAHistory[0].userId, 'USR-A');
  assertEqual(userAHistory[1].userId, 'USR-A');

  const userBHistory = storage.getHistory('USR-B');
  assertEqual(userBHistory.length, 1);
  assertEqual(userBHistory[0].id, 'H2');
});

// Test 12: History pruning to 50 items
suite.test('Storage.saveHistoryEntry enforces pruning to maximum 50 entries', () => {
  for (let i = 1; i <= 60; i++) {
    storage.saveHistoryEntry({ id: `HIST-${i}`, totalScore: i * 5 });
  }

  const list = storage.getHistory();
  assertEqual(list.length, 50, 'History should be capped at 50 records');
  assertEqual(list[0].id, 'HIST-60', 'Most recent item should be at index 0');
});

// Test 13: Legacy profile migration
suite.test('Storage.migrateLegacy correctly migrates legacy cat_cpns_user_profile to cat_users_db', () => {
  const legacyProfile = {
    id: 'LEGACY-99',
    nama: 'Bambang Soediro',
    email: 'bambang@legacy.com',
    noHp: '081234567890',
    noPeserta: '27-01-081234567890',
    formasi: 'Pranata Komputer'
  };
  env.localStorage.setItem('cat_cpns_user_profile', JSON.stringify(legacyProfile));

  storage.migrateLegacy();

  const users = storage.getUsers();
  assert(users['LEGACY-99'], 'User should be migrated into cat_users_db');
  assertEqual(users['LEGACY-99'].nama, 'Bambang Soediro');
  assertEqual(users['LEGACY-99'].formasi, 'Pranata Komputer');

  const session = storage.getActiveSession();
  assert(session, 'Active session should be initialized for migrated user');
  assertEqual(session.userId, 'LEGACY-99');
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
