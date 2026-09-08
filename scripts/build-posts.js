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
const SITE_URL = 'https://peritrigkas.netlify.app/';
const OG_FALLBACK_IMAGE = 'img/og-default.png';
const SHARE_SUFFIX = ' — Field notes by Peri Trigkas';

function absoluteUrl(relative) {
  return new URL(relative, SITE_URL).href;
}

// Read intrinsic dimensions + MIME type straight from a PNG or JPEG file so the
// social meta tags advertise the real image size (LinkedIn/Facebook use these).
function readImageInfo(relativePath) {
  const abs = path.join(ROOT, relativePath);
  const b = fs.readFileSync(abs);
  if (b[0] === 0x89 && b[1] === 0x50) {
    return { type: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // JPEG: walk the marker segments to the start-of-frame
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { type: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`Could not read image dimensions from ${relativePath}`);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Brand-tinted share icons — monochrome, coloured via currentColor in CSS.
const SHARE_ICONS = {
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64z"/></svg>',
  email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm10 7.13L3.5 6H20.5L12 11.13zM3 8.24V18h18V8.24l-9 5.4-9-5.4z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.42 5.83c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 10.35c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.24.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.47-.02-.16 0-.43.06-.65.31-.22.24-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.12.16 1.73 2.64 4.19 3.7.59.26 1.04.41 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 1H4a2 2 0 0 0-2 2v13h2V3h11V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h10v14z"/></svg>',
};

function renderMetaTags({ title, description, url, imagePath, type }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const u = escapeAttr(url);
  const img = escapeAttr(absoluteUrl(imagePath));
  const info = readImageInfo(imagePath);
  return `<link rel="canonical" href="${u}">
<meta name="description" content="${d}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Peri Trigkas">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${img}">
<meta property="og:image:secure_url" content="${img}">
<meta property="og:image:type" content="${info.type}">
<meta property="og:image:width" content="${info.width}">
<meta property="og:image:height" content="${info.height}">
<meta property="og:image:alt" content="${t}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${t}">`;
}

function renderShareRow({ url, title }) {
  const u = encodeURIComponent(url);
  const text = `${title}${SHARE_SUFFIX}`;
  const targets = [
    { key: 'linkedin', label: 'Share on LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, blank: true },
    { key: 'x', label: 'Share on X', href: `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(text)}`, blank: true },
    { key: 'email', label: 'Share by email', href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`, blank: false },
    { key: 'whatsapp', label: 'Share on WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, blank: true },
  ];
  const links = targets
    .map((t) => {
      const rel = t.blank ? ' target="_blank" rel="noopener"' : '';
      return `      <a class="share-btn" href="${escapeAttr(t.href)}"${rel} aria-label="${t.label}">${SHARE_ICONS[t.key]}</a>`;
    })
    .join('\n');
  return `<div class="post-share">
      <span class="share-label mono">Share</span>
${links}
      <button type="button" class="share-btn share-copy" data-copy-url="${escapeAttr(url)}" aria-label="Copy link">${SHARE_ICONS.copy}</button>
    </div>`;
}

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

  const postUrl = absoluteUrl(`blog-${post.slug}.html`);
  const metaTags = renderMetaTags({
    title: post.title,
    description: post.excerpt,
    url: postUrl,
    imagePath: post.image || OG_FALLBACK_IMAGE,
    type: 'article',
  });
  const shareRow = renderShareRow({ url: postUrl, title: post.title });

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
${metaTags}
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
    ${shareRow}
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
  const metaTags = renderMetaTags({
    title: 'Field notes — Peri Trigkas',
    description: 'Write-ups on testing, automation, and whatever breaks in interesting ways.',
    url: absoluteUrl('field-notes.html'),
    imagePath: OG_FALLBACK_IMAGE,
    type: 'website',
  });

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
${metaTags}
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
