'use strict';

// Integration tests for the go-links HTTP API.
// Uses the built-in node:test runner and node:http only (no external deps).

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Point the server at a throwaway data file BEFORE importing it, so tests
// never touch the real links.json.
const TMP_FILE = path.join(os.tmpdir(), `go-links-test-${process.pid}.json`);
process.env.LINKS_FILE = TMP_FILE;

const app = require('../server');

let server;
let baseUrl;

before(async () => {
  // Listen on an ephemeral port.
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
  fs.rmSync(TMP_FILE, { force: true });
});

beforeEach(() => {
  // Reset to an empty store before each test.
  fs.writeFileSync(TMP_FILE, '{}', 'utf8');
});

// Minimal fetch-like helper over node:http. Returns { status, json, location }.
function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      `${baseUrl}${urlPath}`,
      {
        method,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }
          resolve({ status: res.statusCode, json, location: res.headers.location, raw });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('POST creates a link and returns 201', async () => {
  const res = await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.json, { slug: 'wiki', url: 'https://wiki.example.com' });
});

test('GET /api/links lists created links', async () => {
  await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  const res = await request('GET', '/api/links');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { wiki: 'https://wiki.example.com' });
});

test('POST with duplicate slug returns 409', async () => {
  await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  const res = await request('POST', '/api/links', { slug: 'wiki', url: 'https://other.example.com' });
  assert.equal(res.status, 409);
});

test('POST with invalid slug returns 400', async () => {
  const res = await request('POST', '/api/links', { slug: 'bad slug!', url: 'https://x.example.com' });
  assert.equal(res.status, 400);
});

test('POST with invalid url returns 400', async () => {
  const res = await request('POST', '/api/links', { slug: 'ok', url: 'not-a-url' });
  assert.equal(res.status, 400);
});

test('GET /:slug redirects with 302 to the target URL', async () => {
  await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  const res = await request('GET', '/wiki');
  assert.equal(res.status, 302);
  assert.equal(res.location, 'https://wiki.example.com');
});

test('GET /:slug for unknown slug returns 404', async () => {
  const res = await request('GET', '/nope');
  assert.equal(res.status, 404);
});

test('nested slug (foo/bar) redirects correctly', async () => {
  await request('POST', '/api/links', { slug: 'hr/vacation', url: 'https://hr.example.com/vacation' });
  const res = await request('GET', '/hr/vacation');
  assert.equal(res.status, 302);
  assert.equal(res.location, 'https://hr.example.com/vacation');
});

test('PUT updates an existing link', async () => {
  await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  const res = await request('PUT', '/api/links/wiki', { url: 'https://new.example.com' });
  assert.equal(res.status, 200);

  const redirect = await request('GET', '/wiki');
  assert.equal(redirect.location, 'https://new.example.com');
});

test('PUT on missing slug returns 404', async () => {
  const res = await request('PUT', '/api/links/ghost', { url: 'https://x.example.com' });
  assert.equal(res.status, 404);
});

test('PUT with invalid url returns 400', async () => {
  await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  const res = await request('PUT', '/api/links/wiki', { url: 'nope' });
  assert.equal(res.status, 400);
});

test('DELETE removes a link and returns 204', async () => {
  await request('POST', '/api/links', { slug: 'wiki', url: 'https://wiki.example.com' });
  const del = await request('DELETE', '/api/links/wiki');
  assert.equal(del.status, 204);

  const res = await request('GET', '/wiki');
  assert.equal(res.status, 404);
});

test('DELETE on missing slug returns 404', async () => {
  const res = await request('DELETE', '/api/links/ghost');
  assert.equal(res.status, 404);
});

test('GET / serves the web UI', async () => {
  const res = await request('GET', '/');
  assert.equal(res.status, 200);
  assert.match(res.raw, /go-links/);
});
