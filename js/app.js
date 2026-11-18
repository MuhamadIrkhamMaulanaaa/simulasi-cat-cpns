// js/app.js - Application Bootstrap, Screen Router, Theme & Feature Modals

let passwordSuccessCallback = null;

function initTheme() {
  if (typeof document === 'undefined') return;
  const saved = window.Storage && window.STORAGE_KEYS
    ? window.Storage.getRaw(window.STORAGE_KEYS.THEME, 'light')
    : 'light';
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
}

function toggleTheme() {
  if (typeof document === 'undefined') return;
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  if (window.Storage && window.STORAGE_KEYS) {
    window.Storage.setRaw(window.STORAGE_KEYS.THEME, next);
  }
}

function openDonationModal() {
  const m = document.getElementById('modalDonation');
  if (m) m.classList.remove('hidden');
}

function closeDonationModal() {
  const m = document.getElementById('modalDonation');
  if (m) m.classList.add('hidden');
}

function confirmDonationDone() {
  alert('Terima kasih banyak atas ketulusan dan kebaikan Anda!\n\nSetiap rupiah donasi Anda sangat berarti untuk operasional server cepat & penambahan soal baru. Semoga Anda sukses dan LULUS menjadi ASN CPNS 2027!');
  closeDonationModal();
}

function isFeatureUnlocked() {
  try {
    const hasAdmin = typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('admin') === 'true';
    const hasLs = window.Storage && window.STORAGE_KEYS
      ? window.Storage.getRaw(window.STORAGE_KEYS.FEATURE_UNLOCKED, null) === 'true'
      : false;
    return hasAdmin || hasLs;
  } catch (_) {
    return false;
  }
}

function updateLockBadges() {
  const unlocked = isFeatureUnlocked();
  ['materiLockBadge', 'materiLockBadge1', 'materiLockBadge2'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = unlocked ? 'TERBUKA' : 'TERKUNCI';
    el.classList.toggle('badge-tag-green', unlocked);
    el.classList.toggle('badge-tag-red', !unlocked);
  });
}

function unlockFeaturePermanently() {
  if (window.Storage && window.STORAGE_KEYS) {
    window.Storage.setRaw(window.STORAGE_KEYS.FEATURE_UNLOCKED, 'true');
  }
  updateLockBadges();
  if (window.Landing) window.Landing.renderPackages();
}

function lockFeaturesManually() {
  if (window.Storage && window.STORAGE_KEYS) {
    window.Storage.removeRaw(window.STORAGE_KEYS.FEATURE_UNLOCKED);
  }
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  updateLockBadges();
  if (window.Landing) window.Landing.renderPackages();
  alert('Seluruh paket fokus TWK/TIU/TKP, Modul Belajar Jilid 1 & 2, serta SKB telah berhasil dikunci kembali.');
  if (typeof window.closeUserProfileModal === 'function') window.closeUserProfileModal();
}

function openPasswordModal(title, desc, callback, waCustomText) {
  passwordSuccessCallback = typeof callback === 'function' ? callback : null;
  const titleEl = document.getElementById('lockModalTitle');
  const descEl = document.getElementById('lockModalDesc');
  const inputEl = document.getElementById('inputFeaturePassword');
  const errEl = document.getElementById('lockPasswordError');
  const waBtn = document.getElementById('btnLockWaRequest');

  if (titleEl && title) titleEl.textContent = title;
  if (descEl && desc) descEl.textContent = desc;
  if (inputEl) {
    inputEl.value = '';
    if (inputEl.type === 'text' && typeof window.togglePasswordVisibility === 'function') {
      window.togglePasswordVisibility('inputFeaturePassword');
    } else {
      inputEl.type = 'password';
    }
    setTimeout(() => inputEl.focus(), 100);
  }
  if (errEl) errEl.classList.add('hidden');
  if (waBtn && window.CAT_CONFIG) {
    const msg = waCustomText || 'Halo Admin, saya minta password akses Simulasi CAT CPNS 2027';
    waBtn.href = `https://wa.me/62${window.CAT_CONFIG.adminWhatsApp.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`;
  }

  const modal = document.getElementById('modalPasswordLock');
  if (modal) modal.classList.remove('hidden');
}

