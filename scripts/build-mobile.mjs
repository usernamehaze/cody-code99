/* npm run build:mobile: copies the web app into www/ for the Android app (Capacitor), and points it at
   the deployed server for AI and class boards. Set CODY_URL to use another address:
     CODY_URL=https://my-cody-code99.vercel.app npm run build:mobile
   The service worker is left out: inside the app every file is already on the phone. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
const server = (process.env.CODY_URL || 'https://cody-code99.vercel.app').replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+$/.test(server)) throw new Error('CODY_URL must look like https://cody-code99.vercel.app');

fs.rmSync(www, { recursive: true, force: true });
for (const d of ['js', 'css', 'icons']) fs.cpSync(path.join(root, d), path.join(www, d), { recursive: true });
for (const f of ['manifest.webmanifest', 'privacy.html', 'terms.html']) fs.copyFileSync(path.join(root, f), path.join(www, f));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<script type="module" src="/js/app.js">', `<script>window.CODY_API = ${JSON.stringify(server)}; window.CODY_NATIVE = true;</script>\n  <script type="module" src="/js/app.js">`);
fs.writeFileSync(path.join(www, 'index.html'), html);
console.log(`www/ is ready (server: ${server})`);
