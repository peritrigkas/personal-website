/*
 * Reads Markdown posts from /posts, writes a standalone HTML page for each
 * into the repo root (blog-<slug>.html), injects cards for the 3 most
 * recent posts into index.html between the BLOG_CARDS markers, and writes
 * an archive page (field-notes.html) listing every post.
 *
 * Usage: npm run build-posts
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const INDEX_HTML = path.join(ROOT, 'index.html');
const ARCHIVE_HTML = path.join(ROOT, 'field-notes.html');
const CARD_COUNT = 3;

function parsePost(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath}: missing frontmatter (expected --- ... --- block at the top)`);
  }
  const [, frontmatterBlock, body] = match;

  const frontmatter = {};
  for (const line of frontmatterBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    frontmatter[key] = value;
  }

  const required = ['title', 'excerpt', 'date'];
  for (const key of required) {
    if (!frontmatter[key]) throw new Error(`${filePath}: frontmatter is missing "${key}"`);
  }

  const slug = path.basename(filePath, '.md');
  return {
    slug,
    title: frontmatter.title,
    excerpt: frontmatter.excerpt,
    date: frontmatter.date,
    image: frontmatter.image || '',
    bodyHtml: marked.parse(body.trim()),
  };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderPostPage(post) {
  const coverHtml = post.image
    ? `<div class="post-cover"><img src="${post.image}" alt="${post.title}" loading="lazy"></div>`
    : `<div class="post-cover is-placeholder">[ Add cover image ]</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${post.title} — Peri Trigkas</title>
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="apple-touch-icon" href="icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
</head>
<body>

<nav>
  <div class="wrap">
    <a href="index.html#top" class="brand"><span class="dot"></span> Peri Trigkas</a>
    <ul class="navlinks" id="navlinks">
      <li><a href="index.html#journey">Journey</a></li>
      <li><a href="index.html#skills">Skills</a></li>
      <li><a href="index.html#experience">Experience</a></li>
      <li><a href="index.html#blog">Field notes</a></li>
      <li><a href="index.html#books">Books</a></li>
      <li><a href="index.html#hobbies">Beyond Work</a></li>
      <li><a href="index.html#contact">Contact</a></li>
    </ul>
    <button class="burger" id="burgerBtn" aria-label="Open menu" aria-expanded="false" aria-controls="navlinks">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<article class="post-hero">
  <div class="wrap">
    <a class="back-link mono" href="index.html#blog">&larr; Back to Field notes</a>
    <h1>${post.title}</h1>
    <span class="post-date mono">${formatDate(post.date)}</span>
    ${coverHtml}
  </div>
</article>

<div class="wrap">
  <div class="post-body">
${post.bodyHtml}
  </div>
</div>

<footer id="contact">
  <div class="wrap">
    <span class="eyebrow mono">// let's talk</span>
    <h2>Get in touch</h2>
    <p>Based in Cardiff, open to remote roles, always happy to talk quality, automation or growth mindset.</p>
    <div class="contact-links">
      <a href="mailto:ptrigkas@gmail.com">✉ ptrigkas@gmail.com</a>
      <a href="tel:07827421616">☎ 07827 421616</a>
      <a href="index.html#top">📍 Cardiff, Wales</a>
    </div>
    <div class="foot-note mono">Wired for growth — one small check at a time.</div>
  </div>
</footer>

<script src="js/app.js" defer></script>

</body>
</html>
`;
}

function renderCard(post) {
  const thumbHtml = post.image
    ? `<div class="blog-thumb"><img src="${post.image}" alt="${post.title}" loading="lazy"></div>`
    : `<div class="blog-thumb is-placeholder">[ Add cover image ]</div>`;

  return `      <a class="blog-card" href="blog-${post.slug}.html">
        ${thumbHtml}
        <div class="blog-body">
          <span class="blog-title">${post.title}</span>
          <span class="blog-date mono">${formatDate(post.date)}</span>
          <p>${post.excerpt}</p>
        </div>
      </a>`;
}

function renderArchivePage(posts) {
  const cardsHtml = posts.map(renderCard).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Field notes — Peri Trigkas</title>
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="icon.svg">
<link rel="apple-touch-icon" href="icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
</head>
<body>

<nav>
  <div class="wrap">
    <a href="index.html#top" class="brand"><span class="dot"></span> Peri Trigkas</a>
    <ul class="navlinks" id="navlinks">
      <li><a href="index.html#journey">Journey</a></li>
      <li><a href="index.html#skills">Skills</a></li>
      <li><a href="index.html#experience">Experience</a></li>
      <li><a href="index.html#blog">Field notes</a></li>
      <li><a href="index.html#books">Books</a></li>
      <li><a href="index.html#hobbies">Beyond Work</a></li>
      <li><a href="index.html#contact">Contact</a></li>
    </ul>
    <button class="burger" id="burgerBtn" aria-label="Open menu" aria-expanded="false" aria-controls="navlinks">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<header class="post-hero">
  <div class="wrap">
    <a class="back-link mono" href="index.html#blog">&larr; Back to home</a>
    <h1>Field notes</h1>
    <span class="post-date mono">${posts.length} post${posts.length === 1 ? '' : 's'}, newest first</span>
  </div>
</header>

<div class="wrap">
  <div class="blog-grid archive-grid">
${cardsHtml}
  </div>
</div>

<footer id="contact">
  <div class="wrap">
    <span class="eyebrow mono">// let's talk</span>
    <h2>Get in touch</h2>
    <p>Based in Cardiff, open to remote roles, always happy to talk quality, automation or growth mindset.</p>
    <div class="contact-links">
      <a href="mailto:ptrigkas@gmail.com">✉ ptrigkas@gmail.com</a>
      <a href="tel:07827421616">☎ 07827 421616</a>
      <a href="index.html#top">📍 Cardiff, Wales</a>
    </div>
    <div class="foot-note mono">Wired for growth — one small check at a time.</div>
  </div>
</footer>

<script src="js/app.js" defer></script>

</body>
</html>
`;
}

function updateIndexCards(cardsHtml) {
  const indexSrc = fs.readFileSync(INDEX_HTML, 'utf-8');
  const startMarker = '<!-- BLOG_CARDS:START -->';
  const endMarker = '<!-- BLOG_CARDS:END -->';
  const startIdx = indexSrc.indexOf(startMarker);
  const endIdx = indexSrc.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`index.html is missing the ${startMarker} / ${endMarker} markers`);
  }
  const before = indexSrc.slice(0, startIdx + startMarker.length);
  const after = indexSrc.slice(endIdx);
  const updated = `${before}\n${cardsHtml}\n      ${after}`;
  fs.writeFileSync(INDEX_HTML, updated, 'utf-8');
}

function run() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No posts found in /posts.');
    return;
  }

  const posts = files.map((f) => parsePost(path.join(POSTS_DIR, f)));
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const post of posts) {
    const outPath = path.join(ROOT, `blog-${post.slug}.html`);
    fs.writeFileSync(outPath, renderPostPage(post), 'utf-8');
    console.log(`wrote blog-${post.slug}.html`);
  }

  const latest = posts.slice(0, CARD_COUNT);
  const cardsHtml = latest.map(renderCard).join('\n');
  updateIndexCards(cardsHtml);
  console.log(`updated index.html with ${latest.length} card(s)`);

  fs.writeFileSync(ARCHIVE_HTML, renderArchivePage(posts), 'utf-8');
  console.log(`wrote field-notes.html with all ${posts.length} post(s)`);
}

run();
