# Cody: your notes, turned into a study kit

**Code 99: CSS Hackathon 2027 · Track 3: EdTech** (with Gamified Learning built in)

**Live:** https://cody-code99.vercel.app

Cody is a study buddy for Filipino students. Upload your notes (a PDF, a photo of your notebook, or pasted
text) and Cody makes a **reviewer**, **draws the topic step by step** while it explains, then turns the same
notes into a **quiz**, **flashcards** and a **Label it! game**. It plans every day until your exam.

## Background: the problem

Before an exam, most students in the Philippines review the same way: re-read handouts and highlight.
Making a good reviewer, practice questions and flashcards by hand takes hours, so most students never do it.
Many topics in science (the heart, the water cycle, cells) are also much easier to understand as a
**picture** than as a paragraph, but students rarely have someone who draws it for them.

**Who it helps:** high school and college students, especially those who study alone on a phone or a shared
school computer. **Teachers** can use the drawings in class.

## Features

| | What it does |
|---|---|
| **Home** | A greeting in Filipino, your exam countdown, streak, cards learned, quiz score and points. **Today's plan, made by Cody** ticks itself off as you study. Shows the week's study time and your **class leaderboard**. |
| **My reviewers** | Drop a PDF or photo, scan pages, or paste notes. Each reviewer opens as a short page: the **reviewer file** (Read, PDF, Word), study tools (Quiz, Flashcards, Label it!, Ask Cody), key terms and mastery. The long study guide opens on its own reading page, one folding section at a time, with a row of section chips to jump around. When Cody finishes writing it, Cody asks once: read it here, save it as PDF or Word, or skip to the quiz. Saved files hold the study guide, the quiz with an answer key, and the flashcards. |
| **Draw with Cody** | Ask anything ("how does the water cycle work?"). Cody draws it part by part like a pen on a blackboard and highlights each step as it explains. Back, Pause and Next controls, plus **Voice** (read aloud). Save the drawing as a reviewer, or play it as a game. |
| **Label it! game** | Drag each name onto its part of Cody's drawing. Faster answers and streaks of right answers (combos) earn more points. Works with a finger on a phone. |
| **Quiz** | Multiple choice from your own notes. After every answer, **Why** shows the reason with the right part of the drawing highlighted. **Explain more** gives an everyday example. |
| **Flashcards** | Spaced repetition (Leitner boxes). Rate a card **Again**, **Almost** or **Got it**; missed cards come back sooner. The back of each card shows Cody's drawing with that part lit up. |
| **Me** | Like Cassie's "You" page: your name, school level and three numbers (streak, cards learned, points), then a settings list where each row opens its own page: Account, Study (name, level, next exam), Language, Appearance, Your class, Privacy, plus Premium, Help, Privacy policy and Terms. Sign out, then Delete account in red. Home still counts down to the exam and plans each day. |
| **Class room** | A teacher or student makes a class and shares its 6-letter code. Inside the class room, classmates **draw together** on one board, **chat**, send **voice messages**, **ask Cody for everyone** (one person asks, the whole class sees the answer), and **share reviewers** (a classmate saves a copy with its study guide, quiz and flashcards). It also shows who's here and a class leaderboard. Words that sound like a student is at risk never go to the class: they open a private chat with Cody's care response. |
| **Scan with camera** | Take photos of up to 8 notebook or textbook pages in a row. Cody reads them all as one set of notes and makes one reviewer. |
| **Ask Cody bubble** | A floating Cody on every screen. Tap it to ask a quick question without leaving the page; **Open in Ask Cody** carries the talk into the full chat. |
| **Any language** | On **Me**, pick the language Cody answers in (English, Filipino, Hiligaynon, Cebuano and more). Chats, reviewers and study guides come back in that language; the screens stay in English. |
| **Stop and clear** | While Cody is thinking, Send turns into **Stop**. **Clear chat** empties a chat (it asks first). |
| **Onboarding and sign-in** | Like Cassie's first run: a splash, an illustrated intro, four quick questions (name, school level, what brings you, your next exam), a "You're all set" summary, then the sign-in page. **Continue with Google** saves everything the student does to their account; **Continue as a guest** keeps work on that device only. |
| **Private by design** | Nobody else can see a student's things. Classmates see only their name, points and what they post or share in a study room. Study rooms need sign-in, and only members can read one (knowing the code isn't enough). Signing out saves to the account, then clears the device, so a shared phone never shows the last student's work. **Delete my account** removes it everywhere. |
| **Premium** (free for the demo) | **Make it yours:** pick an accent colour and a background, with a live preview. **Reviewer mastery:** each reviewer shows how well you know it (quiz 45%, flashcards learned 40%, Label it! 15%) and what to do next. |
| **Chrome extension** | Highlight text on any page (an article, a handout, a Google Doc), right-click, and choose *Make a Cody reviewer* or *Draw it with Cody*. The popup can also turn a whole page into a reviewer. |
| **Works offline** | Draw with Cody has four built-in example drawings (the human heart, the water cycle, photosynthesis, the plant cell) that work with no internet and no AI key. After the first visit the app opens offline. |
| **Phone and computer** | One web app, a sidebar on computers and a bottom tab bar on phones. Install it to the home screen (it's a PWA). |

## Learning outcomes

After using Cody on a topic, a student can:
1. **Explain** its key terms in their own words (study guide, key terms, Ask Cody).
2. **Name and place** the parts of its diagram from memory (Draw with Cody, Label it!).
3. **Answer** exam-style questions and say why the answer is right (quiz with "Why").
4. **Remember** it long term, by reviewing at growing intervals (flashcards with spaced repetition).

## How Cody follows the Code 99 rules

| Rule | How Cody meets it |
|---|---|
| Accepted output | A web app (also an Android app and a Chrome extension) with educational games that have defined learning outcomes (above) |
| Any language or framework; low-code discouraged | Hand-written HTML, CSS and JavaScript, with small Node.js server functions. No low-code or no-code tools |
| Safe for a general audience: no NSFW, excessive violence, or controversial political or religious themes | Safety rules are in every AI prompt (`lib/tasks.js`): no explicit content or graphic violence, and political or religious topics taught only neutrally from the student's notes. The class room refuses explicit words and insults in English and Filipino (`lib/safe.js`). Self-harm words get a care response with the NCMH crisis line (`js/care.js`) |
| AI-generated code allowed; the team must explain and defend it | AI coding tools assisted development. [How Cody works](docs/how-cody-works.md) explains every part and lists questions judges may ask |

## Architecture

```
Browser (plain HTML/CSS/JS, no build step)              Vercel
┌──────────────────────────────────────────┐          ┌──────────────────────────────┐
│ index.html + js/app.js   (router, shell)  │  POST    │ api/ai.js  (serverless)      │
│ js/views/*      one file per screen       │ /api/ai  │  ├ lib/tasks.js prompts +    │
│ js/draw.js      drawing engine (SVG)      │ ───────► │  │  checks for each answer   │
│ js/store.js     state, streak, spaced     │          │  └ providers, in order:      │
│                 repetition (localStorage) │ ◄─────── │     Groq → Gemini → Claude   │
│ js/notes.js     PDF text (pdf.js), photos │   JSON   │  keys live only here         │
│ js/samples.js   built-in reviewers        │          │ api/class.js (serverless)    │
│ js/classroom.js class code, point sync    │ ───────► │  class boards in Upstash     │
└──────────────────────────────────────────┘ /api/class│  Redis (lib/kv.js)           │
        ▲ #/import?t=…  (text in the link's #)          └──────────────────────────────┘
┌───────┴──────────────────────────────────┐
│ extension/  Chrome extension (Manifest V3) │
└──────────────────────────────────────────┘
```

- **One drawing spec powers four features.** The AI writes a small JSON "spec": parts in teaching order,
  each with shapes (paths, arrows, circles…), a label, an anchor point and what Cody says. `js/draw.js`
  animates it stroke by stroke for **Draw with Cody**, turns the anchors into drop spots for **Label it!**,
  and highlights single parts for the **quiz** and the **flashcards**.
- **Every AI answer is checked before it is used** (`lib/tasks.js`). A quiz needs 4 choices and a valid
  answer. A drawing needs at least 3 parts, anchors on the board, and no piling into one corner. For common
  topics (the heart, cells, the water cycle…) the prompt lists the parts a textbook figure shows. A bad
  answer is sent back once with the reason.
- **Fallback between providers.** Text goes to Groq first (free and fast). If Groq is busy, Gemini answers,
  then Claude. PDFs that are scans, and photos, go to Gemini or Claude, which can read images.
- **Private by default.** An account is optional. Your notes go only to the AI provider that reads them, and
  everything Cody keeps (reviewers, cards, points) stays in your browser, unless you sign in with Google, which
  keeps a backup copy in your account (Google's sign-in is checked on the server; Cody never sees a password).
  See [privacy.html](privacy.html) and [terms.html](terms.html). If you join a class, only your
  name and points go to its board. Each device has a private id that the board never shows.
- **The extension needs no site access.** It reads a page only when you click (`activeTab`), and hands the
  text to Cody inside the link's `#` part, which browsers never send to a server. Cody removes it from the
  address bar at once.

### Files

| Path | What's in it |
|---|---|
| `index.html`, `css/style.css` | The page and all styles |
| `js/app.js` | Sidebar, bottom tabs, hash router, streak card |
| `js/views/` | `home`, `reviewers`, `draw`, `label`, `quiz`, `cards`, `plan` |
| `js/draw.js` | The drawing engine |
| `js/store.js` | Saved state, points, streak, spaced repetition, today's plan |
| `js/samples.js` | Built-in reviewers with hand-made drawings |
| `js/notes.js` | Reads PDFs (pdf.js), shrinks photos, reads text files |
| `api/ai.js` | AI server function: providers, fallback, rate limit |
| `api/class.js`, `lib/kv.js` | Class leaderboards: codes, joining, point sync, the store |
| `js/classroom.js` | The app side of classes |
| `js/views/import.js` | Receives text from the extension |
| `extension/` | The Chrome extension (popup, right-click menu) |
| `scripts/pack-extension.mjs` | Builds `Cody-extension.zip` |
| `lib/tasks.js` | Prompts and answer checks for `reviewer`, `draw`, `explain` |
| `scripts/dev.mjs` | Local server (no Vercel account needed) |
| `tests/` | Server tests with a fake AI (`npm test`) |

## Setup and run

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)).