function closePasswordModal() {
  const modal = document.getElementById('modalPasswordLock');
  if (modal) modal.classList.add('hidden');
  passwordSuccessCallback = null;
}

function verifyFeaturePassword() {
  const inputEl = document.getElementById('inputFeaturePassword');
  const errEl = document.getElementById('lockPasswordError');
  const entered = inputEl ? inputEl.value.trim() : '';
  const expected = window.CAT_CONFIG ? window.CAT_CONFIG.featureAccessPassword : '';

  if (entered && entered === expected) {
    unlockFeaturePermanently();
    const cb = passwordSuccessCallback;
    closePasswordModal();
    alert('Kata sandi benar! Akses Bank Soal Fokus TWK/TIU/TKP, Bank Materi & Paket SKB resmi telah dibuka.');
    if (typeof cb === 'function') cb();
  } else if (errEl) {
    errEl.classList.remove('hidden');
    errEl.textContent = 'Kata sandi tidak valid. Hubungi WhatsApp Admin: 087784800668.';
  }
}

function openModulFile(vol) {
  const links = (window.CAT_CONFIG && window.CAT_CONFIG.driveLinks) || {};
  const url = vol === 1 ? links.modul1 : links.modul2;
  if (isFeatureUnlocked()) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    openPasswordModal(
      `Akses Terkunci: Modul Belajar Jilid ${vol}`,
      `Akses Modul Jilid ${vol} wajib donasi seikhlasnya (+ kode unik 27) dan konfirmasi ke WhatsApp Admin untuk mendapatkan password resmi. Berlaku untuk 2 paket modul sekaligus!`,
      () => window.open(url, '_blank', 'noopener,noreferrer'),
      `Halo Admin, saya sudah transfer donasi seikhlasnya dengan kode unik 27. Mohon password akses Modul Materi Belajar Jilid ${vol} (CPNS 2027) ya.`
    );
  }
}

function openGoogleDriveFolder() {
  const links = (window.CAT_CONFIG && window.CAT_CONFIG.driveLinks) || {};
  const url = links.folder;
  if (isFeatureUnlocked()) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    openPasswordModal(
      'Akses Terkunci: Perpustakaan Google Drive',
      'Akses seluruh folder modul materi ini wajib donasi seikhlasnya (+ kode unik 27) dan konfirmasi ke WhatsApp Admin untuk mendapatkan password akses resmi.',
      () => window.open(url, '_blank', 'noopener,noreferrer'),
      'Halo Admin, saya sudah transfer donasi seikhlasnya dengan kode unik 27. Mohon password akses Seluruh Folder Modul Google Drive (CPNS 2027) ya.'
    );
  }
}

function isPackageLocked(pkgId) {
  if (isFeatureUnlocked()) return false;
  return ['twk_drill', 'tiu_drill', 'tkp_drill'].includes(pkgId) || String(pkgId).startsWith('skb_');
}

function openLockedPackage(pkgId, mode) {
  if (!isPackageLocked(pkgId)) {
    if (mode === 'cat') window.openPrepModal(pkgId);
    else window.startDirectPackage(pkgId, mode);
    return;
  }

  let title = 'Akses Terkunci: Paket Bank Soal Fokus';
  let desc = 'Paket drill soal fokus ini memerlukan kata sandi resmi. Hubungi WhatsApp Admin untuk meminta password.';
  let waMsg = 'Halo Admin, saya minta password akses paket latihan CPNS 2027';

  if (pkgId === 'twk_drill') {
    title = 'Akses Terkunci: Bank Drill Fokus TWK';
    desc = 'Paket Bank Drill Fokus TWK & Bahasa Indonesia (120 Soal) dilindungi kata sandi resmi harian. Hubungi WhatsApp Admin untuk mendapatkan password.';
    waMsg = 'Halo Admin, saya minta password akses Bank Drill Fokus TWK & Bahasa Indonesia (120 Soal)';
  } else if (pkgId === 'tiu_drill') {
    title = 'Akses Terkunci: Bank Drill Fokus TIU';
    desc = 'Paket Bank Drill Fokus TIU, Kotak Angka & Figural (150 Soal) dilindungi kata sandi resmi harian. Hubungi WhatsApp Admin untuk mendapatkan password.';
    waMsg = 'Halo Admin, saya minta password akses Bank Drill Fokus TIU & Figural (150 Soal)';
  } else if (pkgId === 'tkp_drill') {
    title = 'Akses Terkunci: Bank Drill Fokus TKP';
    desc = 'Paket Bank Drill Fokus TKP BerAKHLAK Skor 5 (180 Soal) dilindungi kata sandi resmi harian. Hubungi WhatsApp Admin untuk mendapatkan password.';
    waMsg = 'Halo Admin, saya minta password akses Bank Drill Fokus TKP BerAKHLAK Skor 5 (180 Soal)';
  } else if (String(pkgId).startsWith('skb_')) {
    title = 'Akses Terkunci: Seleksi Kompetensi Bidang (SKB)';
    desc = 'Paket ujian SKB Teknis dilindungi kata sandi resmi harian. Hubungi WhatsApp Admin untuk membuka akses.';
    waMsg = 'Halo Admin, saya minta password akses Tryout SKB Teknis CPNS 2027';
  }

  openPasswordModal(
    title,
    desc,
    () => {
      if (mode === 'cat') window.openPrepModal(pkgId);
      else window.startDirectPackage(pkgId, mode);
    },
    waMsg
  );
}

