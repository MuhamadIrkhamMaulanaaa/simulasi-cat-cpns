// js/auth.js - Multi-User Authentication, 6-Digit PIN & Session Management

function authEsc(str) {
  if (typeof escapeHtml === 'function') return escapeHtml(str);
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createAuth(storage, env) {
  return {
    validatePhone(phone) {
      if (!phone || typeof phone !== 'string') return false;
      const clean = phone.replace(/[\s-]/g, '');
      return /^(?:\+62|62|0)8[0-9]{8,11}$/.test(clean);
    },

    validateEmail(email) {
      if (!email || typeof email !== 'string') return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    },

    validatePin(pin) {
      if (!pin || typeof pin !== 'string') return false;
      return /^\d{6}$/.test(pin.trim());
    },

    cleanPhone(phone) {
      if (!phone || typeof phone !== 'string') return '';
      let clean = phone.replace(/[\s-]/g, '');
      if (clean.startsWith('+62')) clean = '0' + clean.slice(3);
      else if (clean.startsWith('62')) clean = '0' + clean.slice(2);
      return clean;
    },

    generateNoPeserta(cleanPhone) {
      return `27-01-${cleanPhone}`;
    },

    generateRandomPin() {
      return String(Math.floor(100000 + Math.random() * 900000));
    },

    register({ nama, email, noHp, formasi, pin }) {
      if (!nama || typeof nama !== 'string' || nama.trim().length < 3) {
        return { success: false, error: 'Nama lengkap minimal 3 karakter' };
      }
      if (!this.validateEmail(email)) {
        return { success: false, error: 'Format email tidak valid' };
      }
      if (!this.validatePhone(noHp)) {
        return { success: false, error: 'Nomor HP tidak valid (gunakan awalan 08 / 62 / +62, 10-13 digit)' };
      }
      if (!this.validatePin(pin)) {
        return { success: false, error: 'PIN harus tepat 6 digit angka' };
      }

      const cleanPh = this.cleanPhone(noHp);
      const cleanEm = email.trim().toLowerCase();
      const users = storage.getUsers();

      for (const u of Object.values(users)) {
        if (u.email && u.email.toLowerCase() === cleanEm) {
          return { success: false, error: 'Email sudah terdaftar. Silakan login.' };
        }
        if (u.noHp && this.cleanPhone(u.noHp) === cleanPh) {
          return { success: false, error: 'Nomor HP sudah terdaftar. Silakan login.' };
        }
      }

      const userId = 'USR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const nowIso = new Date().toISOString();
      const userRecord = {
        id: userId,
        nama: nama.trim(),
        email: cleanEm,
        noHp: cleanPh,
        noPeserta: this.generateNoPeserta(cleanPh),
        formasi: formasi && String(formasi).trim() ? String(formasi).trim() : 'Umum',
        pin: pin.trim(),
        registeredAt: nowIso,
        registeredAtFormatted: new Date().toLocaleString('id-ID'),
        lastLoginAt: nowIso
      };

      storage.saveUser(userRecord);
      storage.setActiveSession({ userId, loginAt: nowIso });

      return { success: true, user: userRecord };
    },

    login({ identifier, pin }) {
      if (!identifier || !String(identifier).trim() || !pin) {
        return { success: false, error: 'Identifier dan PIN wajib diisi' };
      }
      if (!this.validatePin(pin)) {
        return { success: false, error: 'PIN harus tepat 6 digit angka' };
      }

      const idClean = String(identifier).trim().toLowerCase();
      const phClean = this.cleanPhone(String(identifier));
      const users = storage.getUsers();

      let matchedUser = null;
      for (const u of Object.values(users)) {
        if (
          (u.email && u.email.toLowerCase() === idClean) ||
          (u.noHp && this.cleanPhone(u.noHp) === phClean) ||
          (u.noPeserta && u.noPeserta.toLowerCase() === idClean)
        ) {
          matchedUser = u;
          break;
        }
      }

      if (!matchedUser) {
        return { success: false, error: 'Akun tidak ditemukan. Periksa kembali No. Peserta / Email / No. HP Anda.' };
      }

      if (matchedUser.pin !== pin.trim()) {
        return { success: false, error: 'PIN yang Anda masukkan salah.' };
      }

      matchedUser.lastLoginAt = new Date().toISOString();
      storage.saveUser(matchedUser);
      storage.setActiveSession({ userId: matchedUser.id, loginAt: new Date().toISOString() });

      return { success: true, user: matchedUser };
    },

    logout() {
      storage.clearActiveSession();
    },

    getRegisteredAccounts() {
      const users = Object.values(storage.getUsers());
      return users.sort((a, b) => {
        const ta = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0;
        const tb = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0;
        return tb - ta;
      });
    },

    syncUI(doc) {
      const targetDoc = doc || (env && env.document) || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc) return;

      const user = storage.getActiveUser();
      const widget = targetDoc.getElementById('btnHdrUserWidget');
      const banner = targetDoc.getElementById('userWelcomeBanner');

      if (user) {
        const safeNama = authEsc(user.nama);
        const safeNo = authEsc(user.noPeserta);
        const safeFormasi = authEsc(user.formasi || 'Umum');
        const initial = authEsc((user.nama || 'P').trim().charAt(0).toUpperCase() || 'P');

        if (widget) {
          widget.className = 'btn btn-ghost-dark hdr-user-btn';
          widget.setAttribute('title', `Kartu Peserta: ${user.nama} (${user.noPeserta})`);
          widget.innerHTML = `<span class="hdr-user-avatar">${initial}</span><span class="hdr-user-info-text"><span class="hdr-user-name badge-name">${safeNama}</span> <span class="hdr-user-card-tag badge-num">${safeNo}</span></span>`;
        }

        if (banner) {
          banner.style.display = 'block';
          banner.innerHTML = `
            <div class="user-strip-inner">
              <div class="user-strip-info">
                <div class="user-strip-label">Peserta Aktif CAT BKN 2027</div>
                <div class="user-strip-name">Selamat datang, <strong>${safeNama}</strong></div>
                <div class="user-strip-meta">
                  <span>No. Peserta: <strong>${safeNo}</strong></span>
                  <span>Formasi: <strong>${safeFormasi}</strong></span>
                </div>
              </div>
              <div class="user-strip-actions">
                <button type="button" class="btn btn-secondary" onclick="openUserProfileModal()">Kartu Peserta</button>
                <button type="button" class="btn btn-outline" onclick="openAuthModal(null, 'login')">Ganti Akun</button>
                <button type="button" class="btn btn-outline" onclick="logoutUser()">Keluar</button>
              </div>
            </div>
          `;
        }
      } else {
        if (widget) {
          widget.className = 'btn hdr-login-btn';
          widget.setAttribute('title', 'Daftar atau Masuk sebagai Peserta CAT');
          widget.innerHTML = 'Masuk / Daftar';
        }
        if (banner) {
          banner.style.display = 'none';
          banner.innerHTML = '';
        }
      }
    }
  };
}

