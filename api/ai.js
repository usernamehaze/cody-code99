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
import { cors } from '../lib/cors.js';
import { SYSTEM, reviewerPrompt, checkReviewer, drawPrompt, checkDrawing, explainPrompt, checkExplain, chatPrompt, checkChat, guidePrompt, checkGuide } from '../lib/tasks.js';

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
const MAX_FILE = 3.5 * 1024 * 1024; // Vercel takes request bodies up to 4.5 MB

function parseJSON(text) {
  const s = String(text || ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON in the answer');
  return JSON.parse(s.slice(a, b + 1));
}

const groq = (prompt, file, opts = {}) => eachModel(GROQ_MODELS(), async (model) => {
  const body = { model, temperature: 0.4, max_tokens: 12000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] };
  if (/gpt-oss/.test(model)) body.reasoning_effort = opts.effort || 'low'; // (quick answers; a study guide thinks harder)
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env('GROQ_API_KEY')}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw await fail('Groq', r);
  const j = await r.json();
  return parseJSON(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
});

const gemini = (prompt, file) => eachModel(GEMINI_MODELS(), (model) => geminiOnce(model, prompt, file));
async function geminiOnce(model, prompt, file) {
  const parts = [];
  if (file) parts.push({ inline_data: { mime_type: file.type, data: file.data } });
  parts.push({ text: prompt });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal: AbortSignal.timeout(file ? 45000 : 30000),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
  });
  if (!r.ok) throw await fail('Gemini', r);
  const j = await r.json();
  const text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
  return parseJSON(text);
}

let claudeClient = null;
async function claude(prompt, file) {
  claudeClient = claudeClient || new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 55000, maxRetries: 1 });
  const content = [];
  if (file && file.type === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } });
  else if (file) content.push({ type: 'image', source: { type: 'base64', media_type: file.type, data: file.data } });
  content.push({ type: 'text', text: prompt });
  // fallbacks: 'default' lets the API rerun a declined request on a fallback model inside the same call
  const msg = await claudeClient.beta.messages.create({
    model: CLAUDE_MODEL(), max_tokens: 16000, system: SYSTEM,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    messages: [{ role: 'user', content }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined');
  return parseJSON(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

const PROVIDERS = { groq: { key: 'GROQ_API_KEY', run: groq, files: false }, gemini: { key: 'GEMINI_API_KEY', run: gemini, files: true }, claude: { key: 'ANTHROPIC_API_KEY', run: claude, files: true } };
const ORDER = ['groq', 'gemini', 'claude'];

// ask each brain in turn; check() turns its JSON into clean data or says what to fix (one retry with the reason)
async function ask(prompt, check, file, opts = {}) {
  const tried = [];
  for (const name of opts.order || ORDER) {
    const p = PROVIDERS[name];
    if (!env(p.key) || (file && !p.files)) continue;
    let q = prompt;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = check(await p.run(q, file, opts));
        if (out && out.ok !== false) return { data: out.spec || out, by: name, skipped: tried };
        tried.push(`${name}: answer not usable${out && out.why ? ` (${out.why})` : ''}`);
        q = `${prompt}\n\nYour last answer could not be used${out && out.why ? `: ${out.why}` : ''}. Try again, following the shape exactly.`;
      } catch (e) { tried.push(`${name}: ${e.message}`); break; }
    }
  }
  const err = new Error(tried.length ? 'All AI providers failed' : 'No AI key is set on the server');
  err.detail = tried; err.status = tried.length ? 502 : 503;
  throw err;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method === 'GET') return res.status(200).json({ ok: true, providers: ORDER.filter((n) => env(PROVIDERS[n].key)) });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  // (300 an hour: a whole class can share one school address)
  if (limited(req, 'ai', 300)) return res.status(429).json({ ok: false, error: 'Cody needs a short break. Try again in a few minutes.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let file = null;
  if (body.file && body.file.data) {
    const type = String(body.file.type || '');
    if (!/^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(type)) return res.status(400).json({ ok: false, error: 'Use a PDF, a photo, or paste your notes.' });
    if (body.file.data.length * 0.75 > MAX_FILE) return res.status(413).json({ ok: false, error: 'That file is too big. Try a smaller PDF, or paste the text.' });
    file = { type, data: String(body.file.data) };
  }
  try {
    let out;
    if (body.task === 'reviewer') {
      if (!file && !String(body.notes || '').trim()) return res.status(400).json({ ok: false, error: 'Add some notes first.' });
      out = await ask(reviewerPrompt({ notes: body.notes, fileName: body.fileName }), checkReviewer, file, { effort: 'medium' });
    } else if (body.task === 'guide') {
      if (!file && !String(body.notes || '').trim()) return res.status(400).json({ ok: false, error: 'Add some notes first.' });
      // a study guide is long and must be exact, and nobody waits for it (it is written in the background):
      // Gemini first (it read wrapped tables more accurately in testing), which also leaves Groq's per-minute
      // allowance on its free plan for chat and quizzes
      out = await ask(guidePrompt({ notes: body.notes, fileName: body.fileName }), checkGuide, file, { effort: 'medium', order: ['gemini', 'groq', 'claude'] });
    } else if (body.task === 'draw') {
      if (!String(body.question || '').trim()) return res.status(400).json({ ok: false, error: 'Ask Cody what to draw.' });
      out = await ask(drawPrompt({ question: body.question, context: body.context }), checkDrawing, null);
    } else if (body.task === 'chat') {
      const msgs = Array.isArray(body.messages) ? body.messages : [];
      if (!msgs.length || !String((msgs[msgs.length - 1] || {}).text || '').trim()) return res.status(400).json({ ok: false, error: 'Say something to Cody first.' });
      out = await ask(chatPrompt({ messages: msgs, mode: body.mode, context: body.context, name: body.name }), checkChat, file);
    } else if (body.task === 'explain') {
      out = await ask(explainPrompt(body), checkExplain, null);
    } else return res.status(400).json({ ok: false, error: 'Unknown task' });
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error('ai', body.task, e.message, e.detail || '');
    return res.status(e.status || 500).json({ ok: false, error: e.status === 503 ? 'Cody’s AI is not set up on this server yet. The sample reviewers still work.' : 'Cody could not finish that one. Please try again.' });
  }
}
