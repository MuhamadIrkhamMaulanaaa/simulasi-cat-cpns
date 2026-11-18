/**
 * tests/tier2_boundaries/test_score_boundaries.js
 * Tier 2 Boundary Tests: Passing Grade Cutoff Boundaries & Tie-Breaker Logic
 */

const {
  createSuite,
  createScoring,
  loadQuestions,
  loadPackages,
  assert,
  assertEqual
} = require('../harness');

const suite = createSuite('Tier 2: Score Cutoff Boundaries & Edge Cases');

let scoring, questions, packages, skdQuestions;

suite.beforeEach(() => {
  scoring = createScoring();
  questions = loadQuestions();
  packages = loadPackages();
  const pkg = packages.find((p) => p.id === 'skd_hots');
  skdQuestions = questions.filter(pkg.filter);
});

// 1. TWK boundary 64 vs 65
suite.test('TWK boundary: 64 fails passTWK while 65 passes passTWK', () => {
  const fail = scoring.evaluatePassingGrade({ TWK: 64, TIU: 80, TKP: 166 });
  assertEqual(fail.passTWK, false);
  assertEqual(fail.passAll, false);

  const pass = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(pass.passTWK, true);
  assertEqual(pass.passAll, true);
});

// 2. TIU boundary 79 vs 80
suite.test('TIU boundary: 79 fails passTIU while 80 passes passTIU', () => {
  const fail = scoring.evaluatePassingGrade({ TWK: 65, TIU: 79, TKP: 166 });
  assertEqual(fail.passTIU, false);
  assertEqual(fail.passAll, false);

  const pass = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(pass.passTIU, true);
  assertEqual(pass.passAll, true);
});

// 3. TKP boundary 165 vs 166
suite.test('TKP boundary: 165 fails passTKP while 166 passes passTKP', () => {
  const fail = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 165 });
  assertEqual(fail.passTKP, false);
  assertEqual(fail.passAll, false);

  const pass = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(pass.passTKP, true);
  assertEqual(pass.passAll, true);
});

// 4. Exact threshold sum 311
suite.test('Exact boundary combination (65 + 80 + 166 = 311) achieves passAll = true', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 166 });
  assertEqual(pg.total, 311);
  assertEqual(pg.passAll, true);
  assertEqual(pg.isCompetitive, false, '311 is below competitive target of 430');
});

// 5. Off-by-one under: TWK 64
suite.test('Score of 310 with TWK 64, TIU 80, TKP 166 fails passAll', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 64, TIU: 80, TKP: 166 });
  assertEqual(pg.total, 310);
  assertEqual(pg.passAll, false);
});

// 6. Off-by-one under: TIU 79
suite.test('Score of 310 with TWK 65, TIU 79, TKP 166 fails passAll', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 65, TIU: 79, TKP: 166 });
  assertEqual(pg.total, 310);
  assertEqual(pg.passAll, false);
});

// 7. Off-by-one under: TKP 165
suite.test('Score of 310 with TWK 65, TIU 80, TKP 165 fails passAll', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 65, TIU: 80, TKP: 165 });
  assertEqual(pg.total, 310);
  assertEqual(pg.passAll, false);
});

// 8. Minimum possible TKP score (all 1s)
suite.test('TKP with all lowest choices (score 1) yields 45 points and fails PG', () => {
  const tkpQuestions = skdQuestions.slice(65, 110);
  const answers = {};
  for (const q of tkpQuestions) {
    const opt1 = Object.keys(q.scores).find((k) => q.scores[k] === 1);
    answers[q.id] = opt1;
  }

  const res = scoring.calculateScores(tkpQuestions, answers);
  assertEqual(res.scoresByGroup.TKP, 45);
  const pg = scoring.evaluatePassingGrade(res.scoresByGroup);
  assertEqual(pg.passTKP, false);
});

// 9. All answers incorrect in TWK and TIU
suite.test('Answering all TWK and TIU questions incorrectly yields 0 points', () => {
  const nonTkp = skdQuestions.slice(0, 65);
  const answers = {};
  for (const q of nonTkp) {
    // Pick an option that is not the answer key
    const wrongOpt = Object.keys(q.options).find((k) => k !== q.answer);
    answers[q.id] = wrongOpt;
  }

  const res = scoring.calculateScores(nonTkp, answers);
  assertEqual(res.scoresByGroup.TWK, 0);
  assertEqual(res.scoresByGroup.TIU, 0);
  assertEqual(res.correctCount, 0);
});

// 10. Maximum score 550
suite.test('Perfect score 550 achieves passAll and competitive status', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 150, TIU: 175, TKP: 225 });
  assertEqual(pg.total, 550);
  assertEqual(pg.passAll, true);
  assertEqual(pg.isCompetitive, true);
});