1. **Get the code**
   ```bash
   git clone https://github.com/usernamehaze/cody-code99.git
   cd cody-code99
   npm install
   ```
2. **Add your AI keys** (optional: without them the four built-in reviewers still work). Create a file
   named `.env` in the project folder:
   ```
   GROQ_API_KEY=your-groq-key           # free: console.groq.com/keys
   GEMINI_API_KEY=your-gemini-key       # free: aistudio.google.com/app/apikey (reads PDFs and photos)
   ANTHROPIC_API_KEY=your-claude-key    # optional backup: console.anthropic.com
   ```
   `.env` is in `.gitignore`, so it is never committed. Never put keys in the code.
3. **Run it**
   ```bash
   npm run dev
   ```
   Open **http://localhost:3000**.
4. **Run the tests**
   ```bash
   npm test
   ```
5. **Try the class room locally.** `npm run dev` keeps classes in memory, so they work on one computer
   (open a second browser profile to be a second student).
6. **Build the extension**
   ```bash
   npm run pack:extension
   ```
   This makes `Cody-extension.zip`. To install it, unzip it, open `chrome://extensions`, turn on
   **Developer mode**, click **Load unpacked** and pick the folder. For a local Cody, open the popup →
   Settings and set `http://localhost:3000`.

Optional settings: `GROQ_MODEL`, `GEMINI_MODEL` and `CLAUDE_MODEL` (tried first). Without them Cody tries
`openai/gpt-oss-120b`, `llama-3.3-70b-versatile` and `openai/gpt-oss-20b` on Groq, then `gemini-flash-latest` and
`gemini-flash-lite-latest`, then `claude-opus-5-5` (set `claude-haiku-5-5` for a cheaper backup). A model a
provider has retired is skipped automatically.

