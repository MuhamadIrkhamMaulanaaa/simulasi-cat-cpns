/**
 * tests/tier1_features/test_auth.js
 * Tier 1 Feature Tests: Authentication & Session Management (F1, F2, F3)
 */

const {
  createSuite,
  createMockEnvironment,
  createStorage,
  createAuth,
  assert,
  assertEqual,
  assertNotEqual
} = require('../harness');

const suite = createSuite('Tier 1: Authentication & Session Management');

let env, storage, auth;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
  auth = createAuth(storage, env);
});

// Test 1: Register creates valid UserRecord
suite.test('Auth.register creates valid UserRecord in storage and returns success', () => {
  const res = auth.register({
    nama: 'Budi Santoso',
    email: 'budi@example.com',
    noHp: '081234567890',
    formasi: 'Pranata Komputer Ahli Pertama',
    pin: '123456'
  });

  assertEqual(res.success, true, 'Registration should succeed');
  assert(res.user, 'Result should contain user object');
  assertEqual(res.user.nama, 'Budi Santoso');
  assertEqual(res.user.email, 'budi@example.com');
  assertEqual(res.user.pin, '123456');

  // Check stored in storage
  const users = storage.getUsers();
  assertEqual(Object.keys(users).length, 1);
  assertEqual(users[res.user.id].nama, 'Budi Santoso');
});

// Test 2: noPeserta formatting
suite.test('Auth.register formats noPeserta correctly with prefix 27-01-<phone>', () => {
  const res = auth.register({
    nama: 'Dewi Lestari',
    email: 'dewi@example.com',
    noHp: '085712345678',
    formasi: 'Pengembang Teknologi Pembelajaran',
    pin: '654321'
  });

  assertEqual(res.success, true);
  assertEqual(res.user.noPeserta, '27-01-085712345678');
});

// Test 3: Active session set immediately
suite.test('Auth.register automatically creates active session upon successful registration', () => {
  const res = auth.register({
    nama: 'Rian Pratama',
    email: 'rian@example.com',
    noHp: '087812345678',
    formasi: 'Guru Informatika',
    pin: '112233'
  });

  assertEqual(res.success, true);
  const session = storage.getActiveSession();
  assert(session, 'Active session should exist');
  assertEqual(session.userId, res.user.id);
  const activeUser = storage.getActiveUser();
  assertEqual(activeUser.nama, 'Rian Pratama');
});

// Test 4: Support various formasi
suite.test('Auth.register handles custom formasi values and sets default if omitted', () => {
  const res1 = auth.register({
    nama: 'Siti Aminah',
    email: 'siti@example.com',
    noHp: '089612345678',
    formasi: 'Penata Kelola Sistem dan Teknologi Informasi',
    pin: '334455'
  });
  assertEqual(res1.user.formasi, 'Penata Kelola Sistem dan Teknologi Informasi');

  const res2 = auth.register({
    nama: 'Ahmad Faiz',
    email: 'faiz@example.com',
    noHp: '082112345678',
    pin: '556677'
  });
  assertEqual(res2.user.formasi, 'Umum');
});

// Test 5: Login with email
suite.test('Auth.login with registered email and correct PIN succeeds', () => {
  auth.register({
    nama: 'Citra Kirana',
    email: 'citra@example.com',
    noHp: '081398765432',
    pin: '987654'
  });

  // Clear active session to simulate new session
  auth.logout();
  assertEqual(storage.getActiveSession(), null);

  const loginRes = auth.login({
    identifier: 'citra@example.com',
    pin: '987654'
  });

  assertEqual(loginRes.success, true);
  assertEqual(loginRes.user.nama, 'Citra Kirana');
  assertEqual(storage.getActiveUser().email, 'citra@example.com');
});

