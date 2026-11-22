# How Cody works: a guide for explaining and defending it

Code 99 allows AI-generated code as a tool, but **the team must explain and defend the solution**. This guide
walks through every part of Cody: what it does, where the code is, and why it was built that way. Read it as
a team, open each file it names, and practise answering the questions at the end in your own words.

## 1. The idea in one minute

Students in the Philippines mostly review by re-reading, because making a reviewer, quiz and flashcards by hand
takes hours. Cody takes a student's **own notes** (a PDF, a photo, or pasted text) and makes, in seconds:

- a **study guide** and **key terms** in plain words,
- a **drawing** that explains the topic step by step,
- a **quiz** that explains every answer,
- **flashcards** that bring back what the student misses (spaced repetition),
- a **Label it!** game on the drawing,
- a **daily plan** up to the exam, and a **class room** to study with classmates.

**Learning outcomes.** After using Cody on a topic, a student can: (1) explain its key terms in their own
words, (2) name and place the parts of its diagram from memory (Label it!), (3) answer exam-style questions and
say why the answer is right (quiz), and (4) keep it in long-term memory by reviewing at growing intervals
(flashcards).

## 2. The big picture (architecture)

```
Phone or computer browser                          Vercel (the server)
  index.html, css/style.css                          api/ai.js     → Groq, then Gemini, then Claude
  js/app.js        the shell and router              api/class.js  → Upstash Redis (classes, the room)
  js/views/*.js    one file per screen               lib/tasks.js  prompts + checks for every AI answer
  js/store.js      everything saved on the device    lib/safe.js   keeps the class room friendly
```

- **No framework, no build step.** Plain HTML, CSS and JavaScript modules. It loads fast on old school
  computers and is easy to read. Every screen is one file in `js/views/`.
- **The device keeps the student's data** (`js/store.js`, in the browser's `localStorage`). Signing in with Google is optional and keeps a backup copy.
  Only classes live on the server.
- **The server only does what the browser can't do safely:** call the AI (the API keys must stay secret) and
  share a class between devices.

## 3. Each part

### Turning notes into a reviewer (`js/views/reviewers.js`, `js/notes.js`, `lib/tasks.js`)
1. `js/notes.js` reads the file: a PDF's text with pdf.js, a photo shrunk to 1600px, or pasted text.
2. The browser sends it to `/api/ai` with the task `reviewer`. The prompt (`reviewerPrompt` in `lib/tasks.js`)
   asks for JSON: terms, a 10-question quiz, flashcards and practice questions.
3. `checkReviewer` **checks the answer before it is used**: every quiz question needs 4 choices and a valid
   answer, text is cut to safe lengths. A bad answer is sent back to the AI once with the reason.
4. In the background, a second request (`guide`) writes the long **study guide**, and a third (`draw`)
   makes the drawing. The student doesn't wait for them.

**Why check AI answers?** AI can return broken or wrong data. Checking the shape means the app never shows a
quiz with 3 choices or crashes on a missing field.

### The AI and its backups (`api/ai.js`)
- Keys are **Vercel environment variables**, never in the app.
- Chat and quizzes try **Groq** first (fast, free), then **Gemini**, then **Claude**. Study guides try
  **Gemini** first (it was more accurate on tables in our tests). Photos and scanned PDFs go to Gemini or
  Claude, which can read images.
- Each provider has a list of models. If a provider retires a model (Groq retired `llama-3.3-70b-versatile`
  during development), Cody skips it automatically.
- `lib/tasks.js` has **safety rules in every prompt**: no explicit content or graphic violence, and political
  or religious topics only taught neutrally from the student's notes.

### The drawing engine (`js/draw.js`)
- The AI doesn't make a picture. It writes a small **JSON "spec"**: parts in teaching order, each with
  shapes (paths, arrows, circles), a label, a point on the part (the "anchor") and a sentence.
- `clean()` makes the spec safe: numbers are clamped to the board, colours must be hex codes, paths may only
  contain path letters and numbers, and text is never treated as HTML.
- `mount()` draws it as SVG, stroke by stroke, using the dash-offset trick, and places labels in the margins
  so they never cover the drawing.
- **One spec powers four features:** Draw with Cody (animated), Label it! (the anchors become drop spots),
  the quiz's "Why" (one part highlighted) and the back of a flashcard.

### Flashcards and spaced repetition (`js/store.js`, `js/views/cards.js`)
- Each card sits in a **Leitner box** (0 to 6). "Got it" moves it up a box; the next review is
  0, 1, 3, 7, 16, 35 or 70 days later. "Again" sends it back to box 0 (one minute). "Almost" keeps the box.
- This is based on the **spacing effect**: reviewing just before you forget makes memories last longer.

### Label it! (`js/views/label.js`)
- Drag (or tap) each name onto its spot. Right answers in a row build a **combo**; faster answers earn more.
- Wrong drops shake and flash the right spot, so a mistake still teaches.

### Ask Cody, the chat (`js/views/chat.js`)
- Four modes: Tutor, Hint (never gives the answer), Quiz me, and Heart-to-heart.
- **Safety first** (`js/care.js`): if a student writes that they want to hurt themselves, in English or
  Filipino, Cody answers with care and the **NCMH crisis line (1553)** at once, without sending it to the AI.
  The numbers were checked on ncmh.gov.ph.

### The class room (`js/views/room.js`, `api/class.js`)
- A class has a 6-letter code. The room is a **list of things that happened** (a line drawn, a message, a
  voice message, a shared reviewer) kept in Upstash Redis. Each device asks for anything new every 2.5 seconds
  while the room is open ("polling").