const Auth = typeof window !== 'undefined' && window.Storage
  ? createAuth(window.Storage, window)
  : null;

let authSuccessCallback = null;
let currentAuthTab = 'login';

function isCatExamLocked() {
  const st = window.Exam && typeof window.Exam.getState === 'function'
    ? window.Exam.getState()
    : null;
  return Boolean(st && st.isActive && st.mode === 'cat' && !st.isFinished);
}

function resetAuthModalFields() {
  if (typeof document === 'undefined') return;
  const regIds = ['authInputNama', 'authInputEmail', 'authInputNoHp', 'authInputFormasi', 'authInputPin'];
  regIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const regPin = document.getElementById('authInputPin');
  if (regPin) regPin.type = 'password';
  const pinHint = document.getElementById('authPinGeneratedHint');
  if (pinHint) {
    pinHint.textContent = '';
    pinHint.classList.add('hidden');
  }
  const loginId = document.getElementById('authLoginIdentifier');
  const loginPin = document.getElementById('authLoginPin');
  if (loginId) loginId.value = '';
  if (loginPin) loginPin.value = '';
}

function getRegisteredUser() {
  return window.Storage ? window.Storage.getActiveUser() : null;
}

function handleHeaderUserClick() {
  if (getRegisteredUser()) {
    openUserProfileModal();
  } else {
    openAuthModal();
  }
}

function renderAuthQuickSwitchList() {
  const wrap = document.getElementById('authQuickSwitchWrap');
  const listEl = document.getElementById('authQuickSwitchList');
  if (!wrap || !listEl || !window.Auth) return;

  const accounts = window.Auth.getRegisteredAccounts();
  if (!accounts.length) {
    wrap.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  wrap.classList.remove('hidden');
  const active = getRegisteredUser();
  listEl.innerHTML = accounts
    .map((acc) => {
      const isCurrent = active && active.id === acc.id;
      const safeName = authEsc(acc.nama);
      const safeNo = authEsc(acc.noPeserta);
      const safeEmail = authEsc(acc.email);
      return `
        <button type="button" class="quick-account-chip ${isCurrent ? 'is-active' : ''}" data-identifier="${safeNo}" onclick="selectQuickSwitchAccount(this.dataset.identifier)">
          <span class="quick-account-avatar">${authEsc((acc.nama || 'P').charAt(0).toUpperCase())}</span>
          <span class="quick-account-meta">
            <strong>${safeName}</strong>
            <small>${safeNo} • ${safeEmail}</small>
          </span>
          <span class="quick-account-badge">${isCurrent ? 'Aktif' : 'Pilih'}</span>
        </button>
      `;
    })
    .join('');
}

function selectQuickSwitchAccount(identifier) {
  switchAuthTab('login');
  const idInput = document.getElementById('authLoginIdentifier');
  const pinInput = document.getElementById('authLoginPin');
  const errBox = document.getElementById('authLoginError');
  if (errBox) errBox.classList.add('hidden');
  if (idInput) idInput.value = identifier || '';
  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }
}

