#!/usr/bin/env node
/**
 * Dependency-free static server for the exported web build.
 *
 * `npx expo export --platform web` writes a static site to `web-build/`; this serves
 * it with the two behaviours a single-page app needs:
 *   1. `/later` resolves to `later.html` (expo-router's static output).
 *   2. Unknown paths fall back to `index.html` so client-side routing works,
 *      which is what `/task/<id>` needs since dynamic routes render on the client.
 *
 * Usage: node scripts/serve-web.js [port]
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HOST = '0.0.0.0'; // required so the sandbox preview proxy can reach it
const ROOT = path.join(__dirname, '..', 'web-build');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function resolveFile(urlPath) {
  // Never allow a resolved path to escape dist/.
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [
    path.join(ROOT, safe),
    path.join(ROOT, `${safe}.html`),
    path.join(ROOT, safe, 'index.html'),
  ];
  for (const candidate of candidates) {
    if (!candidate.startsWith(ROOT)) continue;
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return path.join(ROOT, 'index.html');
}

if (!fs.existsSync(ROOT)) {
  console.error(`No build found at ${ROOT}. Run: npm run build:web`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    const file = resolveFile(urlPath);
    const ext = path.extname(file).toLowerCase();

    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // The preview iframe must be able to embed this page.
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`Blink web preview running at http://${HOST}:${PORT}`);
  });