- **Why polling, not live sockets?** Vercel's serverless functions can't hold a live connection. Polling is
  simple and works everywhere; the cost is a delay of up to 2.5 seconds.
- **Safety:** only members can post, names come from the server, ids are never shown, posts are checked, and
  `lib/safe.js` refuses explicit words and insults (English and Filipino). Words that sound like a student is
  at risk are never posted to the class; they open a private chat with the care message.

### Saving a reviewer as PDF or Word (`js/pdf.js`, `js/docx.js`, `js/mdblocks.js`)
- Both files hold the study guide, then the quiz, an answer key and the flashcards (`reviewerDoc` in `js/views/reviewers.js`).
- iPhones block websites from opening the print window, so Cody builds the PDF itself with **jsPDF**.
- The Word file is made with no library: a `.docx` is a zip of a few XML files (the text, the styles, a footer
  with page numbers). `js/docx.js` writes that XML and a small zip. Word, Google Docs, Pages and WPS open it.
- The PDF's fonts only know Western letters, so a reviewer in Chinese, Japanese or Korean is saved as Word instead.

### Accounts, Premium and privacy (`api/account.js`, `js/account.js`, `js/theme.js`, `privacy.html`)
- **Sign in with Google** sends the student to Google. Google sends back a signed *ID token*. The server checks
  its signature with Google's public keys, that it was made for Cody (`GOOGLE_CLIENT_ID`), that it hasn't
  expired, and a one-time *nonce* (so an old token can't be replayed). Then it gives Cody its own signed session.
- The backup is the same data as on the device, saved to Upstash under the Google account id, a few seconds
  after something changes and when the app is closed. **Delete my account** removes it.
- **Premium** is free for the demo: one tap turns it on. It unlocks the colour themes (CSS variables) and
  **reviewer mastery**: quiz 45% + flashcards learned 40% + Label it! 15%.
- The privacy page and terms list every service Cody uses and what it sends there.

### Onboarding, sign-in and keeping each student's things private (`js/welcome.js`, `lib/session.js`)
- On a new device: three onboarding cards, then the sign-in screen. Nothing of Cody shows until the student
  signs in or taps **Try without an account**.
- **Each account sees only its own copy:** the server finds the copy by the Google account inside Cody's signed
  session, never by anything the browser says, so one student can't ask for another's.
- **Shared phones:** the device remembers a private *owner label* for whose things it holds. Signing out saves,
  then wipes the device. If a different account signs in, the device starts clean and never mixes the two.
- **Study rooms** need a signed-in student to make or join, and the server only answers members when anyone
  reads a room's board, messages or voice messages. Knowing a class code is not enough.
- Tests: `tests/account.test.js` (Ben can't load Ana's things) and `tests/class.test.js` (strangers and
  signed-out visitors are refused).

### Scan, languages, the bubble and Stop
- **Scan:** each photo is shrunk in the browser (to about 1400 px) and up to 8 go to the AI in one request.
- **Languages:** the student's choice is added to every AI prompt as a rule ("answer in Hiligaynon").
- **The bubble** (`js/bubble.js`) saves its talk as a normal chat, so it can continue in Ask Cody.
- **Stop** uses an `AbortController`, which cancels the request in the browser.

### Other parts
- **Android app:** the same web app wrapped with **Capacitor** (`android/`, `scripts/build-mobile.mjs`).
- **Chrome extension:** `extension/`. It reads a page only when the student clicks, and hands text to Cody
  inside the link's `#`, which browsers never send to a server.
- **Tests:** `npm test` (19 server tests, with a fake AI so no keys are needed).

## 4. Questions judges may ask (practise answering in your own words)

| Question | What to cover in your answer |
|---|---|
| What problem does Cody solve, for whom? | Filipino students review by re-reading; making study materials takes hours; Cody makes them from their own notes in seconds |
| How is it different from just using ChatGPT? | It uses the student's own notes, checks every AI answer, turns one drawing into a game, a quiz and flashcards, schedules reviews, and works as a class |
| What if the AI is wrong? | Answers are checked for shape; prompts say to stick to the notes; study guides use the more accurate model; students should still check against their notes |
| How did you use AI in building it? | AI coding tools helped write code, as the rules allow. The team decided the features, tested them, and can explain each part (this guide) |
| What's original about it? | The drawing spec that powers 4 features, Label it! on AI drawings, the class room, and the Filipino context |
| Is it safe for students? | Safety rules in every AI prompt, a class room word filter, the care response with NCMH 1553, accounts optional, a privacy page, data kept on the device unless they sign in |
| Does it work without internet? | The app opens offline after the first visit, and the example drawings work offline; making new reviewers needs internet |
| What does it cost to run? | Groq and Gemini free tiers, Vercel and Upstash free plans; Claude is an optional paid backup |
| How does the class room update live? | Polling every 2.5 s, because serverless functions can't keep a live connection |
| How do flashcards decide what comes back? | Leitner boxes: 0, 1, 3, 7, 16, 35, 70 days |
| How do you keep one student's data from another? | The server picks the copy by the signed session, not by what the browser asks for; signing out wipes the device; rooms only answer members |
| Why sign in with Google and not a password? | No passwords to store or leak; Google checks who you are; the server verifies Google's signature itself |
| What is Premium? | Free for the demo; a way Cody could earn money later (themes and mastery), while the learning itself stays free |
| What would you add next? | A live voice call in the room, a teacher view of class progress, more offline drawings |
