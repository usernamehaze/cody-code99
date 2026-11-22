import * as S from '../store.js';
import { esc, header, toast, askSure, busy as spinBusy } from '../ui.js';
import * as Class from '../classroom.js';
import { mascot } from '../mascot.js';
import * as Acc from '../account.js';
import { LANGS } from '../ai.js';
import { ACCENTS, BACKS, apply as applyTheme } from '../theme.js';
import { busy } from '../ui.js';

// ---------- Me: like Cassie's "You" page ----------
// Who you are and three numbers on top, then a list of settings; each row opens its own page (#/plan/<page>).
// Sign out, then Delete account in red, at the end. (The day-by-day study plan is gone from here: Home's
// "Today's plan" still uses the exam date set in Study.)
const LEVEL = { elem: 'Elementary', jhs: 'Junior High', shs: 'Senior High', college: 'College / University', board: 'Reviewing for a board exam', teach: 'Teacher or parent' };
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC = {
  account: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  study: svg('<path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>'),
  language: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z"/>'),
  appearance: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>'),
  class: svg('<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M3 20c.8-3.5 3.2-5.5 6-5.5s5.2 2 6 5.5M15 15c2.6 0 4.4 1.6 5 4.5"/>'),
  privacy: svg('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  premium: svg('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5M12 17.2v.1"/>'),
  doc: svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
};
const CHEV = '<svg class="set-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const row = (go, title, sub, val = '', ext = false) => `<a class="set-link" href="${ext ? go : '#/plan/' + go}"${ext ? ' target="_blank" rel="noopener"' : ''}><span class="set-ico">${IC[ext ? 'doc' : go] || IC.doc}</span><span class="set-lt"><b>${title}</b><small>${sub}</small></span>${val ? `<span class="set-val">${esc(val)}</span>` : ''}${CHEV}</a>`;
const PAGES = { account: 'Account', study: 'Study', language: 'Language', appearance: 'Appearance', class: 'Study room', privacy: 'Privacy and data', premium: 'Premium', help: 'Help' };

export function render(root, page) {
  const s = S.get();
  if (page && PAGES[page]) return renderPage(root, page);
  const a = s.account, name = s.name || (a && a.name) || 'You';
  const lang = (LANGS.find(([k]) => k === (s.lang || 'en')) || ['', 'English'])[1].replace(/ \(.*\)$/, '');
  root.innerHTML = `
    ${header('Me', '')}
    <section class="set-page">
      <div class="set-me">
        ${a && a.picture ? `<img class="set-avatar" src="${esc(a.picture)}" alt="" referrerpolicy="no-referrer">` : `<span class="set-avatar" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</span>`}
        <div class="set-who"><b>${esc(name)}</b><small>${esc([LEVEL[s.level], a ? a.email : 'Guest · not signed in'].filter(Boolean).join(' · '))}</small></div>
        <a class="set-edit" href="#/plan/study">Edit</a>
      </div>
      <div class="set-stats">
        <div><b>${S.streak()}</b><small>day streak</small></div>
        <div><b>${S.learnedCount()}</b><small>cards learned</small></div>
        <div><b>${(s.points || 0).toLocaleString()}</b><small>points</small></div>
      </div>
      ${!a ? `<a class="set-signin" href="#/plan/account">${mascot('think', 40)}<span><b>Save your progress</b><small>You’re a guest. Sign in so your work is kept on every device.</small></span>${CHEV}</a>` : ''}
      <h3 class="set-you-h">Settings</h3>
      <div class="set-group set-links">
        ${row('account', 'Account', 'Sign in and back up', a ? 'Signed in' : 'Guest')}
        ${row('study', 'Study', 'Your name, level and exam', S.daysToExam() != null ? `${S.daysToExam()} day${S.daysToExam() === 1 ? '' : 's'} to go` : '')}
        ${row('language', 'Language', 'How Cody replies', lang)}
        ${row('appearance', 'Appearance', 'Your colours (Premium)', Acc.premium() ? ((ACCENTS[(s.theme || {}).accent || 'teal'] || ['Teal'])[0]) : '')}
        ${row('class', 'Study room', 'Join, make, leave, and the code', s.class ? s.class.name : '')}
        ${row('privacy', 'Privacy', 'What is shared, and your data')}
      </div>
      <h3 class="set-you-h">More</h3>
      <div class="set-group set-links">
        ${row('premium', 'Premium', 'Free during Code 99', Acc.premium() ? 'On' : '')}
        ${row('help', 'Help', 'How Cody works, and report a problem')}
        ${row('/privacy.html', 'Privacy policy', 'What Cody keeps and why', '', true)}
        ${row('/terms.html', 'Terms', 'The rules for using Cody', '', true)}
      </div>
      ${a ? `<div class="set-group set-links"><button type="button" class="set-link set-out sign-out"><span class="set-lt"><b>Sign out</b></span></button></div>
        <div class="set-group set-links"><button type="button" class="set-link set-danger del-acct"><span class="set-lt"><b>Delete account</b></span></button></div>`
        : `<div class="set-group set-links"><button type="button" class="set-link set-danger fresh"><span class="set-lt"><b>Clear this device</b><small>Remove everything you made as a guest</small></span></button></div>`}
    </section>`;
  wireAccount(root);
  wireFresh(root);
}

// one settings page, with a back arrow to Me
function renderPage(root, page) {
  const s = S.get();
  const body = {
    account: () => `<div class="card acct-card">${accountCard(s)}</div>`,
    study: () => `<form class="card settings">
        <label>Your name<input name="name" value="${esc(s.name)}" maxlength="30" autocomplete="given-name"></label>
        <label>Where you are in school<select name="level"><option value="">Choose…</option>${Object.entries(LEVEL).map(([k, n]) => `<option value="${k}" ${s.level === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label>Next exam: subject<input name="subject" value="${esc(s.exam.subject || '')}" maxlength="40" placeholder="e.g. Biology"></label>
        <label>Next exam: date <small>Home counts down and plans each day</small><input type="date" name="date" value="${esc(s.exam.date || '')}"></label>
        <button class="btn primary">Save</button>
      </form>`,
    language: () => `<form class="card settings lang-form">
        <label>Cody answers in <small>Chats, reviewers, quizzes and drawings. The screens stay in English.</small><select name="lang">${LANGS.map(([k, n]) => `<option value="${k}" ${(s.lang || 'en') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <button class="btn primary">Save</button>
      </form>`,
    appearance: () => `<div class="card prem-card">${premiumCard(s)}</div>`,
    premium: () => `<div class="card prem-card">${premiumCard(s)}</div>`,
    class: () => `<div class="card class-card">${classCard(s)}<p class="class-signin muted" hidden>Study rooms are for signed-in students, so everyone in a class is a real classmate. <a class="link" href="#/plan/account">Sign in</a> to join or make one.</p><p class="class-off muted" hidden>Classes aren’t switched on yet. Whoever runs this Cody site needs to connect the class database in Vercel: <b>Storage → Create Database → Upstash (free)</b>, connect it to the project, then redeploy.</p></div>`,
    privacy: () => `<div class="card"><h2 class="eyebrow">Only you can see your things</h2>
        <p>${s.account ? 'Everything you do in Cody is saved to your account, and only you can see it.' : 'You’re a guest, so everything stays on this device. Sign in to save it to your account.'}</p>
        <p class="muted">Classmates never see your reviewers, chats or scores. In a study room they only see your name, your points and what you choose to post or share there. Signing out takes everything off this device, so a shared phone never shows your work.</p>
        <p class="legal"><a class="link" href="/privacy.html">Read the privacy policy</a> · <a class="link" href="/terms.html">Terms</a></p></div>
      <div class="card"><h2 class="eyebrow">Your data</h2>
        <div class="row">${s.account ? '<button class="btn small ghost del-acct">Delete my account</button>' : '<button class="btn small fresh">Clear this device</button>'}</div></div>`,
    help: () => `<div class="card"><h2 class="eyebrow">How Cody works</h2>
        <ol class="help-steps"><li><b>Upload your notes</b> (a PDF, a photo, or pasted text) in Reviewers.</li><li>Cody makes a <b>reviewer</b>: a study guide, a quiz with an answer key, flashcards and key terms. Read it in Cody or save it as PDF or Word.</li><li><b>Quiz</b>, <b>flashcards</b> and <b>Label it!</b> help you remember it. Flashcards come back right before you'd forget.</li><li>Stuck? Tap the <b>Cody bubble</b> on any screen, or open <b>Ask Cody</b>.</li><li>Study with friends in a <b>study room</b>: draw on one board, chat and share reviewers.</li></ol></div>
      <div class="card"><h2 class="eyebrow">Something not working?</h2><p class="muted">Tell us what happened and on which screen.</p><a class="btn small" href="https://github.com/usernamehaze/cody-code99/issues" target="_blank" rel="noopener">Report a problem</a></div>`,
  }[page]();
  root.innerHTML = `<a class="back-link" href="#/plan">‹ Me</a>${header(PAGES[page], '')}<section class="set-sub">${body}</section>`;
  const f = root.querySelector('.settings');
  if (f && page === 'study') f.addEventListener('submit', (e) => { e.preventDefault(); s.name = f.name.value.trim(); s.level = f.level.value || undefined; s.exam = { subject: f.subject.value.trim(), date: f.date.value }; S.save(); toast('Saved'); location.hash = '#/plan'; });
  if (f && page === 'language') f.addEventListener('submit', (e) => { e.preventDefault(); s.lang = f.lang.value; S.save(); toast('Saved. Cody will answer in ' + f.lang.selectedOptions[0].textContent.replace(/ \(.*\)$/, '')); location.hash = '#/plan'; });
  if (page === 'class') {
    wireClass(root);
    // (classes need the class database on the server, and sign-in when it's on: say so before anyone types a code)
    if (!s.class && !s.account) Acc.config().then((c) => { if (!c.google || !root.isConnected) return; const card = root.querySelector('.class-card'); if (!card) return; card.querySelectorAll('form, .err').forEach((x) => { x.hidden = true; }); card.querySelector('.class-signin').hidden = false; });
    if (!s.class) Class.enabled().then((on) => { if (on || !root.isConnected) return; const c = root.querySelector('.class-card'); if (!c) return; c.querySelectorAll('form').forEach((x) => { x.hidden = true; }); c.querySelector('.class-off').hidden = false; });
  }
  wireAccount(root);
  wireFresh(root);
}
function wireFresh(root) {
  const b = root.querySelector('.fresh');
  if (b) b.addEventListener('click', async () => {
    if (await askSure({ title: 'Clear this device?', body: "Your points, streak, chats and the reviewers you made will be cleared from this device. This can't be undone.", action: 'Clear everything' })) { S.reset(); location.hash = '#/plan'; render(root); }
  });
}

function classCard(s) {
  if (s.class) return `<p class="muted">You are in <b>${esc(s.class.name)}</b>. Classmates join with this code:</p>
    <p class="class-code">${esc(s.class.code)}</p>
    <div class="row"><button class="btn small copy">Copy code</button><a class="btn small primary" href="#/room">Open the study room</a><button class="btn ghost small leave">Leave class</button></div>`;
  return `<p class="muted">Study with your real classmates. Your teacher (or one student) makes the class, then everyone joins with its code. Classmates see only your name, your points and what you share in the study room.</p>
    <form class="inline join"><input name="code" maxlength="6" placeholder="Class code" aria-label="Class code" autocomplete="off"><button class="btn">Join class</button></form>
    <form class="inline make" style="margin-top:10px"><input name="cname" maxlength="40" placeholder="New class name, e.g. Grade 9 Rizal" aria-label="New class name" style="text-transform:none"><button class="btn">Make a class</button></form>
    <p class="err" aria-live="polite"></p>`;
}
function wireClass(root) {
  const card = root.querySelector('.class-card'), err = card.querySelector('.err');
  const busy = async (fn) => { card.querySelectorAll('button').forEach((b) => { b.disabled = true; }); if (err) err.textContent = ''; try { await fn(); render(root, 'class'); } catch (e) { if (err) err.textContent = e.message; card.querySelectorAll('button').forEach((b) => { b.disabled = false; }); } };
  const need = () => { if (!S.get().name) throw new Error('Add your name first (Me → Study), so classmates know it is you.'); };
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
  if (!s.account) return `${intro}<p class="muted">Free during Code 99. <a class="link" href="#/plan/account">Sign in</a> to unlock it.</p>`;
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
  if (get) get.addEventListener('click', () => busy(get, 'Unlocking…', async () => { try { await Acc.unlockPremium(); toast('Premium is on!'); render(root, currentPage()); } catch (e) { toast(e.message); } }));
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
  if (cancel) cancel.addEventListener('click', () => { applyTheme(s.theme); render(root, currentPage()); });
  if (saveT) saveT.addEventListener('click', () => { s.theme = draft; S.save(); toast('Your colours are saved'); render(root, currentPage()); });
  // leaving without saving puts the saved colours back
  const back = () => { if (!/^#\/plan\/(appearance|premium)/.test(location.hash)) { applyTheme(Acc.premium() ? S.get().theme : null); window.removeEventListener('hashchange', back); } };
  window.addEventListener('hashchange', back);
}

const currentPage = () => (location.hash.match(/^#\/plan\/(\w+)/) || [])[1];
