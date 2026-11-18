// data/packages.js - 12 Paket Simulasi CAT CPNS 2027
const PACKAGES = [
  {
    id: 'fr_bocoran', featured: true, isFullSKD: false, tag: 'BOCORAN FR KEDINASAN 2026 & CPNS 2027',
    title: 'Drill Bocoran Kotak Angka, Operator Simbol & Figural SVG',
    desc: '28 Soal Spesial FR Kedinasan 2026 & CPNS 2027: Kotak Angka 3×3 ("Berapa Angka Dalam Kotak?"), Segitiga Berpola, Operator Simbol Khusus, & Seluruh Soal Figural Visual SVG.',
    minutes: 30, filter: q => q.pkg === 'BOCORAN' || Boolean(q.svg)
  },
  {
    id: 'skd_hots', featured: true, isFullSKD: true, tag: 'SIMULASI PENUH SKD • PAKET UTAMA HOTS',
    title: 'Tryout SKD CPNS 2027 — Paket Utama HOTS (110 Soal)',
    desc: '110 Soal HOTS Penalaran Mendalam (30 TWK + 35 TIU + 45 TKP) • Waktu 100 Menit • Evaluasi Passing Grade Resmi BKN (65 / 80 / 166).',
    minutes: 100, filter: q => q.pkg === 'HOTS' && ['TWK','TIU','TKP'].includes(q.group)
  },
  {
    id: 'skd_p1', featured: true, isFullSKD: true, tag: 'SIMULASI PENUH SKD • PAKET 1',
    title: 'Tryout SKD CPNS 2027 — Paket 1 Standar Nasional (110 Soal)',
    desc: '110 Soal Simulasi Penuh Paket 1 (30 TWK + 35 TIU + 45 TKP) sesuai KepmenPANRB 321/2024 • Waktu 100 Menit • Evaluasi Passing Grade Resmi.',
    minutes: 100, filter: q => q.pkg === 'SKD_P1'
  },
  {
    id: 'skd_p2', featured: true, isFullSKD: true, tag: 'SIMULASI PENUH SKD • PAKET 2',
    title: 'Tryout SKD CPNS 2027 — Paket 2 Gaya Kedinasan (110 Soal)',
    desc: '110 Soal Simulasi Penuh Paket 2 Gaya Sekolah Kedinasan & Kuantitatif P–Q / X–Y (30 TWK + 35 TIU + 45 TKP) • Waktu 100 Menit.',
    minutes: 100, filter: q => q.pkg === 'SKD_P2'
  },
  {
    id: 'skd_p3', featured: true, isFullSKD: true, tag: 'SIMULASI PENUH SKD • PAKET 3',
    title: 'Tryout SKD CPNS 2027 — Paket 3 Prediksi Siber-Birokrasi (110 Soal)',
    desc: '110 Soal Simulasi Penuh Paket 3 Prediksi HOTS CPNS 2027 & Transformasi Digital (30 TWK + 35 TIU + 45 TKP) • Waktu 100 Menit.',
    minutes: 100, filter: q => q.pkg === 'SKD_P3'
  },
  {
    id: 'twk_drill', featured: false, isFullSKD: false, tag: 'BANK SUBTES SKD • 4 PAKET GABUNGAN',
    title: 'Bank Drill Fokus TWK & Bahasa Indonesia (120 Soal)',
    desc: '120 Soal Gabungan Seluruh Paket: Nasionalisme, Integritas, Bela Negara, Pilar Negara & Bahasa Indonesia EYD V • Target 90 Menit.',
    minutes: 90, filter: q => q.group === 'TWK'
  },
  {
    id: 'tiu_drill', featured: false, isFullSKD: false, tag: 'BANK SUBTES SKD • 4 PAKET + BOCORAN',
    title: 'Bank Drill Fokus TIU, Kotak Angka & Figural SVG (150 Soal)',
    desc: '150 Soal Lengkap: Kotak Angka 3×3, Operator Simbol, Analogi Kalimat, Silogisme, Analitis, Hitung Cepat, P–Q/X–Y & Figural SVG • 120 Menit.',
    minutes: 120, filter: q => q.group === 'TIU'
  },
  {
    id: 'tkp_drill', featured: false, isFullSKD: false, tag: 'BANK SUBTES SKD • 4 PAKET GABUNGAN',
    title: 'Bank Drill Fokus TKP BerAKHLAK Skor 5 (180 Soal)',
    desc: '180 Soal Studi Kasus Pelayanan Publik, Jejaring Kerja, Sosial Budaya, TIK, Profesionalisme & Anti-Radikalisme • 120 Menit.',
    minutes: 120, filter: q => q.group === 'TKP'
  },
  {
    id: 'skb_p4', featured: true, isFullSKD: false, tag: 'SIMULASI PENUH SKB • PAKET 4 (100 SOAL)',
    title: 'Tryout SKB Teknis — Paket Penuh CAT BKN (100 Soal)',
    desc: '100 Soal Standar BKN (50 Soal Rumpun Pranata Komputer + 50 Soal Rumpun PTP & Guru Informatika) • Waktu Resmi 90 Menit.',
    minutes: 90, filter: q => q.pkg === 'SKB_P4'
  },
  {
    id: 'skb_hots', featured: false, isFullSKD: false, tag: 'SKB INTI HOTS • 60 SOAL',
    title: 'Paket Inti HOTS SKB (60 Soal)',
    desc: '60 Soal HOTS Mendalam gabungan Pranata Komputer, Penata Kelola TI, PTP, dan Guru Informatika • Waktu 55 Menit.',
    minutes: 55, filter: q => q.pkg === 'HOTS' && q.group === 'SKB'
  },
  {
    id: 'skb_prakom', featured: false, isFullSKD: false, tag: 'FORMASI TEKNIS TI • GABUNGAN',
    title: 'Bank SKB Pranata Komputer & Penata Kelola TI (75 Soal)',
    desc: '75 Soal SPBE, UU PDP, COBIT 2019, TOGAF, ITIL v4, RPO/RTO, Subnetting CIDR, RAID, SQL, UML, Scrum & Keamanan Siber • 70 Menit.',
    minutes: 70, filter: q => q.category === 'SKB_PRAKOM'
  },
  {
    id: 'skb_ptp_guru', featured: false, isFullSKD: false, tag: 'FORMASI PTP & PENDIDIK • GABUNGAN',
    title: 'Bank SKB PTP & Guru Ahli Pertama Informatika (85 Soal)',
    desc: '85 Soal ADDIE/ASSURE, Kawasan Tekpend, Mayer Multimedia, SCORM/xAPI, Kirkpatrick, Kurikulum Merdeka, TaRL & Python • 75 Menit.',
    minutes: 75, filter: q => ['SKB_PTP', 'SKB_GURU'].includes(q.category)
  }
];

if (typeof window !== 'undefined') {
  window.PACKAGES = PACKAGES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PACKAGES };
}
