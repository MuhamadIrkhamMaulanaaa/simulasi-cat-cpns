# Arsitektur Sistem & Design System — Simulasi CAT BKN CPNS 2027

**Versi Dokumen:** 2.0 (Produksi Penuh — Modular Zero-Build)  
**Target Platform:** Static Edge Deployment (Vercel & Cloudflare Pages) + Client-Side Persistence (`localStorage`) + Opsional Google Sheets BaaS  
**Acuan Regulasi:** KepmenPANRB No. 321 Tahun 2024 (Nilai Ambang Batas SKD Pengadaan PNS) & Standar Antarmuka CAT BKN

---

## 1. Audit Mendalam Sistem Monolit Lama & Akar Masalah

Sebelum proses refaktorisasi modular (Milestone M1–M6), aplikasi Simulasi CAT CPNS 2027 berada dalam satu berkas monolitik `index.html` berukuran **~1,66 MB** (~1.654 KB pada arsip `DEPLOY_CLOUDFLARE/index.html`) yang menggabungkan markup HTML, seluruh CSS inline, 610 objek soal lengkap beserta 23 diagram SVG, gambar QRIS dalam format Base64, dan ~48,5 KB skrip logika aplikasi dalam satu baris terkompresi (`line 776`).

### 1.1 Tabel Temuan Audit & Akar Masalah

| Area Sistem | Kondisi Sistem Lama (Monolit) | Akar Masalah & Dampak Produksi | Solusi Arsitektur Baru |
|---|---|---|---|
| **Struktur Kode & Aset** | 1 file HTML 1,66 MB (CSS, JS, 610 soal, Base64 QRIS disatukan) | Parsing lambat, mustahil diuji otomatis per unit, risiko regresi tinggi saat perubahan UI | Pemisahan total ke `data/`, `css/`, `js/`, aset `qris.jpg`, serta `<index.html>` ringkas (< 100 KB) |
| **Autentikasi & Multi-User** | Kunci tunggal `cat_cpns_user_profile` tanpa PIN; logout menghapus profil | Satu perangkat tidak dapat dipakai bergantian oleh beberapa peserta; peserta lama kehilangan riwayat saat ganti akun; `noPeserta` tidak konsisten | Skema `cat_users_db` + `cat_active_session` + PIN 6 digit; login via Email / No. HP / `27-01-<noHp>`; logout hanya membersihkan sesi aktif |
| **Timer Ujian CAT** | Decrement `setInterval(() => state.secondsLeft--, 1000)` | *Timer drift* saat tab browser di-background atau perangkat sleep (browser membatasi interval menjadi 1x/menit atau pause) | Timer berbasis *wall-clock* (`examEndTime = Date.now() + durasiMs`); sisa waktu dihitung ulang via `examEndTime - Date.now()` pada tick & `visibilitychange` |
| **Ketahanan Sesi (Crash Recovery)** | Tidak ada persistensi progres selama ujian berlangsung | Refresh, crash browser, atau baterai habis menghapus seluruh 110 jawaban & mengulang waktu dari awal | Auto-save snapshot `cat_active_exam_session` setiap pilih jawaban, ragu-ragu, hapus, navigasi, & tick + banner pemulihan di beranda |
| **Bug Hitung Grid Navigasi** | `answered = filter(answers)`, `doubt = filter(doubts)`, `empty = total - answered` | Soal yang sudah dijawab sekaligus ditandai Ragu-Ragu terhitung **ganda** di statistik Dijawab dan Ragu (`Dijawab + Ragu + Belum > 110`) | Partisi saling lepas (*mutually exclusive*): `doubtCount`, `answeredConfidentCount` (`answered && !doubt`), dan `emptyCount` (`total - doubt - confident`) |
| **Riwayat & Review Pembahasan** | `cpns2027_pti_hist` hanya menyimpan ringkasan `{date, pkgTitle, score, max, violations}` max 30 | Tidak ada `userId`, rincian subtes, status Passing Grade, durasi, maupun `answersLedger`; review soal mustahil dilakukan setelah reload | Skema `cat_exam_history` (kapasitas 50 entri terbaru) lengkap dengan `scoresByGroup`, `passingGrade`, `violations`, dan `answersLedger` untuk rekonstruksi mode `review` pasca-reload |
| **Responsivitas Mobile & HTML** | Grid lock `minmax(0, 1fr) 310px !important`, robot donasi menutupi toolbar bawah, atribut `class` duplikat pada tag HTML | Overflow horizontal di viewport `< 980px`, tombol navigasi soal tertutup robot di mobile, kelas CSS kedua diabaikan browser | Breakpoint adaptif `<= 980px` (stacking flex + grid toggle) & `<= 640px`, penyesuaian posisi `.floating-robot-wrap`, perbaikan markup HTML valid |