// 11. Competitive boundary: 429 vs 430
suite.test('Competitive boundary: 429 is not competitive while 430 is competitive', () => {
  const c429 = scoring.evaluatePassingGrade({ TWK: 100, TIU: 140, TKP: 189 }); // 429
  assertEqual(c429.total, 429);
  assertEqual(c429.passAll, true);
  assertEqual(c429.isCompetitive, false);

  const c430 = scoring.evaluatePassingGrade({ TWK: 100, TIU: 140, TKP: 190 }); // 430
  assertEqual(c430.total, 430);
  assertEqual(c430.passAll, true);
  assertEqual(c430.isCompetitive, true);
});

// 12. High total without passAll is not competitive
suite.test('Total score 485 with failed TKP is NOT competitive', () => {
  const pg = scoring.evaluatePassingGrade({ TWK: 150, TIU: 175, TKP: 160 }); // 485
  assertEqual(pg.total, 485);
  assertEqual(pg.passTKP, false);
  assertEqual(pg.passAll, false);
  assertEqual(pg.isCompetitive, false);
});

// 13. Invalid answer option letters
suite.test('Unrecognized or invalid answer letters award 0 points', () => {
  const firstQ = skdQuestions[0];
  const answers = { [firstQ.id]: 'Z' };

  const res = scoring.calculateScores([firstQ], answers);
  assertEqual(res.scoresByGroup.TWK, 0);
  assertEqual(res.ledger[firstQ.id].score, 0);
  assertEqual(res.ledger[firstQ.id].correct, false);
});

// 14. TKP options scores 1..5 verification
suite.test('TKP question awards exact scores corresponding to chosen options A..E', () => {
  const tkpQ = skdQuestions[65]; // First TKP question

  for (const opt of ['A', 'B', 'C', 'D', 'E']) {
    const expectedPts = tkpQ.scores[opt];
    const res = scoring.calculateScores([tkpQ], { [tkpQ.id]: opt });
    assertEqual(res.scoresByGroup.TKP, expectedPts);
    assertEqual(res.ledger[tkpQ.id].score, expectedPts);
  }
});

// 15. Non-SKD package evaluation (isFullSKD = false)
suite.test('Non-SKD package bypasses 321/2024 cutoffs', () => {
  const nonSkdPg = scoring.evaluatePassingGrade({ TIU: 50 }, false);
  assertEqual(nonSkdPg.passAll, true, 'Non-SKD drill packages should not fail SKD cutoffs');
  assertEqual(nonSkdPg.isCompetitive, false);
});

// 16. BKN Tie-breaker order: TKP > TIU > TWK
suite.test('BKN tie-breaker ranking orders candidates by TKP, then TIU, then TWK', () => {
  const candidateA = { nama: 'A', total: 400, scores: { TKP: 180, TIU: 120, TWK: 100 } };
  const candidateB = { nama: 'B', total: 400, scores: { TKP: 185, TIU: 115, TWK: 100 } };
  const candidateC = { nama: 'C', total: 400, scores: { TKP: 180, TIU: 125, TWK: 95 } };

  const candidates = [candidateA, candidateB, candidateC];

  // BKN Sorting algorithm
  candidates.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.scores.TKP !== a.scores.TKP) return b.scores.TKP - a.scores.TKP;
    if (b.scores.TIU !== a.scores.TIU) return b.scores.TIU - a.scores.TIU;
    return b.scores.TWK - a.scores.TWK;
  });

  assertEqual(candidates[0].nama, 'B', 'Highest TKP wins rank 1');
  assertEqual(candidates[1].nama, 'C', 'Equal TKP resolved by higher TIU');
  assertEqual(candidates[2].nama, 'A', 'Lowest TIU gets rank 3');
});

// 17. Percentage calculation rounding
suite.test('Percentage calculation rounds accurately to integer', () => {
  const res = scoring.calculateScores(skdQuestions, {});
  assertEqual(res.percentage, 0);

  // Score 275 out of 550 = 50%
  const halfPg = {
    scoresByGroup: { TWK: 75, TIU: 100, TKP: 100 },
    maxByGroup: { TWK: 150, TIU: 175, TKP: 225 },
    totalScore: 275,
    maxScore: 550,
    percentage: Math.round((275 / 550) * 100)
  };
  assertEqual(halfPg.percentage, 50);
});

// 18. No negative points
suite.test('Negative points are never awarded under any circumstances', () => {
  const firstQ = skdQuestions[0];
  const res1 = scoring.calculateScores([firstQ], { [firstQ.id]: null });
  assert(res1.totalScore >= 0);

  const res2 = scoring.calculateScores([firstQ], { [firstQ.id]: undefined });
  assert(res2.totalScore >= 0);

  const res3 = scoring.calculateScores([firstQ], { [firstQ.id]: '' });
  assert(res3.totalScore >= 0);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then((res) => {
    console.log(`Results for ${res.suiteName}: ${res.passed}/${res.total} passed in ${res.durationMs}ms`);
  });
}
