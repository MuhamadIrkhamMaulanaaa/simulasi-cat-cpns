// js/history.js - Persistent Exam History Ledger, Filtering & Past Attempt Review Mode

function histEsc(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const History = (function () {
  let scope = 'active'; // 'active' | 'all'

  function formatDurationShort(sec) {
    if (!sec || sec <= 0) return '-';
    if (typeof formatDurationId === 'function') return formatDurationId(sec);
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}m ${rem}s`;
  }

  function setScope(nextScope) {
    scope = nextScope === 'all' ? 'all' : 'active';
    render();
  }

  function getScopedEntries() {
    if (!window.Storage) return [];
    const activeUser = window.Storage.getActiveUser();
    if (scope === 'active' && activeUser) {
      return window.Storage.getHistory(activeUser.id);
    }
    return window.Storage.getHistory();
  }

  function renderSummary(entries) {
    const summaryEl = document.getElementById('historySummaryBar');
    if (!summaryEl) return;

    if (!entries.length) {
      summaryEl.innerHTML = '';
      summaryEl.classList.add('hidden');
      return;
    }

    summaryEl.classList.remove('hidden');
    const totalCount = entries.length;
    const skdEntries = entries.filter((e) => e.isFullSKD);
    const pgPassCount = skdEntries.filter((e) => e.passingGrade && e.passingGrade.passAll).length;
    const bestSkd = skdEntries.length
      ? Math.max(...skdEntries.map((e) => Number(e.totalScore) || 0))
      : null;
    const avgPct = Math.round(
      entries.reduce((acc, e) => acc + (Number(e.percentage) || 0), 0) / totalCount
    );

    summaryEl.innerHTML = `
      <div class="summary-stat-card">
        <span class="summary-stat-label">Total Percobaan</span>
        <strong class="summary-stat-value">${totalCount}</strong>
        <span class="summary-stat-sub">${skdEntries.length} Simulasi SKD Penuh</span>
      </div>
      <div class="summary-stat-card">
        <span class="summary-stat-label">Skor SKD Tertinggi</span>
        <strong class="summary-stat-value">${bestSkd !== null ? bestSkd : '-'}</strong>
        <span class="summary-stat-sub">${bestSkd !== null ? (bestSkd >= 430 ? 'Target ≥430 Tercapai' : 'Target Kompetitif: 430+') : 'Belum ada SKD penuh'}</span>
      </div>
      <div class="summary-stat-card">
        <span class="summary-stat-label">Lulus PG SKD</span>
        <strong class="summary-stat-value">${skdEntries.length ? `${pgPassCount}/${skdEntries.length}` : '-'}</strong>
        <span class="summary-stat-sub">KepmenPANRB 321/2024</span>
      </div>
      <div class="summary-stat-card">
        <span class="summary-stat-label">Rata-Rata Akurasi</span>
        <strong class="summary-stat-value">${avgPct}%</strong>
        <span class="summary-stat-sub">Maksimal 50 riwayat tersimpan</span>
      </div>
    `;
  }

  function renderScopeControls() {
    const toggleEl = document.getElementById('historyScopeToggle');
    if (!toggleEl || !window.Storage) return;
    const activeUser = window.Storage.getActiveUser();
    const allCount = window.Storage.getHistory().length;
    const myCount = activeUser ? window.Storage.getHistory(activeUser.id).length : 0;

    if (!activeUser) {
      toggleEl.innerHTML = `
        <span class="scope-hint">Menampilkan seluruh riwayat di perangkat ini (${allCount} entri). Masuk akun untuk memfilter riwayat pribadi.</span>
      `;
      return;
    }

    toggleEl.innerHTML = `
      <div class="filter-pills">
        <button type="button" class="filter-pill ${scope === 'active' ? 'active' : ''}" onclick="setHistoryScope('active')">
          Riwayat ${histEsc((activeUser.nama || 'Peserta').split(' ')[0])} (${myCount})
        </button>
        <button type="button" class="filter-pill ${scope === 'all' ? 'active' : ''}" onclick="setHistoryScope('all')">
          Semua Akun di Perangkat (${allCount})
        </button>
      </div>
    `;
  }

  function render() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('historyContainer');
    if (!container) return;

    renderScopeControls();
    const entries = getScopedEntries();
    renderSummary(entries);

    if (!entries.length) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 16c-2.05 0-3.81-1.24-4.58-3h1.71c.63.9 1.68 1.5 2.87 1.5 1.93 0 3.5-1.57 3.5-3.5S13.93 9.5 12 9.5c-1.35 0-2.52.78-3.1 1.9l1.6 1.6h-4V9l1.3 1.3C8.69 8.92 10.23 8 12 8c2.76 0 5 2.24 5 5s-2.24 5-5 5z"/></svg>
          </div>
          <div class="empty-state-title">Belum Ada Riwayat Simulasi</div>
          <p>Anda belum memiliki riwayat penyelesaian simulasi pada tampilan ini. Mulai salah satu paket ujian CAT untuk merekam nilai, status passing grade, dan review pembahasan lengkap.</p>
          <button type="button" class="btn btn-primary" onclick="switchHomeTab('pkg', true)">+ Mulai Simulasi CAT</button>
        </div>
      `;
      return;
    }

    const rowsHtml = entries
      .map((entry) => {
        const s = entry.scoresByGroup || {};
        const pg = entry.passingGrade || {};
        const v = entry.violations || {};
        const violTotal = typeof v === 'object' ? (v.total || 0) : (Number(v) || 0);

        let subtestHtml = '';
        if (entry.isFullSKD) {
          subtestHtml = `
            <div class="hist-subtest-badges">
              <span class="sub-chip ${pg.passTWK ? 'ok' : 'fail'}">TWK ${s.TWK || 0}</span>
              <span class="sub-chip ${pg.passTIU ? 'ok' : 'fail'}">TIU ${s.TIU || 0}</span>
              <span class="sub-chip ${pg.passTKP ? 'ok' : 'fail'}">TKP ${s.TKP || 0}</span>
            </div>
          `;
        } else if (s && Object.keys(s).some((k) => s[k] > 0)) {
          const nonZero = Object.entries(s)
            .filter(([, val]) => val > 0)
            .map(([k, val]) => `<span class="sub-chip neutral">${histEsc(k)} ${val}</span>`)
            .join('');
          subtestHtml = `<div class="hist-subtest-badges">${nonZero}</div>`;
        } else {
          subtestHtml = '<span style="font-size:0.78rem; color:var(--text-muted);">-</span>';
        }

        let statusBadge = '';
        if (entry.isFullSKD) {
          if (pg.isCompetitive) {
            statusBadge = '<span class="history-badge pass">KOMPETITIF ≥430</span>';
          } else if (pg.passAll) {
            statusBadge = '<span class="history-badge pass">LULUS PG</span>';
          } else {
            statusBadge = '<span class="history-badge fail">BELUM PG</span>';
          }
        } else {
          const ok = (entry.percentage || 0) >= 70;
          statusBadge = `<span class="history-badge ${ok ? 'pass' : 'fail'}">${entry.percentage || 0}% Akurasi</span>`;
        }

        const violBadge = violTotal > 0
          ? `<span class="integrity-badge warn">${violTotal} Pelanggaran</span>`
          : '<span class="integrity-badge clean">Bersih</span>';

        const actionsHtml = entry.answersLedger
          ? `
            <div class="hist-actions">
              <button type="button" class="btn btn-primary btn-xs" onclick="reviewHistoryEntry('${histEsc(entry.id)}', false)">Review Pembahasan</button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="reviewHistoryEntry('${histEsc(entry.id)}', true)">Soal Salah</button>
            </div>
          `
          : '<span class="badge-tag-amber">Arsip Versi Lama</span>';

        return `
          <tr>
            <td>
              <div style="font-weight:600; color:var(--text-primary);">${histEsc(entry.dateFormatted || '-')}</div>
              <div style="font-size:0.76rem; color:var(--text-muted);">${histEsc(entry.userNama || 'Peserta Mandiri')}</div>
            </td>
            <td>
              <div style="font-weight:600; color:var(--text-primary);">${histEsc(entry.pkgTitle)}</div>
              <div style="font-size:0.76rem; color:var(--text-muted);">Mode: ${entry.mode === 'study' ? 'Latihan' : 'CAT BKN'} • Durasi: ${histEsc(formatDurationShort(entry.durationSeconds))}</div>
            </td>
            <td>
              <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">${entry.totalScore} / ${entry.maxScore}</div>
              ${subtestHtml}
            </td>
            <td>${statusBadge}</td>
            <td>${violBadge}</td>
            <td>${actionsHtml}</td>
          </tr>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="table-responsive-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>Waktu &amp; Peserta</th>
              <th>Paket &amp; Durasi</th>
              <th>Skor &amp; Subtes</th>
              <th>Status PG</th>
              <th>Integritas</th>
              <th>Tinjauan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  function reviewEntry(historyId, onlyMistakes = false) {
    if (!window.Storage || !window.Exam) return;
    const all = window.Storage.getHistory();
    const target = all.find((item) => item && item.id === historyId);
    if (!target) {
      alert('Entri riwayat tidak ditemukan.');
      return;
    }
    window.Exam.openReviewForEntry(target, onlyMistakes);
  }

  function clearHistory() {
    if (!window.Storage) return;
    const activeUser = window.Storage.getActiveUser();
    const clearMyOnly = scope === 'active' && activeUser;
    const msg = clearMyOnly
      ? `Hapus seluruh riwayat ujian milik ${activeUser.nama}? Riwayat akun lain di perangkat ini tetap aman.`
      : 'Apakah Anda yakin ingin menghapus SELURUH riwayat ujian di perangkat ini?';

    if (!confirm(msg)) return;
    window.Storage.clearHistory(clearMyOnly ? activeUser.id : null);
    render();
    if (window.Landing && typeof window.Landing.refresh === 'function') {
      window.Landing.refresh();
    }
  }

  return {
    render,
    setScope,
    reviewEntry,
    clearHistory
  };
})();

if (typeof window !== 'undefined') {
  window.History = History;
  window.renderHistory = History.render;
  window.setHistoryScope = History.setScope;
  window.reviewHistoryEntry = History.reviewEntry;
  window.clearHistory = History.clearHistory;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { History };
}
