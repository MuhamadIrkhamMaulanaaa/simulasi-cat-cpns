// js/storage.js - Client-Side Persistence Layer & Legacy Migration

const STORAGE_KEYS = {
  USERS_DB: 'cat_users_db',
  ACTIVE_SESSION: 'cat_active_session',
  ACTIVE_EXAM: 'cat_active_exam_session',
  ACTIVE_EXAMS_MAP: 'cat_active_exam_sessions',
  EXAM_HISTORY: 'cat_exam_history',
  LEGACY_PROFILE: 'cat_cpns_user_profile',
  LEGACY_HISTORY: 'cpns2027_pti_hist',
  LEGACY_HIST_MIGRATED: 'cat_legacy_hist_migrated',
  FEATURE_UNLOCKED: 'cat_skb_materi_unlocked',
  THEME: 'cat_theme',
  FONT_SCALE: 'cat_font_scale'
};

function createMemoryStorageFallback() {
  const map = new Map();
  return {
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); }
  };
}

function createStorage(env) {
  const ls =
    (env && env.localStorage) ||
    (typeof window !== 'undefined' && window.localStorage) ||
    createMemoryStorageFallback();

  function safeParse(key, fallback) {
    try {
      const raw = ls.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      ls.setItem(key, String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getSnapshotsMap() {
    const parsed = safeParse(STORAGE_KEYS.ACTIVE_EXAMS_MAP, {});
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  }

  return {
    keys: STORAGE_KEYS,

    getRaw(key, fallback = null) {
      try {
        const val = ls.getItem(key);
        return val !== null ? val : fallback;
      } catch (_) {
        return fallback;
      }
    },

    setRaw(key, value) {
      safeWrite(key, value);
    },

    removeRaw(key) {
      try {
        ls.removeItem(key);
      } catch (_) {
        // Ignore storage errors
      }
    },

    getUsers() {
      const parsed = safeParse(STORAGE_KEYS.USERS_DB, {});
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed;
    },

    getUserById(id) {
      if (!id) return null;
      const users = this.getUsers();
      return users[id] || null;
    },

    saveUser(user) {
      if (!user || !user.id) {
        throw new Error('Invalid user payload');
      }
      const users = this.getUsers();
      users[user.id] = Object.assign({}, users[user.id] || {}, user, {
        updatedAt: new Date().toISOString()
      });
      safeWrite(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
      return users[user.id];
    },

    getActiveSession() {
      const parsed = safeParse(STORAGE_KEYS.ACTIVE_SESSION, null);
      if (!parsed || typeof parsed !== 'object' || !parsed.userId) {
        return null;
      }
      return parsed;
    },

    setActiveSession(session) {
      if (!session || !session.userId) {
        throw new Error('Invalid session payload');
      }
      safeWrite(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    },

    clearActiveSession() {
      try {
        ls.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      } catch (_) {
        // Ignore storage errors
      }
    },

    getActiveUser() {
      const session = this.getActiveSession();
      if (!session || !session.userId) return null;
      return this.getUserById(session.userId);
    },

    getActiveExamSnapshot() {
      const parsed = safeParse(STORAGE_KEYS.ACTIVE_EXAM, null);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    },

    getActiveExamSnapshotForUser(userId) {
      const ownerId = userId || 'ANON';
      const map = getSnapshotsMap();
      if (map[ownerId] && typeof map[ownerId] === 'object') {
        return map[ownerId];
      }
      const legacySnap = this.getActiveExamSnapshot();
      if (!legacySnap) return null;
      const snapOwner = legacySnap.userId || 'ANON';
      return snapOwner === ownerId ? legacySnap : null;
    },

    hasAccountSavedExam() {
      const map = getSnapshotsMap();
      for (const [k, v] of Object.entries(map)) {
        if (k !== 'ANON' && v && typeof v === 'object' && v.pkgId) return true;
      }
      const snap = this.getActiveExamSnapshot();
      return Boolean(snap && snap.pkgId && snap.userId && snap.userId !== 'ANON');
    },

    saveActiveExamSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        throw new Error('Invalid snapshot payload');
      }
      const serialized = JSON.stringify(snapshot);
      safeWrite(STORAGE_KEYS.ACTIVE_EXAM, serialized);
      const ownerId = snapshot.userId || 'ANON';
      const map = getSnapshotsMap();
      map[ownerId] = snapshot;
      safeWrite(STORAGE_KEYS.ACTIVE_EXAMS_MAP, JSON.stringify(map));
    },

    clearActiveExamSnapshot(userId) {
      const current = this.getActiveExamSnapshot();
      const map = getSnapshotsMap();
      if (userId) {
        delete map[userId];
        safeWrite(STORAGE_KEYS.ACTIVE_EXAMS_MAP, JSON.stringify(map));
        if (current && (current.userId || 'ANON') === userId) {
          try { ls.removeItem(STORAGE_KEYS.ACTIVE_EXAM); } catch (_) {}
        }
      } else {
        if (current && current.userId) {
          delete map[current.userId];
          safeWrite(STORAGE_KEYS.ACTIVE_EXAMS_MAP, JSON.stringify(map));
        }
        try { ls.removeItem(STORAGE_KEYS.ACTIVE_EXAM); } catch (_) {}
      }
    },

    getHistory(userId) {
      const parsed = safeParse(STORAGE_KEYS.EXAM_HISTORY, []);
      if (!Array.isArray(parsed)) return [];
      if (userId) {
        return parsed.filter((item) => item && item.userId === userId);
      }
      return parsed;
    },

    saveHistoryEntry(entry) {
      if (!entry || !entry.id) {
        throw new Error('Invalid history entry');
      }
      const list = this.getHistory();
      list.unshift(entry);
      for (const limit of [50, 25, 10, 5, 1]) {
        const pruned = list.slice(0, limit);
        if (safeWrite(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify(pruned))) {
          return entry;
        }
      }
      // Last-resort compact fallback without large answersLedger if quota is critically full
      const compactEntry = Object.assign({}, entry, { answersLedger: null });
      safeWrite(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify([compactEntry]));
      return entry;
    },

    clearHistory(userId) {
      if (userId) {
        const remaining = this.getHistory().filter((item) => item && item.userId !== userId);
        safeWrite(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify(remaining));
      } else {
        try { ls.removeItem(STORAGE_KEYS.EXAM_HISTORY); } catch (_) {}
      }
    },

    migrateLegacy() {
      let migratedUserId = null;
      try {
        const legacyProfileRaw = ls.getItem(STORAGE_KEYS.LEGACY_PROFILE);
        if (legacyProfileRaw) {
          const profile = JSON.parse(legacyProfileRaw);
          if (profile && typeof profile === 'object') {
            const userId = profile.id || 'USR-LEGACY-' + Date.now();
            migratedUserId = userId;
            const users = this.getUsers();
            if (!users[userId]) {
              const rawHp = String(profile.noHp || profile.whatsapp || '08000000000').replace(/[\s-]/g, '');
              const cleanHp = rawHp.startsWith('+62')
                ? '0' + rawHp.slice(3)
                : rawHp.startsWith('62')
                  ? '0' + rawHp.slice(2)
                  : rawHp;
              const rawNo = profile.noPeserta ? String(profile.noPeserta) : '';
              const noPeserta = rawNo
                ? (rawNo.startsWith('27-01-') ? rawNo : `27-01-${rawNo}`)
                : `27-01-${cleanHp}`;

              users[userId] = {
                id: userId,
                nama: profile.nama || 'Peserta',
                email: profile.email || 'legacy@catcpns.id',
                noHp: cleanHp,
                noPeserta,
                formasi: profile.formasi || 'Umum',
                pin: profile.pin || '123456',
                registeredAt: profile.registeredAt || new Date().toISOString(),
                registeredAtFormatted: profile.registeredAtFormatted || new Date().toLocaleString('id-ID'),
                lastLoginAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              ls.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
            }
            if (!this.getActiveSession()) {
              this.setActiveSession({ userId, loginAt: new Date().toISOString() });
            }
          }
        }
      } catch (_) {
        // Safe fail on corrupt legacy profile
      }

      try {
        const alreadyMigratedHist = ls.getItem(STORAGE_KEYS.LEGACY_HIST_MIGRATED);
        const legacyHistRaw = ls.getItem(STORAGE_KEYS.LEGACY_HISTORY);
        if (!alreadyMigratedHist && legacyHistRaw) {
          const legacyList = JSON.parse(legacyHistRaw);
          if (Array.isArray(legacyList) && legacyList.length > 0) {
            const existing = this.getHistory();
            const existingIds = new Set(existing.map((e) => e.id));
            const fallbackUser = this.getActiveUser();
            const targetUserId = migratedUserId || (fallbackUser ? fallbackUser.id : 'ANON');
            const targetUserNama = fallbackUser ? fallbackUser.nama : 'Peserta Lama';
            const targetUserNo = fallbackUser ? fallbackUser.noPeserta : '27-01-00000000';

            const converted = [];
            legacyList.forEach((item, idx) => {
              if (!item || typeof item !== 'object') return;
              const entryId = `HIST-LEGACY-${idx + 1}`;
              if (existingIds.has(entryId)) return;
              const score = Number(item.score) || 0;
              const max = Number(item.max) || 550;
              const violCount = Number(item.violations) || 0;
              converted.push({
                id: entryId,
                userId: targetUserId,
                userNama: targetUserNama,
                userNoPeserta: targetUserNo,
                pkgId: item.pkgId || 'legacy',
                pkgTitle: item.pkgTitle || 'Riwayat Simulasi Lama',
                mode: 'cat',
                timestamp: new Date().toISOString(),
                dateFormatted: item.date || '-',
                durationSeconds: 0,
                allocatedSeconds: 0,
                scoresByGroup: {},
                maxByGroup: {},
                totalScore: score,
                maxScore: max,
                percentage: max > 0 ? Math.round((score / max) * 100) : 0,
                isFullSKD: false,
                passingGrade: {
                  passTWK: true,
                  passTIU: true,
                  passTKP: true,
                  passAll: true,
                  isCompetitive: false
                },
                violations: {
                  tabSwitches: 0,
                  fullscreenExits: 0,
                  total: violCount,
                  isClean: violCount === 0
                },
                metrics: {
                  totalQuestions: 0,
                  answeredCount: 0,
                  doubtCount: 0,
                  emptyCount: 0,
                  correctCount: 0
                },
                answersLedger: null,
                isLegacy: true
              });
            });

            if (converted.length > 0) {
              const merged = [...existing, ...converted].slice(0, 50);
              ls.setItem(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify(merged));
            }
          }
          ls.setItem(STORAGE_KEYS.LEGACY_HIST_MIGRATED, 'true');
        }
      } catch (_) {
        // Safe fail on corrupt legacy history
      }
    }
  };
}

const Storage = typeof window !== 'undefined' ? createStorage(window) : null;

if (typeof window !== 'undefined') {
  window.STORAGE_KEYS = STORAGE_KEYS;
  window.createStorage = createStorage;
  window.Storage = Storage;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    createStorage,
    Storage
  };
}
