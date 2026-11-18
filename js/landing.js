// js/landing.js - Interactive Landing Page, Crash Recovery Banner, Summary Stats & Package Filter/Search

function landEsc(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const Landing = (function () {
  let activeCategory = 'all'; // 'all' | 'skd' | 'drill' | 'skb'
  let searchQuery = '';
  let activeHeroSlide = 0;
  let activeTimelineTrack = 'skd';
  let heroAutoTimer = null;

  const HERO_SLIDES = [
    {
      title: 'Seleksi CPNS &amp; Sekolah Kedinasan 2027',
      tag: 'Pelaksanaan SKD &amp; SKB Metode CAT BKN • 610 Soal',
      desc: 'Ikuti simulasi CAT BKN 110 soal (100 menit) sesuai KepmenPANRB 321/2024 lengkap dengan timer anti-drift, pengawasan kamera proctor, serta review rumus cepat &lt;15 detik.'
    },
    {
      title: 'Target Passing Grade &amp; Ranking BKN',
      tag: 'TWK &ge; 65 &bull; TIU &ge; 80 &bull; TKP &ge; 166 &bull; Aman &ge; 430',
      desc: 'Pantau ambang batas per subtes secara real-time, lengkap dengan algoritma pemutus seri resmi BKN (TKP &rarr; TIU &rarr; TWK) dan rekap progres tiap peserta.'
    },
    {
      title: 'Karantina Layar Penuh &amp; Anti-Cheat',
      tag: 'Fullscreen Lock &bull; Anti-Copy &bull; Auto-Save Tahan Refresh',
      desc: 'Berlatih di lingkungan ujian steril bebas salin soal &amp; tangkapan layar, dilengkapi pemulihan sesi otomatis saat terjadi kendala koneksi atau penutupan tidak sengaja.'
    }
  ];

  const PACKAGE_SHOWCASE_TRACKS = {
    skd: {
      ids: ['skd_hots', 'skd_p1', 'skd_p2', 'skd_p3', 'fr_bocoran'],
      icons: { skd_hots: 'award', skd_p1: 'doc', skd_p2: 'grad', skd_p3: 'shield', fr_bocoran: 'calc' },
      shortNames: {
        skd_hots: 'Tryout SKD Utama HOTS',
        skd_p1: 'Tryout SKD Paket 1 Nasional',
        skd_p2: 'Tryout SKD Paket 2 Kedinasan',
        skd_p3: 'Tryout SKD Paket 3 Siber',
        fr_bocoran: 'Drill FR Sekolah Kedinasan'
      }
    },
    drill: {
      ids: ['fr_bocoran', 'twk_drill', 'tiu_drill', 'tkp_drill'],
      icons: { fr_bocoran: 'calc', twk_drill: 'book', tiu_drill: 'doc', tkp_drill: 'shield' },
      shortNames: {
        fr_bocoran: 'FR Kedinasan Kotak & SVG',
        twk_drill: 'Bank Drill Fokus TWK',
        tiu_drill: 'Bank Drill Fokus TIU & SVG',
        tkp_drill: 'Bank Drill Fokus TKP'
      }
    },
    skb: {
      ids: ['skb_p4', 'skb_hots', 'skb_prakom', 'skb_ptp_guru'],
      icons: { skb_p4: 'award', skb_hots: 'shield', skb_prakom: 'calc', skb_ptp_guru: 'grad' },
      shortNames: {
        skb_p4: 'SKB Penuh CAT BKN (100 Soal)',
        skb_hots: 'Paket Inti HOTS SKB',
        skb_prakom: 'SKB Pranata Komputer & TI',
        skb_ptp_guru: 'SKB PTP & Guru Informatika'
      }
    }
  };

  function getTimelineIconSvg(name) {
    const paths = {
      user: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
      card: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 11H5v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z',
      doc: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
      cam: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
      check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      calc: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5.97 4.06L14.09 6l1.41 1.41L16.91 6l1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.4-1.41 1.41-1.06-1.06 1.41-1.41-1.41-1.42zm-6.78.66h5v1.5h-5v-1.5zM11.5 16h-2v2H8v-2H6v-1.5h2v-2h1.5v2h2V16zm6.5 1.25h-5v-1.5h5v1.5zm0-2.5h-5v-1.5h5v1.5z',
      shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
      award: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
      book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
      grad: 'M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z'
    };
    const d = paths[name] || paths.doc;
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  function renderHeroSlide() {
    if (typeof document === 'undefined') return;
    const slide = HERO_SLIDES[activeHeroSlide] || HERO_SLIDES[0];
    const titleEl = document.getElementById('heroTitleText');
    const tagEl = document.getElementById('heroTagText');
    const subEl = document.getElementById('heroSubtitleText');
    const dotsEl = document.getElementById('heroSlideDots');
    if (titleEl) titleEl.innerHTML = slide.title;
    if (tagEl) tagEl.innerHTML = slide.tag;
    if (subEl) subEl.innerHTML = slide.desc;
    if (dotsEl) {
      dotsEl.innerHTML = HERO_SLIDES.map((_, idx) => `
        <button type="button" class="hero-slide-dot ${idx === activeHeroSlide ? 'active' : ''}" onclick="setHeroSlide(${idx})" aria-label="Slide ${idx + 1}"></button>
      `).join('');
    }
  }

  function setHeroSlide(idx) {
    activeHeroSlide = ((idx % HERO_SLIDES.length) + HERO_SLIDES.length) % HERO_SLIDES.length;
    renderHeroSlide();
  }

  function nextHeroSlide() {
    setHeroSlide(activeHeroSlide + 1);
  }

  function prevHeroSlide() {
    setHeroSlide(activeHeroSlide - 1);
  }

  function renderTimeline() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('timelineBoardContainer');
    const pillsEl = document.getElementById('timelineTrackPills');
    if (!container) return;

    const tracks = [
      { id: 'skd', label: 'Simulasi SKD CPNS &amp; Sekolah Kedinasan' },
      { id: 'drill', label: 'Drill Fokus TWK · TIU · TKP' },
      { id: 'skb', label: 'Tryout SKB Teknis &amp; Guru' }
    ];
    if (pillsEl) {
      pillsEl.innerHTML = tracks.map((t) => `
        <button type="button" class="timeline-pill-btn ${activeTimelineTrack === t.id ? 'active' : ''}" onclick="setTimelineTrack('${t.id}')">${t.label}</button>
      `).join('');
    }

    const pkgs = window.PACKAGES || [];
    const allQ = window.ALL_QUESTIONS || [];
    const cfg = PACKAGE_SHOWCASE_TRACKS[activeTimelineTrack] || PACKAGE_SHOWCASE_TRACKS.skd;
    const items = cfg.ids
      .map((id) => pkgs.find((p) => p.id === id))
      .filter(Boolean);

    const colClass = items.length === 4 ? 'cols-4' : items.length === 3 ? 'cols-3' : '';
    const isLoggedIn = Boolean(window.Storage && window.Storage.getActiveUser());

    container.innerHTML = `
      <div class="timeline-row ${colClass}">
        ${items.map((pkg) => {
          const matched = allQ.filter(pkg.filter);
          const qCount = matched.length;
          const subSummary = getSubtestSummary(matched);
          const locked = typeof window.isPackageLocked === 'function' ? window.isPackageLocked(pkg.id) : false;
          const iconName = (cfg.icons && cfg.icons[pkg.id]) || 'doc';
          const shortTitle = (cfg.shortNames && cfg.shortNames[pkg.id]) || pkg.title;
          const actionLabel = isLoggedIn ? 'Mulai Tryout' : 'Masuk &amp; Mulai';
          return `
            <div class="timeline-step-card is-package">
              <div class="timeline-icon-box">
                ${getTimelineIconSvg(iconName)}
                <span class="timeline-status-dot ${locked ? 'next' : 'done'}" title="${locked ? 'Akses Terkunci' : 'Gratis'}">${locked ? '&#128274;' : '&#10003;'}</span>
              </div>
              <div class="timeline-step-title">${landEsc(shortTitle)}</div>
              <div class="timeline-step-date">${qCount} Soal &bull; ${pkg.minutes} Menit</div>
              <div class="timeline-step-desc">${landEsc(subSummary || (pkg.isFullSKD ? 'Standar KepmenPANRB 321' : 'Latihan Intensif'))}</div>
              <button type="button" class="timeline-step-btn" onclick="openPortalTabOrLogin('pkg', '${landEsc(pkg.id)}')">${actionLabel}</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function setTimelineTrack(trackId) {
    activeTimelineTrack = PACKAGE_SHOWCASE_TRACKS[trackId] ? trackId : 'skd';
    renderTimeline();
  }

  function ensureHeroCarouselRunning() {
    if (typeof window === 'undefined' || heroAutoTimer) return;
    heroAutoTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.body && !document.body.classList.contains('in-exam') && !document.body.classList.contains('is-logged-in')) {
        nextHeroSlide();
      }
    }, 6500);
  }

  function getCategoryOfPackage(pkg) {
    if (pkg.isFullSKD) return 'skd';
    if (pkg.id && pkg.id.startsWith('skb_')) return 'skb';
    return 'drill';
  }

  function getSubtestSummary(questionsForPkg) {
    const groups = {};
    questionsForPkg.forEach((q) => {
      const g = q.group || 'SOAL';
      groups[g] = (groups[g] || 0) + 1;
    });
    return Object.entries(groups).map(([k, v]) => `${k} ${v}`).join(' • ');
  }

  function formatCountdown(sec) {
    const s = Math.max(0, Math.round(sec));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function renderRecoveryBanner() {
    if (typeof document === 'undefined' || !window.Storage) return;
    const el = document.getElementById('examRecoveryBanner');
    if (!el) return;

    const activeUser = window.Storage.getActiveUser();
    const targetUserId = activeUser ? activeUser.id : 'ANON';
    const snap = typeof window.Storage.getActiveExamSnapshotForUser === 'function'
      ? window.Storage.getActiveExamSnapshotForUser(targetUserId)
      : window.Storage.getActiveExamSnapshot();

    if (!snap || !snap.pkgId) {
      if (!activeUser && typeof window.Storage.hasAccountSavedExam === 'function' && window.Storage.hasAccountSavedExam()) {
        el.classList.remove('hidden');
        el.innerHTML = `
          <div class="recovery-banner-inner">
            <div class="recovery-banner-info">
              <span class="recovery-pill">SESI UJIAN TERPROTEKSI AKUN</span>
              <h3 class="recovery-title">Terdapat sesi simulasi CAT yang belum selesai milik akun terdaftar</h3>
              <p class="recovery-meta">Masuk ke akun peserta Anda menggunakan No. Peserta / Email dan PIN 6 digit untuk melanjutkan atau mengelola sesi tersebut.</p>
            </div>
            <div class="recovery-banner-actions">
              <button type="button" class="btn btn-primary" onclick="openAuthModal(null, 'login')">Masuk Akun Peserta</button>
            </div>
          </div>
        `;
        return;
      }
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }

    const pkgs = window.PACKAGES || [];
    const pkg = pkgs.find((p) => p.id === snap.pkgId);
    if (!pkg) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }

    const allQ = window.ALL_QUESTIONS || [];
    const totalQ = allQ.filter(pkg.filter).length;
    const answeredCount = snap.answers ? Object.keys(snap.answers).length : 0;
    const isTimed = snap.mode !== 'study';
    const remainingSec = Math.max(0, Math.round(((Number(snap.examEndTime) || 0) - Date.now()) / 1000));
    const expired = isTimed && remainingSec <= 0;
    const timeLabel = !isTimed
      ? 'Tanpa Batas (Latihan Mandiri)'
      : (expired ? '00:00:00 (Habis)' : formatCountdown(remainingSec));
    const resumeLabel = !isTimed
      ? 'Lanjutkan Latihan Sekarang'
      : (expired ? 'Kunci &amp; Nilai Hasil Sesi' : 'Lanjutkan Ujian Sekarang');

    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="recovery-banner-inner ${expired ? 'is-expired' : ''}">
        <div class="recovery-banner-info">
          <span class="recovery-pill">${expired ? 'SESI UJIAN HABIS WAKTU' : 'SESI UJIAN TERSIMPAN DITEMUKAN'}</span>
          <h3 class="recovery-title">${landEsc(pkg.title)}</h3>
          <p class="recovery-meta">
            Mode: <strong>${!isTimed ? 'Latihan Mandiri' : 'Simulasi CAT BKN'}</strong>
            &bull; Terjawab: <strong>${answeredCount} / ${totalQ} soal</strong>
            &bull; Sisa Waktu: <strong>${timeLabel}</strong>
          </p>
        </div>
        <div class="recovery-banner-actions">
          <button type="button" class="btn btn-primary" onclick="resumeSavedExam()">
            ${resumeLabel}
          </button>
          <button type="button" class="btn btn-outline" onclick="discardSavedExam()">Buang Sesi</button>
        </div>
      </div>
    `;
  }

  function renderHeroAndAuthCTA() {
    if (typeof document === 'undefined') return;
    const ctaWrap = document.getElementById('heroAuthCtaBtn');
    if (!ctaWrap || !window.Storage) return;

    const user = window.Storage.getActiveUser();
    if (user) {
      const firstName = (user.nama || 'Peserta').split(' ')[0];
      ctaWrap.textContent = `Kartu Peserta (${firstName})`;
      ctaWrap.setAttribute('onclick', 'openUserProfileModal()');
    } else {
      ctaWrap.textContent = 'Daftar / Masuk Peserta';
      ctaWrap.setAttribute('onclick', 'openAuthModal()');
    }
  }

  function renderPersonalSummaryBar() {
    if (typeof document === 'undefined' || !window.Storage) return;
    const el = document.getElementById('personalSummaryBar');
    if (!el) return;

    const user = window.Storage.getActiveUser();
    const entries = user
      ? window.Storage.getHistory(user.id)
      : window.Storage.getHistory();

    const totalCompleted = entries.length;
    const skdAttempts = entries.filter((e) => e.isFullSKD);
    const highestSkd = skdAttempts.length
      ? Math.max(...skdAttempts.map((e) => Number(e.totalScore) || 0))
      : null;
    const latestSkd = skdAttempts.length ? skdAttempts[0] : null;
    const avgAccuracy = totalCompleted
      ? Math.round(entries.reduce((acc, e) => acc + (Number(e.percentage) || 0), 0) / totalCompleted)
      : null;

    let lastPgText = 'Belum Ada SKD';
    let lastPgBadge = 'neutral';
    let lastPgSub = 'Coba Tryout SKD 110 soal';
    if (latestSkd && latestSkd.passingGrade) {
      if (latestSkd.passingGrade.isCompetitive) {
        lastPgText = 'KOMPETITIF';
        lastPgBadge = 'pass';
        lastPgSub = `Skor ${latestSkd.totalScore} (≥ 430)`;
      } else if (latestSkd.passingGrade.passAll) {
        lastPgText = 'LULUS PG';
        lastPgBadge = 'pass';
        lastPgSub = `Skor ${latestSkd.totalScore} (3/3 Subtes)`;
      } else {
        lastPgText = 'BELUM PG';
        lastPgBadge = 'fail';
        lastPgSub = `Skor ${latestSkd.totalScore} — Evaluasi subtes`;
      }
    }

    const skdPctVs430 = highestSkd !== null ? Math.min(100, Math.round((highestSkd / 430) * 100)) : 0;

    el.innerHTML = `
      <div class="summary-stat-card">
        <span class="summary-stat-label">${user ? 'Simulasi Anda Selesai' : 'Simulasi di Perangkat'}</span>
        <strong class="summary-stat-value">${totalCompleted}</strong>
        <span class="summary-stat-sub">${user ? `${landEsc((user.nama || 'Peserta').split(' ')[0])} (${landEsc(user.noPeserta)})` : 'Masuk akun untuk isolasi progres'}</span>
      </div>
      <div class="summary-stat-card">
        <span class="summary-stat-label">Skor SKD Tertinggi vs 430+</span>
        <strong class="summary-stat-value">${highestSkd !== null ? highestSkd : '-'} <span class="summary-stat-denom">/ 550</span></strong>
        <div class="mini-progress-bar"><span style="width:${skdPctVs430}%"></span></div>
        <span class="summary-stat-sub">${highestSkd !== null ? (highestSkd >= 430 ? 'Melampaui target kompetitif 430+' : `Kurang ${430 - highestSkd} poin ke zona 430`) : 'Target aman 3x formasi: ≥ 430'}</span>
      </div>
      <div class="summary-stat-card">
        <span class="summary-stat-label">Status Passing Grade Terakhir</span>
        <strong class="summary-stat-value pg-status-${lastPgBadge}">${lastPgText}</strong>
        <span class="summary-stat-sub">${landEsc(lastPgSub)}</span>
      </div>
      <div class="summary-stat-card">
        <span class="summary-stat-label">Rata-Rata Akurasi</span>
        <strong class="summary-stat-value">${avgAccuracy !== null ? `${avgAccuracy}%` : '-'}</strong>
        <span class="summary-stat-sub">${totalCompleted ? `Dari ${totalCompleted} riwayat tersimpan` : 'Belum ada nilai tercatat'}</span>
      </div>
    `;
  }

  function renderFilterBar() {
    if (typeof document === 'undefined') return;
    const pillsEl = document.getElementById('pkgFilterPills');
    if (!pillsEl) return;

    const pkgs = window.PACKAGES || [];
    const counts = { all: pkgs.length, skd: 0, drill: 0, skb: 0 };
    pkgs.forEach((p) => {
      counts[getCategoryOfPackage(p)]++;
    });

    const defs = [
      { id: 'all', label: `Semua Paket (${counts.all})` },
      { id: 'skd', label: `Simulasi SKD Full (${counts.skd})` },
      { id: 'drill', label: `Drill Fokus &amp; FR (${counts.drill})` },
      { id: 'skb', label: `SKB Teknis &amp; Pendidik (${counts.skb})` }
    ];

    pillsEl.innerHTML = defs
      .map((d) => `
        <button type="button" class="filter-pill ${activeCategory === d.id ? 'active' : ''}" onclick="setPackageCategory('${d.id}')">
          ${d.label}
        </button>
      `)
      .join('');
  }

  function getBestAttemptMap() {
    const map = {};
    if (!window.Storage) return map;
    const user = window.Storage.getActiveUser();
    const entries = user ? window.Storage.getHistory(user.id) : [];
    entries.forEach((entry) => {
      if (!entry || !entry.pkgId) return;
      const prev = map[entry.pkgId];
      if (!prev || (Number(entry.totalScore) || 0) > (Number(prev.totalScore) || 0)) {
        map[entry.pkgId] = entry;
      }
    });
    return map;
  }

  function renderPackages() {
    if (typeof document === 'undefined') return;
    renderFilterBar();
    const container = document.getElementById('packageList');
    if (!container) return;

    const pkgs = window.PACKAGES || [];
    const allQ = window.ALL_QUESTIONS || [];
    const bestMap = getBestAttemptMap();
    const qLower = searchQuery.trim().toLowerCase();

    const filtered = pkgs.filter((pkg) => {
      const catOk = activeCategory === 'all' || getCategoryOfPackage(pkg) === activeCategory;
      if (!catOk) return false;
      if (!qLower) return true;
      const hay = `${pkg.title} ${pkg.desc} ${pkg.tag} ${pkg.id}`.toLowerCase();
      return hay.includes(qLower);
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1;">
          <p>Tidak ada paket simulasi yang cocok dengan pencarian "<strong>${landEsc(searchQuery)}</strong>".</p>
          <button type="button" class="btn btn-secondary" onclick="resetPackageFilters()">Tampilkan Semua Paket</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((pkg) => {
        const matchedQuestions = allQ.filter(pkg.filter);
        const qCount = matchedQuestions.length;
        const subtestText = getSubtestSummary(matchedQuestions);
        const locked = typeof window.isPackageLocked === 'function' ? window.isPackageLocked(pkg.id) : false;
        const best = bestMap[pkg.id];

        const bestBadgeHtml = best
          ? `<span class="pkg-best-badge" title="Skor terbaik Anda pada paket ini">Terbaik: ${best.totalScore}/${best.maxScore} (${best.percentage}%)</span>`
          : '';

        const pgBadgeHtml = pkg.isFullSKD
          ? '<span class="pkg-meta-chip pg">PG: 65 / 80 / 166</span>'
          : '';

        const actionsHtml = locked
          ? `
            <button type="button" class="btn btn-primary" onclick="openLockedPackage('${landEsc(pkg.id)}', 'cat')" style="background:#0284c7; border:none; display:inline-flex; align-items:center; gap:5px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              Mulai CAT (Terkunci)
            </button>
            <button type="button" class="btn btn-outline" onclick="openLockedPackage('${landEsc(pkg.id)}', 'study')" style="border-color:#0284c7; color:#0284c7;">Latihan (Terkunci)</button>
          `
          : `
            <button type="button" class="btn btn-primary" onclick="openPrepModal('${landEsc(pkg.id)}')">Mulai Simulasi CAT</button>
            <button type="button" class="btn btn-secondary" onclick="startDirectPackage('${landEsc(pkg.id)}', 'study')">Latihan Mandiri</button>
          `;

        return `
          <div class="package-card ${pkg.featured ? 'featured' : ''}">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
                <span class="pkg-badge" style="margin-bottom:0;">${landEsc(pkg.tag)}</span>
                ${locked ? '<span class="badge-tag-red">TERKUNCI</span>' : '<span class="badge-tag-green">GRATIS</span>'}
              </div>
              <h3 class="pkg-title">${landEsc(pkg.title)}</h3>
              <div class="pkg-meta-row">
                <span class="pkg-meta-chip">${qCount} Soal</span>
                <span class="pkg-meta-chip">${pkg.minutes} Menit</span>
                ${subtestText ? `<span class="pkg-meta-chip sub">${landEsc(subtestText)}</span>` : ''}
                ${pgBadgeHtml}
                ${bestBadgeHtml}
              </div>
              <p class="pkg-desc">${landEsc(pkg.desc)}</p>
            </div>
            <div class="pkg-footer">
              ${actionsHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function setPackageCategory(cat) {
    activeCategory = cat || 'all';
    renderPackages();
  }

  function setPackageSearch(val) {
    searchQuery = val || '';
    const clearBtn = document.getElementById('btnClearPkgSearch');
    if (clearBtn) clearBtn.classList.toggle('hidden', !searchQuery.trim());
    renderPackages();
  }

  function resetPackageFilters() {
    activeCategory = 'all';
    searchQuery = '';
    const input = document.getElementById('pkgSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('btnClearPkgSearch');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderPackages();
  }

  function refresh() {
    renderHeroSlide();
    ensureHeroCarouselRunning();
    renderTimeline();
    renderRecoveryBanner();
    renderHeroAndAuthCTA();
    renderPersonalSummaryBar();
    renderPackages();
  }

  return {
    refresh,
    renderRecoveryBanner,
    renderPersonalSummaryBar,
    renderPackages,
    setPackageCategory,
    setPackageSearch,
    resetPackageFilters,
    setHeroSlide,
    nextHeroSlide,
    prevHeroSlide,
    setTimelineTrack
  };
})();

if (typeof window !== 'undefined') {
  window.Landing = Landing;
  window.renderPackages = Landing.renderPackages;
  window.setPackageCategory = Landing.setPackageCategory;
  window.setPackageSearch = Landing.setPackageSearch;
  window.resetPackageFilters = Landing.resetPackageFilters;
  window.setHeroSlide = Landing.setHeroSlide;
  window.nextHeroSlide = Landing.nextHeroSlide;
  window.prevHeroSlide = Landing.prevHeroSlide;
  window.setTimelineTrack = Landing.setTimelineTrack;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Landing };
}
