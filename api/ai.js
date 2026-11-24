/* POST /api/ai  { task: 'reviewer' | 'draw' | 'explain', ...input }  ->  { ok, data, by }
   One small Vercel function holds the API keys (as Vercel environment variables, never in the app):
     GROQ_API_KEY       Groq, the main brain for text (free tier, fast)
     GEMINI_API_KEY     Google Gemini: reads PDFs and photos, and backs up Groq
     ANTHROPIC_API_KEY  Claude: optional, the last backup (and the best at drawings)
   Text tasks try Groq, then Gemini, then Claude; study guides try Gemini first. Tasks with a file (a PDF or a photo)
   try Gemini, then Claude.
   (The same order Cassie's server uses.) Optional: GROQ_MODEL, GEMINI_MODEL, CLAUDE_MODEL (tried first). */
import Anthropic from '@anthropic-ai/sdk';
import { limited } from '../lib/limit.js';
import { kv, kvMode } from '../lib/kv.js';
import { cors } from '../lib/cors.js';
import { SYSTEM, plain, reviewerPrompt, checkReviewer, drawPrompt, drawMode, checkDrawing, explainPrompt, checkExplain, chatPrompt, checkChat, guidePrompt, checkGuide } from '../lib/tasks.js';

const env = (k) => (process.env[k] || '').trim();
// Providers retire model names over time, so each has a list, best first (the same lists Cassie uses).
// A name the provider says is gone is skipped from then on; a busy or slow one passes to the next.
const GROQ_MODELS = () => [env('GROQ_MODEL'), 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'].filter(Boolean);
const GEMINI_MODELS = () => [env('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter(Boolean);
const gone = new Set();
const isGone = (status, msg) => status === 404 || /decommission|does not exist|not found|no longer|deprecated|not supported/i.test(msg);
async function eachModel(names, run) {
  const reasons = [];
  for (const m of [...new Set(names)].filter((x) => !gone.has(x))) {
    try { return await run(m); }
    catch (e) { if (e.gone) gone.add(m); reasons.push(`${m}: ${e.message}`); }
  }
  throw new Error(reasons.join(' | ') || 'no model left');
}
const fail = async (name, r) => { const msg = await why(r); return Object.assign(new Error(`${name} ${r.status} ${msg}`), { gone: isGone(r.status, msg) }); };
const CLAUDE_MODEL = () => env('CLAUDE_MODEL') || 'claude-opus-5-5';
// a provider's own short reason ("model not found", "quota exceeded"), never the key
const why = async (r) => { try { const j = await r.json(); const e = j.error || j; return String(e.message || e.status || '').slice(0, 160); } catch (e) { return ''; } };
// the language Cody writes in (chosen in Me); English unless one of these is picked
const LANGS = { en: 'English', fil: 'Filipino', taglish: 'Taglish (English and Filipino mixed the way Filipino students talk)', hil: 'Hiligaynon (Ilonggo)', ceb: 'Cebuano (Bisaya)', ilo: 'Ilocano', bik: 'Bikol', war: 'Waray', pam: 'Kapampangan', pag: 'Pangasinan', es: 'Spanish', zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean' };
function langRule(code) {
  const name = LANGS[code];
  if (!name || code === 'en') return '';
  return `\n\nLANGUAGE: write every word meant for the student (all text values in the JSON) in ${name}. Keep scientific, technical and proper names the way they are usually taught (often in English). Keep the JSON keys in English.`;
}
const MAX_FILE = 3.5 * 1024 * 1024; // Vercel takes request bodies up to 4.5 MB

function parseJSON(text) {
  const s = String(text || ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON in the answer');
  return JSON.parse(s.slice(a, b + 1));
}

const groq = (prompt, file, opts = {}) => eachModel(GROQ_MODELS(), async (model) => {
  const body = { model, temperature: 0.4, max_tokens: 12000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM() }, { role: 'user', content: prompt }] };
  if (/gpt-oss/.test(model)) body.reasoning_effort = opts.effort || 'low'; // (quick answers; a study guide thinks harder)
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(Math.min(30000, opts.ms || 30000)),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env('GROQ_API_KEY')}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw await fail('Groq', r);
  const j = await r.json();
  return parseJSON(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
});

const gemini = (prompt, file, opts = {}) => eachModel(GEMINI_MODELS(), (model) => geminiOnce(model, prompt, file, opts.ms));
async function geminiOnce(model, prompt, file, ms) {
  const parts = [];
  if (file) file.forEach((f) => parts.push({ inline_data: { mime_type: f.type, data: f.data } }));
  parts.push({ text: prompt });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(Math.min(file ? 45000 : 30000, ms || 45000)),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM() }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
  });
  if (!r.ok) throw await fail('Gemini', r);
  const j = await r.json();
  const text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
  return parseJSON(text);
}