// Test 6: Login with phone number
suite.test('Auth.login with registered phone number and correct PIN succeeds', () => {
  auth.register({
    nama: 'Eko Nugroho',
    email: 'eko@example.com',
    noHp: '087784800668',
    pin: '778899'
  });
  auth.logout();

  const loginRes = auth.login({
    identifier: '087784800668',
    pin: '778899'
  });

  assertEqual(loginRes.success, true);
  assertEqual(loginRes.user.nama, 'Eko Nugroho');
});

// Test 7: Login with noPeserta
suite.test('Auth.login with registered noPeserta and correct PIN succeeds', () => {
  const reg = auth.register({
    nama: 'Fajar Hidayat',
    email: 'fajar@example.com',
    noHp: '085298765432',
    pin: '223344'
  });
  auth.logout();

  const loginRes = auth.login({
    identifier: reg.user.noPeserta,
    pin: '223344'
  });

  assertEqual(loginRes.success, true);
  assertEqual(loginRes.user.id, reg.user.id);
});

// Test 8: Login with wrong PIN fails
suite.test('Auth.login with wrong PIN fails with descriptive error', () => {
  auth.register({
    nama: 'Gita Savitri',
    email: 'gita@example.com',
    noHp: '081299887766',
    pin: '665544'
  });
  auth.logout();

  const res = auth.login({
    identifier: 'gita@example.com',
    pin: '000000'
  });

  assertEqual(res.success, false);
  assertEqual(res.error, 'PIN yang Anda masukkan salah.');
  assertEqual(storage.getActiveSession(), null);
});

// Test 9: Login with unknown identifier fails
suite.test('Auth.login with unregistered identifier returns account not found', () => {
  const res = auth.login({
    identifier: 'unknown@example.com',
    pin: '123456'
  });

  assertEqual(res.success, false);
  assert(res.error.includes('Akun tidak ditemukan'));
});

// Test 10: Logout clears session only
suite.test('Auth.logout clears active session without deleting users from cat_users_db', () => {
  const reg = auth.register({
    nama: 'Hadi Gunawan',
    email: 'hadi@example.com',
    noHp: '082345678901',
    pin: '123123'
  });

  assertEqual(storage.getActiveSession() !== null, true);
  auth.logout();
  assertEqual(storage.getActiveSession(), null);

  // User database must still contain the user
  const user = storage.getUserById(reg.user.id);
  assert(user, 'User must remain in cat_users_db after logout');
  assertEqual(user.nama, 'Hadi Gunawan');
});

// Test 11: syncUI renders active user details
suite.test('Auth.syncUI renders participant name and badge in DOM', () => {
  const widget = env.document.createElement('div');
  widget.id = 'btnHdrUserWidget';
  env.document.body.appendChild(widget);

  const banner = env.document.createElement('div');
  banner.id = 'userWelcomeBanner';
  env.document.body.appendChild(banner);

  auth.register({
    nama: 'Indah Permata',
    email: 'indah@example.com',
    noHp: '081700112233',
    pin: '321321'
  });

  auth.syncUI(env.document);

  assert(widget.innerHTML.includes('Indah Permata'));
  assert(widget.innerHTML.includes('27-01-081700112233'));
  assertEqual(banner.style.display, 'block');
  assert(banner.innerHTML.includes('Indah Permata'));
});

// Test 12: syncUI resets on logout
suite.test('Auth.syncUI resets header widget and hides banner on logout', () => {
  const widget = env.document.createElement('div');
  widget.id = 'btnHdrUserWidget';
  env.document.body.appendChild(widget);

  const banner = env.document.createElement('div');
  banner.id = 'userWelcomeBanner';
  env.document.body.appendChild(banner);

  auth.register({
    nama: 'Joko Widodo',
    email: 'joko@example.com',
    noHp: '081899887766',
    pin: '889900'
  });
  auth.syncUI(env.document);
  assert(widget.innerHTML.includes('Joko Widodo'));

  auth.logout();
  auth.syncUI(env.document);

  assertEqual(widget.innerHTML, 'Masuk / Daftar');
  assertEqual(banner.style.display, 'none');
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
