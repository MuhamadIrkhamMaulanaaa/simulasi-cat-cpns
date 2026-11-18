// js/exam.js - CAT BKN Exam Engine, Wall-Clock Timer, Auto-Save, Recovery & Keyboard/UI Controls

function examEsc(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function examRenderMd(raw) {
  if (typeof renderMarkdownLite === 'function') return renderMarkdownLite(raw);
  return examEsc(raw || '');
}

function createExamEngine(storage, questions, packages, env) {
  const scoring = typeof createScoring === 'function'
    ? createScoring()
    : (typeof require !== 'undefined' ? require('./result').createScoring() : null);

  let state = {
    pkg: null,
    mode: null,
    questions: [],
    idx: 0,
    answers: {},
    doubts: {},
    revealed: {},
    startTime: null,
    examEndTime: null,
    secondsLeft: 0,
    isActive: false,
    isFinished: false,
    tabSwitches: 0,
    fullscreenExits: 0,
    faceMissingViolations: 0,
    gazeViolations: 0,
    multiFaceViolations: 0
  };

  return {
    getState() {
      return state;
    },

    start(pkgId, mode = 'cat') {
      const pkg = (packages || []).find((p) => p.id === pkgId);
      if (!pkg) throw new Error(`Package ${pkgId} not found`);

      const qList = (questions || []).filter(pkg.filter);
      if (qList.length === 0) throw new Error(`No questions matched for package ${pkgId}`);

      const durationMinutes = pkg.minutes || 100;
      const now = Date.now();
      const endTime = now + durationMinutes * 60 * 1000;

      state = {
        pkg,
        mode,
        questions: qList,
        idx: 0,
        answers: {},
        doubts: {},
        revealed: {},
        startTime: now,
        examEndTime: endTime,
        secondsLeft: durationMinutes * 60,
        isActive: true,
        isFinished: false,
        tabSwitches: 0,
        fullscreenExits: 0,
        faceMissingViolations: 0,
        gazeViolations: 0,
        multiFaceViolations: 0
      };

      this.saveProgress();
      return state;
    },

    selectOption(qId, letter) {
      if (!state.isActive || state.mode === 'review') return;
      state.answers[qId] = letter;
      this.saveProgress();
    },

    toggleDoubt(qId) {
      if (!state.isActive || state.mode === 'review') return;
      state.doubts[qId] = !state.doubts[qId];
      this.saveProgress();
    },

    clearAnswer(qId) {
      if (!state.isActive || state.mode === 'review') return;
      delete state.answers[qId];
      this.saveProgress();
    },

    jumpTo(index) {
      if (index >= 0 && index < state.questions.length) {
        state.idx = index;
        if (state.isActive) this.saveProgress();
      }
    },

    nextQuestion() {
      if (state.idx < state.questions.length - 1) {
        state.idx++;
        if (state.isActive) this.saveProgress();
      }
    },

    prevQuestion() {
      if (state.idx > 0) {
        state.idx--;
        if (state.isActive) this.saveProgress();
      }
    },

    updateTime() {
      if (!state.isActive || !state.examEndTime) return 0;
      const rem = Math.max(0, Math.round((state.examEndTime - Date.now()) / 1000));
      state.secondsLeft = rem;
      return rem;
    },

    getGridStats() {
      const total = state.questions.length;
      let doubtCount = 0;
      let answeredConfidentCount = 0;
      let emptyCount = 0;

      for (const q of state.questions) {
        const isDoubt = Boolean(state.doubts[q.id]);
        const hasAnswer = Boolean(state.answers[q.id]);
        if (isDoubt) {
          doubtCount++;
        } else if (hasAnswer) {
          answeredConfidentCount++;
        } else {
          emptyCount++;
        }
      }

      return {
        total,
        doubtCount,
        answeredConfidentCount,
        emptyCount,
        totalAnswered: Object.keys(state.answers).length
      };
    },

    saveProgress() {
      if (!state.isActive || !state.pkg || !storage) return;
      const user = storage.getActiveUser();
      const snapshot = {
        pkgId: state.pkg.id,
        mode: state.mode,
        userId: user ? user.id : 'ANON',
        startedAt: new Date(state.startTime || Date.now()).toISOString(),
        examEndTime: state.examEndTime,
        secondsLeft: this.updateTime(),
        currentIdx: state.idx,
        answers: Object.assign({}, state.answers),
        doubts: Object.assign({}, state.doubts),
        tabSwitches: state.tabSwitches || 0,
        fullscreenExits: state.fullscreenExits || 0,
        faceMissingViolations: state.faceMissingViolations || 0,
        gazeViolations: state.gazeViolations || 0,
        multiFaceViolations: state.multiFaceViolations || 0,
        lastSavedAt: new Date().toISOString()
      };
      storage.saveActiveExamSnapshot(snapshot);
    },

    recoverSession(targetUserId) {
      if (!storage) return false;
      const snap = targetUserId && typeof storage.getActiveExamSnapshotForUser === 'function'
        ? storage.getActiveExamSnapshotForUser(targetUserId)
        : storage.getActiveExamSnapshot();
      if (!snap || !snap.pkgId) return false;

      const pkg = (packages || []).find((p) => p.id === snap.pkgId);
      if (!pkg) return false;

      const qList = (questions || []).filter(pkg.filter);
      if (qList.length === 0) return false;

      const mode = snap.mode || 'cat';
      const endTime = Number(snap.examEndTime) || Date.now();
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      const safeIdx = Math.min(Math.max(0, Number(snap.currentIdx) || 0), qList.length - 1);

      state = {
        pkg,
        mode,
        questions: qList,
        idx: safeIdx,
        answers: snap.answers && typeof snap.answers === 'object' ? Object.assign({}, snap.answers) : {},
        doubts: snap.doubts && typeof snap.doubts === 'object' ? Object.assign({}, snap.doubts) : {},
        revealed: {},
        startTime: snap.startedAt ? new Date(snap.startedAt).getTime() : Date.now(),
        examEndTime: endTime,
        secondsLeft: remaining,
        isActive: mode === 'study' ? true : remaining > 0,
        isFinished: false,
        tabSwitches: Number(snap.tabSwitches) || 0,
        fullscreenExits: Number(snap.fullscreenExits) || 0,
        faceMissingViolations: Number(snap.faceMissingViolations) || 0,
        gazeViolations: Number(snap.gazeViolations) || 0,
        multiFaceViolations: Number(snap.multiFaceViolations) || 0
      };

      return true;
    },

    enterReviewMode({ pkg, questionsList, answersMap, onlyMistakes = false, ledger = null }) {
      let filtered = questionsList || [];
      if (onlyMistakes) {
        filtered = filtered.filter((q) => {
          if (ledger && ledger[q.id]) {
            return ledger[q.id].score < 5;
          }
          const chosen = answersMap ? answersMap[q.id] : null;
          const pts = chosen && q.scores && q.scores[chosen] ? q.scores[chosen] : 0;
          return pts < 5;
        });
      }

      const emptyMistakesFallback = onlyMistakes && filtered.length === 0;
      const finalQuestions = emptyMistakesFallback ? (questionsList || []) : filtered;

      state = {
        pkg,
        mode: 'review',
        questions: finalQuestions,
        idx: 0,
        answers: Object.assign({}, answersMap || {}),
        doubts: {},
        revealed: {},
        startTime: null,
        examEndTime: null,
        secondsLeft: 0,
        isActive: false,
        isFinished: true,
        tabSwitches: 0,
        fullscreenExits: 0,
        faceMissingViolations: 0,
        gazeViolations: 0,
        multiFaceViolations: 0
      };

      return { state, emptyMistakesFallback };
    },

    finish() {
      if (!state.isActive && state.questions.length === 0) {
        throw new Error('No active exam to finish');
      }
      state.isActive = false;
      state.isFinished = true;

      const user = storage ? storage.getActiveUser() : null;
      const scoreResult = scoring.calculateScores(state.questions, state.answers);
      const isFullSKD = Boolean(state.pkg && state.pkg.isFullSKD);
      const pgResult = scoring.evaluatePassingGrade(scoreResult.scoresByGroup, isFullSKD);

      const allocatedSeconds = ((state.pkg && state.pkg.minutes) || 100) * 60;
      const durationSeconds = state.mode === 'study' && state.startTime
        ? Math.max(0, Math.round((Date.now() - state.startTime) / 1000))
        : Math.max(0, Math.min(allocatedSeconds, Math.round(allocatedSeconds - state.secondsLeft)));

      const tabSw = state.tabSwitches || 0;
      const fsEx = state.fullscreenExits || 0;
      const faceMiss = state.faceMissingViolations || 0;
      const gazeV = state.gazeViolations || 0;
      const multiFace = state.multiFaceViolations || 0;
      const totalViol = tabSw + fsEx + faceMiss + gazeV + multiFace;

      const historyEntry = {
        id: 'HIST-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: user ? user.id : 'ANON',
        userNama: user ? user.nama : 'Peserta Mandiri',
        userNoPeserta: user ? user.noPeserta : '27-01-00000000',
        pkgId: state.pkg.id,
        pkgTitle: state.pkg.title,
        mode: state.mode,
        timestamp: new Date().toISOString(),
        dateFormatted: new Date().toLocaleString('id-ID'),
        durationSeconds,
        allocatedSeconds,
        scoresByGroup: scoreResult.scoresByGroup,
        maxByGroup: scoreResult.maxByGroup,
        totalScore: scoreResult.totalScore,
        maxScore: scoreResult.maxScore,
        percentage: scoreResult.percentage,
        isFullSKD,
        passingGrade: pgResult,
        violations: {
          tabSwitches: tabSw,
          fullscreenExits: fsEx,
          faceMissingViolations: faceMiss,
          gazeViolations: gazeV,
          multiFaceViolations: multiFace,
          total: totalViol,
          isClean: totalViol === 0
        },
        metrics: {
          totalQuestions: state.questions.length,
          answeredCount: Object.keys(state.answers).length,
          doubtCount: Object.keys(state.doubts).filter((k) => state.doubts[k]).length,
          emptyCount: state.questions.length - Object.keys(state.answers).length,
          correctCount: scoreResult.correctCount
        },
        answersLedger: scoreResult.ledger
      };

      if (storage) {
        storage.saveHistoryEntry(historyEntry);
        storage.clearActiveExamSnapshot(user ? user.id : 'ANON');
      }

      return historyEntry;
    }
  };
}

// Browser UI Controller wrapping createExamEngine
const Exam = (function () {
  let engine = null;
  let timerId = null;
  let pendingPkgId = null;
  let isStartingCat = false;
  let tickSaveCounter = 0;
  let lastFinishedEntry = null;
  const FONT_STEPS = [0.88, 1, 1.12, 1.25];
  let fontStepIdx = 1;

  function ensureEngine() {
    if (!engine && typeof window !== 'undefined') {
      engine = createExamEngine(
        window.Storage,
        window.ALL_QUESTIONS || [],
        window.PACKAGES || [],
        window
      );
      const savedScale = window.Storage && window.Storage.getRaw(window.STORAGE_KEYS.FONT_SCALE, null);
      if (savedScale) {
        const idx = FONT_STEPS.indexOf(Number(savedScale));
        if (idx !== -1) fontStepIdx = idx;
      }
    }
    return engine;
  }

  function getState() {
    const eng = ensureEngine();
    return eng ? eng.getState() : null;
  }

  function saveProgress() {
    const eng = ensureEngine();
    if (eng) eng.saveProgress();
  }

  function stopTimerLoop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimerLoop() {
    stopTimerLoop();
    tickSaveCounter = 0;
    timerId = setInterval(() => {
      const eng = ensureEngine();
      if (!eng) return;
      const st = eng.getState();
      if (!st.isActive || st.mode !== 'cat') {
        stopTimerLoop();
        return;
      }
      const rem = eng.updateTime();
      updateTimerUI();
      tickSaveCounter++;
      if (tickSaveCounter >= 5) {
        tickSaveCounter = 0;
        eng.saveProgress();
      }
      if (rem <= 0) {
        stopTimerLoop();
        alert('Waktu ujian telah habis! Sistem secara otomatis mengunci lembar jawaban dan menghitung perolehan nilai Anda.');
        confirmFinishExam();
      }
    }, 1000);
  }

  function syncTimerOnVisibility() {
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (!st.isActive || st.mode !== 'cat') return;
    const rem = eng.updateTime();
    updateTimerUI();
    eng.saveProgress();
    if (rem <= 0) {
      stopTimerLoop();
      alert('Waktu ujian telah berakhir saat jendela tidak aktif. Lembar jawaban dikunci otomatis.');
      confirmFinishExam();
    }
  }

  function applyFontScale() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('qMainPanel');
    const scale = FONT_STEPS[fontStepIdx] || 1;
    if (panel) panel.style.setProperty('--exam-font-scale', String(scale));
    const dec = document.getElementById('btnFontDec');
    const rst = document.getElementById('btnFontReset');
    const inc = document.getElementById('btnFontInc');
    if (dec) dec.disabled = fontStepIdx === 0;
    if (inc) inc.disabled = fontStepIdx === FONT_STEPS.length - 1;
    if (rst) rst.classList.toggle('is-active', fontStepIdx === 1);
  }

  function adjustFontSize(delta) {
    if (delta === 0) fontStepIdx = 1;
    else fontStepIdx = Math.min(FONT_STEPS.length - 1, Math.max(0, fontStepIdx + delta));
    applyFontScale();
    if (window.Storage && window.STORAGE_KEYS) {
      window.Storage.setRaw(window.STORAGE_KEYS.FONT_SCALE, FONT_STEPS[fontStepIdx]);
    }
  }

  function toggleMobileGrid() {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('navSoalCard');
    const btn = document.getElementById('btnToggleGridMobile');
    if (!card) return;
    const collapsed = card.classList.toggle('grid-collapsed');
    if (btn) {
      btn.textContent = collapsed ? 'Tampilkan Peta Soal' : 'Sembunyikan Peta Soal';
    }
  }

  function fillExamParticipant() {
    if (typeof document === 'undefined') return;
    const user = window.Storage ? window.Storage.getActiveUser() : null;
    const st = getState();
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };
    setText('examSideNo', user ? user.noPeserta : '-');
    setText('examSideNama', user ? user.nama : 'Peserta Mandiri');
    setText('examSidePaket', st && st.pkg ? st.pkg.title : '-');
  }

  function updateTimerUI() {
    if (typeof document === 'undefined') return;
    const st = getState();
    const wrap = document.getElementById('examTimerWrapper');
    const hEl = document.getElementById('timerHours');
    const mEl = document.getElementById('timerMinutes');
    const sEl = document.getElementById('timerSeconds');
    if (!wrap || !st) return;

    if (st.mode === 'study') {
      wrap.classList.add('study-mode');
      wrap.classList.remove('urgent');
      if (hEl) hEl.textContent = '--';
      if (mEl) mEl.textContent = 'LATIHAN';
      if (sEl) sEl.textContent = '--';
      return;
    }

    if (st.mode === 'review') {
      wrap.classList.add('study-mode');
      wrap.classList.remove('urgent');
      if (hEl) hEl.textContent = '00';
      if (mEl) mEl.textContent = 'REVIEW';
      if (sEl) sEl.textContent = '00';
      return;
    }

    wrap.classList.remove('study-mode');
    const sec = Math.max(0, st.secondsLeft || 0);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hEl) hEl.textContent = String(hrs).padStart(2, '0');
    if (mEl) mEl.textContent = String(mins).padStart(2, '0');
    if (sEl) sEl.textContent = String(secs).padStart(2, '0');
    wrap.classList.toggle('urgent', sec <= 300);
  }

  function renderSubtestJumpBar() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('subtestJumpBar');
    const st = getState();
    if (!bar || !st || !st.questions.length) return;

    const groups = [];
    const seen = new Map();
    st.questions.forEach((q, idx) => {
      const grp = q.group || 'SOAL';
      if (!seen.has(grp)) {
        const item = { group: grp, firstIdx: idx, count: 0 };
        seen.set(grp, item);
        groups.push(item);
      }
      seen.get(grp).count++;
    });

    if (groups.length <= 1) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }

    const currentGroup = (st.questions[st.idx] && st.questions[st.idx].group) || '';
    bar.classList.remove('hidden');
    bar.innerHTML = groups
      .map((g) => `
        <button type="button" class="subtest-pill ${g.group === currentGroup ? 'active' : ''}" onclick="jumpTo(${g.firstIdx})">
          ${examEsc(g.group)} (${g.count})
        </button>
      `)
      .join('');
  }

  function renderGrid() {
    if (typeof document === 'undefined') return;
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    const stats = eng.getGridStats();

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    // Mutually exclusive counts summing strictly to total
    setEl('statHdrAns', stats.answeredConfidentCount);
    setEl('statHdrDoubt', stats.doubtCount);
    setEl('statHdrEmpty', stats.emptyCount);
    setEl('lgAnsCount', stats.answeredConfidentCount);
    setEl('lgDbtCount', stats.doubtCount);
    setEl('lgEmpCount', stats.emptyCount);
    setEl('gridProgressText', `${stats.totalAnswered} / ${stats.total} Dijawab`);

    const numGrid = document.getElementById('numGrid');
    if (numGrid) {
      numGrid.innerHTML = st.questions
        .map((q, i) => {
          let cls = 'num-tile';
          if (st.doubts[q.id]) cls += ' dbt';
          else if (st.answers[q.id]) cls += ' ans';
          if (i === st.idx) cls += ' curr';
          const ansLetter = st.answers[q.id];
          return `<button type="button" class="${cls}" onclick="jumpTo(${i})"><span>${i + 1}</span>${ansLetter ? `<small class="num-ans">${examEsc(ansLetter)}</small>` : ''}</button>`;
        })
        .join('');
    }

    renderSubtestJumpBar();
  }

  function renderQuestion() {
    if (typeof document === 'undefined') return;
    const st = getState();
    if (!st || !st.questions.length) return;
    const q = st.questions[st.idx];
    if (!q) return;

    applyFontScale();
    const scrollArea = document.getElementById('qContentScroll');
    if (scrollArea) scrollArea.scrollTop = 0;

    const badge = document.getElementById('qCategoryBadge');
    if (badge) {
      badge.textContent = q.group + (q.group === 'SKB' && q.category ? ' • ' + q.category.replace('SKB_', '') : '');
    }
    const subtopic = document.getElementById('qSubtopicText');
    if (subtopic) subtopic.textContent = q.subtopic || '';
    const counter = document.getElementById('qCounterText');
    if (counter) counter.textContent = `Soal Nomor ${st.idx + 1} dari ${st.questions.length}`;

    const stemEl = document.getElementById('qStemContainer');
    if (stemEl) {
      stemEl.innerHTML = examRenderMd(q.stem) + (q.svg ? q.svg : '');
    }

    const chosen = st.answers[q.id];
    const showExplain =
      st.mode === 'review' ||
      (st.mode === 'study' && (Boolean(chosen) || Boolean(st.revealed[q.id]))) ||
      Boolean(st.revealed[q.id]);

    const btnExplain = document.getElementById('btnToggleExplain');
    if (btnExplain) {
      btnExplain.classList.toggle('hidden', st.mode !== 'study');
      if (st.mode === 'study') {
        if (chosen) {
          btnExplain.textContent = 'Pembahasan Aktif';
          btnExplain.disabled = true;
        } else if (st.revealed[q.id]) {
          btnExplain.textContent = 'Tutup Pembahasan';
          btnExplain.disabled = false;
        } else {
          btnExplain.textContent = 'Lihat Pembahasan';
          btnExplain.disabled = false;
        }
      }
    }

    const btnDoubt = document.getElementById('btnDoubt');
    if (btnDoubt) {
      btnDoubt.classList.toggle('active', Boolean(st.doubts[q.id]));
      btnDoubt.disabled = st.mode === 'review';
    }

    const btnClear = document.getElementById('btnClearAns');
    if (btnClear) btnClear.disabled = st.mode === 'review';

    const btnPrev = document.getElementById('btnPrev');
    if (btnPrev) btnPrev.disabled = st.idx === 0;

    const btnNext = document.getElementById('btnNext');
    if (btnNext) {
      const isLast = st.idx === st.questions.length - 1;
      if (isLast) {
        btnNext.innerHTML = st.mode === 'cat' ? 'Selesai Ujian &rsaquo;' : 'Soal Terakhir';
        btnNext.disabled = st.mode !== 'cat';
      } else {
        btnNext.innerHTML = 'Soal Berikutnya &rsaquo;';
        btnNext.disabled = false;
      }
    }

    const optsEl = document.getElementById('qOptionsContainer');
    if (optsEl) {
      const isReviewMode = st.mode === 'review';
      optsEl.innerHTML = ['A', 'B', 'C', 'D', 'E']
        .map((letter) => {
          const text = (q.options && q.options[letter]) || '';
          const pts = q.scores && q.scores[letter] !== undefined ? q.scores[letter] : 0;
          let cls = 'option-btn';
          if (isReviewMode) cls += ' is-review';
          if (chosen === letter) cls += ' selected';
          if (showExplain) {
            if (letter === q.answer) cls += ' correct';
            else if (chosen === letter) cls += ' wrong';
          }
          const scoreBadge = showExplain ? `<span class="opt-score">Poin: ${pts}</span>` : '';
          return `
            <button type="button" class="${cls}" ${isReviewMode ? 'disabled' : `onclick="selectOption('${letter}')"`}>
              <span class="opt-letter">${letter}</span>
              <span class="opt-text">${examRenderMd(text)}</span>
              ${scoreBadge}
            </button>
          `;
        })
        .join('');
    }

    const explainEl = document.getElementById('qExplainContainer');
    if (explainEl) {
      if (showExplain) {
        explainEl.classList.remove('hidden');
        const keySummary =
          q.group === 'TKP'
            ? '<strong>Skor Opsi:</strong> ' +
              ['A', 'B', 'C', 'D', 'E'].map((k) => `${k}=${q.scores[k]}`).join(' | ') +
              ` &nbsp;(Jawaban Terbaik: <strong>${examEsc(q.answer)}</strong>)`
            : `<strong>Kunci Jawaban: ${examEsc(q.answer)}</strong> (Poin Maksimal: 5)`;

        const reportMsg = `Halo Admin, saya ingin melaporkan soal No. ${st.idx + 1} (${q.id}) pada paket ${st.pkg ? st.pkg.title : ''}.`;
        const waNum = (window.CAT_CONFIG && window.CAT_CONFIG.adminWhatsApp) || '087784800668';
        const reportHref = `https://wa.me/62${waNum.replace(/^0/, '')}?text=${encodeURIComponent(reportMsg)}`;

        explainEl.innerHTML = `
          <div class="explain-header">Kunci Jawaban &amp; Bobot Nilai</div>
          <div class="explain-body">${keySummary}</div>
          <div class="explain-header" style="margin-top:12px;">Pembahasan Analitis</div>
          <div class="explain-body">${examRenderMd(q.pembahasan)}</div>
          <div class="hack-card">
            <div class="hack-card-title">Konsep Kunci &amp; Trik Cepat (&lt;15 Detik)</div>
            <div style="font-size:0.88rem; line-height:1.5;">${examRenderMd(q.hack)}</div>
            <div style="margin-top:14px; padding-top:10px; border-top:1px dashed #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <span style="font-size:0.8rem; color:var(--text-muted);">Menemukan ketidaksesuaian kunci atau pembahasan?</span>
              <a href="${reportHref}" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem; color:#0284c7; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                Lapor Ralat via WhatsApp (0877-8480-0668) &rarr;
              </a>
            </div>
          </div>
        `;
      } else {
        explainEl.classList.add('hidden');
        explainEl.innerHTML = '';
      }
    }

    renderGrid();
  }

  function closeExamModals() {
    if (typeof document === 'undefined') return;
    ['finishModal', 'fullscreenWarningModal', 'tabSwitchModal'].forEach((id) => {
      const m = document.getElementById(id);
      if (m) m.classList.add('hidden');
    });
  }

  function enterExamScreenUI() {
    const st = getState();
    if (!st || !st.pkg) return;

    closeExamModals();

    const proctorCard = document.getElementById('proctorCard');
    if (proctorCard) proctorCard.classList.toggle('hidden', st.mode !== 'cat');

    const warnBanner = document.getElementById('proctorWarningBanner');
    if (warnBanner) warnBanner.className = 'proctor-warn-banner hidden';

    const navCard = document.getElementById('navSoalCard');
    if (navCard) navCard.classList.remove('grid-collapsed');
    const gridBtn = document.getElementById('btnToggleGridMobile');
    if (gridBtn) gridBtn.textContent = 'Sembunyikan Peta Soal';

    const shortcutHint = document.getElementById('examShortcutHint');
    if (shortcutHint) shortcutHint.classList.toggle('hidden', st.mode === 'review');

    const btnSidebarFinish = document.getElementById('btnSidebarFinish');
    if (btnSidebarFinish) btnSidebarFinish.classList.toggle('hidden', st.mode === 'review');

    const btnSidebarBackHistory = document.getElementById('btnSidebarBackHistory');
    if (btnSidebarBackHistory) btnSidebarBackHistory.classList.toggle('hidden', st.mode !== 'review');

    if (typeof window.showScreen === 'function') window.showScreen('exam');
    fillExamParticipant();

    const limEl = document.getElementById('statHdrLimit');
    if (limEl) {
      if (st.mode === 'review') limEl.textContent = 'Mode Review';
      else if (st.mode === 'study') limEl.textContent = 'Tanpa Batas';
      else limEl.textContent = `${st.pkg.minutes} Menit`;
    }
    const totEl = document.getElementById('statHdrTotal');
    if (totEl) totEl.textContent = String(st.questions.length);

    if (window.Proctor) {
      if (typeof window.Proctor.updateProctorViolationsUI === 'function') {
        window.Proctor.updateProctorViolationsUI();
      }
      if (typeof window.Proctor.syncCopyProtection === 'function') {
        window.Proctor.syncCopyProtection();
      }
    }
    updateTimerUI();
    renderQuestion();
  }

  function openPrepModal(pkgId) {
    if (!window.getRegisteredUser || !window.getRegisteredUser()) {
      if (window.openAuthModal) window.openAuthModal(() => openPrepModal(pkgId));
      return;
    }
    pendingPkgId = pkgId;
    isStartingCat = false;
    const chk = document.getElementById('chkAgreeIntegrity');
    if (chk) chk.checked = false;
    const btn = document.getElementById('btnStartExamConfirmed');
    if (btn) btn.disabled = true;
    const camErr = document.getElementById('prepCameraError');
    if (camErr) camErr.classList.add('hidden');
    const fbBtn = document.getElementById('btnStartStudyFallback');
    if (fbBtn) fbBtn.classList.add('hidden');
    const modal = document.getElementById('prepModal');
    if (modal) modal.classList.remove('hidden');
  }

  function closePrepModal() {
    pendingPkgId = null;
    isStartingCat = false;
    const modal = document.getElementById('prepModal');
    if (modal) modal.classList.add('hidden');
  }

  function togglePrepAgree(checked) {
    const btn = document.getElementById('btnStartExamConfirmed');
    if (btn && !isStartingCat) btn.disabled = !checked;
  }

  async function executeConfirmedCatStart() {
    if (isStartingCat) return;
    const pkgId = pendingPkgId;
    const btn = document.getElementById('btnStartExamConfirmed');
    const camErr = document.getElementById('prepCameraError');
    const fbBtn = document.getElementById('btnStartStudyFallback');
    isStartingCat = true;
    if (btn) btn.disabled = true;
    if (camErr) camErr.classList.add('hidden');
    try {
      if (window.Proctor) await window.Proctor.startWebcamStream();
      closePrepModal();
      if (window.Proctor) window.Proctor.requestFullscreenLock();
      startDirectPackage(pkgId, 'cat');
      if (window.Proctor) window.Proctor.startFaceTrackingAI();
    } catch (err) {
      isStartingCat = false;
      const chk = document.getElementById('chkAgreeIntegrity');
      if (btn) btn.disabled = !(chk && chk.checked);
      if (camErr) {
        camErr.classList.remove('hidden');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          camErr.innerHTML = '<strong>Akses Kamera Ditolak!</strong> Anda belum memberikan izin kamera. Klik ikon gembok/izin di bilah alamat peramban Anda, izinkan akses kamera, lalu coba lagi. Mode Simulasi CAT BKN mewajibkan kamera aktif.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          camErr.innerHTML = '<strong>Kamera Tidak Terdeteksi!</strong> Perangkat Anda tidak memiliki webcam aktif. Anda dapat menggunakan <em>Mode Latihan Mandiri</em> untuk tetap mengerjakan soal tanpa kamera.';
        } else {
          camErr.innerHTML = '<strong>Kendala Kamera / Protokol Berkas:</strong> Peramban membatasi akses webcam atau kamera tidak tersedia. Pastikan Anda memberikan izin kamera atau gunakan tombol <em>Latihan Mandiri</em> di bawah.';
        }
      }
      if (fbBtn) fbBtn.classList.remove('hidden');
    }
  }

  function startStudyFallbackFromPrep() {
    const pkgId = pendingPkgId;
    closePrepModal();
    startDirectPackage(pkgId, 'study');
  }

  function startDirectPackage(pkgId, mode = 'cat') {
    if (!window.getRegisteredUser || !window.getRegisteredUser()) {
      if (window.openAuthModal) window.openAuthModal(() => startDirectPackage(pkgId, mode));
      return;
    }
    const eng = ensureEngine();
    if (!eng) return;

    try {
      stopTimerLoop();
      eng.start(pkgId, mode);
    } catch (err) {
      alert('Soal belum tersedia untuk paket ini.');
      return;
    }

    enterExamScreenUI();
    if (mode === 'cat') {
      startTimerLoop();
    }
  }

  function resumeSavedExam() {
    const eng = ensureEngine();
    if (!eng) return;

    const activeUser = window.Storage ? window.Storage.getActiveUser() : null;
    const targetUserId = activeUser ? activeUser.id : 'ANON';
    const ok = eng.recoverSession(targetUserId);
    if (!ok) {
      alert('Sesi ujian tersimpan untuk akun aktif tidak ditemukan atau sudah kedaluwarsa.');
      if (window.Landing) window.Landing.refresh();
      return;
    }

    const st = eng.getState();
    if (st.mode === 'cat' && st.secondsLeft <= 0) {
      const entry = eng.finish();
      lastFinishedEntry = entry;
      if (window.Result) window.Result.render(entry);
      if (window.showScreen) window.showScreen('result');
      if (window.Landing) window.Landing.refresh();
      if (window.History) window.History.render();
      return;
    }

    enterExamScreenUI();
    if (st.mode === 'cat') {
      if (window.Proctor) {
        window.Proctor.requestFullscreenLock();
        window.Proctor.startWebcamStream()
          .then(() => window.Proctor.startFaceTrackingAI())
          .catch(() => {
            const statusText = document.getElementById('proctorStatusText');
            const badge = document.getElementById('proctorStatusBadge');
            if (statusText) statusText.textContent = 'SESI PULIH (NO CAM)';
            if (badge) badge.className = 'proctor-badge warn';
          });
      }
      startTimerLoop();
    }
  }

  function discardSavedExam() {
    if (!confirm('Buang sesi ujian yang tersimpan? Jawaban yang belum diselesaikan tidak dapat dipulihkan lagi.')) {
      return;
    }
    if (window.Storage) {
      const activeUser = window.Storage.getActiveUser();
      window.Storage.clearActiveExamSnapshot(activeUser ? activeUser.id : 'ANON');
    }
    if (window.Landing) window.Landing.refresh();
  }

  function selectOption(letter) {
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (st.mode === 'review' || !st.questions.length) return;
    const q = st.questions[st.idx];
    eng.selectOption(q.id, letter);
    renderQuestion();
  }

  function revealCurrentExplanation() {
    const st = getState();
    if (!st || !st.questions.length) return;
    const q = st.questions[st.idx];
    st.revealed[q.id] = !st.revealed[q.id];
    renderQuestion();
  }

  function toggleDoubt() {
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (st.mode === 'review' || !st.questions.length) return;
    const q = st.questions[st.idx];
    eng.toggleDoubt(q.id);
    renderQuestion();
  }

  function clearAnswer() {
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (st.mode === 'review' || !st.questions.length) return;
    const q = st.questions[st.idx];
    eng.clearAnswer(q.id);
    renderQuestion();
  }

  function prevQuestion() {
    const eng = ensureEngine();
    if (!eng) return;
    if (eng.getState().idx > 0) {
      eng.prevQuestion();
      renderQuestion();
    }
  }

  function nextQuestion() {
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (st.idx < st.questions.length - 1) {
      eng.nextQuestion();
      renderQuestion();
    } else if (st.mode === 'cat') {
      openFinishModal();
    }
  }

  function jumpTo(index) {
    const eng = ensureEngine();
    if (!eng) return;
    eng.jumpTo(index);
    renderQuestion();
  }

  function openFinishModal() {
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (!st || st.mode === 'review' || st.isFinished || !st.questions.length) return;
    if (st.mode === 'cat') {
      eng.updateTime();
      updateTimerUI();
    }
    const stats = eng.getGridStats();

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    // Mutually exclusive counts summing to total
    setEl('bigModalStatAns', stats.answeredConfidentCount);
    setEl('bigModalStatDoubt', stats.doubtCount);
    setEl('bigModalStatEmpty', stats.emptyCount);

    const remEl = document.getElementById('bigModalTimeRemaining');
    if (remEl) {
      if (st.mode === 'study') {
        remEl.textContent = 'Mode: Latihan Mandiri (Tanpa Batas Waktu)';
      } else {
        const sec = Math.max(0, st.secondsLeft || 0);
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const secs = sec % 60;
        remEl.textContent = `Sisa Waktu Anda: ${String(hrs).padStart(2, '0')} Jam ${String(mins).padStart(2, '0')} Menit ${String(secs).padStart(2, '0')} Detik`;
      }
    }

    const notice = document.getElementById('finishNoticeBox');
    if (notice) {
      if (stats.emptyCount > 0 || stats.doubtCount > 0) {
        notice.className = 'finish-notice-box warn';
        notice.innerHTML = `<strong>Perhatian:</strong> Terdapat <strong>${stats.emptyCount}</strong> soal belum dijawab (bernilai <strong>0 poin</strong>) dan <strong>${stats.doubtCount}</strong> soal masih bertanda ragu-ragu. Yakin ingin mengunci lembar jawaban sekarang?`;
      } else {
        notice.className = 'finish-notice-box ready';
        notice.innerHTML = `<strong>Luar Biasa!</strong> Seluruh <strong>${stats.answeredConfidentCount}</strong> butir soal telah Anda jawab dengan yakin tanpa tanda ragu-ragu.`;
      }
    }

    const modal = document.getElementById('finishModal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeFinishModal() {
    const modal = document.getElementById('finishModal');
    if (modal) modal.classList.add('hidden');
  }

  function confirmFinishExam() {
    closeExamModals();
    stopTimerLoop();
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (!st || st.isFinished || !st.questions.length) return;

    if (st.mode === 'cat' || st.mode === 'study') {
      eng.updateTime();
    }

    if (window.Proctor) {
      window.Proctor.exitFullscreenLock();
      window.Proctor.stopWebcamStream();
    }

    const entry = eng.finish();
    lastFinishedEntry = entry;

    if (window.Result) window.Result.render(entry);
    if (window.showScreen) window.showScreen('result');
    if (window.Proctor && typeof window.Proctor.syncCopyProtection === 'function') {
      window.Proctor.syncCopyProtection();
    }
    if (window.Landing) window.Landing.refresh();
    if (window.History) window.History.render();
  }

  function reviewExam(onlyMistakes = false) {
    if (lastFinishedEntry) {
      openReviewForEntry(lastFinishedEntry, onlyMistakes);
      return;
    }
    const eng = ensureEngine();
    if (!eng) return;
    const st = eng.getState();
    if (!st.pkg) return;
    const qList = (window.ALL_QUESTIONS || []).filter(st.pkg.filter);
    const { emptyMistakesFallback } = eng.enterReviewMode({
      pkg: st.pkg,
      questionsList: qList,
      answersMap: st.answers,
      onlyMistakes
    });
    if (emptyMistakesFallback) {
      alert('Sempurna! Anda mendapatkan nilai maksimal (5 poin) pada seluruh butir soal paket ini.');
    }
    enterExamScreenUI();
  }

  function openReviewForEntry(entry, onlyMistakes = false) {
    const eng = ensureEngine();
    if (!eng || !entry) return false;

    const allQ = window.ALL_QUESTIONS || [];
    const allPkgs = window.PACKAGES || [];
    let pkg = allPkgs.find((p) => p.id === entry.pkgId);
    let qList = [];

    if (pkg) {
      qList = allQ.filter(pkg.filter);
    } else if (entry.answersLedger) {
      const idSet = new Set(Object.keys(entry.answersLedger));
      qList = allQ.filter((q) => idSet.has(q.id));
      pkg = { id: entry.pkgId, title: entry.pkgTitle, minutes: Math.round((entry.allocatedSeconds || 6000) / 60), isFullSKD: Boolean(entry.isFullSKD) };
    }

    if (!qList.length) {
      alert('Data butir soal untuk riwayat ini tidak tersedia (riwayat versi lama).');
      return false;
    }

    const answersMap = {};
    if (entry.answersLedger) {
      Object.entries(entry.answersLedger).forEach(([qId, item]) => {
        if (item && item.chosen) answersMap[qId] = item.chosen;
      });
    }

    stopTimerLoop();
    const { emptyMistakesFallback } = eng.enterReviewMode({
      pkg,
      questionsList: qList,
      answersMap,
      onlyMistakes,
      ledger: entry.answersLedger || null
    });

    if (emptyMistakesFallback) {
      alert('Sempurna! Anda mendapatkan poin penuh (5) pada seluruh butir soal pada percobaan ini. Menampilkan seluruh pembahasan.');
    }

    enterExamScreenUI();
    return true;
  }

  function exitReviewToHistory() {
    if (typeof window.showScreen === 'function') window.showScreen('home');
    if (typeof window.switchHomeTab === 'function') window.switchHomeTab('hist');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, behavior: 'instant' });
      } catch (_) {
        window.scrollTo(0, 0);
      }
    }
  }

  function handleExamKeydown(e) {
    const screenExam = document.getElementById('screenExam');
    if (!screenExam || screenExam.classList.contains('hidden')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const tag = (e.target && e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const modalIds = [
      'prepModal',
      'finishModal',
      'fullscreenWarningModal',
      'tabSwitchModal',
      'modalDonation',
      'modalPasswordLock',
      'modalUserAuth',
      'modalUserProfile'
    ];
    for (const id of modalIds) {
      const m = document.getElementById(id);
      if (m && !m.classList.contains('hidden')) return;
    }

    const st = getState();
    if (!st) return;

    const key = e.key;
    if (key === 'ArrowLeft') {
      e.preventDefault();
      prevQuestion();
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      if (st.idx < st.questions.length - 1) {
        nextQuestion();
      }
      return;
    }

    if (st.mode === 'review') return;

    const upper = key.toUpperCase();
    if (['A', 'B', 'C', 'D', 'E'].includes(upper)) {
      e.preventDefault();
      selectOption(upper);
      return;
    }
    const numMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
    if (numMap[key]) {
      e.preventDefault();
      selectOption(numMap[key]);
      return;
    }
    if (upper === 'R') {
      e.preventDefault();
      toggleDoubt();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleExamKeydown);
  }

  return {
    getState,
    saveProgress,
    stopTimerLoop,
    syncTimerOnVisibility,
    updateTimerUI,
    renderQuestion,
    renderGrid,
    fillExamParticipant,
    openPrepModal,
    closePrepModal,
    togglePrepAgree,
    executeConfirmedCatStart,
    startStudyFallbackFromPrep,
    startDirectPackage,
    resumeSavedExam,
    discardSavedExam,
    selectOption,
    revealCurrentExplanation,
    toggleDoubt,
    clearAnswer,
    prevQuestion,
    nextQuestion,
    jumpTo,
    openFinishModal,
    closeFinishModal,
    confirmFinishExam,
    reviewExam,
    openReviewForEntry,
    exitReviewToHistory,
    adjustFontSize,
    toggleMobileGrid
  };
})();

