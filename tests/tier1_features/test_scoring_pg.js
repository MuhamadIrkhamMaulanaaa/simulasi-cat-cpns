/**
 * tests/tier1_features/test_scoring_pg.js
 * Tier 1 Feature Tests: KepmenPANRB 321/2024 Scoring & Passing Grade Logic (F8)
 */

const {
  createSuite,
  createScoring,
  loadQuestions,
  loadPackages,
  assert,
  assertEqual
} = require('../harness');

const suite = createSuite('Tier 1: KepmenPANRB 321/2024 Scoring & Passing Grade');

let scoring, questions, packages, skdQuestions;

suite.beforeEach(() => {
  scoring = createScoring();
  questions = loadQuestions();
  packages = loadPackages();
  const pkg = packages.find((p) => p.id === 'skd_hots');
  skdQuestions = questions.filter(pkg.filter);
});

// Test 1: TWK max score is 150
suite.test('TWK subtest awards 5 points per correct answer up to max 150 (30 questions)', () => {
  const twkQuestions = skdQuestions.slice(0, 30);
  const answers = {};
  for (const q of twkQuestions) {
    answers[q.id] = q.answer; // All correct
  }

  const res = scoring.calculateScores(twkQuestions, answers);
  assertEqual(res.scoresByGroup.TWK, 150);
  assertEqual(res.maxByGroup.TWK, 150);
  assertEqual(res.correctCount, 30);
});

// Test 2: TIU max score is 175
suite.test('TIU subtest awards 5 points per correct answer up to max 175 (35 questions)', () => {
  const tiuQuestions = skdQuestions.slice(30, 65);
  const answers = {};
  for (const q of tiuQuestions) {
    answers[q.id] = q.answer; // All correct
  }

  const res = scoring.calculateScores(tiuQuestions, answers);
  assertEqual(res.scoresByGroup.TIU, 175);
  assertEqual(res.maxByGroup.TIU, 175);
  assertEqual(res.correctCount, 35);
});

// Test 3: TKP scale 1..5 up to max 225
suite.test('TKP subtest awards graded scale 1..5 up to max 225 (45 questions)', () => {
  const tkpQuestions = skdQuestions.slice(65, 110);
  const answers = {};
  for (const q of tkpQuestions) {
    // Pick the option with score 5
    const opt5 = Object.keys(q.scores).find((k) => q.scores[k] === 5);
    answers[q.id] = opt5;
  }

  const res = scoring.calculateScores(tkpQuestions, answers);
  assertEqual(res.scoresByGroup.TKP, 225);
  assertEqual(res.maxByGroup.TKP, 225);
});

// Test 4: Total SKD maximum is 550
suite.test('Full SKD exam maximum cumulative score is exactly 550', () => {
  const answers = {};
  for (const q of skdQuestions) {
    if (q.group === 'TKP') {
      answers[q.id] = Object.keys(q.scores).find((k) => q.scores[k] === 5);
    } else {
      answers[q.id] = q.answer;
    }
  }

  const res = scoring.calculateScores(skdQuestions, answers);
  assertEqual(res.totalScore, 550, 'Max SKD score must equal 550');
  assertEqual(res.maxScore, 550);
  assertEqual(res.percentage, 100);
});

// Test 5: Exact Passing Grade cutoffs (65 / 80 / 166)
suite.test('KepmenPANRB 321/2024 Passing Grade cutoffs are TWK >= 65, TIU >= 80, TKP >= 166', () => {
  const pg = scoring.evaluatePassingGrade({
    TWK: 65,
    TIU: 80,
    TKP: 166
  });

  assertEqual(pg.passTWK, true, 'TWK 65 passes');
  assertEqual(pg.passTIU, true, 'TIU 80 passes');
  assertEqual(pg.passTKP, true, 'TKP 166 passes');
  assertEqual(pg.passAll, true, 'All three meet cutoff');
});

