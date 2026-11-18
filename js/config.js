// js/config.js - Application Configuration & Text/Math Rendering Utilities

const CAT_CONFIG = {
  featureAccessPassword: '5uk53sCPnS202tujuh!',
  adminWhatsApp: '087784800668',
  defaultSheetUrl: 'https://script.google.com/macros/s/AKfycbysWUcwKQKOf7QD3Br4vZZBFtMaDaxc_2EYVZIzC7vtnIErmsM8THi4OlGcRMK4jKxsUA/exec',
  passingGrade: {
    TWK: 65,
    TIU: 80,
    TKP: 166,
    COMPETITIVE: 430,
    MAX_TOTAL: 550
  },
  driveLinks: {
    modul1: 'https://drive.google.com/file/d/1RJIz_azD8TarhpekTl8CtrSvLTMvB-q9/view?usp=drive_link',
    modul2: 'https://drive.google.com/file/d/1WqMYbwp9IIRQPQT0PEnahvnl-FqTFL6c/view?usp=drive_link',
    folder: 'https://drive.google.com/drive/folders/1KMh26ixMnDYKk63a7NWdsZZNz5AjqBoO?usp=sharing'
  },
  get googleSheetScriptUrl() {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem('cat_sheet_script_url')) || this.defaultSheetUrl;
    } catch (_) {
      return this.defaultSheetUrl;
    }
  },
  set googleSheetScriptUrl(val) {
    try {
      if (typeof localStorage === 'undefined') return;
      if (val && String(val).trim()) {
        localStorage.setItem('cat_sheet_script_url', String(val).trim());
      } else {
        localStorage.removeItem('cat_sheet_script_url');
      }
    } catch (_) {
      // Ignore storage errors
    }
  }
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMathTokens(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\rightarrow|\\implies/g, '→')
    .replace(/\\equiv/g, '≡')
    .replace(/\\neg/g, '~')
    .replace(/\\land/g, '∧')
    .replace(/\\lor/g, '∨')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\%/g, '%')
    .replace(/\\dots|\\ldots|\\cdots/g, '...')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³');
}

function renderMarkdownLite(raw) {
  if (!raw) return '';
  const lines = String(raw).split('\n');
  let html = '';
  let inCode = false;
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];

  function inlineFormat(s) {
    let out = formatMathTokens(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Protect inline code spans (including empty `` pairs) before math/bold/italic transforms
    const codeTokens = [];
    out = out.replace(/`([^`\n]*)`/g, (_, c) => {
      if (!c) return '';
      const idx = codeTokens.length;
      codeTokens.push('<code>' + c + '</code>');
      return `\u0000CODE${idx}\u0000`;
    });

    out = out
      .replace(/\$\$([^$]+)\$\$/g, (_, m) => '<strong>' + formatMathTokens(m) + '</strong>')
      .replace(/\$([^$]+)\$/g, (_, m) => '<span class="math-inline">' + formatMathTokens(m) + '</span>')
      .replace(/\*\*\*((?:[^*]|\*(?!\*\*))+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*((?:[^*]|\*(?!\*))+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');

    if (codeTokens.length) {
      out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, idx) => codeTokens[Number(idx)] || '');
    }
    return out;
  }

  function flushTable() {
    if (!inTable) return;
    inTable = false;
    if (!tableRows.length) return;
    let tHtml = '<table>';
    tableRows.forEach((row, idx) => {
      if (/^\|?[\s\-:|]+\|?$/.test(row.trim())) return;
      const cells = row.trim().replace(/^\||\|$/g, '').split('|');
      const tag = idx === 0 ? 'th' : 'td';
      tHtml += '<tr>' + cells.map((c) => `<${tag}>${inlineFormat(c.trim())}</${tag}>`).join('') + '</tr>';
    });
    tHtml += '</table>';
    html += tHtml;
    tableRows = [];
  }

  function flushList() {
    if (!inList) return;
    inList = false;
    if (!listItems.length) return;
    html += '<ul class="md-list">' + listItems.map((item) => `<li>${inlineFormat(item)}</li>`).join('') + '</ul>';
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      flushTable();
      flushList();
      if (inCode) {
        inCode = false;
        html += '<pre><code>' + codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';
      } else {
        inCode = true;
        codeLines = [];
      }
    } else if (inCode) {
      codeLines.push(line);
    } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      inTable = true;
      tableRows.push(line);
    } else if (/^[-*]\s+/.test(trimmed)) {
      flushTable();
      inList = true;
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
    } else {
      flushTable();
      flushList();
      if (trimmed !== '') {
        html += '<p>' + inlineFormat(line) + '</p>';
      }
    }
  }

  flushTable();
  flushList();
  if (inCode && codeLines.length) {
    html += '<pre><code>' + codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';
  }
  return html;
}

if (typeof window !== 'undefined') {
  window.CAT_CONFIG = CAT_CONFIG;
  window.escapeHtml = escapeHtml;
  window.formatMathTokens = formatMathTokens;
  window.renderMarkdownLite = renderMarkdownLite;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CAT_CONFIG,
    escapeHtml,
    formatMathTokens,
    renderMarkdownLite
  };
}