function switchAuthTab(tab) {
  currentAuthTab = tab === 'register' ? 'register' : 'login';
  const btnLogin = document.getElementById('authTabBtnLogin');
  const btnReg = document.getElementById('authTabBtnRegister');
  const paneLogin = document.getElementById('authPaneLogin');
  const paneReg = document.getElementById('authPaneRegister');
  const errLogin = document.getElementById('authLoginError');
  const errReg = document.getElementById('authRegisterError');

  if (btnLogin) btnLogin.classList.toggle('active', currentAuthTab === 'login');
  if (btnReg) btnReg.classList.toggle('active', currentAuthTab === 'register');
  if (paneLogin) paneLogin.classList.toggle('hidden', currentAuthTab !== 'login');
  if (paneReg) paneReg.classList.toggle('hidden', currentAuthTab !== 'register');
  if (errLogin) errLogin.classList.add('hidden');
  if (errReg) errReg.classList.add('hidden');
}

function openAuthModal(callback, preferredTab) {
  if (isCatExamLocked()) {
    alert('Tidak dapat mengganti atau masuk akun saat simulasi CAT BKN sedang berlangsung.');
    return;
  }
  authSuccessCallback = typeof callback === 'function' ? callback : null;
  const accounts = window.Auth ? window.Auth.getRegisteredAccounts() : [];
  const targetTab = preferredTab || (accounts.length > 0 ? 'login' : 'register');

  resetAuthModalFields();
  renderAuthQuickSwitchList();
  switchAuthTab(targetTab);

  const errLogin = document.getElementById('authLoginError');
  const errReg = document.getElementById('authRegisterError');
  if (errLogin) errLogin.classList.add('hidden');
  if (errReg) errReg.classList.add('hidden');

  const modal = document.getElementById('modalUserAuth');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('modalUserAuth');
  if (modal) modal.classList.add('hidden');
  resetAuthModalFields();
  authSuccessCallback = null;
}

function generateAndFillPin() {
  const pinInput = document.getElementById('authInputPin');
  const hint = document.getElementById('authPinGeneratedHint');
  if (!window.Auth || !pinInput) return;
  const pin = window.Auth.generateRandomPin();
  pinInput.value = pin;
  pinInput.type = 'text';
  if (hint) {
    hint.textContent = `PIN otomatis dibuat: ${pin} — catat PIN ini untuk login kembali.`;
    hint.classList.remove('hidden');
  }
}

function handleRegisterSubmit(event) {
  if (event) event.preventDefault();
  if (!window.Auth) return;

  const nama = (document.getElementById('authInputNama') || {}).value || '';
  const email = (document.getElementById('authInputEmail') || {}).value || '';
  const noHp = (document.getElementById('authInputNoHp') || {}).value || '';
  const formasiEl = document.getElementById('authInputFormasi');
  const formasi = formasiEl ? formasiEl.value : '';
  const pin = (document.getElementById('authInputPin') || {}).value || '';
  const errBox = document.getElementById('authRegisterError');

  const res = window.Auth.register({ nama, email, noHp, formasi, pin });
  if (!res.success) {
    if (errBox) {
      errBox.textContent = res.error;
      errBox.classList.remove('hidden');
    }
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  window.Auth.syncUI(document);
  syncUserToDeveloper(res.user);

  const cb = authSuccessCallback;
  closeAuthModal();

  if (window.Landing && typeof window.Landing.refresh === 'function') window.Landing.refresh();
  if (window.History && typeof window.History.render === 'function') window.History.render();

  if (typeof cb === 'function') {
    cb();
  } else {
    openUserProfileModal();
  }
}

function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  if (!window.Auth) return;

  const identifier = (document.getElementById('authLoginIdentifier') || {}).value || '';
  const pin = (document.getElementById('authLoginPin') || {}).value || '';
  const errBox = document.getElementById('authLoginError');

  const res = window.Auth.login({ identifier, pin });
  if (!res.success) {
    if (errBox) {
      errBox.textContent = res.error;
      errBox.classList.remove('hidden');
    }
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  window.Auth.syncUI(document);

  const cb = authSuccessCallback;
  closeAuthModal();

  if (window.Landing && typeof window.Landing.refresh === 'function') window.Landing.refresh();
  if (window.History && typeof window.History.render === 'function') window.History.render();

  if (typeof cb === 'function') {
    cb();
  }
}

function openUserProfileModal() {
  const user = getRegisteredUser();
  if (!user) {
    openAuthModal();
    return;
  }

  const avatar = document.getElementById('cardAvatarInitial');
  if (avatar) avatar.textContent = (user.nama || 'P').trim().charAt(0).toUpperCase() || 'P';

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '-';
  };

  setText('cardDisplayNama', user.nama);
  setText('cardDisplayEmail', user.email);
  setText('cardDisplayNoPeserta', user.noPeserta);
  setText('cardDisplayFormasi', user.formasi || 'Umum');
  setText('cardDisplayWhatsapp', user.noHp);
  setText('cardDisplayPin', user.pin ? `${user.pin}` : '-');
  setText('cardDisplayWaktu', user.registeredAtFormatted || user.registeredAt || '-');
  setText('cardDisplayBarcodeCode', user.noPeserta ? `BKN-${user.noPeserta}` : 'CAT-2027-OK');

  const logoutBtn = document.getElementById('btnProfileLogout');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', isCatExamLocked());

  const modal = document.getElementById('modalUserProfile');
  if (modal) modal.classList.remove('hidden');
}

