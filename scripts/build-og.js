/*
 * Regenerates the default social-share card (img/og-default.png).
 *
 * The word cloud is built dynamically from the most frequent meaningful words
 * across index.html and every post in /posts, so the card reflects whatever the
 * site is actually about at build time.
 *
 * Rasterising needs headless Chrome. The script looks for it in the usual
 * places and honours the CHROME_PATH env var. If none is found it still writes
 * the intermediate HTML (scripts/.og-card.html) and prints how to finish.
 *
 * Usage: npm run build-og
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_PNG = path.join(ROOT, 'img', 'og-default.png');
const TMP_HTML = path.join(__dirname, '.og-card.html');
const WORD_COUNT = 18;
const SITE_HOST = 'peritrigkas.netlify.app';
const HEADLINE = 'Peri Trigkas — Wired for growth.';
const BUTTON_TEXT = 'Explore the site';

// Words that are common but say nothing about the subject.
const STOP_WORDS = new Set(
  (
    'the a an and or but if then else of to in on at for with by from as is are was ' +
    'were be been being it its this that these those i you he she they we my your his ' +
    'her their our me him us them so not no yes do does did done have has had having ' +
    'will would can could should may might must shall about into over under out up ' +
    'down off than too very just also more most some any all each every other another ' +
    'such own same few new like via still per across around back onto what which who ' +
    'whom whose when where why how there here one two three actually genuinely really ' +
    'something anything thing things rather instead before after while because during ' +
    'through against between within without been being able well much many lot lots ' +
    'kind sort stuff bit way ways going gets getting goes went come came make makes ' +
    'made take takes took need needs first second next last time times year years ' +
    'work works working worth good great better best usually often sometimes always ' +
    'never once nine says said tell told wrote written read seen saw look looks looking ' +
    'real actual thats theres youre dont wont cant havent isnt everything nothing ' +
    'someone anyone everyone somewhere anywhere everywhere point points part parts'
  ).split(/\s+/)
);

function collectText() {
  let text = '';
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  text += ' ' + idx
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  for (const file of fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
    text += ' ' + fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8').replace(/^---[\s\S]*?---/, ' ');
  }
  return text;
}

function topWords(text, limit) {
  const counts = new Map();
  const normalised = text.toLowerCase().replace(/ci\/cd/g, 'cicd').replace(/[^a-z\s-]/g, ' ');
  for (let word of normalised.split(/\s+/)) {
    word = word.replace(/^-+|-+$/g, '');
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  // Fold simple plurals into their singular ("tests" -> "test").
  for (const word of [...counts.keys()]) {
    if (word.endsWith('s') && counts.has(word.slice(0, -1))) {
      counts.set(word.slice(0, -1), counts.get(word.slice(0, -1)) + counts.get(word));
      counts.delete(word);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => (word === 'cicd' ? 'CI/CD' : word));
}

// Interleave sizes so big words are spread through the cloud rather than clumped.
function tierFor(index) {
  const pattern = [1, 3, 4, 2, 3, 4, 1, 4, 3, 2, 4, 3, 2, 4, 3, 4, 4, 3];
  return pattern[index % pattern.length];
}

function renderCardHtml(words) {
  const spans = words
    .map((w, i) => `<span class="w${tierFor(i)}">${w}</span>`)
    .join('\n      ');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box;}
  html,body{width:1200px;height:630px;overflow:hidden;}
  body{background:#eef1f5;font-family:'Space Grotesk','Segoe UI',sans-serif;position:relative;}
  body::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 30% 45%, #ffffff 0, rgba(255,255,255,0) 55%);}
  .card{
    position:absolute;left:-26px;top:50%;transform:translateY(-50%) rotate(-8deg);
    width:566px;height:452px;border-radius:22px;
    background:#0B1F3A;border:1px solid rgba(255,255,255,0.6);
    box-shadow:0 40px 80px -20px rgba(11,31,58,0.45), 0 0 0 1px rgba(11,31,58,0.06);
    padding:38px 40px 38px 78px;overflow:hidden;
  }
  .card::before{content:"";position:absolute;inset:0;
    background-image:
      radial-gradient(circle at 24% 16%, rgba(95,168,255,0.18) 0, transparent 46%),
      repeating-linear-gradient(0deg, rgba(95,168,255,0.07) 0 1px, transparent 1px 40px),
      repeating-linear-gradient(90deg, rgba(95,168,255,0.07) 0 1px, transparent 1px 40px);}
  .cloud{position:relative;display:flex;flex-wrap:wrap;align-content:center;align-items:baseline;gap:6px 15px;height:100%;}
  .cloud span{line-height:1;white-space:nowrap;}
  .w1{font-size:52px;font-weight:700;color:#EAF2FF;}
  .w2{font-size:38px;font-weight:600;color:#8FC4FF;}
  .w3{font-size:29px;font-weight:600;color:#BFE3FF;}
  .w4{font-size:21px;font-family:'IBM Plex Mono',monospace;color:#7FA0C9;}
  .right{position:absolute;right:70px;top:50%;transform:translateY(-50%);width:520px;}
  .pill{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:20px;color:#4a5b74;
    background:#e2e6ec;border:1px solid #d3d9e2;border-radius:999px;padding:8px 18px;margin-bottom:26px;}
  h1{font-size:60px;font-weight:700;letter-spacing:-0.02em;line-height:1.05;color:#0B1F3A;margin-bottom:30px;}
  .btn{display:inline-block;background:#0B1F3A;color:#EAF2FF;font-size:22px;font-weight:600;border-radius:999px;padding:16px 34px;}
</style></head><body>
  <div class="card"><div class="cloud">
      ${spans}
  </div></div>
  <div class="right">
    <span class="pill">${SITE_HOST}</span>
    <h1>${HEADLINE}</h1>
    <span class="btn">${BUTTON_TEXT}</span>
  </div>
</body></html>
`;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function run() {
  const words = topWords(collectText(), WORD_COUNT);
  fs.writeFileSync(TMP_HTML, renderCardHtml(words), 'utf-8');
  console.log(`word cloud: ${words.join(', ')}`);

  const chrome = findChrome();
  if (!chrome) {
    console.log(`\nNo Chrome/Edge found. Wrote ${path.relative(ROOT, TMP_HTML)}.`);
    console.log('Set CHROME_PATH or render it manually:');
    console.log(`  chrome --headless --screenshot="${OUT_PNG}" --window-size=1200,630 "${TMP_HTML}"`);
    return;
  }

  execFileSync(chrome, [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    `--screenshot=${OUT_PNG}`,
    TMP_HTML,
  ], { stdio: 'ignore' });
  fs.unlinkSync(TMP_HTML);
  console.log(`wrote ${path.relative(ROOT, OUT_PNG)}`);
}

run();