function openSkbPackage(pkgId, mode) {
  openLockedPackage(pkgId, mode);
}

function switchHomeTab(tab, scrollIntoContent) {
  const validTabs = ['pkg', 'cheat', 'hist', 'profile'];
  const activeTab = validTabs.includes(tab) ? tab : 'pkg';
  validTabs.forEach((t) => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    const pane = document.getElementById('homeTab' + cap);
    const btn = document.getElementById('tabNav' + cap);
    if (pane) pane.classList.toggle('hidden', t !== activeTab);
    if (btn) btn.classList.toggle('active', t === activeTab);
  });

  const portalTitleMap = {
    pkg: 'Beranda Simulasi & Paket Soal',
    hist: 'Beranda Pendaftaran & Riwayat',
    cheat: 'Materi Belajar & Rumus Cepat',
    profile: 'Profile Saya'
  };
  const portalTitleEl = document.getElementById('hdrPortalTitle');
  if (portalTitleEl && portalTitleMap[activeTab]) {
    portalTitleEl.textContent = portalTitleMap[activeTab];
  }

  if (activeTab === 'hist' && window.History) {
    window.History.render();
  }
  if (activeTab === 'profile' && window.Auth && typeof window.Auth.syncUI === 'function') {
    window.Auth.syncUI(document);
  }
  if (scrollIntoContent && typeof document !== 'undefined') {
    const target = document.getElementById('homeSubNavStrip') || document.getElementById('homeContentWrap');
    if (target && typeof target.scrollIntoView === 'function') {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) { }
    }
  }
}

function openPortalTabOrLogin(tab, optionalPkgId) {
  const user = typeof window.getRegisteredUser === 'function' ? window.getRegisteredUser() : null;
  if (!user) {
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal(() => {
        if (typeof window.showScreen === 'function') window.showScreen('home');
        switchHomeTab(tab || 'pkg', false);
        if (optionalPkgId) {
          if (typeof isPackageLocked === 'function' && isPackageLocked(optionalPkgId)) {
            openLockedPackage(optionalPkgId, 'cat');
          } else if (typeof window.openPrepModal === 'function') {
            window.openPrepModal(optionalPkgId);
          }
        }
      });
    }
    return;
  }
  if (typeof window.showScreen === 'function') window.showScreen('home');
  switchHomeTab(tab || 'pkg', true);
  if (optionalPkgId) {
    if (typeof isPackageLocked === 'function' && isPackageLocked(optionalPkgId)) {
      openLockedPackage(optionalPkgId, 'cat');
    } else if (typeof window.openPrepModal === 'function') {
      window.openPrepModal(optionalPkgId);
    }
  }
}

function scrollHomeSection(sectionKey) {
  if (typeof showScreen === 'function') showScreen('home');
  if (sectionKey === 'top' && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const map = {
    timeline: 'sectionTimelinePengadaan',
    faq: 'sectionFaqPanduan',
    paket: 'homeSubNavStrip'
  };
  const id = map[sectionKey];
  const el = id && typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (el && typeof el.scrollIntoView === 'function') {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) { }
  }
}

