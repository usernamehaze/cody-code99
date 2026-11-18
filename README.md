# Cody: your notes, turned into a study kit

**Code 99: CSS Hackathon 2027 · Track 3: EdTech** (with Gamified Learning built in)

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
| **My reviewers** | Drop a PDF or photo, or paste notes. Cody writes the key terms in plain words, 3 practice questions, a 10-question quiz and flashcards. Each term has a **✎ Draw it** button. |
| **Draw with Cody** | Ask anything ("how does the water cycle work?"). Cody draws it part by part like a pen on a blackboard and highlights each step as it explains. Back, Pause and Next controls, plus **Voice** (read aloud). Save the drawing as a reviewer, or play it as a game. |
| **Label it! game** | Drag each name onto its part of Cody's drawing. Faster answers and streaks of right answers (combos) earn more points. Works with a finger on a phone. |
| **Quiz** | Multiple choice from your own notes. After every answer, **Why** shows the reason with the right part of the drawing highlighted. **Explain more** gives an everyday example. |
| **Flashcards** | Spaced repetition (Leitner boxes). Rate a card **Again**, **Almost** or **Got it**; missed cards come back sooner. The back of each card shows Cody's drawing with that part lit up. |
| **Study plan** | Set your exam subject and date. Cody plans each day until then, with your weakest topic coming back more often. |
| **Class leaderboard** | A teacher (or one student) makes a class and shares its 6-letter code. Classmates join, and everyone's points show on one live board. No accounts, and only names and points are shared. |
| **Chrome extension** | Highlight text on any page (an article, a handout, a Google Doc), right-click, and choose *Make a Cody reviewer* or *Draw it with Cody*. The popup can also turn a whole page into a reviewer. |
| **Works offline** | Four built-in reviewers (the human heart, the water cycle, photosynthesis, the plant cell) work with no internet and no AI key. After the first visit the app opens offline. |
| **Phone and computer** | One web app, a sidebar on computers and a bottom tab bar on phones. Install it to the home screen (it's a PWA). |

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
- **Private by default.** There are no accounts. Your notes go only to the AI provider that reads them, and
  everything Cody keeps (reviewers, cards, points) stays in your browser. If you join a class, only your
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
5. **Try class leaderboards locally.** `npm run dev` keeps classes in memory, so they work on one computer
   (open a second browser profile to be a second student).
6. **Build the extension**
   ```bash
   npm run pack:extension
   ```
   This makes `Cody-extension.zip`. To install it, unzip it, open `chrome://extensions`, turn on
   **Developer mode**, click **Load unpacked** and pick the folder. For a local Cody, open the popup →
   Settings and set `http://localhost:3000`.

Optional settings: `GROQ_MODEL` (default `llama-3.3-70b-versatile`), `GEMINI_MODEL` (default
`gemini-flash-latest`), `CLAUDE_MODEL` (default `claude-opus-5-5`; set `claude-haiku-5-5` for a cheaper backup).

### Deploy to Vercel (https://cody.vercel.app)

1. Sign in at [vercel.com](https://vercel.com) with GitHub, then **Add New → Project** and import `cody-code99`.
2. Set the **Project Name** to `cody` (this gives `cody.vercel.app` if the name is free). Framework preset:
   **Other**. Leave the build command empty.
3. Under **Environment Variables**, add `GROQ_API_KEY`, `GEMINI_API_KEY` and (optionally) `ANTHROPIC_API_KEY`.
4. For class leaderboards: in the project, open **Storage → Create → Upstash (Redis)**, free plan, and connect it.
   That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. Without it, the app shows sample classmates.
5. Click **Deploy**. Vercel serves the files as they are and runs `api/ai.js` and `api/class.js` as serverless functions.
6. **Builds for Milestone 3:** upload `Cody-extension.zip` to Google Drive (set to *Anyone with the link*).

**Demo login:** none needed. Cody has no accounts. It opens with a demo student ("Juan") so judges see a full
dashboard. Its leaderboard shows *sample* classmates until you join a class (**Study plan → Your class**).
**Start fresh** clears everything, and **Load the demo again** brings the demo back.

## How to demo (about 10 minutes)

1. **Home**: the plan, streak, week and leaderboard.
2. **My reviewers → The human heart**: key terms, practice questions and the labelled drawing.
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