// Test 6: Below TWK cutoff fails passAll
suite.test('Failing TWK cutoff (<65) results in passTWK = false and passAll = false', () => {
  const pg = scoring.evaluatePassingGrade({
    TWK: 60, // Fail
    TIU: 120,
    TKP: 190
  });

  assertEqual(pg.passTWK, false);
  assertEqual(pg.passTIU, true);
  assertEqual(pg.passTKP, true);
  assertEqual(pg.passAll, false, 'passAll must be false if TWK fails');
});

// Test 7: Below TIU cutoff fails passAll
suite.test('Failing TIU cutoff (<80) results in passTIU = false and passAll = false', () => {
  const pg = scoring.evaluatePassingGrade({
    TWK: 85,
    TIU: 75, // Fail
    TKP: 180
  });

  assertEqual(pg.passTWK, true);
  assertEqual(pg.passTIU, false);
  assertEqual(pg.passTKP, true);
  assertEqual(pg.passAll, false);
});

// Test 8: Below TKP cutoff fails passAll
suite.test('Failing TKP cutoff (<166) results in passTKP = false and passAll = false', () => {
  const pg = scoring.evaluatePassingGrade({
    TWK: 90,
    TIU: 100,
    TKP: 160 // Fail
  });

  assertEqual(pg.passTWK, true);
  assertEqual(pg.passTIU, true);
  assertEqual(pg.passTKP, false);
  assertEqual(pg.passAll, false);
});

// Test 9: Competitive target >= 430
suite.test('Competitive ranking (3x Formasi Target) requires passAll and totalScore >= 430', () => {
  const highPass = scoring.evaluatePassingGrade({
    TWK: 100,
    TIU: 140,
    TKP: 195 // Total = 435
  });

  assertEqual(highPass.passAll, true);
  assertEqual(highPass.total, 435);
  assertEqual(highPass.isCompetitive, true);

  const borderlinePass = scoring.evaluatePassingGrade({
    TWK: 70,
    TIU: 85,
    TKP: 170 // Total = 325
  });

  assertEqual(borderlinePass.passAll, true);
  assertEqual(borderlinePass.total, 325);
  assertEqual(borderlinePass.isCompetitive, false, 'Total < 430 is not competitive');
});

// Test 10: High total but failed subtest is NOT competitive
suite.test('Candidate with total >= 430 but failing one subtest is NOT competitive', () => {
  const failedOne = scoring.evaluatePassingGrade({
    TWK: 60, // Failed TWK
    TIU: 175,
    TKP: 215 // Total = 450
  });

  assertEqual(failedOne.total, 450);
  assertEqual(failedOne.passTWK, false);
  assertEqual(failedOne.passAll, false);
  assertEqual(failedOne.isCompetitive, false, 'Must pass all subtests to be competitive');
});

// Test 11: All unanswered gives 0 score and fails PG
suite.test('Empty answers result in 0 score across all groups and fails passing grade', () => {
  const res = scoring.calculateScores(skdQuestions, {});
  assertEqual(res.totalScore, 0);
  assertEqual(res.scoresByGroup.TWK, 0);
  assertEqual(res.scoresByGroup.TIU, 0);
  assertEqual(res.scoresByGroup.TKP, 0);

  const pg = scoring.evaluatePassingGrade(res.scoresByGroup);
  assertEqual(pg.passAll, false);
  assertEqual(pg.isCompetitive, false);
});

// Test 12: Answers ledger accuracy
suite.test('calculateScores generates correct ledger itemizing chosen, score, and correct status', () => {
  const firstQ = skdQuestions[0]; // TWK
  const answers = { [firstQ.id]: firstQ.answer };

  const res = scoring.calculateScores([firstQ], answers);
  const item = res.ledger[firstQ.id];

  assertEqual(item.chosen, firstQ.answer);
  assertEqual(item.score, 5);
  assertEqual(item.correct, true);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