let claudeClient = null;
async function claude(prompt, file, opts = {}) {
  claudeClient = claudeClient || new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 55000, maxRetries: 1 });
  const content = [];
  (file || []).forEach((f) => content.push(f.type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
    : { type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } }));
  content.push({ type: 'text', text: prompt });
  // fallbacks: 'default' lets the API rerun a declined request on a fallback model inside the same call
  const msg = await claudeClient.beta.messages.create({
    model: CLAUDE_MODEL(), max_tokens: 16000, system: SYSTEM(),
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    messages: [{ role: 'user', content }],
  }, opts.ms ? { timeout: Math.min(55000, opts.ms), maxRetries: 0 } : undefined);
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined');
  return parseJSON(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

const PROVIDERS = { groq: { key: 'GROQ_API_KEY', run: groq, files: false }, gemini: { key: 'GEMINI_API_KEY', run: gemini, files: true }, claude: { key: 'ANTHROPIC_API_KEY', run: claude, files: true } };
const ORDER = ['groq', 'gemini', 'claude'];

// a provider whose account is out of credit or quota, or whose key is refused, rests for 10 minutes, so each
// request does not wait for the same refusal again
const resting = {};
const RESTING = /credit balance|billing|quota|exceeded your|insufficient|invalid.{0,10}(api.)?key|unauthori[sz]ed|\b40[13]\b/i;

// ask each brain in turn; check() turns its JSON into clean data or says what to fix (one retry with the reason).
// opts.end: the time (ms) the answer must be back by (the server stops at 120 seconds); each try gets the time
// left, and none starts with less than 15 seconds to go
async function ask(prompt, check, file, opts = {}) {
  const tried = [];
  const left = () => (opts.end ? opts.end - Date.now() : 0);
  const late = () => opts.end && left() < 15000;
  for (const name of opts.order || ORDER) {
    const p = PROVIDERS[name];
    if (!env(p.key) || (file && !p.files)) continue;
    if (resting[name] > Date.now()) { tried.push(`${name}: resting`); continue; }
    let q = prompt + (opts.lang || '');
    for (let attempt = 0; attempt < 2; attempt++) {
      if (late()) { tried.push(`${name}: out of time`); break; }
      try {
        const out = check(await p.run(q, file, { ...opts, ms: left() || undefined }), attempt);
        if (out && out.ok !== false) return { data: plain(out.spec || out), by: name, skipped: tried };
        tried.push(`${name}: answer not usable${out && out.why ? ` (${out.why})` : ''}`);
        q = `${prompt}${opts.lang || ''}\n\nYour last answer could not be used${out && out.why ? `: ${out.why}` : ''}. Try again, following the shape exactly.`;
      } catch (e) {
        if (RESTING.test(e.message)) resting[name] = Date.now() + 10 * 60000;
        tried.push(`${name}: ${e.message}`); break;
      }
    }
  }
  const err = new Error(tried.length ? 'All AI providers failed' : 'No AI key is set on the server');
  err.detail = tried; err.status = tried.length ? 502 : 503;
  throw err;
}

// ---- drawings kept on the server (in the same store as study rooms), for 180 days ----
// the key is the question with the small words taken out, so "Draw the water cycle!" and "water cycle" match
const FILLER = /\b(a|an|the|of|please|pls|draw|show|me|us|can|you|could|make|explain|picture|diagram|in\s*3d|3d|model)\b/g;
export const drawKey = (question, mode, lang) => {
  const words = String(question || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return words ? `draw:v1:${mode}:${lang || 'en'}:${words}` : null;
};
const storeOn = () => kvMode() !== 'off';
async function keptDrawing(key) {
  if (!key || !storeOn()) return null;
  try { const v = await kv('GET', key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
async function keepDrawing(key, data) {
  if (!key || !storeOn() || !data) return;
  try { await kv('SET', key, JSON.stringify(data), 'EX', 180 * 24 * 3600); } catch (e) { /* (a drawing that is not kept is only slower next time) */ }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === 'GET') return res.status(200).json({ ok: true, providers: ORDER.filter((n) => env(PROVIDERS[n].key)) });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  // (300 an hour: a whole class can share one school address)
  if (limited(req, 'ai', 300)) return res.status(429).json({ ok: false, error: 'Cody needs a short break. Try again in a few minutes.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  // one file (a PDF or a photo) or up to 8 scanned pages (photos), read by Gemini or Claude
  let file = null;
  const given = Array.isArray(body.files) ? body.files.slice(0, 8) : body.file && body.file.data ? [body.file] : [];
  if (given.length) {
    let size = 0;
    for (const f of given) {
      const type = String((f && f.type) || '');
      if (!/^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(type) || typeof f.data !== 'string') return res.status(400).json({ ok: false, error: 'Use a PDF, a photo, or paste your notes.' });
      size += f.data.length * 0.75;
    }
    if (size > MAX_FILE) return res.status(413).json({ ok: false, error: given.length > 1 ? 'Those pages are too big together. Try fewer pages.' : 'That file is too big. Try a smaller PDF, or paste the text.' });
    file = given.map((f) => ({ type: f.type, data: String(f.data) }));
  }
  const lang = langRule(body.lang);
  try {
    let out;
    if (body.task === 'reviewer') {
      if (!file && !String(body.notes || '').trim()) return res.status(400).json({ ok: false, error: 'Add some notes first.' });
      out = await ask(reviewerPrompt({ notes: body.notes, fileName: body.fileName }), checkReviewer, file, { effort: 'medium', lang });
    } else if (body.task === 'guide') {
      if (!file && !String(body.notes || '').trim()) return res.status(400).json({ ok: false, error: 'Add some notes first.' });
      // a study guide is long and must be exact, and nobody waits for it (it is written in the background):
      // Gemini first (it read wrapped tables more accurately in testing), which also leaves Groq's per-minute
      // allowance on its free plan for chat and quizzes
      out = await ask(guidePrompt({ notes: body.notes, fileName: body.fileName }), checkGuide, file, { effort: 'medium', order: ['gemini', 'groq', 'claude'], lang });
    } else if (body.task === 'draw') {
      if (!String(body.question || '').trim()) return res.status(400).json({ ok: false, error: 'Ask Cody what to draw.' });
      // a realistic drawing is many careful curves: Claude draws best, then Gemini; Groq thinks harder if it gets there
      // 2d: a flat drawing; 3d (asked for, and a real object): a model the student can turn, open and pull apart
      // the server stops at 120 seconds, so every try ends by 110; a 3D model gets the first 75, and if no AI could
      // build one, it is drawn flat instead (an easier job) in the time left
      const mode = drawMode(body.question, body.mode);
      // a drawing someone already got for the same question comes back at once, the same every time
      // (fresh: the student asked for a new one, which then replaces it)
      const key = drawKey(body.question, mode, body.lang);
      if (!body.fresh) { const kept = await keptDrawing(key); if (kept) return res.status(200).json({ ok: true, data: kept, by: 'saved', ...(body.mode === '3d' && mode === '2d' ? { flat: 'soft' } : {}) }); }
      const t0 = Date.now();
      const draw = (m, end) => ask(drawPrompt({ question: body.question, context: body.context, mode: m }), (j, attempt) => checkDrawing(j, attempt, body.question), null, { lang, order: ['claude', 'gemini', 'groq'], effort: 'medium', end });
      if (mode === '3d') {
        try { out = await draw('3d', t0 + 75000); }
        catch (e) { if (e.status === 503) throw e; out = await draw('2d', t0 + 110000); out.flat = 'failed'; }
      } else out = await draw('2d', t0 + 110000);
      if (body.mode === '3d' && mode === '2d') out.flat = 'soft'; // (3D was asked for something soft or living: drawn flat, and the app says why)
      if (out.flat !== 'failed') await keepDrawing(key, out.data);
    } else if (body.task === 'chat') {
      const msgs = Array.isArray(body.messages) ? body.messages : [];
      if (!msgs.length || !String((msgs[msgs.length - 1] || {}).text || '').trim()) return res.status(400).json({ ok: false, error: 'Say something to Cody first.' });
      out = await ask(chatPrompt({ messages: msgs, mode: body.mode, context: body.context, name: body.name }), checkChat, file, { lang });
    } else if (body.task === 'explain') {
      out = await ask(explainPrompt(body), checkExplain, null, { lang });
    } else return res.status(400).json({ ok: false, error: 'Unknown task' });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error('ai', body.task, e.message, e.detail || '');
    return res.status(e.status || 500).json({ ok: false, error: e.status === 503 ? 'Cody’s AI is not set up on this server yet. The sample reviewers still work.' : 'Cody could not finish that one. Please try again.' });
  }
}
