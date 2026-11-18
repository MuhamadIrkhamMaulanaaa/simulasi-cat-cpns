const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    failures++;
  } else {
    console.log('✅ PASS:', message);
  }
}

console.log('====================================================');
console.log('MILESTONE 1 (M1) COMPREHENSIVE VERIFICATION SUITE');
console.log('====================================================\n');

// 1. Root Deployment Parity
console.log('--- 1. Root Deployment Parity ---');
const headersRoot = path.join(rootDir, '_headers');
const redirectsRoot = path.join(rootDir, '_redirects');
const headersDeploy = path.join(rootDir, 'DEPLOY_CLOUDFLARE', '_headers');
const wranglerPath = path.join(rootDir, 'wrangler.jsonc');

assert(fs.existsSync(headersRoot), 'Root _headers file exists');
assert(!fs.existsSync(redirectsRoot), 'Root _redirects absent (Workers uses wrangler.jsonc single-page-application, avoids code 100324)');
if (fs.existsSync(headersRoot) && fs.existsSync(headersDeploy)) {
  const contentRoot = fs.readFileSync(headersRoot, 'utf8').trim();
  const contentDeploy = fs.readFileSync(headersDeploy, 'utf8').trim();
  assert(contentRoot === contentDeploy, 'Root _headers matches DEPLOY_CLOUDFLARE/_headers');
}
assert(fs.existsSync(wranglerPath), 'Root wrangler.jsonc exists');
if (fs.existsSync(wranglerPath)) {
  const wCfg = JSON.parse(fs.readFileSync(wranglerPath, 'utf8'));
  assert(wCfg.assets && wCfg.assets.not_found_handling === 'single-page-application', 'wrangler.jsonc sets assets.not_found_handling = single-page-application');
}

// 2. Data Extraction: questions.js
console.log('\n--- 2. Data Extraction: questions.js ---');
const questionsPath = path.join(rootDir, 'data', 'questions.js');
assert(fs.existsSync(questionsPath), 'data/questions.js exists');

let questionsData = [];
try {
  const { ALL_QUESTIONS } = require(questionsPath);
  questionsData = ALL_QUESTIONS;
  assert(Array.isArray(ALL_QUESTIONS), 'ALL_QUESTIONS is an array');
  assert(ALL_QUESTIONS.length === 610, `ALL_QUESTIONS has exactly 610 items (got: ${ALL_QUESTIONS.length})`);
  
  const groups = { TWK: 0, TIU: 0, TKP: 0, SKB: 0 };
  let svgCount = 0;
  ALL_QUESTIONS.forEach(q => {
    if (groups[q.group] !== undefined) groups[q.group]++;
    if (q.svg) svgCount++;
  });

  assert(groups.TWK === 120, `TWK questions: 120 (got: ${groups.TWK})`);
  assert(groups.TIU === 150, `TIU questions: 150 (got: ${groups.TIU})`);
  assert(groups.TKP === 180, `TKP questions: 180 (got: ${groups.TKP})`);
  assert(groups.SKB === 160, `SKB questions: 160 (got: ${groups.SKB})`);
  assert(svgCount === 23, `SVG diagram count: 23 (got: ${svgCount})`);
} catch (e) {
  assert(false, 'Failed loading data/questions.js: ' + e.message);
}

// 3. Data Extraction: packages.js
console.log('\n--- 3. Data Extraction: packages.js ---');
const packagesPath = path.join(rootDir, 'data', 'packages.js');
assert(fs.existsSync(packagesPath), 'data/packages.js exists');

try {
  const { PACKAGES } = require(packagesPath);
  assert(Array.isArray(PACKAGES), 'PACKAGES is an array');
  assert(PACKAGES.length === 12, `PACKAGES has exactly 12 items (got: ${PACKAGES.length})`);

  let allFiltersWork = true;
  PACKAGES.forEach((p, idx) => {
    const matchCount = questionsData.filter(p.filter).length;
    if (matchCount === 0) allFiltersWork = false;
  });
  assert(allFiltersWork, 'All 12 package filter functions match questions');
} catch (e) {
  assert(false, 'Failed loading data/packages.js: ' + e.message);
}

// 4. CSS Modularization
console.log('\n--- 4. CSS Modularization ---');
const cssFiles = [
  'tokens.css',
  'base.css',
  'components.css',
  'landing.css',
  'exam.css',
  'result.css'
];

