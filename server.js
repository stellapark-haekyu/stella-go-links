'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
// Data file location; overridable via LINKS_FILE (used by tests).
const DATA_FILE = process.env.LINKS_FILE || path.join(__dirname, 'links.json');

// ---------------------------------------------------------------------------
// Data store (links.json)
// ---------------------------------------------------------------------------

// Create links.json as an empty object if it does not exist yet.
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readLinks() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    // Fall back to an empty object if the file is not a plain object.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.error('Failed to read links.json:', err.message);
    return {};
  }
}

function writeLinks(links) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(links, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

// slug: allow letters, digits, hyphen, underscore and slash (supports nested slugs).
const SLUG_RE = /^[a-zA-Z0-9_\-/]+$/;

function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length > 0 && slug.length <= 200 && SLUG_RE.test(slug);
}

function isValidUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// Static web UI assets.
app.use('/static', express.static(path.join(__dirname, 'public')));

// --- API: list all links ---------------------------------------------------
app.get('/api/links', (req, res) => {
  res.json(readLinks());
});

// --- API: create a link ----------------------------------------------------
app.post('/api/links', (req, res) => {
  const { slug, url } = req.body || {};

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid slug. Allowed characters: letters, digits, - _ /' });
  }
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'url must be a valid http(s) address.' });
  }

  const links = readLinks();
  if (Object.prototype.hasOwnProperty.call(links, slug)) {
    return res.status(409).json({ error: `slug '${slug}' already exists.` });
  }

  links[slug] = url;
  writeLinks(links);
  res.status(201).json({ slug, url });
});

// --- API: update a link ----------------------------------------------------
app.put('/api/links/:slug', (req, res) => {
  const { slug } = req.params;
  const { url } = req.body || {};

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'url must be a valid http(s) address.' });
  }

  const links = readLinks();
  if (!Object.prototype.hasOwnProperty.call(links, slug)) {
    return res.status(404).json({ error: `slug '${slug}' not found.` });
  }

  links[slug] = url;
  writeLinks(links);
  res.json({ slug, url });
});

// --- API: delete a link ----------------------------------------------------
app.delete('/api/links/:slug', (req, res) => {
  const { slug } = req.params;

  const links = readLinks();
  if (!Object.prototype.hasOwnProperty.call(links, slug)) {
    return res.status(404).json({ error: `slug '${slug}' not found.` });
  }

  delete links[slug];
  writeLinks(links);
  res.status(204).end();
});

// --- Web UI ----------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Redirect: GET /:slug --------------------------------------------------
// Use a wildcard so nested slugs like 'foo/bar' are handled too.
app.get('/*', (req, res) => {
  const slug = decodeURIComponent(req.path.replace(/^\//, ''));
  if (!slug) return res.redirect(302, '/');

  const links = readLinks();
  const target = links[slug];
  if (!target) {
    return res.status(404).send(
      `<!doctype html><meta charset="utf-8">` +
      `<body style="font-family:system-ui;padding:2rem">` +
      `<h1>404</h1><p>Link <code>${escapeHtml(slug)}</code> not found.</p>` +
      `<p><a href="/">Go to link manager</a></p>`
    );
  }
  res.redirect(302, target);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Start the server only when run directly, so tests can import `app`.
if (require.main === module) {
  ensureDataFile();
  app.listen(PORT, () => {
    console.log(`go-links server running: http://localhost:${PORT}`);
  });
}

module.exports = app;