if (typeof window !== 'undefined') {
  window.createExamEngine = createExamEngine;
  window.Exam = Exam;
  window.openPrepModal = Exam.openPrepModal;
  window.closePrepModal = Exam.closePrepModal;
  window.togglePrepAgree = Exam.togglePrepAgree;
  window.executeConfirmedCatStart = Exam.executeConfirmedCatStart;
  window.startStudyFallbackFromPrep = Exam.startStudyFallbackFromPrep;
  window.startDirectPackage = Exam.startDirectPackage;
  window.resumeSavedExam = Exam.resumeSavedExam;
  window.discardSavedExam = Exam.discardSavedExam;
  window.selectOption = Exam.selectOption;
  window.revealCurrentExplanation = Exam.revealCurrentExplanation;
  window.toggleDoubt = Exam.toggleDoubt;
  window.clearAnswer = Exam.clearAnswer;
  window.prevQuestion = Exam.prevQuestion;
  window.nextQuestion = Exam.nextQuestion;
  window.jumpTo = Exam.jumpTo;
  window.openFinishModal = Exam.openFinishModal;
  window.closeFinishModal = Exam.closeFinishModal;
  window.confirmFinishExam = Exam.confirmFinishExam;
  window.reviewExam = Exam.reviewExam;
  window.exitReviewToHistory = Exam.exitReviewToHistory;
  window.adjustFontSize = Exam.adjustFontSize;
  window.toggleMobileGrid = Exam.toggleMobileGrid;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createExamEngine,
    Exam
  };
}
