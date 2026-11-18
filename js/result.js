// js/result.js - Scoring Engine, KepmenPANRB 321/2024 Evaluator, Tie-Breaker & Result Renderer

function resEsc(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDurationId(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs} Jam`);
  if (mins > 0 || hrs > 0) parts.push(`${mins} Menit`);
  parts.push(`${secs} Detik`);
  return parts.join(' ');
}

function createScoring() {
  return {
    calculateScores(questions, answers) {
      const scoresByGroup = { TWK: 0, TIU: 0, TKP: 0, SKB: 0 };
      const maxByGroup = { TWK: 0, TIU: 0, TKP: 0, SKB: 0 };
      let correctCount = 0;
      let totalScore = 0;
      const ledger = {};
      const safeAnswers = answers || {};

      for (const q of questions || []) {
        const group = q.group || 'TWK';
        if (scoresByGroup[group] === undefined) scoresByGroup[group] = 0;
        if (maxByGroup[group] === undefined) maxByGroup[group] = 0;

        let maxItem = 5;
        if (q.scores && typeof q.scores === 'object') {
          const vals = Object.values(q.scores).map((v) => Number(v) || 0);
          if (vals.length > 0) maxItem = Math.max(...vals);
        }
        maxByGroup[group] += maxItem;

        const chosen = safeAnswers[q.id] || null;
        let score = 0;
        if (chosen && q.scores && q.scores[chosen] !== undefined) {
          score = Number(q.scores[chosen]) || 0;
        }

        scoresByGroup[group] += score;
        totalScore += score;
        if (score === 5) correctCount++;

        ledger[q.id] = {
          chosen,
          score,
          correct: (chosen !== null && chosen === q.answer) || score === 5
        };
      }

      const maxScore = Object.values(maxByGroup).reduce((acc, v) => acc + v, 0);

      return {
        scoresByGroup,
        maxByGroup,
        totalScore,
        maxScore,
        correctCount,
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        ledger
      };
    },

    evaluatePassingGrade(scoresByGroup, isFullSKD = true) {
      if (!isFullSKD) {
        return {
          passTWK: true,
          passTIU: true,
          passTKP: true,
          passAll: true,
          isCompetitive: false
        };
      }

      const safeNum = (val) => (typeof val === 'number' && Number.isFinite(val) ? val : 0);
      const s = scoresByGroup || {};
      const twk = safeNum(s.TWK);
      const tiu = safeNum(s.TIU);
      const tkp = safeNum(s.TKP);

      const passTWK = twk >= 65;
      const passTIU = tiu >= 80;
      const passTKP = tkp >= 166;
      const passAll = passTWK && passTIU && passTKP;
      const total = twk + tiu + tkp;
      const isCompetitive = passAll && total >= 430;

      return {
        passTWK,
        passTIU,
        passTKP,
        passAll,
        isCompetitive,
        total
      };
    },

    compareBknTieBreaker(a, b) {
      const totalA = a.totalScore !== undefined ? a.totalScore : (a.total || 0);
      const totalB = b.totalScore !== undefined ? b.totalScore : (b.total || 0);
      if (totalB !== totalA) return totalB - totalA;

      const sA = a.scoresByGroup || a.scores || {};
      const sB = b.scoresByGroup || b.scores || {};
      if ((sB.TKP || 0) !== (sA.TKP || 0)) return (sB.TKP || 0) - (sA.TKP || 0);
      if ((sB.TIU || 0) !== (sA.TIU || 0)) return (sB.TIU || 0) - (sA.TIU || 0);
      return (sB.TWK || 0) - (sA.TWK || 0);
    }
  };
}

const Result = (function () {
  const scoring = createScoring();
  let lastHistoryEntry = null;

  function renderProgressTile(label, score, max, pgTarget, passed, extraLabel) {
    const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;
    const pgPct = max > 0 && pgTarget ? Math.min(100, Math.round((pgTarget / max) * 100)) : 0;
    const statusClass = passed ? 'ok' : 'fail';
    return `
      <div class="score-box">
        <div class="score-box-title">${resEsc(label)}</div>
        <div class="score-box-val">${score} <span class="score-box-max">/ ${max}</span></div>
        <div class="pg-progress-track" title="Skor ${score} dari maksimal ${max} (Target ${pgTarget})">
          <div class="pg-progress-fill ${statusClass}" style="width:${pct}%"></div>
          ${pgTarget ? `<span class="pg-cutoff-marker" style="left:${pgPct}%" title="Ambang Batas ${pgTarget}"></span>` : ''}
        </div>
        <div class="score-box-meta">
          <span class="score-badge ${statusClass}">${resEsc(extraLabel)}</span>
          ${pgTarget ? `<span class="score-delta">${score >= pgTarget ? `+${score - pgTarget} di atas batas` : `${score - pgTarget} dari batas`}</span>` : ''}
        </div>
      </div>
    `;
  }

  function render(entry) {
    if (typeof document === 'undefined' || !entry) return;
    lastHistoryEntry = entry;

    const titleEl = document.getElementById('resTitle');
    const subtitleEl = document.getElementById('resSubtitle');
    const verdictEl = document.getElementById('resVerdictBox');
    const tilesEl = document.getElementById('resScoreTiles');
    const tieBoxEl = document.getElementById('resTieBreakerBox');
    const badgeEl = document.getElementById('integrityBadgeStatus');
    const summaryEl = document.getElementById('integritySummaryText');

    const userTag = entry.userNama && entry.userId !== 'ANON'
      ? ` • Peserta: ${entry.userNama} (${entry.userNoPeserta})`
      : '';
    if (titleEl) {
      titleEl.textContent = `Hasil Evaluasi: ${entry.pkgTitle}${userTag}`;
    }

    const durText = entry.durationSeconds > 0 ? ` • Durasi Pengerjaan: ${formatDurationId(entry.durationSeconds)}` : '';
    if (subtitleEl) {
      subtitleEl.textContent = `Total Perolehan Nilai: ${entry.totalScore} dari maksimal ${entry.maxScore} poin (${entry.percentage}%)${durText}`;
    }

    const v = entry.violations || {};
    const totalViol = v.total || 0;
    if (badgeEl && summaryEl) {
      if (totalViol === 0) {
        badgeEl.className = 'integrity-badge clean';
        badgeEl.textContent = 'INTEGRITAS BERSIH (0 PELANGGARAN)';
        summaryEl.textContent = 'Luar biasa! Seluruh sesi simulasi diselesaikan dalam kepatuhan protokol penuh tanpa pergantian tab, keluar fullscreen, maupun anomali posisi wajah.';
      } else {
        badgeEl.className = 'integrity-badge warn';
        badgeEl.textContent = `${totalViol} CATATAN PELANGGARAN PENGAWAS`;
        const notes = [];
        if (v.tabSwitches > 0) notes.push(`${v.tabSwitches}x pindah tab`);
        if (v.fullscreenExits > 0) notes.push(`${v.fullscreenExits}x keluar layar penuh`);
        if (v.faceMissingViolations > 0) notes.push(`${v.faceMissingViolations}x wajah hilang dari kamera`);
        if (v.gazeViolations > 0) notes.push(`${v.gazeViolations}x pandangan tidak fokus`);
        if (v.multiFaceViolations > 0) notes.push(`${v.multiFaceViolations}x terdeteksi orang lain`);
        summaryEl.textContent = `Tercatat selama sesi simulasi: ${notes.join(', ') || `${totalViol} pelanggaran`}. Seluruh anomali terekam dalam log audit pengawasan CAT.`;
      }
    }

    const pg = entry.passingGrade || {};
    const scores = entry.scoresByGroup || {};
    const maxes = entry.maxByGroup || {};

    if (entry.isFullSKD) {
      if (verdictEl) {
        verdictEl.innerHTML = `
          <div class="result-banner ${pg.passAll ? 'pass' : 'fail'}">
            <strong style="font-size:1.05rem; display:block; margin-bottom:4px;">
              ${pg.passAll
                ? (pg.isCompetitive
                  ? 'MEMENUHI NILAI AMBANG BATAS &amp; SANGAT KOMPETITIF (3x FORMASI)'
                  : 'MEMENUHI NILAI AMBANG BATAS (PASSING GRADE) KEPMENPANRB 321/2024')
                : 'BELUM MEMENUHI NILAI AMBANG BATAS (PASSING GRADE)'}
            </strong>
            <div>
              ${pg.passAll
                ? (pg.isCompetitive
                  ? 'Selamat! Nilai akumulasi SKD Anda melampaui zona aman kompetitif (≥ 430) dan berpeluang tinggi masuk perankingan 3x formasi menuju tahap SKB.'
                  : 'Ketiga subtes TWK, TIU, dan TKP memenuhi Passing Grade. Tingkatkan konsistensi skor menuju target ≥ 430 agar aman bersaing di perankingan 3x formasi.')
                : 'Periksa subtes yang belum mencapai ambang batas minimal di bawah ini dan gunakan tombol Pembahasan Soal Salah Saja untuk meninjau strategi cepatnya.'}
            </div>
          </div>
        `;
      }

      if (tilesEl) {
        tilesEl.innerHTML = [
          renderProgressTile('TWK (PG: 65)', scores.TWK || 0, maxes.TWK || 150, 65, pg.passTWK, pg.passTWK ? 'LULUS PG' : 'DI BAWAH PG'),
          renderProgressTile('TIU (PG: 80)', scores.TIU || 0, maxes.TIU || 175, 80, pg.passTIU, pg.passTIU ? 'LULUS PG' : 'DI BAWAH PG'),
          renderProgressTile('TKP (PG: 166)', scores.TKP || 0, maxes.TKP || 225, 166, pg.passTKP, pg.passTKP ? 'LULUS PG' : 'DI BAWAH PG'),
          renderProgressTile('TOTAL SKD (TARGET: 430)', entry.totalScore, entry.maxScore || 550, 430, pg.isCompetitive, pg.isCompetitive ? 'KOMPETITIF (≥430)' : (pg.passAll ? 'LULUS PG • TARGET 430+' : 'BELUM PG'))
        ].join('');
      }

      if (tieBoxEl) {
        tieBoxEl.classList.remove('hidden');
        tieBoxEl.innerHTML = `
          <div class="tiebreaker-title">Urutan Prioritas Tie-Breaker Resmi BKN (Jika Total Skor Sama)</div>
          <div class="tiebreaker-steps">
            <div class="tb-step"><span>1. TKP (Bobot Prioritas 1)</span><strong>${scores.TKP || 0} / ${maxes.TKP || 225}</strong></div>
            <div class="tb-arrow">&rarr;</div>
            <div class="tb-step"><span>2. TIU (Bobot Prioritas 2)</span><strong>${scores.TIU || 0} / ${maxes.TIU || 175}</strong></div>
            <div class="tb-arrow">&rarr;</div>
            <div class="tb-step"><span>3. TWK (Bobot Prioritas 3)</span><strong>${scores.TWK || 0} / ${maxes.TWK || 150}</strong></div>
          </div>
        `;
      }
    } else {
      const masteryOk = entry.percentage >= 70;
      if (verdictEl) {
        verdictEl.innerHTML = `
          <div class="result-banner ${masteryOk ? 'pass' : 'fail'}">
            <strong style="font-size:1.05rem; display:block; margin-bottom:4px;">
              Tingkat Penguasaan Materi: ${entry.percentage}% (${entry.totalScore} dari ${entry.maxScore} Poin)
            </strong>
            <div>
              ${masteryOk
                ? 'Hasil latihan menunjukkan penguasaan materi yang solid. Tinjau kembali soal dengan poin &lt; 5 untuk penyempurnaan konsep.'
                : 'Perlu penguatan konsep pada topik ini. Gunakan tombol Pembahasan Soal Salah Saja untuk mempelajari trik cepatnya.'}
            </div>
          </div>
        `;
      }

      if (tilesEl) {
        const metrics = entry.metrics || {};
        tilesEl.innerHTML = `
          <div class="score-box">
            <div class="score-box-title">Skor Perolehan</div>
            <div class="score-box-val">${entry.totalScore}</div>
            <span class="score-badge ${masteryOk ? 'ok' : 'fail'}">Dari ${entry.maxScore} Poin</span>
          </div>
          <div class="score-box">
            <div class="score-box-title">Persentase Akurasi</div>
            <div class="score-box-val">${entry.percentage}%</div>
            <span class="score-badge ${masteryOk ? 'ok' : 'fail'}">${masteryOk ? 'KOMPETEN (≥70%)' : 'PERLU DRILL ULANG'}</span>
          </div>
          <div class="score-box">
            <div class="score-box-title">Jawaban Poin Penuh</div>
            <div class="score-box-val">${metrics.correctCount || 0} <span class="score-box-max">/ ${metrics.totalQuestions || 0}</span></div>
            <span class="score-badge ok">Terjawab: ${metrics.answeredCount || 0}</span>
          </div>
          <div class="score-box">
            <div class="score-box-title">Durasi Pengerjaan</div>
            <div class="score-box-val" style="font-size:1.25rem; padding:6px 0;">${resEsc(formatDurationId(entry.durationSeconds))}</div>
            <span class="score-badge ok">Alokasi: ${Math.round((entry.allocatedSeconds || 0) / 60)} Menit</span>
          </div>
        `;
      }

      if (tieBoxEl) {
        tieBoxEl.classList.add('hidden');
        tieBoxEl.innerHTML = '';
      }
    }
  }

  function getLastEntry() {
    return lastHistoryEntry;
  }

  return {
    scoring,
    calculateScores: scoring.calculateScores.bind(scoring),
    evaluatePassingGrade: scoring.evaluatePassingGrade.bind(scoring),
    compareBknTieBreaker: scoring.compareBknTieBreaker.bind(scoring),
    formatDurationId,
    render,
    getLastEntry
  };
})();

if (typeof window !== 'undefined') {
  window.createScoring = createScoring;
  window.Result = Result;
  window.formatDurationId = formatDurationId;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createScoring,
    Result,
    formatDurationId
  };
}
