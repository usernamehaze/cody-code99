# Cody for Chrome (desktop)

Highlight text on any page (an article, a handout, a Google Doc) and Cody turns it into a reviewer,
quiz and flashcards in the Cody web app, or draws it step by step.

- **Popup** (click the Cody icon, or press Alt+Shift+C): *Make a reviewer from this page*,
  *from what I highlighted*, or ask Cody to draw something.
- **Right-click** highlighted text: *Make a Cody reviewer from this* or *Draw "…" with Cody*.

**Install (for judges and testers):** download `Cody-extension.zip` and unzip it. Open `chrome://extensions`,
turn on **Developer mode**, click **Load unpacked**, and pick the unzipped folder.
Running Cody on your own computer (`npm run dev`)? Open the popup → Settings, and set
`http://localhost:3000`.

**Privacy:** the extension reads a page only when you click a button (Chrome's `activeTab`), has no
access to any site by itself, and sends nothing anywhere. The text is handed to the Cody app in the
link's `#` part, which browsers never send to a server, and Cody removes it from the address bar right away.