cssFiles.forEach(file => {
  const fullPath = path.join(rootDir, 'css', file);
  assert(fs.existsSync(fullPath), `css/${file} exists`);
  if (fs.existsSync(fullPath)) {
    const css = fs.readFileSync(fullPath, 'utf8');
    assert(css.length > 100, `css/${file} is non-empty (${css.length} bytes)`);
    
    // Check balanced braces
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;
    assert(openBraces === closeBraces, `css/${file} has balanced braces ({: ${openBraces}, }: ${closeBraces})`);
  }
});

// Specific checks in exam.css
const examCssPath = path.join(rootDir, 'css', 'exam.css');
if (fs.existsSync(examCssPath)) {
  const examCss = fs.readFileSync(examCssPath, 'utf8');
  assert(!examCss.includes('minmax(0, 1fr) 310px !important'), 'exam.css: No !important 310px grid lock');
  assert(examCss.includes('@media (max-width: 980px)'), 'exam.css: Has media query for <= 980px');
  assert(examCss.includes('examSidebarCol'), 'exam.css: Styles examSidebarCol responsively');
}

// Specific checks in components.css
const compCssPath = path.join(rootDir, 'css', 'components.css');
if (fs.existsSync(compCssPath)) {
  const compCss = fs.readFileSync(compCssPath, 'utf8');
  assert(compCss.includes('.floating-robot-wrap'), 'components.css: Styles .floating-robot-wrap');
  assert(compCss.includes('@media (max-width: 980px)'), 'components.css: Has responsive adjustments for robot');
}

// 5. index.html Integration & File Size
console.log('\n--- 5. index.html Integration & File Size ---');
const indexHtmlPath = path.join(rootDir, 'index.html');
assert(fs.existsSync(indexHtmlPath), 'index.html exists');

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const indexSize = Buffer.byteLength(indexHtml, 'utf8');
console.log(`index.html actual size: ${indexSize} bytes (${(indexSize / 1024).toFixed(2)} KB)`);

assert(indexSize < 100 * 1024, `index.html size is < 100KB (${(indexSize / 1024).toFixed(2)} KB < 100 KB)`);
assert(indexSize < 100000, `index.html size is < 100,000 bytes (${indexSize} bytes < 100,000 bytes)`);

// Check QRIS image cleanup
assert(!indexHtml.includes('data:image/jpeg;base64'), 'index.html has zero base64 QRIS image URIs');
assert(indexHtml.includes('src="qris.jpg"'), 'index.html references qris.jpg in src');
assert(indexHtml.includes('href="qris.jpg"'), 'index.html references qris.jpg in href');

// Check modular CSS links
cssFiles.forEach(file => {
  assert(indexHtml.includes(`href="css/${file}"`), `index.html links css/${file}`);
});

// Check removed inline style block
assert(!indexHtml.includes('<style>'), 'index.html has no embedded <style> block');

// Check script includes
assert(indexHtml.includes('<script src="data/questions.js"></script>'), 'index.html includes data/questions.js');
assert(indexHtml.includes('<script src="data/packages.js"></script>'), 'index.html includes data/packages.js');

// Check removed inline data arrays
assert(!indexHtml.includes('const ALL_QUESTIONS = ['), 'index.html has no inline ALL_QUESTIONS definition');
assert(!indexHtml.includes('const PACKAGES = ['), 'index.html has no inline PACKAGES definition');

// 6. JS Syntax Check in index.html
console.log('\n--- 6. JS Syntax Check in index.html ---');
const scriptStartTag = '<script>';
const scriptEndTag = '</script>';
const lastScriptStart = indexHtml.lastIndexOf(scriptStartTag);
const lastScriptEnd = indexHtml.lastIndexOf(scriptEndTag);

if (lastScriptStart !== -1 && lastScriptEnd > lastScriptStart) {
  const inlineJs = indexHtml.substring(lastScriptStart + scriptStartTag.length, lastScriptEnd);
  try {
    new vm.Script(inlineJs);
    assert(true, 'Inline JavaScript in index.html is 100% syntactically valid');
  } catch (e) {
    assert(false, 'Inline JavaScript syntax error: ' + e.message);
  }
} else {
  assert(false, 'Could not locate inline application script in index.html');
}

console.log('\n====================================================');
if (failures === 0) {
  console.log('🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY!');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failures} CHECKS FAILED!`);
  console.log('====================================================');
  process.exit(1);
}