function closeUserProfileModal() {
  const modal = document.getElementById('modalUserProfile');
  if (modal) modal.classList.add('hidden');
}

function logoutUser() {
  if (!window.Auth) return;
  if (isCatExamLocked()) {
    alert('Tidak dapat keluar atau mengganti akun saat simulasi CAT BKN sedang berlangsung.');
    return;
  }
  if (!confirm('Keluar dari sesi peserta aktif saat ini? Akun dan riwayat ujian Anda tetap tersimpan aman di perangkat ini.')) {
    return;
  }
  closeUserProfileModal();
  if (typeof window.showScreen === 'function') window.showScreen('home');
  window.Auth.logout();
  window.Auth.syncUI(document);
  if (window.Landing && typeof window.Landing.refresh === 'function') window.Landing.refresh();
  if (window.History && typeof window.History.render === 'function') window.History.render();
}

function printParticipantCard() {
  window.print();
}

function sendWaConfirmation(targetUser) {
  const user = targetUser || getRegisteredUser();
  if (!user) return;
  const waNum = (window.CAT_CONFIG && window.CAT_CONFIG.adminWhatsApp) || '087784800668';
  const msg = `Halo Admin MGNIFICMRNA Course, saya sudah mendaftar Simulasi CAT CPNS 2027.\n\n*Nama:* ${user.nama}\n*No. Peserta:* ${user.noPeserta}\n*Formasi:* ${user.formasi}\n*WhatsApp:* ${user.noHp}\n\nMohon info grup belajar dan materi latihan terbaru. Terima kasih!`;
  const url = `https://wa.me/62${waNum.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function syncUserToDeveloper(user) {
  const scriptUrl = window.CAT_CONFIG && window.CAT_CONFIG.googleSheetScriptUrl;
  if (!scriptUrl || !user) return;
  try {
    const safePayload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      noHp: user.noHp,
      noPeserta: user.noPeserta,
      formasi: user.formasi,
      registeredAt: user.registeredAt,
      registeredAtFormatted: user.registeredAtFormatted
    };
    fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload)
    }).catch((err) => {
      console.warn('[DevSync] Sinkronisasi latar belakang:', err);
    });
  } catch (err) {
    console.warn('[DevSync] Fetch gagal:', err);
  }
}

if (typeof window !== 'undefined') {
  window.createAuth = createAuth;
  window.Auth = Auth;
  window.getRegisteredUser = getRegisteredUser;
  window.handleHeaderUserClick = handleHeaderUserClick;
  window.switchAuthTab = switchAuthTab;
  window.selectQuickSwitchAccount = selectQuickSwitchAccount;
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.generateAndFillPin = generateAndFillPin;
  window.handleRegisterSubmit = handleRegisterSubmit;
  window.handleLoginSubmit = handleLoginSubmit;
  window.openUserProfileModal = openUserProfileModal;
  window.closeUserProfileModal = closeUserProfileModal;
  window.logoutUser = logoutUser;
  window.printParticipantCard = printParticipantCard;
  window.sendWaConfirmation = sendWaConfirmation;
  window.syncUserToDeveloper = syncUserToDeveloper;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createAuth,
    Auth
  };
}
