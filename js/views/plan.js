import * as S from '../store.js';
import { esc, header, toast, askSure, plural, busy as spinBusy } from '../ui.js';
import * as Class from '../classroom.js';
import { emptyState, mascot } from '../mascot.js';
import * as Acc from '../account.js';
import { LANGS } from '../ai.js';
import { ACCENTS, BACKS, apply as applyTheme } from '../theme.js';
import { ICON, busy } from '../ui.js';

const DAY = 864e5;
const nice = (t) => new Date(t).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

// a day-by-day plan up to the exam: new reviewers first, a different topic each day, the weak topic twice,
// and a last-day review of everything
function schedule() {
  const s = S.get(), d = S.daysToExam();
  const revs = [...s.reviewers].sort((a, b) => (s.quiz[a.id] ? s.quiz[a.id].last : 0) - (s.quiz[b.id] ? s.quiz[b.id].last : 0));
  if (d == null || !revs.length) return [];
  const days = Math.min(d, 21), out = [];
  for (let k = 0; k <= days; k++) {
    const t = Date.now() + k * DAY;
    if (k === days && days > 0) { out.push({ t, items: ['Light review: flashcards due', 'One quiz on each topic', 'Sleep early. You are ready!'] }); continue; }
    const r = revs[k % revs.length];
    out.push({ t, today: k === 0, items: [`Read: ${r.title}`, `Flashcards due`, k % 2 ? `Label it! ${r.title}` : `Draw with Cody: ${r.title}`, `Quiz: ${r.title}`] });
  }
  return out;
}