---

## 2. Arsitektur Modular & Pipeline Eksekusi

Aplikasi menerapkan pola **Zero-Build Browser Modules + CommonJS Dual Export** sehingga dapat langsung dijalankan oleh server statis maupun dibuka pada runtime Node.js untuk pengujian otomatis tanpa bundler eksternal.

```text
E:\Karir\Portofolio\CPNS\
├── index.html                          # Shell SPA terstruktur (< 100 KB, < 1.000 baris)
├── qris.jpg                            # Aset gambar QRIS eksternal (menggantikan Base64)
├── KODE_GOOGLE_APPS_SCRIPT_SPREADSHEET.js # Backend opsional pencatatan pendaftaran ke Sheets
├── vercel.json                         # Konfigurasi routing SPA Vercel
├── wrangler.jsonc                      # Konfigurasi Cloudflare Workers/Pages static assets
├── _headers & _redirects               # Header keamanan (X-Frame-Options, nosniff) & SPA fallback
├── data/
│   ├── questions.js                    # 610 butir soal tervalidasi (120 TWK, 150 TIU, 180 TKP, 160 SKB, 23 SVG)
│   └── packages.js                     # 12 definisi paket ujian & fungsi filter deterministik
├── css/
│   ├── tokens.css                      # Token warna, tipografi, radius, elevasi, dark theme
│   ├── base.css                        # Reset, layout kontainer utama, header, footer
│   ├── components.css                  # Tombol, form, modal, kartu modul, floating robot, print A4
│   ├── landing.css                     # Hero interaktif, kartu PG, filter bar, grid paket
│   ├── exam.css                        # Antarmuka CAT BKN, panel proktor webcam, grid 110 nomor
│   └── result.css                      # Evaluasi skor, progress bar PG, audit integritas, tabel riwayat
├── js/
│   ├── config.js                       # Konfigurasi aplikasi, konstanta PG, utilitas math/markdown/XSS
│   ├── storage.js                      # Abstraksi persistensi terisolasi + factory createStorage(env)
│   ├── auth.js                         # Autentikasi multi-user PIN 6-digit + factory createAuth(storage, env)
│   ├── proctor.js                      # Pengawasan fullscreen, pindah tab, webcam & deteksi wajah AI
│   ├── exam.js                         # Mesin ujian CAT (wall-clock timer, auto-save, grid stats, shortcuts)
│   ├── result.js                       # Kalkulator skor, evaluator KepmenPANRB 321/2024, tie-breaker BKN
│   ├── history.js                      # Render riwayat tersegmentasi user & rekonstruksi mode review
│   ├── landing.js                      # Hero interaktif, crash recovery banner, ringkasan personal, filter
│   └── app.js                          # Inisialisasi aplikasi, router layar, tema, modal donasi & kunci akses
└── tests/
    ├── harness.js                      # Mock DOM/localStorage & runner protokol TAP v13
    ├── run_all_tests.js                # Orkestrator 137 pengujian (Tier 1–4)
    ├── adversarial_boundary_stress.js  # 23 uji stres batas ekstrem & corner cases
    ├── verify_m1_final.js              # Audit integritas aset, CSS, ukuran berkas, dan paritas deployment
    └── tier1_features/ ... tier4_scenarios/
```

### 2.1 Pola Ketergantungan Antar Modul (`<script>` Load Order)

1. **Lapisan Data**: `data/questions.js` → `data/packages.js`
2. **Lapisan Inti & Persistensi**: `js/config.js` → `js/storage.js` → `js/auth.js`
3. **Lapisan Domain Ujian & Evaluasi**: `js/proctor.js` → `js/result.js` → `js/exam.js`
4. **Lapisan Presentasi & Orkestrasi**: `js/history.js` → `js/landing.js` → `js/app.js` → Inline Bootstrap `<script>`

Setiap modul domain inti (`storage.js`, `auth.js`, `result.js`, `exam.js`) menyediakan **factory function murni** (`createStorage(env)`, `createAuth(storage, env)`, `createScoring()`, `createExamEngine(storage, questions, packages, env)`) sekaligus mendaftarkan singleton browser ke objek `window` serta mengekspor modul via `module.exports` ketika berjalan di lingkungan Node.js.

---

## 3. Design System Tokens & Standar Antarmuka (`css/tokens.css`)

