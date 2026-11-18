/**
 * tests/tier2_boundaries/test_auth_boundaries.js
 * Tier 2 Boundary Tests: Auth Boundaries, Edge Cases, Sanitization & Tampering
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

const suite = createSuite('Tier 2: Auth Boundaries & Tampering Protection');

let env, storage, auth;

suite.beforeEach(() => {
  env = createMockEnvironment();
  storage = createStorage(env);
  auth = createAuth(storage, env);
});

// 1. Empty name
suite.test('Auth.register rejects empty or whitespace-only candidate name', () => {
  const res1 = auth.register({ nama: '', email: 'valid@cat.id', noHp: '081234567890', pin: '123456' });
  assertEqual(res1.success, false);
  assert(res1.error.includes('Nama'));

  const res2 = auth.register({ nama: '   ', email: 'valid@cat.id', noHp: '081234567890', pin: '123456' });
  assertEqual(res2.success, false);
});

// 2. Short name
suite.test('Auth.register rejects names with less than 3 characters', () => {
  const res = auth.register({ nama: 'Al', email: 'valid@cat.id', noHp: '081234567890', pin: '123456' });
  assertEqual(res.success, false);
  assert(res.error.includes('3 karakter'));
});

// 3. Invalid email: missing @
suite.test('Auth.register rejects email lacking @ symbol', () => {
  const res = auth.register({ nama: 'Budi Santoso', email: 'budisantoso.gmail.com', noHp: '081234567890', pin: '123456' });
  assertEqual(res.success, false);
  assert(res.error.includes('email'));
});

// 4. Invalid email: missing domain
suite.test('Auth.register rejects email missing top-level domain', () => {
  const res = auth.register({ nama: 'Budi Santoso', email: 'budi@gmail', noHp: '081234567890', pin: '123456' });
  assertEqual(res.success, false);
});

// 5. Invalid email: spaces in address
suite.test('Auth.register rejects email with internal whitespace', () => {
  const res = auth.register({ nama: 'Budi Santoso', email: 'budi santoso@gmail.com', noHp: '081234567890', pin: '123456' });
  assertEqual(res.success, false);
});

// 6. Phone: too short
suite.test('Auth.register rejects phone number with less than 10 digits', () => {
  const res = auth.register({ nama: 'Dewi Sartika', email: 'dewi@cat.id', noHp: '08123456', pin: '123456' });
  assertEqual(res.success, false);
  assert(res.error.includes('HP'));
});

// 7. Phone: non-Indonesian prefix
suite.test('Auth.register rejects phone number without valid Indonesian mobile prefix (08/62/etc)', () => {
  const res = auth.register({ nama: 'John Doe', email: 'john@cat.id', noHp: '02112345678', pin: '123456' });
  assertEqual(res.success, false);
});

// 8. Phone: alphabetical characters
suite.test('Auth.register rejects phone number containing letters', () => {
  const res = auth.register({ nama: 'Dewi Sartika', email: 'dewi@cat.id', noHp: '0812345ABCDE', pin: '123456' });
  assertEqual(res.success, false);
});

// 9. Phone normalization (+62 -> 08)
suite.test('Auth.register normalizes +62 and 62 prefixes into canonical 08 prefix', () => {
  const res1 = auth.register({ nama: 'Eko 1', email: 'eko1@cat.id', noHp: '+6281234567891', pin: '123456' });
  assertEqual(res1.success, true);
  assertEqual(res1.user.noHp, '081234567891');
  assertEqual(res1.user.noPeserta, '27-01-081234567891');

  const res2 = auth.register({ nama: 'Eko 2', email: 'eko2@cat.id', noHp: '6281234567892', pin: '123456' });
  assertEqual(res2.success, true);
  assertEqual(res2.user.noHp, '081234567892');
});

// 10. Phone normalization: spaces and dashes
suite.test('Auth.register removes formatting dashes and spaces from phone numbers', () => {
  const res = auth.register({ nama: 'Farhan', email: 'farhan@cat.id', noHp: '0812 - 3456 - 7893', pin: '123456' });
  assertEqual(res.success, true);
  assertEqual(res.user.noHp, '081234567893');
});

// 11. PIN: 5 digits rejected
suite.test('Auth.register rejects PIN with less than 6 digits', () => {
  const res = auth.register({ nama: 'Gani', email: 'gani@cat.id', noHp: '081234567894', pin: '12345' });
  assertEqual(res.success, false);
  assert(res.error.includes('PIN'));
});

// 12. PIN: 7 digits rejected
suite.test('Auth.register rejects PIN with more than 6 digits', () => {
  const res = auth.register({ nama: 'Gani', email: 'gani@cat.id', noHp: '081234567894', pin: '1234567' });
  assertEqual(res.success, false);
});

// 13. PIN: alphanumeric rejected
suite.test('Auth.register rejects alphanumeric PIN', () => {
  const res = auth.register({ nama: 'Gani', email: 'gani@cat.id', noHp: '081234567894', pin: '12345A' });
  assertEqual(res.success, false);
});

// 14. Duplicate email rejection
suite.test('Auth.register rejects duplicate email address', () => {
  auth.register({ nama: 'User A', email: 'duplicate@cat.id', noHp: '081234567801', pin: '111111' });
  const dup = auth.register({ nama: 'User B', email: 'duplicate@cat.id', noHp: '081234567802', pin: '222222' });

  assertEqual(dup.success, false);
  assert(dup.error.includes('Email sudah terdaftar'));
});

// 15. Duplicate phone rejection
suite.test('Auth.register rejects duplicate phone number even if email differs', () => {
  auth.register({ nama: 'User A', email: 'usera@cat.id', noHp: '081234567803', pin: '111111' });
  const dup = auth.register({ nama: 'User B', email: 'userb@cat.id', noHp: '081234567803', pin: '222222' });

  assertEqual(dup.success, false);
  assert(dup.error.includes('Nomor HP sudah terdaftar'));
});

// 16. Case-insensitive email duplicate check
suite.test('Auth.register treats emails case-insensitively when detecting duplicates', () => {
  auth.register({ nama: 'User A', email: 'CaseTest@Cat.Id', noHp: '081234567804', pin: '111111' });
  const dup = auth.register({ nama: 'User B', email: 'casetest@cat.id', noHp: '081234567805', pin: '222222' });

  assertEqual(dup.success, false);
});

// 17. XSS sanitization resilience
suite.test('Auth handles HTML/script tags in candidate name safely', () => {
  const scriptName = '<script>alert("pwned")</script> Irkham';
  const res = auth.register({ nama: scriptName, email: 'xss@cat.id', noHp: '081234567806', pin: '123456' });

  assertEqual(res.success, true);
  assertEqual(res.user.nama, scriptName);
  // Storage remains intact and queryable
  const fetched = storage.getUserById(res.user.id);
  assertEqual(fetched.nama, scriptName);
});

// 18. SQL Injection input resistance
suite.test('Auth.login resists SQL injection strings in identifier field', () => {
  auth.register({ nama: 'Real User', email: 'real@cat.id', noHp: '081234567807', pin: '123456' });

  const sqli = auth.login({ identifier: "' OR '1'='1' --", pin: '123456' });
  assertEqual(sqli.success, false);
  assert(sqli.error.includes('Akun tidak ditemukan'));
});

// 19. Identifier whitespace trimming on login
suite.test('Auth.login trims leading and trailing whitespace from identifier', () => {
  auth.register({ nama: 'Trim Candidate', email: 'trim@cat.id', noHp: '081234567808', pin: '123456' });
  auth.logout();

  const res = auth.login({ identifier: '   trim@cat.id   ', pin: '123456' });
  assertEqual(res.success, true);
  assertEqual(res.user.email, 'trim@cat.id');
});

// 20. Corrupted session data handling
suite.test('Storage and Auth handle corrupt JSON in storage keys gracefully without crashing', () => {
  env.localStorage.setItem('cat_users_db', '{malformed_json...');
  env.localStorage.setItem('cat_active_session', '!!!invalid');

  // Should return empty object and null without throwing
  const users = storage.getUsers();
  assert(users !== null && typeof users === 'object');
  assertEqual(storage.getActiveSession(), null);

  const loginRes = auth.login({ identifier: 'test@cat.id', pin: '123456' });
  assertEqual(loginRes.success, false);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