export function render(root) {
  const s = S.get();
  const plan = schedule();
  root.innerHTML = `
    ${header('Study plan', S.daysToExam() == null ? 'Set your exam date and Cody plans every day until then.' : `${S.daysToExam()} day${S.daysToExam() === 1 ? '' : 's'} to your ${s.exam.subject || ''} exam`)}
    <section class="grid-2 grow">
      <div class="card"><h2 class="eyebrow">Day by day</h2>
        ${plan.length ? `<ol class="days">${plan.map((p) => `<li class="${p.today ? 'today' : ''}"><b>${p.today ? 'Today' : nice(p.t)}</b><ul>${p.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>`).join('')}</ol>`
          : !s.reviewers.length ? emptyState({ mood: 'wave', title: 'Nothing to plan yet', text: 'Upload your notes first, then add your exam date. Cody plans every day until the exam.', actions: [{ label: 'Upload my notes', href: '#/reviewers?upload=1' }] })
          : emptyState({ mood: 'think', title: 'When is your exam?', text: 'Add the date on the right and Cody plans every day until then.' })}
      </div>
      <div class="col">
        <div class="card acct-card"><h2 class="eyebrow">Your account</h2>${accountCard(s)}</div>
        <form class="card settings"><h2 class="eyebrow">You and your exam</h2>
          <label>Your name<input name="name" value="${esc(s.name)}" maxlength="30" autocomplete="given-name"></label>
          <label>Exam subject<input name="subject" value="${esc(s.exam.subject || '')}" maxlength="40"></label>
          <label>Exam date<input type="date" name="date" value="${esc(s.exam.date || '')}"></label>
          <label>Cody's language <small>for answers, reviewers, quizzes and drawings</small><select name="lang">${LANGS.map(([k, n]) => `<option value="${k}" ${(s.lang || 'en') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <button class="btn primary">Save my details</button>
        </form>
        <div class="card class-card"><h2 class="eyebrow">Your class</h2>${classCard(s)}<p class="class-signin muted" hidden>Study rooms are for signed-in students, so everyone in a class is a real classmate. Sign in above to join or make one.</p><p class="class-off muted" hidden>Classes aren’t switched on yet. Whoever runs this Cody site needs to connect the class database in Vercel: <b>Storage → Create Database → Upstash (free)</b>, connect it to the project, then redeploy.</p></div>
        <div class="card prem-card"><h2 class="eyebrow">Premium</h2>${premiumCard(s)}</div>
        <div class="card"><h2 class="eyebrow">Your data</h2>
          <p class="muted">${s.account ? 'Everything you do in Cody is saved to your account, and only you can see it.' : 'Everything Cody keeps stays on this device. Sign in to save it to your account.'} Classmates never see your reviewers, chats or scores. In a study room they only see your name, your points and what you choose to post or share there.</p>
          <div class="row"><button class="btn small fresh">Start fresh</button>${s.account ? '<button class="btn small ghost del-acct">Delete my account</button>' : ''}</div>
          <p class="legal"><a class="link" href="/privacy.html">Privacy</a> · <a class="link" href="/terms.html">Terms</a></p>
        </div>
      </div>
    </section>`;
  wireClass(root);
  // (classes need the class database on the server: say so before anyone types a code)
  if (!s.class && !s.account) Acc.config().then((c) => { if (!c.google || !root.isConnected) return; const card = root.querySelector('.class-card'); if (!card) return; card.querySelectorAll('form, .err').forEach((f) => { f.hidden = true; }); card.querySelector('.class-signin').hidden = false; });
  if (!s.class) Class.enabled().then((on) => { if (on || !root.isConnected) return; const c = root.querySelector('.class-card'); if (!c) return; c.querySelectorAll('form').forEach((f) => { f.hidden = true; }); c.querySelector('.class-off').hidden = false; });
  const f = root.querySelector('.settings');
  f.addEventListener('submit', (e) => { e.preventDefault(); s.name = f.name.value.trim(); s.exam = { subject: f.subject.value.trim(), date: f.date.value }; s.lang = f.lang.value; S.save(); toast('Saved. Cody updated your plan.'); render(root); });
  wireAccount(root);
  root.querySelector('.fresh').addEventListener('click', async () => {
    if (await askSure({ title: 'Start fresh?', body: "Your points, streak, chats and the reviewers you made will be cleared from this device. This can't be undone.", action: 'Clear and start fresh' })) { S.reset(); location.hash = '#/plan'; render(root); }
  });
}

function classCard(s) {
  if (s.class) return `<p class="muted">You are in <b>${esc(s.class.name)}</b>. Classmates join with this code:</p>
    <p class="class-code">${esc(s.class.code)}</p>
    <div class="row"><button class="btn small copy">Copy code</button><a class="btn small primary" href="#/room">Open the class room</a><button class="btn ghost small leave">Leave class</button></div>`;
  return `<p class="muted">Study with your real classmates. Your teacher (or one student) makes the class, then everyone joins with its code. Classmates see only your name, your points and what you share in the study room.</p>
    <form class="inline join"><input name="code" maxlength="6" placeholder="Class code" aria-label="Class code" autocomplete="off"><button class="btn">Join class</button></form>
    <form class="inline make" style="margin-top:10px"><input name="cname" maxlength="40" placeholder="New class name, e.g. Grade 9 Rizal" aria-label="New class name" style="text-transform:none"><button class="btn">Make a class</button></form>
    <p class="err" aria-live="polite"></p>`;
}
function wireClass(root) {
  const card = root.querySelector('.class-card'), err = card.querySelector('.err');
  const busy = async (fn) => { card.querySelectorAll('button').forEach((b) => { b.disabled = true; }); if (err) err.textContent = ''; try { await fn(); render(root); } catch (e) { if (err) err.textContent = e.message; card.querySelectorAll('button').forEach((b) => { b.disabled = false; }); } };
  const need = () => { if (!S.get().name) throw new Error('Add your name above first, so classmates know it is you.'); };
  const join = card.querySelector('.join'), make = card.querySelector('.make');
  if (join) join.addEventListener('submit', (e) => { e.preventDefault(); spinBusy(join.querySelector('button'), 'Joining…', () => busy(async () => { need(); const c = await Class.join(join.code.value); toast(`You joined ${c.name}!`); })); });
  if (make) make.addEventListener('submit', (e) => { e.preventDefault(); spinBusy(make.querySelector('button'), 'Making the class…', () => busy(async () => { need(); const c = await Class.create(make.cname.value); toast(`Class made. Share the code ${c.code}`); })); });
  const copy = card.querySelector('.copy');
  if (copy) copy.addEventListener('click', () => { navigator.clipboard.writeText(S.get().class.code).then(() => toast('Code copied'), () => toast(S.get().class.code)); });
  const leave = card.querySelector('.leave');
  if (leave) leave.addEventListener('click', async () => {
    if (await askSure({ title: `Leave “${S.get().class.name}”?`, body: 'Your name and points come off its leaderboard. Your points stay on this device, and you can join again with the code.', action: 'Leave class', danger: false })) busy(() => Class.leave());
  });
}

// ---------- the account ----------
function accountCard(s) {
  const a = s.account;
  if (a) return `<div class="acct">${a.picture ? `<img src="${esc(a.picture)}" alt="" width="48" height="48" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((a.name || '?').slice(0, 2).toUpperCase())}</span>`}<div><b>${esc(a.name || 'Signed in')}</b><span class="muted">${esc(a.email)}</span></div></div>
    <p class="muted small">Your reviewers, cards, chats and points are backed up to your account and follow you to any device.</p>
    <div class="row"><button class="btn small sign-out">Sign out</button></div>`;
  return `<p class="muted">Sign in to keep your reviewers, cards, chats and points on every device, and to unlock Premium.</p>
    <button class="btn google">${GOOGLE} Continue with Google</button>
    <p class="muted small acct-msg" aria-live="polite"></p>
    <p class="muted small">By continuing you agree to Cody's <a class="link" href="/terms.html">Terms</a> and <a class="link" href="/privacy.html">Privacy</a>.</p>`;
}
const GOOGLE = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>';

// ---------- Premium: free during Code 99 ----------
function premiumCard(s) {
  const on = Acc.premium(), t = s.theme || {};
  const intro = `<ul class="prem-list"><li><b>Make it yours:</b> your own colours for Cody.</li><li><b>Reviewer mastery:</b> how well you know each reviewer, and what to study next.</li></ul>`;
  if (!s.account) return `${intro}<p class="muted">Free during Code 99. Sign in above to unlock it.</p>`;
  if (!on) return `${intro}<p class="muted">Free during Code 99. No payment needed.</p><button class="btn primary get-prem">${mascot('cheer', 22)} Unlock Premium</button>`;
  return `<p class="prem-on">${mascot('cheer', 26)} Premium is on. Thanks for trying Cody!</p>
    <h3 class="sub-h">Make it yours</h3>
    <p class="muted small">Tap to preview. Nothing changes until you save.</p>
    <div class="pick-row" role="radiogroup" aria-label="Accent colour">${Object.entries(ACCENTS).map(([k, a]) => `<button type="button" class="swatch-pick ${((t.accent || 'teal') === k) ? 'on' : ''}" data-accent="${k}" role="radio" aria-checked="${(t.accent || 'teal') === k}" style="--c:${a[1]}"><i></i>${a[0]}</button>`).join('')}</div>
    <div class="pick-row" role="radiogroup" aria-label="Background">${Object.entries(BACKS).map(([k, b]) => `<button type="button" class="swatch-pick back ${((t.back || 'navy') === k) ? 'on' : ''}" data-back="${k}" role="radio" aria-checked="${(t.back || 'navy') === k}" style="--c:${b[1]};--c2:${b[3]}"><i></i>${b[0]}</button>`).join('')}</div>
    <div class="row theme-actions" hidden><button type="button" class="btn small cancel-theme">Cancel</button><button type="button" class="btn small primary save-theme">Save colours</button></div>
    <p class="muted small">Reviewer mastery shows on each reviewer and in My reviewers.</p>`;
}

function wireAccount(root) {
  const s = S.get();
  const g = root.querySelector('.google');
  if (g) {
    Acc.config().then((c) => { if (!c.google && root.isConnected) { g.disabled = true; const m = root.querySelector('.acct-msg'); if (m) m.textContent = 'Google sign-in isn’t switched on for this Cody site yet. Whoever runs it adds GOOGLE_CLIENT_ID in Vercel.'; } });
    g.addEventListener('click', () => busy(g, 'Opening Google…', () => Acc.signIn().catch((e) => toast(e.message))));
  }
  const out = root.querySelector('.sign-out');
  if (out) out.addEventListener('click', async () => {
    if (await askSure({ title: 'Sign out?', body: 'Everything is saved to your account first, then removed from this device, so the next person who uses it can’t see your things. Sign in again to get it all back.', action: 'Sign out', danger: false })) busy(out, 'Saving and signing out…', async () => { await Acc.signOut(); applyTheme(null); location.hash = '#/'; location.reload(); });
  });
  const del = root.querySelector('.del-acct');
  if (del) del.addEventListener('click', async () => {
    if (!(await askSure({ title: 'Delete your Cody account?', body: `Everything Cody keeps for ${s.account.email} is deleted, from Cody's server and from this device. Classes you joined keep only the messages you posted there. This can't be undone.`, action: 'Delete my account' }))) return;
    busy(del, 'Deleting…', async () => { try { await Acc.deleteAccount(); applyTheme(null); location.hash = '#/'; location.reload(); } catch (e) { toast(e.message); } });
  });
  const get = root.querySelector('.get-prem');
  if (get) get.addEventListener('click', () => busy(get, 'Unlocking…', async () => { try { await Acc.unlockPremium(); toast('Premium is on!'); render(root); } catch (e) { toast(e.message); } }));
  // Make it yours: preview live, save or cancel
  let draft = { ...(s.theme || {}) };
  const acts = root.querySelector('.theme-actions');
  root.querySelectorAll('.swatch-pick').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.accent) draft.accent = b.dataset.accent; else draft.back = b.dataset.back;
    const sel = b.dataset.accent ? '[data-accent]' : '[data-back]';
    root.querySelectorAll('.swatch-pick' + sel).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    applyTheme(draft); if (acts) acts.hidden = false;
  }));
  const cancel = root.querySelector('.cancel-theme'), saveT = root.querySelector('.save-theme');
  if (cancel) cancel.addEventListener('click', () => { applyTheme(s.theme); render(root); });
  if (saveT) saveT.addEventListener('click', () => { s.theme = draft; S.save(); toast('Your colours are saved'); render(root); });
  // leaving without saving puts the saved colours back
  const back = () => { if (location.hash !== '#/plan') { applyTheme(Acc.premium() ? S.get().theme : null); window.removeEventListener('hashchange', back); } };
  window.addEventListener('hashchange', back);
}