Sistem desain mengusung estetika portal resmi institusi pemerintah modern yang bersih, berwibawa, dan berfokus pada keterbacaan soal jangka panjang (100 menit ujian).

### 3.1 Tipografi
- **Font Utama**: `'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (bobot `400`, `500`, `600`, `700`, `800`).
- **Font Kode / Monospace**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (digunakan pada blok kode SKB Pranata Komputer / Python).
- **Skalabilitas Ujian**: Variabel `--exam-font-scale` (`0.88` hingga `1.25`, langkah `[0.88, 1, 1.12, 1.25]`) dikontrol oleh tombol `A-`, `A`, `A+` pada `.q-topbar` untuk menyesuaikan ukuran teks soal dan opsi jawaban tanpa merusak tata letak grid.

### 3.2 Palet Warna Inti & Semantik CAT BKN

| Token CSS | Mode Terang (Light) | Mode Gelap (`[data-theme="dark"]`) | Peran Semantik |
|---|---|---|---|
| `--bkn-navy` | `#0f172a` | `#0b0f19` | Header utama, aksen resmi BKN, badge kategori soal |
| `--bkn-blue` / `--cat-blue` | `#0284c7` | `#0284c7` | Aksen primer CAT, kartu peserta, tile soal terjawab/aktif |
| `--primary` | `#1d4ed8` | `#3b82f6` | CTA primer, tab aktif, garis batas fokus utama |
| `--cat-yellow` | `#f4c430` | `#f4c430` | Garis aksen header resmi CAT BKN & tombol Ragu-Ragu |
| `--bg-page` | `#f8fafc` | `#0b0f19` | Latar belakang kanvas utama aplikasi |
| `--bg-surface` | `#ffffff` | `#111827` | Permukaan kartu, panel soal, modal |
| `--bg-subtle` | `#f1f5f9` | `#1f2937` | Bar alat soal, header tabel, kartu skor |
| `--text-primary` | `#0f172a` | `#f3f4f6` | Judul, batang soal, teks utama |
| `--text-secondary` | `#475569` | `#cbd5e1` | Deskripsi paket, teks pendukung |
| `--color-answered` | `#16a34a` | `#22c55e` | Status Lulus PG / Jawaban benar / Indikator kamera aktif |
| `--color-doubt` | `#d97706` | `#f59e0b` | Status Ragu-Ragu / Peringatan perhatian |
| `--color-empty` | `#dc2626` | `#ef4444` | Belum dijawab / Gagal PG / Peringatan bahaya |

### 3.3 Breakpoints Responsif
- **Desktop (`> 980px`)**: Layout ujian 2 kolom (`minmax(0, 1fr) 310px`) dengan sidebar proktor & peta 110 nomor menempel (*sticky* `top: 72px`).
- **Tablet & Mobile Besar (`<= 980px`)**: `#examGrid` berubah menjadi tumpukan vertikal (`flex-direction: column`); panel soal tampil di atas (`order: 1`), sidebar navigasi & kamera di bawah (`order: 2`, `width: 100%`). Tersedia tombol collapse/expand peta nomor soal `#numGrid`, dan `.floating-robot-wrap` naik ke `bottom: 82px` agar tidak menutup toolbar ujian.
- **Mobile Kecil (`<= 640px`)**: Padding kontainer mengecil (`8px–12px`), toolbar bawah soal berjajar penuh lebar layar (`flex: 1`), gelembung teks robot disembunyikan agar tidak mengganggu ruang baca soal.

---

## 4. Skema Persistensi Data & Migrasi Legacy

Seluruh penyimpanan lokal menggunakan API terenkapsulasi di `js/storage.js` dengan proteksi `try/catch` terhadap *corrupt JSON* maupun kuota penyimpanan penuh.

### 4.1 Daftar Kunci `localStorage`

1. **`cat_users_db`** (`Object<userId, UserRecord>`):
   ```json
   {
     "USR-1731740000000-123": {
       "id": "USR-1731740000000-123",
       "nama": "Budi Santoso",
       "email": "budi@example.com",
       "noHp": "081234567890",
       "noPeserta": "27-01-081234567890",
       "formasi": "Pranata Komputer Ahli Pertama",
       "pin": "123456",
       "registeredAt": "2026-11-16T09:00:00.000Z",
       "registeredAtFormatted": "16/11/2026, 16.00.00",
       "lastLoginAt": "2026-11-16T09:00:00.000Z",
       "updatedAt": "2026-11-16T09:00:00.000Z"
     }
   }
   ```
   - Validasi nomor HP Indonesia: regex `/^(?:\+62|62|0)8[0-9]{8,11}$/` setelah menghapus spasi dan tanda hubung; dinormalisasi ke awalan `08...`.
   - Format resmi nomor peserta: `27-01-<cleanPhone>`.
   - PIN autentikasi wajib tepat 6 digit numerik (`/^\d{6}$/`).

