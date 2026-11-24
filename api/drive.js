/* POST /api/drive { link } -> { ok, name, type, data }   (data: the file, base64)
   Gets a file a student shared from Google Drive (also Google Docs, Slides and Sheets), Dropbox or OneDrive,
   so Cody can make a reviewer from it. The browser can't download these itself (the sites block it), so the
   server does. Only those sites are fetched, and every redirect is checked too, so the link can't be used to
   reach anything else. The file must be shared as "Anyone with the link". */
import { cors } from '../lib/cors.js';
import { limited } from '../lib/limit.js';

const MAX = 3 * 1024 * 1024; // the reply has to fit Vercel's 4.5 MB limit once it is base64
const HOSTS = ['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com', 'googleusercontent.com',
  'dropbox.com', 'dropboxusercontent.com', '1drv.ms', 'onedrive.live.com', 'api.onedrive.com', '1drv.com', 'sharepoint.com'];
const allowed = (host) => HOSTS.some((h) => host === h || host.endsWith('.' + h));
const SIGN_IN = /(^|\.)(accounts\.google\.com|login\.live\.com|login\.microsoftonline\.com)$/;
const fail = (status, error) => Object.assign(new Error(error), { status });
const PRIVATE = 'This file is private. In your drive, set sharing to "Anyone with the link", then paste the link again.';

// a share link -> where the file itself can be downloaded
export function fileUrl(link) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch (e) { throw fail(400, 'That doesn’t look like a link. Copy the share link from your drive and paste it here.'); }
  if (u.protocol !== 'https:' || !allowed(u.hostname)) throw fail(400, 'Cody can open links from Google Drive, Google Docs, Dropbox and OneDrive.');
  const h = u.hostname, id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get('id');
  if (h === 'docs.google.com' && id) {
    if (u.pathname.startsWith('/document/')) return { url: `https://docs.google.com/document/d/${id}/export?format=txt`, type: 'text/plain' };
    if (u.pathname.startsWith('/presentation/')) return { url: `https://docs.google.com/presentation/d/${id}/export/txt`, type: 'text/plain' };
    if (u.pathname.startsWith('/spreadsheets/')) return { url: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, type: 'text/plain' };
  }
  if ((h === 'drive.google.com' || h === 'docs.google.com') && id) return { url: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t` };
  if (h === 'drive.google.com') throw fail(400, 'That’s a Drive folder. Open the file itself, tap Share, and copy its link.');
  if (h.endsWith('dropbox.com')) { u.searchParams.delete('dl'); u.searchParams.set('dl', '1'); return { url: u.href }; }
  if (h === '1drv.ms' || h === 'onedrive.live.com') {
    // OneDrive's own way to open a share link: /shares/u!{the link in base64url}
    return { url: `https://api.onedrive.com/v1.0/shares/u!${Buffer.from(u.href).toString('base64url')}/root/content` };
  }
  return { url: u.href };
}

const nameFrom = (r, fallback) => {
  const cd = r.headers.get('content-disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
  try { if (m) return decodeURIComponent(m[1]).slice(0, 120); } catch (e) { if (m) return m[1].slice(0, 120); }
  return fallback;
};
const kind = (type, name) => {
  if (/pdf/.test(type) || /\.pdf$/i.test(name)) return 'application/pdf';
  if (/^image\//.test(type)) return type;
  if (/\.(png|jpe?g|webp|gif|heic)$/i.test(name)) return 'image/' + name.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  if (/^text\/(plain|markdown|csv)/.test(type) || /\.(txt|md|csv)$/i.test(name)) return 'text/plain';
  return '';
};

export async function getFile(link, fetchFn = fetch) {
  const want = fileUrl(link);
  let url = want.url, r;
  for (let hop = 0; ; hop++) {
    if (hop > 6) throw fail(502, 'That link kept sending Cody somewhere else. Try copying the share link again.');
    r = await fetchFn(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Cody/1.0' } });
    if (r.status < 300 || r.status >= 400) break;
    const next = new URL(r.headers.get('location') || '', url);
    if (SIGN_IN.test(next.hostname)) throw fail(403, PRIVATE);
    if (next.protocol !== 'https:' || !allowed(next.hostname)) throw fail(400, 'That link leads somewhere Cody can’t open.');
    url = next.href;
  }
  if (r.status === 401 || r.status === 403) throw fail(403, PRIVATE);
  if (r.status === 404) throw fail(404, 'Cody couldn’t find that file. Check the link, or share it again.');
  if (!r.ok) throw fail(502, 'The drive didn’t send the file. Try again in a minute.');
  const len = +r.headers.get('content-length') || 0;
  if (len > MAX) throw fail(413, 'That file is bigger than 3 MB. Download it and upload it from your phone or computer instead.');
  const type = (r.headers.get('content-type') || '').toLowerCase();
  const name = nameFrom(r, want.type ? 'Notes from Google' : 'Notes from your drive');
  // a web page instead of a file: almost always a sign-in page or a "can't preview" page
  if (/text\/html/.test(type)) throw fail(403, PRIVATE);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX) throw fail(413, 'That file is bigger than 3 MB. Download it and upload it from your phone or computer instead.');
  const t = want.type || kind(type, name);
  if (!t) throw fail(415, 'Cody reads PDFs, photos, text files and Google Docs, Slides and Sheets. For a Word file, open it in Google Docs first.');
  return { name: t === 'text/plain' && !/\.\w+$/.test(name) ? name + '.txt' : name, type: t, data: buf.toString('base64') };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (limited(req, 'drive', 40)) return res.status(429).json({ ok: false, error: 'That’s a lot of files for now. Try again in an hour.' });
  try { return res.status(200).json({ ok: true, ...(await getFile((req.body || {}).link)) }); }
  catch (e) { return res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Cody couldn’t get that file. Try again.' }); }
}
