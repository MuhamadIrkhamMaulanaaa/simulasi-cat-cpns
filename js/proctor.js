// js/proctor.js - CAT BKN Security Proctoring (Fullscreen, Tab-Switch, Webcam & AI Face Tracking)

const Proctor = (function () {
  let mediaStream = null;
  let aiVisionInterval = null;
  let nativeDetector = null;
  let trackingTracker = null;
  let trackingTask = null;
  let lastTrackingResult = null;
  let smoothedStatus = 'OK';
  let smoothedReason = '';
  let currentViolationType = 'OK';
  let violationStartTime = 0;
  let lastViolationBeepTime = 0;
  let isExitingCleanly = false;
  let securityToastTimer = null;
  let focusShieldActive = false;
  let timedShieldActive = false;
  let timedShieldTimer = null;
  const faceHistoryBuffer = [];

  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
    } catch (_) {
      nativeDetector = null;
    }
  }

  function getExamState() {
    return typeof window !== 'undefined' && window.Exam && typeof window.Exam.getState === 'function'
      ? window.Exam.getState()
      : null;
  }

  function isExamCopyProtected() {
    if (typeof document === 'undefined') return false;
    const screenExam = document.getElementById('screenExam');
    if (!screenExam || screenExam.classList.contains('hidden')) return false;
    const st = getExamState();
    if (!st || !st.isActive || st.isFinished) return false;
    return st.mode === 'cat' || st.mode === 'study';
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const el = target.nodeType === 3 ? target.parentElement : target;
    if (!el) return false;
    const tag = String(el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
  }

  function clearTextSelection() {
    try {
      const sel = typeof window !== 'undefined' && typeof window.getSelection === 'function'
        ? window.getSelection()
        : null;
      if (sel && typeof sel.removeAllRanges === 'function') {
        sel.removeAllRanges();
      }
    } catch (_) {}
  }

  function hideCopyBlockedNotice() {
    if (securityToastTimer) {
      clearTimeout(securityToastTimer);
      securityToastTimer = null;
    }
    if (typeof document === 'undefined') return;
    const toast = document.getElementById('proctorSecurityToast');
    if (toast) toast.classList.add('hidden');
  }

  function showCopyBlockedNotice(message) {
    if (typeof document === 'undefined') return;
    const toast = document.getElementById('proctorSecurityToast');
    const textEl = document.getElementById('proctorSecurityToastText');
    if (!toast) return;
    if (textEl && message) textEl.textContent = message;
    toast.classList.remove('hidden');
    if (securityToastTimer) clearTimeout(securityToastTimer);
    securityToastTimer = setTimeout(() => {
      toast.classList.add('hidden');
      securityToastTimer = null;
    }, 2400);
  }

  function applyShieldUI(reasonMessage) {
    const active = isExamCopyProtected() && (focusShieldActive || timedShieldActive);
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.toggle('exam-screenshot-shield', active);
    }
    if (typeof document !== 'undefined') {
      const shield = document.getElementById('proctorPrivacyShield');
      const textEl = document.getElementById('proctorPrivacyShieldText');
      if (shield) shield.classList.toggle('hidden', !active);
      if (active && textEl && reasonMessage) textEl.textContent = reasonMessage;
    }
    return active;
  }

  function clearFocusShield() {
    focusShieldActive = false;
    applyShieldUI();
  }

  function resetAllShields() {
    focusShieldActive = false;
    timedShieldActive = false;
    if (timedShieldTimer) {
      clearTimeout(timedShieldTimer);
      timedShieldTimer = null;
    }
    applyShieldUI();
  }

  function clearClipboardForScreenshotProtection() {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard
          .writeText('Konten soal Simulasi CAT CPNS dilindungi dan dilarang di-screenshot selama ujian.')
          .catch(() => {});
      }
    } catch (_) {}
  }

  function triggerScreenshotShield(reasonMessage, options) {
    if (!isExamCopyProtected()) return false;
    const opts = options || {};
    const durationMs = typeof opts.durationMs === 'number' ? opts.durationMs : 3200;
    clearTextSelection();
    clearClipboardForScreenshotProtection();
    timedShieldActive = true;
    if (timedShieldTimer) clearTimeout(timedShieldTimer);
    applyShieldUI(
      reasonMessage ||
        'Terdeteksi tombol atau pintasan screenshot (PrintScreen / Snipping Tool). Layar soal dikunci sementara demi keamanan.'
    );
    if (opts.beep !== false) playSecurityBeep();
    showCopyBlockedNotice('Screenshot & tangkapan layar dilarang selama ujian berlangsung.');
    timedShieldTimer = setTimeout(() => {
      timedShieldActive = false;
      timedShieldTimer = null;
      applyShieldUI();
    }, durationMs);
    return true;
  }

  function handleWindowBlur() {
    if (!isExamCopyProtected()) return;
    focusShieldActive = true;
    clearTextSelection();
    applyShieldUI(
      'Jendela ujian kehilangan fokus atau overlay screenshot (seperti Win+Shift+S / Snipping Tool) sedang terbuka. Klik kembali area ujian untuk melanjutkan.'
    );
  }

  function handleWindowFocus() {
    focusShieldActive = false;
    applyShieldUI();
  }

  function syncWatermark() {
    if (typeof document === 'undefined') return;
    const layer = document.getElementById('examWatermarkLayer');
    if (!layer) return;
    const locked = isExamCopyProtected();
    layer.classList.toggle('hidden', !locked);
    if (!locked) {
      layer.innerHTML = '';
      return;
    }
    const user =
      typeof window !== 'undefined' && window.Storage && typeof window.Storage.getActiveUser === 'function'
        ? window.Storage.getActiveUser()
        : null;
    const rawLabel =
      user && user.noPeserta
        ? `${user.noPeserta} • ${(user.nama || 'PESERTA').slice(0, 18)}`
        : 'CAT BKN 2027 • DILARANG SCREENSHOT';
    const safeLabel = String(rawLabel)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    layer.innerHTML = Array.from({ length: 12 }, () => `<span class="exam-watermark-tile">${safeLabel}</span>`).join('');
  }

  function syncCopyProtection() {
    const locked = isExamCopyProtected();
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.toggle('exam-copy-locked', locked);
    }
    syncWatermark();
    if (locked) {
      clearTextSelection();
    } else {
      hideCopyBlockedNotice();
      resetAllShields();
    }
    return locked;
  }

  function isScreenshotShortcut(e) {
    if (!e) return false;
    const key = String(e.key || '').toLowerCase();
    const code = String(e.code || '').toLowerCase();
    if (key === 'printscreen' || code === 'printscreen' || e.keyCode === 44) {
      return 'PRINTSCREEN';
    }
    if (e.metaKey && e.shiftKey) {
      return 'OS_SNIP';
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['s', 'x', '3', '4', '5', '6'].includes(key)) {
      return 'BROWSER_CAPTURE';
    }
    return false;
  }

  function blockEvent(e) {
    if (!e) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  function handleProtectedContextMenu(e) {
    if (!isExamCopyProtected()) return;
    blockEvent(e);
    clearTextSelection();
    showCopyBlockedNotice('Klik kanan, Salin, dan Tanya AI dinonaktifkan selama ujian berlangsung.');
  }

  function handleProtectedRightClickDown(e) {
    if (!isExamCopyProtected() || !e || e.button !== 2) return;
    blockEvent(e);
    clearTextSelection();
  }

  function handleProtectedCopyOrCut(e) {
    if (!isExamCopyProtected() || isEditableTarget(e && e.target)) return;
    blockEvent(e);
    if (e && e.clipboardData && typeof e.clipboardData.setData === 'function') {
      try {
        e.clipboardData.setData('text/plain', 'Konten soal CAT CPNS dilindungi selama ujian.');
      } catch (_) {}
    }
    clearTextSelection();
    showCopyBlockedNotice('Menyalin teks soal dan pilihan jawaban dinonaktifkan selama ujian.');
  }

  function handleProtectedSelectStart(e) {
    if (!isExamCopyProtected() || isEditableTarget(e && e.target)) return;
    blockEvent(e);
    clearTextSelection();
  }

  function handleProtectedDragStart(e) {
    if (!isExamCopyProtected() || isEditableTarget(e && e.target)) return;
    blockEvent(e);
  }

  function handleProtectedSelectionChange() {
    if (!isExamCopyProtected()) return;
    try {
      const sel = typeof window !== 'undefined' && typeof window.getSelection === 'function'
        ? window.getSelection()
        : null;
      if (sel && !sel.isCollapsed && sel.rangeCount > 0 && !isEditableTarget(sel.anchorNode)) {
        sel.removeAllRanges();
      }
    } catch (_) {}
  }

  function handleProtectedKeydown(e) {
    if (!isExamCopyProtected() || !e) return;
    const key = String(e.key || '').toLowerCase();
    const hasMod = Boolean(e.ctrlKey || e.metaKey);
    const editable = isEditableTarget(e.target);

    const shotKind = isScreenshotShortcut(e);
    if (shotKind) {
      blockEvent(e);
      triggerScreenshotShield(
        'Terdeteksi tombol atau pintasan screenshot. Layar soal disamarkan sementara demi keamanan bank soal.',
        { beep: shotKind === 'PRINTSCREEN', durationMs: 3200 }
      );
      return;
    }

    const isDevToolsShortcut =
      key === 'f12' ||
      e.keyCode === 123 ||
      (hasMod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) ||
      (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(key));

    const isCopyExportShortcut =
      hasMod && !e.altKey && ['c', 'x', 'a', 'u', 's', 'p'].includes(key) && (!editable || ['u', 's', 'p'].includes(key));

    if (isDevToolsShortcut || isCopyExportShortcut) {
      blockEvent(e);
      clearTextSelection();
      if (key === 'p') {
        triggerScreenshotShield('Pencetakan atau simpan PDF soal dilarang selama ujian berlangsung.');
      } else {
        showCopyBlockedNotice('Pintasan salin, cetak, dan inspeksi dinonaktifkan selama ujian.');
      }
    }
  }

  function handleProtectedKeyup(e) {
    if (!isExamCopyProtected() || !e) return;
    const shotKind = isScreenshotShortcut(e);
    if (shotKind === 'PRINTSCREEN' || shotKind === 'BROWSER_CAPTURE') {
      blockEvent(e);
      triggerScreenshotShield(
        'Tombol PrintScreen / Capture terdeteksi. Clipboard dibersihkan dan layar dikunci sementara.',
        { beep: true, durationMs: 3200 }
      );
    }
  }

  function persistSnapshot() {
    if (window.Exam && typeof window.Exam.saveProgress === 'function') {
      window.Exam.saveProgress();
    }
  }

  function playSecurityBeep() {
    try {
      const AudioCtx =
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
        (typeof AudioContext !== 'undefined' ? AudioContext : null);
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (_) {
      // Ignore audio errors when autoplay blocked
    }
  }

  function requestFullscreenLock() {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } catch (_) {
      // Ignore fullscreen errors
    }
  }

  function exitFullscreenLock() {
    if (typeof document === 'undefined') return;
    isExitingCleanly = true;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (_) {
      // Ignore exit errors
    }
    setTimeout(() => {
      isExitingCleanly = false;
    }, 500);
  }

  function updateProctorViolationsUI() {
    if (typeof document === 'undefined') return;
    const st = getExamState();
    const total = st
      ? (st.tabSwitches || 0) +
        (st.fullscreenExits || 0) +
        (st.faceMissingViolations || 0) +
        (st.gazeViolations || 0) +
        (st.multiFaceViolations || 0)
      : 0;
    const badge = document.getElementById('proctorViolationsBadge');
    if (badge) {
      badge.textContent = `${total} Pelanggaran`;
      badge.style.color = total > 0 ? '#dc2626' : '#16a34a';
    }
  }

  function handleFullscreenChange() {
    if (typeof document === 'undefined') return;
    const st = getExamState();
    if (!st || !st.isActive || st.mode !== 'cat' || isExitingCleanly || st.isFinished) return;
    const screenExam = document.getElementById('screenExam');
    if (!screenExam || screenExam.classList.contains('hidden')) return;

    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      st.fullscreenExits = (st.fullscreenExits || 0) + 1;
      const countEl = document.getElementById('fsExitCountText');
      if (countEl) countEl.textContent = st.fullscreenExits;
      const modal = document.getElementById('fullscreenWarningModal');
      if (modal) modal.classList.remove('hidden');
      updateProctorViolationsUI();
      playSecurityBeep();
      persistSnapshot();
    }
  }

  function resumeFullscreenFromWarning() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('fullscreenWarningModal');
    if (modal) modal.classList.add('hidden');
    requestFullscreenLock();
  }

  function handleVisibilityChange() {
    if (typeof document === 'undefined') return;
    const st = getExamState();
    if (!st || !st.isActive || st.isFinished) return;

    // Resync wall-clock timer whenever tab visibility returns
    if (!document.hidden && window.Exam && typeof window.Exam.syncTimerOnVisibility === 'function') {
      window.Exam.syncTimerOnVisibility();
    }

    if (document.hidden) {
      handleWindowBlur();
    }

    if (st.mode !== 'cat') return;
    const screenExam = document.getElementById('screenExam');
    if (!screenExam || screenExam.classList.contains('hidden')) return;

    if (document.hidden) {
      st.tabSwitches = (st.tabSwitches || 0) + 1;
      updateProctorViolationsUI();
      playSecurityBeep();
      persistSnapshot();
    } else {
      if (typeof document.hasFocus !== 'function' || document.hasFocus()) {
        handleWindowFocus();
      }
      if (st.tabSwitches > 0) {
        const countEl = document.getElementById('tabSwitchCountText');
        if (countEl) countEl.textContent = st.tabSwitches;
        const modal = document.getElementById('tabSwitchModal');
        if (modal) modal.classList.remove('hidden');
      }
    }
  }

  function dismissTabSwitchWarning() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('tabSwitchModal');
    if (modal) modal.classList.add('hidden');
  }

  function initTrackingJsTracker() {
    if (typeof tracking !== 'undefined' && tracking.ObjectTracker) {
      try {
        if (!trackingTracker) {
          trackingTracker = new tracking.ObjectTracker('face');
          trackingTracker.setInitialScale(2.5);
          trackingTracker.setStepSize(1.6);
          trackingTracker.setEdgesDensity(0.1);
          trackingTracker.on('track', function (event) {
            const st = getExamState();
            if (!st || !st.isActive || st.mode !== 'cat' || st.isFinished) return;
            const video = document.getElementById('proctorVideo');
            if (!video || video.paused || video.ended) return;

            if (event.data.length === 0) {
              lastTrackingResult = { status: 'NO_FACE', reason: 'Wajah Tidak Terdeteksi di Kamera', count: 0 };
            } else if (event.data.length > 1) {
              lastTrackingResult = {
                status: 'MULTI_FACE',
                reason: 'Terdeteksi ' + event.data.length + ' Orang',
                count: event.data.length
              };
            } else {
              const box = event.data[0];
              const vw = video.videoWidth || 320;
              const vh = video.videoHeight || 240;
              const cx = (box.x + box.width / 2) / vw;
              const cy = (box.y + box.height / 2) / vh;
              if (cx < 0.2) lastTrackingResult = { status: 'LOOKING_AWAY', reason: 'Menoleh ke Samping Kiri', count: 1 };
              else if (cx > 0.8) lastTrackingResult = { status: 'LOOKING_AWAY', reason: 'Menoleh ke Samping Kanan', count: 1 };
              else if (cy > 0.82) lastTrackingResult = { status: 'LOOKING_AWAY', reason: 'Menunduk ke Bawah', count: 1 };
              else if (cy < 0.16) lastTrackingResult = { status: 'LOOKING_AWAY', reason: 'Mendongak ke Atas', count: 1 };
              else lastTrackingResult = { status: 'OK', reason: 'Wajah Terdeteksi & Fokus', count: 1 };
            }
          });
          try {
            trackingTask = tracking.track('#proctorVideo', trackingTracker);
          } catch (_) {
            // Ignore duplicate tracking bindings
          }
        } else if (trackingTask && typeof trackingTask.run === 'function') {
          try {
            trackingTask.run();
          } catch (_) {}
        }
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  function applyFaceUi(status, reason) {
    if (typeof document === 'undefined') return;
    const st = getExamState();
    const badge = document.getElementById('proctorStatusBadge');
    const textEl = document.getElementById('proctorStatusText');
    const overlay = document.getElementById('proctorTargetOverlay');
    const banner = document.getElementById('proctorWarningBanner');
    const bannerText = document.getElementById('proctorWarningBannerText');
    const now = Date.now();

    if (status === 'OK') {
      currentViolationType = 'OK';
      violationStartTime = 0;
      if (badge) badge.className = 'proctor-badge';
      if (textEl) textEl.textContent = 'LIVE: FOKUS (1 WAJAH)';
      if (overlay) overlay.className = 'proctor-target-overlay';
      if (banner) banner.className = 'proctor-warn-banner hidden';
      return;
    }

    if (status === 'LOOKING_AWAY') {
      if (badge) badge.className = 'proctor-badge warn';
      if (textEl) textEl.textContent = reason.toUpperCase();
      if (overlay) overlay.className = 'proctor-target-overlay warn';
      if (banner && bannerText) {
        banner.className = 'proctor-warn-banner warn';
        bannerText.textContent = `Peringatan Pengawas: Pandangan terdeteksi tidak fokus (${reason})! Harap fokus menghadap layar peramban.`;
      }
      if (currentViolationType !== 'LOOKING_AWAY') {
        currentViolationType = 'LOOKING_AWAY';
        violationStartTime = now;
      } else if (now - violationStartTime >= 2000 && now - lastViolationBeepTime > 6000) {
        lastViolationBeepTime = now;
        if (st) st.gazeViolations = (st.gazeViolations || 0) + 1;
        updateProctorViolationsUI();
        playSecurityBeep();
        persistSnapshot();
      }
      return;
    }

    if (status === 'NO_FACE') {
      if (badge) badge.className = 'proctor-badge danger';
      if (textEl) textEl.textContent = 'WAJAH TIDAK TERDETEKSI';
      if (overlay) overlay.className = 'proctor-target-overlay danger';
      if (banner && bannerText) {
        banner.className = 'proctor-warn-banner danger';
        bannerText.textContent = 'Peringatan Pengawas: Wajah tidak terdeteksi di kamera! Harap segera posisikan wajah menghadap layar simulasi.';
      }
      if (currentViolationType !== 'NO_FACE') {
        currentViolationType = 'NO_FACE';
        violationStartTime = now;
      } else if (now - violationStartTime >= 2000 && now - lastViolationBeepTime > 6000) {
        lastViolationBeepTime = now;
        if (st) st.faceMissingViolations = (st.faceMissingViolations || 0) + 1;
        updateProctorViolationsUI();
        playSecurityBeep();
        persistSnapshot();
      }
      return;
    }

    if (status === 'MULTI_FACE') {
      if (badge) badge.className = 'proctor-badge danger';
      if (textEl) textEl.textContent = 'TERDETEKSI >1 ORANG';
      if (overlay) overlay.className = 'proctor-target-overlay danger';
      if (banner && bannerText) {
        banner.className = 'proctor-warn-banner danger';
        bannerText.textContent = 'Peringatan Pengawas: Terdeteksi lebih dari 1 orang di depan kamera! Simulasi ini wajib dikerjakan mandiri tanpa pendamping.';
      }
      if (currentViolationType !== 'MULTI_FACE') {
        currentViolationType = 'MULTI_FACE';
        violationStartTime = now;
      } else if (now - violationStartTime >= 1500 && now - lastViolationBeepTime > 6000) {
        lastViolationBeepTime = now;
        if (st) st.multiFaceViolations = (st.multiFaceViolations || 0) + 1;
        updateProctorViolationsUI();
        playSecurityBeep();
        persistSnapshot();
      }
    }
  }

  function updateSmoothedFaceStatus(sample) {
    if (!sample) return;
    faceHistoryBuffer.push(sample);
    if (faceHistoryBuffer.length > 6) faceHistoryBuffer.shift();

    const noFaceCnt = faceHistoryBuffer.filter((x) => x.status === 'NO_FACE').length;
    const awayCnt = faceHistoryBuffer.filter((x) => x.status === 'LOOKING_AWAY').length;
    const multiCnt = faceHistoryBuffer.filter((x) => x.status === 'MULTI_FACE').length;
    const okCnt = faceHistoryBuffer.filter((x) => x.status === 'OK').length;

    let nextStatus = smoothedStatus;
    let nextReason = smoothedReason;

    if (noFaceCnt >= 5) {
      nextStatus = 'NO_FACE';
      nextReason = 'Wajah Tidak Terdeteksi di Kamera';
    } else if (multiCnt >= 4) {
      nextStatus = 'MULTI_FACE';
      nextReason = 'Terdeteksi Lebih dari 1 Orang';
    } else if (awayCnt >= 4) {
      nextStatus = 'LOOKING_AWAY';
      const lastAway = [...faceHistoryBuffer].reverse().find((x) => x.status === 'LOOKING_AWAY');
      nextReason = lastAway ? lastAway.reason : 'Menoleh ke Samping';
    } else if (okCnt >= 3) {
      nextStatus = 'OK';
      nextReason = 'Wajah Terdeteksi & Fokus';
    }

    smoothedStatus = nextStatus;
    smoothedReason = nextReason;
    applyFaceUi(smoothedStatus, smoothedReason);
  }

  function startFaceTrackingAI() {
    if (typeof document === 'undefined') return;
    if (aiVisionInterval) clearInterval(aiVisionInterval);
    lastTrackingResult = null;
    smoothedStatus = 'OK';
    smoothedReason = '';
    currentViolationType = 'OK';
    violationStartTime = 0;
    lastViolationBeepTime = 0;
    faceHistoryBuffer.length = 0;

    const overlay = document.getElementById('proctorTargetOverlay');
    if (overlay) overlay.classList.remove('hidden');
    initTrackingJsTracker();

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    aiVisionInterval = setInterval(async () => {
      const st = getExamState();
      if (!st || !st.isActive || st.mode !== 'cat' || st.isFinished) {
        stopFaceTrackingAI();
        return;
      }
      const video = document.getElementById('proctorVideo');
      if (!video || video.paused || video.ended || video.readyState < 2) return;

      let result = null;
      if (lastTrackingResult) result = lastTrackingResult;

      if (!result && nativeDetector) {
        try {
          const faces = await nativeDetector.detect(video);
          if (faces.length === 0) {
            result = { status: 'NO_FACE', reason: 'Wajah Tidak Terdeteksi di Kamera', count: 0 };
          } else if (faces.length > 1) {
            result = { status: 'MULTI_FACE', reason: 'Terdeteksi ' + faces.length + ' Orang', count: faces.length };
          } else {
            const f = faces[0];
            const vw = video.videoWidth || 320;
            const vh = video.videoHeight || 240;
            const cx = (f.boundingBox.x + f.boundingBox.width / 2) / vw;
            const cy = (f.boundingBox.y + f.boundingBox.height / 2) / vh;
            let away = false;
            let reason = '';
            if (cx < 0.2) { away = true; reason = 'Menoleh ke Samping Kiri'; }
            else if (cx > 0.8) { away = true; reason = 'Menoleh ke Samping Kanan'; }
            else if (cy > 0.82) { away = true; reason = 'Menunduk ke Bawah'; }
            else if (cy < 0.16) { away = true; reason = 'Mendongak ke Atas'; }

            if (f.landmarks) {
              const eyes = f.landmarks.filter((l) => l.type === 'eye');
              const nose = f.landmarks.find((l) => l.type === 'nose');
              if (eyes.length >= 2 && nose) {
                const eyeMidX = (eyes[0].locations[0].x + eyes[1].locations[0].x) / 2;
                const eyeDist = Math.abs(eyes[0].locations[0].x - eyes[1].locations[0].x) || 1;
                const offset = (nose.locations[0].x - eyeMidX) / eyeDist;
                if (Math.abs(offset) > 0.4) {
                  away = true;
                  reason = offset > 0 ? 'Menoleh ke Samping Kanan' : 'Menoleh ke Samping Kiri';
                }
              }
            }
            result = away
              ? { status: 'LOOKING_AWAY', reason, count: 1 }
              : { status: 'OK', reason: 'Wajah Terdeteksi & Fokus', count: 1 };
          }
        } catch (_) {
          result = null;
        }
      }

      if (!result && ctx) {
        try {
          ctx.drawImage(video, 0, 0, 160, 120);
          const data = ctx.getImageData(0, 0, 160, 120).data;
          let skinCount = 0;
          let sumX = 0;
          let sumY = 0;
          let minX = 160;
          let maxX = 0;
          let minY = 120;
          let maxY = 0;

          for (let y = 0; y < 120; y += 2) {
            for (let x = 0; x < 160; x += 2) {
              const idx = 4 * (160 * y + x);
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              if (
                r > 95 && g > 40 && b > 20 &&
                Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                Math.abs(r - g) > 15 && r > g && r > b
              ) {
                skinCount++;
                sumX += x;
                sumY += y;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          const ratio = skinCount / 4800;
          const boxH = maxY - minY;
          if (ratio < 0.04 || maxX - minX < 22 || boxH < 26) {
            result = { status: 'NO_FACE', reason: 'Wajah Tidak Terdeteksi di Kamera', count: 0 };
          } else if (ratio > 0.7) {
            result = { status: 'MULTI_FACE', reason: 'Terdeteksi Lebih dari 1 Objek / Orang', count: 2 };
          } else {
            let lumaSum = 0;
            let lumaSq = 0;
            let pixCnt = 0;
            let upperSum = 0;
            let upperCnt = 0;
            let midSum = 0;
            let midCnt = 0;

            for (let y = minY; y <= maxY; y += 2) {
              for (let x = minX; x <= maxX; x += 2) {
                const idx = 4 * (160 * y + x);
                const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                lumaSum += luma;
                lumaSq += luma * luma;
                pixCnt++;
                const relY = (y - minY) / (boxH || 1);
                if (relY >= 0.15 && relY <= 0.45) {
                  upperSum += luma;
                  upperCnt++;
                } else if (relY > 0.45 && relY <= 0.75) {
                  midSum += luma;
                  midCnt++;
                }
              }
            }

            const mean = pixCnt ? lumaSum / pixCnt : 0;
            const variance = pixCnt ? lumaSq / pixCnt - mean * mean : 0;
            const stdDev = Math.sqrt(Math.max(0, variance));
            const upperMean = upperCnt ? upperSum / upperCnt : 0;
            const midMean = midCnt ? midSum / midCnt : 0;

            if (stdDev >= 6 && (midMean - upperMean >= 2 || stdDev >= 11)) {
              const cx = sumX / skinCount / 160;
              const cy = sumY / skinCount / 120;
              if (cx < 0.2) result = { status: 'LOOKING_AWAY', reason: 'Menoleh ke Samping Kiri', count: 1 };
              else if (cx > 0.8) result = { status: 'LOOKING_AWAY', reason: 'Menoleh ke Samping Kanan', count: 1 };
              else if (cy > 0.82) result = { status: 'LOOKING_AWAY', reason: 'Menunduk ke Bawah', count: 1 };
              else if (cy < 0.16) result = { status: 'LOOKING_AWAY', reason: 'Mendongak ke Atas', count: 1 };
              else result = { status: 'OK', reason: 'Wajah Terdeteksi & Fokus', count: 1 };
            } else {
              result = { status: 'NO_FACE', reason: 'Wajah Tidak Terdeteksi di Kamera', count: 0 };
            }
          }
        } catch (_) {
          result = { status: 'NO_FACE', reason: 'Kamera Sedang Diinisialisasi', count: 0 };
        }
      }

      updateSmoothedFaceStatus(result);
    }, 250);
  }

  function stopFaceTrackingAI() {
    if (aiVisionInterval) {
      clearInterval(aiVisionInterval);
      aiVisionInterval = null;
    }
    if (trackingTask && typeof trackingTask.stop === 'function') {
      try {
        trackingTask.stop();
      } catch (_) {}
    }
    lastTrackingResult = null;
    faceHistoryBuffer.length = 0;
    if (typeof document !== 'undefined') {
      const banner = document.getElementById('proctorWarningBanner');
      if (banner) banner.className = 'proctor-warn-banner hidden';
      const overlay = document.getElementById('proctorTargetOverlay');
      if (overlay) overlay.classList.add('hidden');
    }
  }

  async function startWebcamStream() {
    const video = document.getElementById('proctorVideo');
    const placeholder = document.getElementById('proctorPlaceholder');
    const badge = document.getElementById('proctorStatusBadge');
    const statusText = document.getElementById('proctorStatusText');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('BROWSER_UNSUPPORTED');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      audio: false
    });
    mediaStream = stream;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch (_) {
        // Autoplay promise fallback
      }
      video.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
    }
    if (badge) badge.classList.remove('off');
    if (statusText) statusText.textContent = 'LIVE: MENCARI WAJAH...';
    return stream;
  }

  function stopWebcamStream() {
    stopFaceTrackingAI();
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (typeof document !== 'undefined') {
      const video = document.getElementById('proctorVideo');
      const placeholder = document.getElementById('proctorPlaceholder');
      const badge = document.getElementById('proctorStatusBadge');
      const statusText = document.getElementById('proctorStatusText');
      if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (badge) badge.classList.add('off');
      if (statusText) statusText.textContent = 'NONAKTIF';
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleProtectedContextMenu, true);
    document.addEventListener('mousedown', handleProtectedRightClickDown, true);
    document.addEventListener('auxclick', handleProtectedRightClickDown, true);
    document.addEventListener('copy', handleProtectedCopyOrCut, true);
    document.addEventListener('cut', handleProtectedCopyOrCut, true);
    document.addEventListener('selectstart', handleProtectedSelectStart, true);
    document.addEventListener('dragstart', handleProtectedDragStart, true);
    document.addEventListener('selectionchange', handleProtectedSelectionChange);
    document.addEventListener('keydown', handleProtectedKeydown, true);
    document.addEventListener('keyup', handleProtectedKeyup, true);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
  }

  return {
    playSecurityBeep,
    requestFullscreenLock,
    exitFullscreenLock,
    handleFullscreenChange,
    resumeFullscreenFromWarning,
    handleVisibilityChange,
    dismissTabSwitchWarning,
    updateProctorViolationsUI,
    startWebcamStream,
    stopWebcamStream,
    startFaceTrackingAI,
    stopFaceTrackingAI,
    isExamCopyProtected,
    syncCopyProtection,
    syncWatermark,
    clearFocusShield,
    triggerScreenshotShield,
    handleWindowBlur,
    handleWindowFocus,
    handleProtectedContextMenu,
    handleProtectedCopyOrCut,
    handleProtectedSelectStart,
    handleProtectedDragStart,
    handleProtectedSelectionChange,
    handleProtectedKeydown,
    handleProtectedKeyup
  };
})();

if (typeof window !== 'undefined') {
  window.Proctor = Proctor;
  window.playSecurityBeep = Proctor.playSecurityBeep;
  window.requestFullscreenLock = Proctor.requestFullscreenLock;
  window.exitFullscreenLock = Proctor.exitFullscreenLock;
  window.resumeFullscreenFromWarning = Proctor.resumeFullscreenFromWarning;
  window.dismissTabSwitchWarning = Proctor.dismissTabSwitchWarning;
  window.updateProctorViolationsUI = Proctor.updateProctorViolationsUI;
  window.startWebcamStream = Proctor.startWebcamStream;
  window.stopWebcamStream = Proctor.stopWebcamStream;
  window.startFaceTrackingAI = Proctor.startFaceTrackingAI;
  window.stopFaceTrackingAI = Proctor.stopFaceTrackingAI;
  window.isExamCopyProtected = Proctor.isExamCopyProtected;
  window.syncCopyProtection = Proctor.syncCopyProtection;
  window.clearFocusShield = Proctor.clearFocusShield;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Proctor };
}