2. **`cat_active_session`** (`ActiveSession | null`):
   ```json
   { "userId": "USR-1731740000000-123", "loginAt": "2026-11-16T09:00:00.000Z" }
   ```
   - Operasi `logout()` **hanya** menghapus `cat_active_session` tanpa menghapus `cat_users_db` maupun `cat_exam_history`.

3. **`cat_active_exam_session`** & **`cat_active_exam_sessions`** (`ExamSnapshot | null` / `Object<userId, ExamSnapshot>`):
   ```json
   {
     "pkgId": "skd_hots",
     "mode": "cat",
     "userId": "USR-1731740000000-123",
     "startedAt": "2026-11-16T09:05:00.000Z",
     "examEndTime": 1794825900000,
     "secondsLeft": 5820,
     "currentIdx": 14,
     "answers": { "TWK_1": "C", "TWK_2": "A" },
     "doubts": { "TWK_2": true },
     "tabSwitches": 0,
     "fullscreenExits": 0,
     "faceMissingViolations": 0,
     "gazeViolations": 0,
     "multiFaceViolations": 0,
     "lastSavedAt": "2026-11-16T09:08:00.000Z"
   }
   ```
   - Tersimpan terisolasi per `userId` pada `cat_active_exam_sessions` (sekaligus disinkronkan ke `cat_active_exam_session`) agar sesi ujian tertunda milik peserta A tidak dapat diakses atau dibuang oleh peserta B pada perangkat yang sama.
   - Dihapus secara atomik untuk pemilik sesi saat ujian selesai (`confirmFinishExam()` / `finish()`) atau saat peserta yang bersangkutan memilih "Buang Sesi" pada banner pemulihan.

4. **`cat_exam_history`** (`Array<ExamHistoryEntry>`, batas maksimal **50 entri terbaru**):
   ```json
   {
     "id": "HIST-1731746000000-456",
     "userId": "USR-1731740000000-123",
     "userNama": "Budi Santoso",
     "userNoPeserta": "27-01-081234567890",
     "pkgId": "skd_hots",
     "pkgTitle": "Tryout SKD CPNS 2027 — Paket Utama HOTS (110 Soal)",
     "mode": "cat",
     "timestamp": "2026-11-16T10:35:00.000Z",
     "dateFormatted": "16/11/2026, 17.35.00",
     "durationSeconds": 5400,
     "allocatedSeconds": 6000,
     "scoresByGroup": { "TWK": 115, "TIU": 145, "TKP": 195, "SKB": 0 },
     "maxByGroup": { "TWK": 150, "TIU": 175, "TKP": 225, "SKB": 0 },
     "totalScore": 455,
     "maxScore": 550,
     "percentage": 83,
     "isFullSKD": true,
     "passingGrade": {
       "passTWK": true,
       "passTIU": true,
       "passTKP": true,
       "passAll": true,
       "isCompetitive": true,
       "total": 455
     },
     "violations": {
       "tabSwitches": 0,
       "fullscreenExits": 0,
       "faceMissingViolations": 0,
       "gazeViolations": 0,
       "multiFaceViolations": 0,
       "total": 0,
       "isClean": true
     },
     "metrics": {
       "totalQuestions": 110,
       "answeredCount": 110,
       "doubtCount": 2,
       "emptyCount": 0,
       "correctCount": 89
     },
     "answersLedger": {
       "TWK_1": { "chosen": "C", "score": 5, "correct": true }
     }
   }
   ```

5. **Kunci Preferensi & Integrasi Lainnya**:
   - `cat_skb_materi_unlocked`: status pembukaan akses paket drill/SKB/modul PDF (`"true"`).
   - `cat_sheet_script_url`: override URL Web App Google Apps Script untuk pencatatan registrasi peserta.
   - `cat_theme`: `"light"` | `"dark"`.
   - `cat_font_scale`: angka skala teks soal (`0.88` | `1` | `1.12` | `1.25`).

