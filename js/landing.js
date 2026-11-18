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
    resetPackageFilters
  };
})();

if (typeof window !== 'undefined') {
  window.Landing = Landing;
  window.renderPackages = Landing.renderPackages;
  window.setPackageCategory = Landing.setPackageCategory;
  window.setPackageSearch = Landing.setPackageSearch;
  window.resetPackageFilters = Landing.resetPackageFilters;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Landing };
}