function toggleA11yMenu(forceOpen) {
  if (typeof document === 'undefined') return;
  const pop = document.getElementById('a11yPopoverCard');
  if (!pop) return;
  if (typeof forceOpen === 'boolean') pop.classList.toggle('hidden', !forceOpen);
  else pop.classList.toggle('hidden');
}

function toggleA11yFontScale() {
  if (typeof document === 'undefined') return;
  const cur = document.documentElement.getAttribute('data-font-scale');
  const next = cur === 'large' ? 'normal' : 'large';
  document.documentElement.setAttribute('data-font-scale', next);
  const btn = document.getElementById('btnA11yFont');
  if (btn) btn.textContent = next === 'large' ? 'Teks: Besar' : 'Teks: Normal';
}

function toggleHighContrast() {
  if (typeof document === 'undefined') return;
  const cur = document.documentElement.getAttribute('data-contrast');
  const next = cur === 'high' ? 'normal' : 'high';
  document.documentElement.setAttribute('data-contrast', next);
  const btn = document.getElementById('btnA11yContrast');
  if (btn) btn.textContent = next === 'high' ? 'Kontras: Tinggi' : 'Kontras: Normal';
}

function handleWindowScrollState() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const y = window.scrollY || window.pageYOffset || 0;
  const hdr = document.getElementById('siteHeader');
  if (hdr) hdr.classList.toggle('is-scrolled', y > 24);
  const topBtn = document.getElementById('btnBackToTop');
  if (topBtn) topBtn.classList.toggle('is-hidden', y < 260);
}

function handleBrandClick() {
  const st = window.Exam && window.Exam.getState ? window.Exam.getState() : null;
  if (st && st.isActive && st.mode === 'cat' && !st.isFinished) {
    return;
  }
  showScreen('home');
}

function showScreen(screenName) {
  if (typeof document === 'undefined') return;
  const st = window.Exam && window.Exam.getState ? window.Exam.getState() : null;

  if (screenName !== 'exam' && st) {
    if (st.mode === 'study' && st.isActive && window.Storage) {
      const activeUser = window.Storage.getActiveUser();
      window.Storage.clearActiveExamSnapshot(activeUser ? activeUser.id : 'ANON');
    }
    st.isActive = false;
  }

  if (screenName !== 'exam') {
    ['finishModal', 'fullscreenWarningModal', 'tabSwitchModal'].forEach((id) => {
      const m = document.getElementById(id);
      if (m) m.classList.add('hidden');
    });
  }

  if (screenName === 'home') {
    if (window.Exam) window.Exam.stopTimerLoop();
    if (window.Proctor) {
      window.Proctor.stopWebcamStream();
      window.Proctor.exitFullscreenLock();
    }
    if (window.Auth && typeof window.Auth.syncUI === 'function') window.Auth.syncUI(document);
    if (window.Landing) window.Landing.refresh();
    if (window.History) window.History.render();
  }

  const sHome = document.getElementById('screenHome');
  const sExam = document.getElementById('screenExam');
  const sRes = document.getElementById('screenResult');
  if (sHome) sHome.classList.toggle('hidden', screenName !== 'home');
  if (sExam) sExam.classList.toggle('hidden', screenName !== 'exam');
  if (sRes) sRes.classList.toggle('hidden', screenName !== 'result');

  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (_) {
      window.scrollTo(0, 0);
    }
  }

  const isExam = screenName === 'exam';
  const mode = st ? st.mode : null;
  const isLockedCat = isExam && mode === 'cat';
  const isWorkingExam = isExam && (mode === 'cat' || mode === 'study');
  const isCopyLocked = isWorkingExam && !(st && st.isFinished);

  document.body.classList.toggle('in-exam', isExam);
  document.body.classList.toggle('is-cat-locked', isLockedCat);
  document.body.classList.toggle('exam-copy-locked', isCopyLocked);
  if (window.Proctor && typeof window.Proctor.syncCopyProtection === 'function') {
    window.Proctor.syncCopyProtection();
  }

  const hdrStats = document.getElementById('catHeaderStats');
  const timerWrap = document.getElementById('examTimerWrapper');
  const btnFinish = document.getElementById('btnHdrFinish');
  const btnMenu = document.getElementById('btnHdrMenu');
  const btnUser = document.getElementById('btnHdrUserWidget');
  const btnTheme = document.getElementById('btnHdrTheme');
  const btnDonasi = document.getElementById('btnHdrDonasi');
  const robot = document.getElementById('floatingRobotDonation');
  const footer = document.getElementById('siteFooter');

  if (hdrStats) hdrStats.classList.toggle('hidden', !isExam);
  if (timerWrap) timerWrap.classList.toggle('hidden', !isExam);
  if (btnUser) btnUser.classList.remove('hidden');
  if (btnFinish) btnFinish.classList.toggle('hidden', !isWorkingExam);
  if (btnMenu) btnMenu.classList.toggle('hidden', screenName === 'home' || isLockedCat);
  if (btnTheme) btnTheme.classList.toggle('hidden', isLockedCat);
  if (btnDonasi) btnDonasi.classList.toggle('hidden', isLockedCat);
  if (robot) robot.classList.toggle('hidden', isExam);
  if (footer) footer.classList.toggle('hidden', isExam);
}