### 4.2 Alur Migrasi Otomatis dari Sistem Lama (`Storage.migrateLegacy()`)
Saat aplikasi dimuat (`init()`):
1. Memeriksa kunci lama `cat_cpns_user_profile`. Jika ditemukan JSON valid dan belum ada di `cat_users_db`, data dimigrasikan ke `cat_users_db` dengan `noPeserta` terformat `27-01-...` serta PIN default `"123456"` (bila belum punya), lalu otomatis membuatkan `cat_active_session` jika belum ada sesi aktif.
2. Memeriksa kunci lama `cpns2027_pti_hist`. Jika terdapat entri historis yang belum termigrasi (ditandai penanda `cat_legacy_hist_migrated`), entri lama dikonversi ke format `ExamHistoryEntry` (dengan penanda `isLegacy: true`) ke dalam `cat_exam_history` tanpa menimpa data baru.

---

## 5. Spesifikasi Regulasi Penilaian & Passing Grade (KepmenPANRB No. 321/2024)

Logika penilaian diimplementasikan terpusat pada `js/result.js` (`createScoring()`) dan terverifikasi penuh melalui pengujian batas ekstrem (*boundary matrix*).

### 5.1 Komposisi Soal & Bobot Skor SKD (110 Soal — 100 Menit / 6.000 Detik)

| Subtes | Urutan Nomor | Jumlah Soal | Skor Benar / Skala | Skor Salah / Kosong | Skor Maksimal | Ambang Batas (PG Umum) |
|---|---|---|---|---|---|---|
| **TWK** (Tes Wawasan Kebangsaan) | No. 1–30 | 30 | `5` | `0` | `150` | **`>= 65`** |
| **TIU** (Tes Intelegensia Umum) | No. 31–65 | 35 | `5` | `0` | `175` | **`>= 80`** |
| **TKP** (Tes Karakteristik Pribadi) | No. 66–110 | 45 | `1` s.d. `5` | `0` | `225` | **`>= 166`** |
| **Total SKD** | 1–110 | **110** | — | — | **550** | Wajib memenuhi 3 PG |

### 5.2 Aturan Kelulusan & Target Kompetitif 3x Formasi
- **Syarat Mutlak Memenuhi Passing Grade (`passAll`)**:
  `passAll = (TWK >= 65) && (TIU >= 80) && (TKP >= 166)`
  *(Skor total tinggi, misalnya `485`, tetap dinyatakan **TIDAK MEMENUHI PG** jika salah satu subtes di bawah ambang batas, misal TWK = 60).*
- **Kategori Kompetitif Aman Melaju ke SKB (`isCompetitive`)**:
  `isCompetitive = passAll && (totalSKD >= 430)`
  *(Merepresentasikan zona aman perankingan kuota 3 kali jumlah kebutuhan formasi jabatan).*
- **Paket Drill / SKB (`isFullSKD = false`)**:
  Mengevaluasi persentase penguasaan skor (`Math.round((totalScore / maxScore) * 100)`), dengan standar kelulusan latihan `>= 70%`, tanpa memblokir syarat ambang batas 3 subtes SKD.

### 5.3 Mekanisme Pemeringkatan & Tie-Breaker Resmi BKN
Apabila dua atau lebih peserta yang sama-sama lolos ambang batas (`passAll = true`) memperoleh **nilai total SKD yang sama persis**, sistem pemeringkatan BKN menggunakan urutan prioritas subtes sebagai pemutus seri (*tie-breaker*):
1. Nilai **TKP** tertinggi menang (`b.scoresByGroup.TKP - a.scoresByGroup.TKP`)
2. Jika TKP masih sama, nilai **TIU** tertinggi menang (`b.scoresByGroup.TIU - a.scoresByGroup.TIU`)
3. Jika TIU masih sama, nilai **TWK** tertinggi menang (`b.scoresByGroup.TWK - a.scoresByGroup.TWK`)

---

## 6. Jaminan Mutu & Strategi Pengujian

Seluruh lapisan logika dan deployment dijaga oleh 3 lapisan verifikasi otomatis:
1. **`tests/verify_m1_final.js`**: Validasi 610 soal, 12 paket, integritas 6 berkas CSS, paritas `_headers`/`_redirects`, pembersihan Base64 QRIS, ukuran `index.html < 100 KB`, serta sintaks skrip.
2. **`tests/run_all_tests.js`**: 137 pengujian otomatis (protokol TAP v13) mencakup Tier 1 Fitur, Tier 2 Batas Ekstrem, Tier 3 Interaksi Lintas Fitur, dan Tier 4 Skenario E2E.
3. **`tests/adversarial_boundary_stress.js`**: 23 uji stres batas (*off-by-one* PG `64/65`, `79/80`, `165/166`, `429/430`, tie-breaker BKN, *timer clamping* di `0`, *corrupt JSON immunity*, validasi batas panjang nama/HP/PIN).