### Build the Android app (Cody.apk)

The Android app is the same Cody, wrapped with [Capacitor](https://capacitorjs.com): the screens are
inside the phone (the samples work offline), and AI and class boards go to the deployed site.

You need **Java 21** and the **Android SDK** (the easiest way is to install
[Android Studio](https://developer.android.com/studio), which installs both and asks you to accept Google's
SDK licence). Then:

```bash
npm run build:apk        # makes Cody.apk in the project folder
```

To point the app at another address: `CODY_URL=https://my-cody-code99.vercel.app npm run build:apk`.
Install `Cody.apk` on an Android phone (allow *Install unknown apps*), or upload it to Google Drive for Milestone 3.
`npm run build:mobile` updates the `android/` project without building, so you can open it in Android Studio.

### Deploy to Vercel (https://cody-code99.vercel.app)

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New → Project** and import `cody-code99`.
2. Set the **Project Name** to `cody-code99` (this gives `cody-code99.vercel.app`; plain `cody` was taken). Framework preset:
   **Other**. Leave the build command empty.
3. Under **Environment Variables**, add `GROQ_API_KEY`, `GEMINI_API_KEY` and (optionally) `ANTHROPIC_API_KEY`.
4. For the class room and leaderboard: in the project, open **Storage → Create → Upstash (Redis)**, free plan, and connect it.
   That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. Without it, classes can't be made on the live site.
   The room checks for news every 2.5 seconds per student while it's open; Upstash's free plan suits a class or a demo.
5. For **Sign in with Google** (optional): in [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   **Create credentials → OAuth client ID → Web application**. Add `https://cody-code99.vercel.app` under *Authorized
   JavaScript origins* and `https://cody-code99.vercel.app/` under *Authorized redirect URIs*. Put the client ID in Vercel as
   `GOOGLE_CLIENT_ID`, and a long random text as `SESSION_SECRET`. Accounts also need the Upstash database from step 4.
6. Click **Deploy**. Vercel serves the files as they are and runs `api/ai.js` and `api/class.js` as serverless functions.
7. **Builds for Milestone 3:** upload `Cody-extension.zip` to Google Drive (set to *Anyone with the link*).

**Demo login:** sign in with any Google account, or tap **Try without an account** on the sign-in screen. Premium is free for the demo. It opens empty: no made-up scores, streaks, reviewers or classmates.
Every number on Home is the student's own, and each empty screen shows Cody and what to do first.
**Study plan → Start fresh** clears everything on the device.

## How to demo (about 10 minutes)

1. **Home** on a fresh device: Cody's empty states. Then **upload your own notes** (a PDF, a photo or pasted text) and open the new reviewer: study guide, key terms and practice questions. Upload before the pitch so the plan, quiz and flashcards have something in them.
2. **Home** again: today's plan, made from your notes.
3. **✎ Draw it** on a term, or ask *"how does the water cycle work?"*: Cody draws step by step. Turn on **Voice**.
4. **Play Label it!**: drag the names on, and watch the combo and points.
5. **Quiz me on this**: answer, see **Why** with the highlighted part, try **Explain more**.
6. **Flashcards**: flip, rate, and see the drawing on the back.
7. **Upload** your own notes live (PDF, photo or paste), then open the brand-new reviewer.
8. **Class**: make a class on the laptop and join it from a phone with the code, so the board updates live.
9. **Extension**: on a Wikipedia page, highlight a paragraph → right-click → *Make a Cody reviewer from this*.

## Credits and licenses

- [Inter](https://rsms.me/inter/) font by Rasmus Andersson, via Google Fonts (SIL Open Font License 1.1)
- [pdf.js](https://mozilla.github.io/pdf.js/) by Mozilla, via cdnjs (Apache License 2.0), reads PDF text in the browser
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) (MIT)
- [jsPDF](https://github.com/parallax/jsPDF) and [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) (MIT), shipped in `js/vendor/`, make study guides into PDF files
- AI providers: [Groq](https://groq.com), [Google Gemini](https://ai.google.dev), [Anthropic Claude](https://www.anthropic.com)
- The logo, icons, the four sample drawings and every screen are original work by the team.
- Cody shares its drawing-spec idea, Leitner flashcard schedule and provider fallback with
  **Cassie**, the team's earlier study app ([usernamehaze/bot](https://github.com/usernamehaze/bot)); the Cody code is new.

## AI use disclosure

As the guidelines ask, here is how AI was used:

- **Inside the app:** Cody uses AI (Groq, Gemini, Claude) at runtime to write reviewers, quizzes, flashcards,
  drawings and explanations from the student's notes.
- **While building:** the team used AI coding assistants (Claude Code), which the organizers confirmed is allowed.
- **No AI-generated images, audio or video** are in the project. Drawings are SVG strokes: the samples are
  hand-made, and live ones are computed from the AI's text spec. Voice uses the browser's built-in speech.
- The promotional poster is made by the team without AI, as the poster rules require.
