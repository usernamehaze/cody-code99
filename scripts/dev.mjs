/* npm run dev: Cody on http://localhost:3000, no Vercel account needed.
   Serves the app's files and runs api/ai.js the way Vercel does. Keys come from a .env file
   (GROQ_API_KEY=..., GEMINI_API_KEY=..., ANTHROPIC_API_KEY=...) or the shell. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch (e) { /* no .env: the samples still work */ }
const { default: ai } = await import('../api/ai.js');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'manifest.webmanifest', 'sw.js']);
const PORT = +process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/ai') {
    let body = '';
    for await (const c of req) { body += c; if (body.length > 6e6) break; }
    const shim = Object.assign(res, {
      status(c) { res.statusCode = c; return shim; },
      json(o) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); },
    });
    try { req.body = body ? JSON.parse(body) : {}; } catch (e) { return shim.status(400).json({ ok: false, error: 'bad JSON' }); }
    return ai(req, shim);
  }
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  const ok = file.startsWith(root + path.sep) && (PUBLIC.has(rel) || /^(js|css|icons)\//.test(rel));
  if (!ok || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Cody is running at http://localhost:${PORT}`));