function configureSheetSync() {
  if (!window.CAT_CONFIG) return;
  const cur = window.CAT_CONFIG.googleSheetScriptUrl;
  const next = prompt('Masukkan URL Web App Google Apps Script Anda (yang berakhiran /exec):', cur);
  if (next !== null) {
    window.CAT_CONFIG.googleSheetScriptUrl = next.trim();
    alert('URL Google Sheet berhasil disimpan! Setiap peserta yang mendaftar akan otomatis dicatat ke Spreadsheet.');
  }
}

function initApp() {
  initTheme();
  if (window.Storage) window.Storage.migrateLegacy();
  if (window.Auth && typeof document !== 'undefined') window.Auth.syncUI(document);
  updateLockBadges();
  if (window.Landing) window.Landing.refresh();
  if (window.History) window.History.render();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', function (e) {
    const st = window.Exam && window.Exam.getState ? window.Exam.getState() : null;
    if (st && st.isActive && st.mode === 'cat' && !st.isFinished) {
      if (window.Exam) window.Exam.saveProgress();
      e.preventDefault();
      e.returnValue = 'Simulasi ujian CAT CPNS sedang berlangsung. Progres Anda tersimpan otomatis, yakin ingin menutup halaman?';
      return e.returnValue;
    }
    return undefined;
  });

  window.initApp = initApp;
  window.init = initApp;
  window.showScreen = showScreen;
  window.switchHomeTab = switchHomeTab;
  window.openPortalTabOrLogin = openPortalTabOrLogin;
  window.scrollHomeSection = scrollHomeSection;
  window.toggleA11yMenu = toggleA11yMenu;
  window.toggleA11yFontScale = toggleA11yFontScale;
  window.toggleHighContrast = toggleHighContrast;
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('scroll', handleWindowScrollState, { passive: true });
    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        const ddWrap = document.getElementById('hdrUserMenuWrap');
        if (ddWrap && !ddWrap.contains(e.target) && typeof window.closeHeaderUserMenu === 'function') {
          window.closeHeaderUserMenu();
        }
        const a11yWrap = document.getElementById('a11yFloatingWrap');
        if (a11yWrap && !a11yWrap.contains(e.target)) {
          toggleA11yMenu(false);
        }
      });
    }
  }
  window.handleBrandClick = handleBrandClick;
  window.toggleTheme = toggleTheme;
  window.openDonationModal = openDonationModal;
  window.closeDonationModal = closeDonationModal;
  window.confirmDonationDone = confirmDonationDone;
  window.isFeatureUnlocked = isFeatureUnlocked;
  window.unlockFeaturePermanently = unlockFeaturePermanently;
  window.lockFeaturesManually = lockFeaturesManually;
  window.updateLockBadges = updateLockBadges;
  window.openPasswordModal = openPasswordModal;
  window.closePasswordModal = closePasswordModal;
  window.verifyFeaturePassword = verifyFeaturePassword;
  window.openModulFile = openModulFile;
  window.openGoogleDriveFolder = openGoogleDriveFolder;
  window.isPackageLocked = isPackageLocked;
  window.openLockedPackage = openLockedPackage;
  window.openSkbPackage = openSkbPackage;
  window.configureSheetSync = configureSheetSync;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initApp,
    showScreen,
    switchHomeTab,
    toggleTheme,
    isPackageLocked
  };
}
