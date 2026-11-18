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

    register({ nama, email, noHp, formasi, pin, fotoDataUrl }) {
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
        fotoDataUrl: fotoDataUrl && String(fotoDataUrl).startsWith('data:image/') ? String(fotoDataUrl) : '',
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

    updateProfile({ nama, noHp, formasi, pin, fotoDataUrl }) {
      const active = storage.getActiveUser();
      if (!active) return { success: false, error: 'Sesi peserta tidak aktif.' };

      const cleanNama = nama ? String(nama).trim() : '';
      if (cleanNama.length < 3) {
        return { success: false, error: 'Nama lengkap minimal 3 karakter.' };
      }
      const cleanPh = noHp ? this.cleanPhone(String(noHp)) : active.noHp;
      if (!this.validatePhone(cleanPh)) {
        return { success: false, error: 'Format No. HP / WhatsApp tidak valid (10–13 digit).' };
      }

      let nextPin = active.pin;
      if (pin && String(pin).trim()) {
        if (!this.validatePin(String(pin).trim())) {
          return { success: false, error: 'PIN baru harus tepat 6 digit angka.' };
        }
        nextPin = String(pin).trim();
      }

      const nextFoto =
        fotoDataUrl && String(fotoDataUrl).startsWith('data:image/')
          ? String(fotoDataUrl)
          : (active.fotoDataUrl || '');

      const updated = {
        ...active,
        nama: cleanNama,
        noHp: cleanPh,
        noPeserta: this.generateNoPeserta(cleanPh),
        formasi: formasi && String(formasi).trim() ? String(formasi).trim() : 'Umum',
        pin: nextPin,
        fotoDataUrl: nextFoto
      };
      storage.saveUser(updated);
      return { success: true, user: updated };
    },

    resetPin({ email, noHp, newPin }) {
      const emClean = email ? String(email).trim().toLowerCase() : '';
      const phClean = noHp ? this.cleanPhone(String(noHp)) : '';
      if (!this.validateEmail(emClean) || !this.validatePhone(phClean)) {
        return { success: false, error: 'Masukkan Email dan No. HP terdaftar yang valid.' };
      }
      if (!this.validatePin(newPin)) {
        return { success: false, error: 'PIN baru harus tepat 6 digit angka.' };
      }
      const users = storage.getUsers();
      const matched = Object.values(users).find(
        (u) =>
          u.email &&
          u.email.toLowerCase() === emClean &&
          u.noHp &&
          this.cleanPhone(u.noHp) === phClean
      );
      if (!matched) {
        return { success: false, error: 'Kombinasi Email dan No. HP tidak cocok dengan akun di perangkat ini.' };
      }
      matched.pin = String(newPin).trim();
      matched.updatedAt = new Date().toISOString();
      storage.saveUser(matched);
      return { success: true, user: matched };
    },

    syncUI(doc) {
      const targetDoc = doc || (env && env.document) || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc) return;

      const user = storage.getActiveUser();
      const widget = targetDoc.getElementById('btnHdrUserWidget');
      const banner = targetDoc.getElementById('userWelcomeBanner');
      const tabProfile = targetDoc.getElementById('tabNavProfile');
      const ddName = targetDoc.getElementById('hdrDropdownUserName');
      const ddNo = targetDoc.getElementById('hdrDropdownUserNo');

      if (targetDoc.body && targetDoc.body.classList) {
        targetDoc.body.classList.toggle('is-logged-in', Boolean(user));
      }
      if (tabProfile) {
        tabProfile.classList.toggle('hidden', !user);
      }

      if (user) {
        const safeNama = authEsc(user.nama);
        const safeNo = authEsc(user.noPeserta);
        const safeFormasi = authEsc(user.formasi || 'Umum');
        const initial = authEsc((user.nama || 'P').trim().charAt(0).toUpperCase() || 'P');

        if (widget) {
          widget.className = 'btn hdr-user-btn';
          widget.setAttribute('title', `Menu Akun: ${user.nama} (${user.noPeserta})`);
          const avatarHtml = user.fotoDataUrl
            ? `<img src="${authEsc(user.fotoDataUrl)}" alt="" class="hdr-user-avatar-img">`
            : initial;
          widget.innerHTML = `<span class="hdr-user-avatar">${avatarHtml}</span><span class="hdr-user-info-text"><span class="hdr-user-name badge-name">${safeNama}</span> <span class="hdr-user-card-tag badge-num">${safeNo}</span></span><span aria-hidden="true" style="font-size:0.7rem; opacity:0.85;">&#9662;</span>`;
        }
        if (ddName) ddName.textContent = user.nama || 'Peserta CAT';
        if (ddNo) ddNo.textContent = `${user.noPeserta || '-'} • ${user.formasi || 'Umum'}`;

        if (banner) {
          banner.style.display = 'block';
          banner.innerHTML = `
            <div class="user-strip-inner">
              <div class="user-strip-info">
                <div class="user-strip-label">PESERTA TERDAFTAR • NO. ${safeNo}</div>
                <div class="user-strip-name">Selamat Datang, ${safeNama}!</div>
                <div class="user-strip-meta">
                  <span>Formasi: <strong>${safeFormasi}</strong></span>
                  <span>Email: <strong>${authEsc(user.email || '-')}</strong></span>
                </div>
                <div class="user-strip-actions" style="margin-top:12px;">
                  <button type="button" class="btn btn-primary" onclick="switchHomeTab('pkg', true)">Pilih Paket Ujian CAT</button>
                  <button type="button" class="btn btn-secondary" onclick="switchHomeTab('profile')">Profile Saya</button>
                  <button type="button" class="btn btn-outline" onclick="openUserProfileModal()">Kartu Peserta (A4)</button>
                </div>
              </div>
              <div class="user-strip-watermark-icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
            </div>
          `;
        }
        if (typeof renderProfileView === 'function') renderProfileView(user, targetDoc);
      } else {
        if (widget) {
          widget.className = 'btn hdr-login-btn';
          widget.setAttribute('title', 'Masuk ke Portal Akun Peserta CAT');
          widget.innerHTML = 'Masuk / Daftar';
        }
        if (banner) {
          banner.style.display = 'none';
          banner.innerHTML = '';
        }
        if (typeof renderProfileView === 'function') renderProfileView(null, targetDoc);
        if (typeof closeHeaderUserMenu === 'function') closeHeaderUserMenu();
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

const EYE_SVG_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
const EYE_SVG_CLOSED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';

function syncEyeToggleState(btnEl, isVisible) {
  if (!btnEl) return;
  btnEl.innerHTML = isVisible ? EYE_SVG_CLOSED : EYE_SVG_OPEN;
  btnEl.classList.toggle('is-visible', isVisible);
  btnEl.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
  btnEl.setAttribute('aria-label', isVisible ? 'Sembunyikan PIN / Kata Sandi' : 'Lihat PIN / Kata Sandi');
  btnEl.setAttribute('title', isVisible ? 'Sembunyikan' : 'Intip / Lihat');
}

function togglePasswordVisibility(inputId, btnEl) {
  if (typeof document === 'undefined') return;
  const input = document.getElementById(inputId);
  if (!input) return;
  const nextVisible = input.type === 'password';
  input.type = nextVisible ? 'text' : 'password';
  syncEyeToggleState(btnEl || document.querySelector(`[data-eye-for="${inputId}"]`), nextVisible);
}

const REGISTER_FOTO_HINT_TEXT =
  'Wajib unggah pas foto (JPG/PNG/WebP) untuk membuat Kartu Peserta Simulasi.';
let pendingRegisterFotoDataUrl = '';
let pendingEditFotoDataUrl = '';
let isCompressingRegisterFoto = false;

function updateFotoPreviewBox(wrapId, statusId, dataUrl, statusText) {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById(wrapId);
  const statusEl = document.getElementById(statusId);
  if (wrap) {
    wrap.innerHTML = dataUrl
      ? `<img src="${authEsc(dataUrl)}" alt="Preview Pas Foto">`
      : '<span>FOTO<br>3:4</span>';
  }
  if (statusEl && statusText) {
    statusEl.textContent = statusText;
  }
}

function compressPassportPhotoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File foto tidak ditemukan.'));
      return;
    }
    const isImage =
      (file.type && String(file.type).startsWith('image/')) ||
      /\.(jpe?g|png|webp|bmp)$/i.test(file.name || '');
    if (!isImage) {
      reject(new Error('Format harus berupa gambar JPG, PNG, atau WebP.'));
      return;
    }
    if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Peramban tidak mendukung pemrosesan foto.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas foto.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Berkas gambar rusak atau format tidak didukung.'));
      img.onload = () => {
        try {
          const targetW = 300;
          const targetH = 400;
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#1672ba';
          ctx.fillRect(0, 0, targetW, targetH);

          const scale = Math.max(targetW / (img.width || targetW), targetH / (img.height || targetH));
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = (targetW - drawW) / 2;
          const dy = (targetH - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);

          let out = canvas.toDataURL('image/jpeg', 0.8);
          if (out.length > 140000) {
            out = canvas.toDataURL('image/jpeg', 0.62);
          }
          resolve(out);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function processFotoUploadInput(inputEl, opts) {
  const file = inputEl && inputEl.files && inputEl.files[0];
  if (!file) {
    opts.onResult('');
    updateFotoPreviewBox(opts.previewWrapId, opts.statusId, '', opts.emptyText);
    return;
  }
  opts.setLoading(true);
  updateFotoPreviewBox(opts.previewWrapId, opts.statusId, '', 'Memproses pas foto 3:4...');
  compressPassportPhotoFile(file)
    .then((dataUrl) => {
      opts.setLoading(false);
      opts.onResult(dataUrl);
      const kb = Math.max(1, Math.round((dataUrl.length * 0.75) / 1024));
      updateFotoPreviewBox(opts.previewWrapId, opts.statusId, dataUrl, `Pas foto siap (${kb} KB • 3:4)`);
      if (opts.errBoxId) {
        const err = document.getElementById(opts.errBoxId);
        if (err) err.classList.add('hidden');
      }
    })
    .catch((err) => {
      opts.setLoading(false);
      opts.onResult('');
      updateFotoPreviewBox(opts.previewWrapId, opts.statusId, '', opts.emptyText);
      if (opts.errBoxId) {
        const errEl = document.getElementById(opts.errBoxId);
        if (errEl) {
          errEl.textContent = err.message || 'Gagal memproses foto.';
          errEl.classList.remove('hidden');
        }
      }
    });
}

function handleRegisterFotoChange(inputEl) {
  processFotoUploadInput(inputEl, {
    previewWrapId: 'authFotoPreviewWrap',
    statusId: 'authFotoStatusText',
    errBoxId: 'authRegisterError',
    emptyText: REGISTER_FOTO_HINT_TEXT,
    setLoading: (v) => { isCompressingRegisterFoto = v; },
    onResult: (url) => { pendingRegisterFotoDataUrl = url; }
  });
}

function handleEditFotoChange(inputEl) {
  processFotoUploadInput(inputEl, {
    previewWrapId: 'editFotoPreviewWrap',
    statusId: 'editFotoStatusText',
    errBoxId: 'editProfileError',
    emptyText: 'Kosongkan bila tidak ingin mengubah pas foto saat ini.',
    setLoading: () => {},
    onResult: (url) => { pendingEditFotoDataUrl = url; }
  });
}

function resetAuthModalFields() {
  if (typeof document === 'undefined') return;
  const regIds = ['authInputNama', 'authInputEmail', 'authInputNoHp', 'authInputFormasi', 'authInputPin'];
  regIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['authLoginPin', 'authInputPin', 'editProfilePin', 'inputFeaturePassword', 'resetPinNewPin'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.type = 'password';
    syncEyeToggleState(document.querySelector(`[data-eye-for="${id}"]`), false);
  });
  ['resetPinEmail', 'resetPinNoHp', 'resetPinNewPin'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  toggleForgotPinPane(false);
  const resetOk = document.getElementById('authResetSuccess');
  if (resetOk) resetOk.classList.add('hidden');
  const resetErr = document.getElementById('authResetError');
  if (resetErr) resetErr.classList.add('hidden');
  const pinHint = document.getElementById('authPinGeneratedHint');
  if (pinHint) {
    pinHint.textContent = '';
    pinHint.classList.add('hidden');
  }
  const loginId = document.getElementById('authLoginIdentifier');
  const loginPin = document.getElementById('authLoginPin');
  if (loginId) loginId.value = '';
  if (loginPin) loginPin.value = '';
  pendingRegisterFotoDataUrl = '';
  isCompressingRegisterFoto = false;
  const regFotoInput = document.getElementById('authInputFoto');
  if (regFotoInput) regFotoInput.value = '';
  updateFotoPreviewBox(
    'authFotoPreviewWrap',
    'authFotoStatusText',
    '',
    REGISTER_FOTO_HINT_TEXT
  );
}

function getRegisteredUser() {
  return window.Storage ? window.Storage.getActiveUser() : null;
}

function handleHeaderUserClick() {
  if (getRegisteredUser()) {
    const dd = typeof document !== 'undefined' ? document.getElementById('hdrUserDropdownMenu') : null;
    if (dd) {
      toggleHeaderUserMenu();
    } else {
      openUserProfileModal();
    }
  } else {
    openAuthModal(null, 'login');
  }
}

function toggleHeaderUserMenu(forceOpen) {
  if (typeof document === 'undefined') return;
  const dd = document.getElementById('hdrUserDropdownMenu');
  if (!dd) return;
  if (typeof forceOpen === 'boolean') {
    dd.classList.toggle('hidden', !forceOpen);
  } else {
    dd.classList.toggle('hidden');
  }
}

function closeHeaderUserMenu() {
  toggleHeaderUserMenu(false);
}

let activeProfileSubTab = 'biodata';

function switchProfileSubTab(subTab) {
  activeProfileSubTab = subTab === 'kartu' ? 'kartu' : 'biodata';
  if (typeof document === 'undefined') return;
  const btnBio = document.getElementById('btnProfileSegBiodata');
  const btnKartu = document.getElementById('btnProfileSegKartu');
  const paneBio = document.getElementById('profilePaneBiodata');
  const paneKartu = document.getElementById('profilePaneKartu');
  if (btnBio) btnBio.classList.toggle('active', activeProfileSubTab === 'biodata');
  if (btnKartu) btnKartu.classList.toggle('active', activeProfileSubTab === 'kartu');
  if (paneBio) paneBio.classList.toggle('hidden', activeProfileSubTab !== 'biodata');
  if (paneKartu) paneKartu.classList.toggle('hidden', activeProfileSubTab !== 'kartu');
}

function renderProfileView(userObj, doc) {
  const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
  if (!targetDoc) return;
  const container = targetDoc.getElementById('profileViewContent');
  if (!container) return;

  if (!userObj) {
    container.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-state-title">Masuk Akun Peserta Diperlukan</div>
        <p>Silakan daftar atau masuk menggunakan akun peserta untuk melihat biodata dan mencetak Kartu Tanda Peserta Ujian.</p>
        <button type="button" class="btn btn-primary" onclick="openAuthModal()">Masuk / Buat Akun</button>
      </div>
    `;
    return;
  }

  const initial = authEsc((userObj.nama || 'P').trim().charAt(0).toUpperCase() || 'P');
  const safeNama = authEsc(userObj.nama);
  const safeNo = authEsc(userObj.noPeserta);
  const safeEmail = authEsc(userObj.email || '-');
  const safeHp = authEsc(userObj.noHp || '-');
  const safeFormasi = authEsc(userObj.formasi || 'Umum');
  const safeWaktu = authEsc(userObj.registeredAtFormatted || '-');
  const entries = window.Storage ? window.Storage.getHistory(userObj.id) : [];

  container.innerHTML = `
    <div class="profile-id-banner">
      <div class="profile-id-name">${safeNama}</div>
      <div class="profile-id-subrow">
        <span>No. Peserta: <strong>${safeNo}</strong></span>
        <span>&bull;</span>
        <span class="profile-email-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          ${safeEmail}
        </span>
      </div>
    </div>

    <div class="profile-segment-bar">
      <button type="button" id="btnProfileSegBiodata" class="profile-seg-btn ${activeProfileSubTab === 'biodata' ? 'active' : ''}" onclick="switchProfileSubTab('biodata')">
        Biodata Diri
      </button>
      <button type="button" id="btnProfileSegKartu" class="profile-seg-btn ${activeProfileSubTab === 'kartu' ? 'active' : ''}" onclick="switchProfileSubTab('kartu')">
        Kartu Peserta &amp; Statistik (${entries.length})
      </button>
    </div>

    <div id="profilePaneBiodata" class="profile-card-panel ${activeProfileSubTab === 'biodata' ? '' : 'hidden'}">
      <div class="profile-panel-head">
        <div>
          <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin:0 0 3px;">Identitas Utama &amp; Biodata</h3>
          <p style="font-size:0.82rem; color:var(--text-muted); margin:0;">Data akun peserta aktif Simulasi CAT CPNS 2027 yang tersimpan terisolasi di perangkat ini.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="openEditProfileModal()">Ubah Biodata Diri</button>
          <button type="button" class="btn btn-outline" onclick="openUserProfileModal()">Cetak Kartu (A4)</button>
        </div>
      </div>

      <div class="profile-biodata-layout">
        <div class="profile-portrait-box ${userObj.fotoDataUrl ? 'has-photo' : ''}">
          ${
            userObj.fotoDataUrl
              ? `<img src="${authEsc(userObj.fotoDataUrl)}" alt="Pas Foto ${safeNama}" class="profile-portrait-img">`
              : `<div class="profile-portrait-avatar">${initial}</div><div style="font-size:0.7rem; font-weight:700; opacity:0.9; letter-spacing:0.4px;">PAS FOTO PESERTA</div><div style="font-size:0.65rem; opacity:0.8; margin-top:2px;">BELUM DIUNGGAH</div>`
          }
        </div>
        <div class="table-responsive-wrap">
          <table class="profile-kv-table">
            <tr><th>No. Peserta CAT</th><td class="is-accent">${safeNo}</td></tr>
            <tr><th>Nama Lengkap</th><td>${safeNama}</td></tr>
            <tr><th>Formasi / Tujuan</th><td>${safeFormasi}</td></tr>
            <tr><th>Email Peserta</th><td class="is-accent">${safeEmail}</td></tr>
            <tr><th>No. WhatsApp / HP</th><td>${safeHp}</td></tr>
            <tr>
              <th>PIN Login Akun</th>
              <td>
                <span id="profilePinMaskedVal" data-revealed="false">••••••</span>
                <button type="button" class="btn-eye-inline" onclick="toggleProfilePinReveal(this)" title="Intip PIN Anda">
                  ${EYE_SVG_OPEN}
                  <span>Intip PIN</span>
                </button>
              </td>
            </tr>
            <tr><th>Waktu Terdaftar</th><td>${safeWaktu}</td></tr>
          </table>
        </div>
      </div>
    </div>

    <div id="profilePaneKartu" class="profile-card-panel ${activeProfileSubTab === 'kartu' ? '' : 'hidden'}">
      <div class="profile-panel-head">
        <div>
          <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin:0 0 3px;">Kartu Ujian &amp; Akun Perangkat</h3>
          <p style="font-size:0.82rem; color:var(--text-muted); margin:0;">Cetak kartu tanda peserta ukuran A4 atau kelola sesi akun di perangkat ini.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="openUserProfileModal()">Buka &amp; Cetak Kartu (A4)</button>
          <button type="button" class="btn btn-secondary" onclick="switchHomeTab('hist')">Lihat Riwayat (${entries.length})</button>
          <button type="button" class="btn btn-outline" onclick="logoutUser()" style="color:#dc2626; border-color:#fecaca;">Keluar Akun</button>
        </div>
      </div>
      <p style="font-size:0.88rem; color:var(--text-secondary); line-height:1.55;">
        Peserta <strong>${safeNama}</strong> (<strong>${safeNo}</strong>) tercatat memiliki <strong>${entries.length}</strong> riwayat ujian tersimpan. Seluruh skor, pelanggaran integritas, dan progres soal terpisah aman dari akun peserta lain pada perangkat yang sama.
      </p>
    </div>
  `;
}

function openEditProfileModal() {
  const user = getRegisteredUser();
  if (!user) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  setVal('editProfileNama', user.nama);
  setVal('editProfileNoHp', user.noHp);
  setVal('editProfileFormasi', user.formasi || '');
  setVal('editProfilePin', '');
  pendingEditFotoDataUrl = '';
  const editFotoEl = document.getElementById('editProfileFoto');
  if (editFotoEl) editFotoEl.value = '';
  updateFotoPreviewBox(
    'editFotoPreviewWrap',
    'editFotoStatusText',
    user.fotoDataUrl || '',
    user.fotoDataUrl ? 'Foto saat ini tersimpan. Pilih file baru bila ingin mengganti.' : 'Belum ada pas foto. Disarankan unggah foto 3:4.'
  );
  const pinEl = document.getElementById('editProfilePin');
  if (pinEl) pinEl.type = 'password';
  syncEyeToggleState(document.querySelector('[data-eye-for="editProfilePin"]'), false);
  const errBox = document.getElementById('editProfileError');
  if (errBox) errBox.classList.add('hidden');
  const modal = document.getElementById('modalEditProfile');
  if (modal) modal.classList.remove('hidden');
}

function closeEditProfileModal() {
  const modal = document.getElementById('modalEditProfile');
  if (modal) modal.classList.add('hidden');
}

function handleEditProfileSubmit(event) {
  if (event) event.preventDefault();
  if (!window.Auth) return;
  const nama = (document.getElementById('editProfileNama') || {}).value || '';
  const noHp = (document.getElementById('editProfileNoHp') || {}).value || '';
  const formasi = (document.getElementById('editProfileFormasi') || {}).value || '';
  const pin = (document.getElementById('editProfilePin') || {}).value || '';
  const errBox = document.getElementById('editProfileError');
  const didUpdateFoto = Boolean(pendingEditFotoDataUrl);

  const res = window.Auth.updateProfile({
    nama,
    noHp,
    formasi,
    pin,
    fotoDataUrl: pendingEditFotoDataUrl
  });
  if (!res.success) {
    if (errBox) {
      errBox.textContent = res.error;
      errBox.classList.remove('hidden');
    }
    return;
  }
  pendingEditFotoDataUrl = '';
  closeEditProfileModal();
  window.Auth.syncUI(document);
  if (didUpdateFoto) {
    syncUserToDeveloper(res.user, 'updateFoto');
  }
  if (window.Landing) window.Landing.refresh();
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
      const avatarInner = acc.fotoDataUrl
        ? `<img src="${authEsc(acc.fotoDataUrl)}" alt="" class="hdr-user-avatar-img">`
        : authEsc((acc.nama || 'P').charAt(0).toUpperCase());
      return `
        <button type="button" class="quick-account-chip ${isCurrent ? 'is-active' : ''}" data-identifier="${safeNo}" onclick="selectQuickSwitchAccount(this.dataset.identifier)">
          <span class="quick-account-avatar">${avatarInner}</span>
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
  toggleForgotPinPane(false);
}

function toggleForgotPinPane(show) {
  if (typeof document === 'undefined') return;
  const loginForm = document.getElementById('formUserLogin');
  const forgotPane = document.getElementById('authForgotPinPane');
  const errBox = document.getElementById('authLoginError');
  const resetErr = document.getElementById('authResetError');
  const okBox = document.getElementById('authResetSuccess');
  if (!loginForm || !forgotPane) return;
  loginForm.classList.toggle('hidden', Boolean(show));
  forgotPane.classList.toggle('hidden', !show);
  if (show) {
    if (errBox) errBox.classList.add('hidden');
    if (resetErr) resetErr.classList.add('hidden');
    if (okBox) okBox.classList.add('hidden');
  }
}

function handleResetPinSubmit(event) {
  if (event) event.preventDefault();
  if (!window.Auth) return;
  const email = (document.getElementById('resetPinEmail') || {}).value || '';
  const noHp = (document.getElementById('resetPinNoHp') || {}).value || '';
  const newPin = (document.getElementById('resetPinNewPin') || {}).value || '';
  const errBox = document.getElementById('authResetError');
  const okBox = document.getElementById('authResetSuccess');

  const res = window.Auth.resetPin({ email, noHp, newPin });
  if (!res.success) {
    if (errBox) {
      errBox.textContent = res.error;
      errBox.classList.remove('hidden');
    }
    return;
  }
  toggleForgotPinPane(false);
  const loginId = document.getElementById('authLoginIdentifier');
  const loginPin = document.getElementById('authLoginPin');
  if (loginId && res.user) loginId.value = res.user.noPeserta || res.user.email || '';
  if (loginPin) loginPin.value = String(newPin).trim();
  if (okBox) {
    okBox.textContent = 'PIN berhasil diatur ulang! Silakan klik "Masuk ke Portal CAT".';
    okBox.classList.remove('hidden');
  }
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
  syncEyeToggleState(document.querySelector('[data-eye-for="authInputPin"]'), true);
  if (hint) {
    hint.textContent = `PIN otomatis dibuat: ${pin} — catat PIN ini untuk login kembali.`;
    hint.classList.remove('hidden');
  }
}

function toggleProfilePinReveal(btnEl) {
  if (typeof document === 'undefined') return;
  const user = getRegisteredUser();
  const valEl = document.getElementById('profilePinMaskedVal');
  if (!valEl || !user) return;
  const revealed = valEl.getAttribute('data-revealed') === 'true';
  if (revealed) {
    valEl.textContent = '••••••';
    valEl.setAttribute('data-revealed', 'false');
    if (btnEl) btnEl.innerHTML = `${EYE_SVG_OPEN}<span>Intip PIN</span>`;
  } else {
    valEl.textContent = user.pin || '••••••';
    valEl.setAttribute('data-revealed', 'true');
    if (btnEl) btnEl.innerHTML = `${EYE_SVG_CLOSED}<span>Sembunyikan</span>`;
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

  if (!pendingRegisterFotoDataUrl) {
    if (errBox) {
      errBox.textContent = isCompressingRegisterFoto
        ? 'Pas foto sedang diproses. Mohon tunggu sebentar lalu klik Daftar lagi.'
        : 'Pas foto wajib diunggah untuk membuat Kartu Peserta Simulasi.';
      errBox.classList.remove('hidden');
    }
    return;
  }

  const res = window.Auth.register({
    nama,
    email,
    noHp,
    formasi,
    pin,
    fotoDataUrl: pendingRegisterFotoDataUrl
  });
  if (!res.success) {
    if (errBox) {
      errBox.textContent = res.error;
      errBox.classList.remove('hidden');
    }
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  window.Auth.syncUI(document);
  syncUserToDeveloper(res.user, 'register');

  const cb = authSuccessCallback;
  closeAuthModal();

  if (window.Landing && typeof window.Landing.refresh === 'function') window.Landing.refresh();
  if (window.History && typeof window.History.render === 'function') window.History.render();
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);

  if (typeof cb === 'function') {
    cb();
  } else if (typeof window.switchHomeTab === 'function') {
    window.switchHomeTab('pkg', false);
  }
}

function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  if (!window.Auth) return;

  const identifier = (document.getElementById('authLoginIdentifier') || {}).value || '';
  const pin = (document.getElementById('authLoginPin') || {}).value || '';
  const errBox = document.getElementById('authLoginError');
  const okBox = document.getElementById('authResetSuccess');
  if (okBox) okBox.classList.add('hidden');

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
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);

  if (typeof cb === 'function') {
    cb();
  } else if (typeof window.switchHomeTab === 'function') {
    window.switchHomeTab('pkg', false);
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

  const cardPhotoEl = document.getElementById('cardAvatarPhoto');
  const cardPlaceholderEl = document.getElementById('cardAvatarPlaceholder');
  const cardFrameEl = document.getElementById('cardAvatarFrame');
  if (cardPhotoEl && cardPlaceholderEl) {
    if (user.fotoDataUrl) {
      cardPhotoEl.src = user.fotoDataUrl;
      cardPhotoEl.classList.remove('hidden');
      cardPlaceholderEl.classList.add('hidden');
      if (cardFrameEl) {
        cardFrameEl.style.padding = '0';
        cardFrameEl.style.borderStyle = 'solid';
      }
    } else {
      cardPhotoEl.src = '';
      cardPhotoEl.classList.add('hidden');
      cardPlaceholderEl.classList.remove('hidden');
      if (cardFrameEl) {
        cardFrameEl.style.padding = '4px';
        cardFrameEl.style.borderStyle = 'dashed';
      }
    }
  }

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

function syncUserToDeveloper(user, action) {
  const scriptUrl = window.CAT_CONFIG && window.CAT_CONFIG.googleSheetScriptUrl;
  if (!scriptUrl || !user) return;
  try {
    const rawDataUrl = user.fotoDataUrl ? String(user.fotoDataUrl) : '';
    const fotoBase64 = rawDataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    const safePayload = {
      action: action || 'register',
      id: user.id,
      nama: user.nama,
      email: user.email,
      noHp: user.noHp,
      noPeserta: user.noPeserta,
      formasi: user.formasi,
      registeredAt: user.registeredAt,
      registeredAtFormatted: user.registeredAtFormatted,
      fotoBase64,
      fotoMime: 'image/jpeg'
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
  window.toggleHeaderUserMenu = toggleHeaderUserMenu;
  window.closeHeaderUserMenu = closeHeaderUserMenu;
  window.switchProfileSubTab = switchProfileSubTab;
  window.openEditProfileModal = openEditProfileModal;
  window.closeEditProfileModal = closeEditProfileModal;
  window.handleEditProfileSubmit = handleEditProfileSubmit;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.toggleProfilePinReveal = toggleProfilePinReveal;
  window.toggleForgotPinPane = toggleForgotPinPane;
  window.handleResetPinSubmit = handleResetPinSubmit;
  window.handleRegisterFotoChange = handleRegisterFotoChange;
  window.handleEditFotoChange = handleEditFotoChange;
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
