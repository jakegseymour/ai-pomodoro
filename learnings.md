# Learnings

A running log of concepts learned while building ai-pomodoro. Newest at the top.

---

## Session 2 — Background scripts and message passing

**Chrome extensions have multiple JavaScript contexts that don't share state.**
The popup and the background script are separate worlds. Each has its own variables, its own console, its own lifetime. They communicate by sending messages, not by reading each other's variables.

**Mental model:** popup is the front desk (where the user interacts). Background is the kitchen (where the real work happens). They pass tickets back and forth via `chrome.runtime.sendMessage` and `chrome.runtime.onMessage`.

**Service workers (Manifest V3 background scripts) sleep and restart.**
Chrome can kill a service worker to save memory. It comes back when needed (e.g. when a message arrives). This means in-memory variables in the background aren't reliable for long-term state — eventually state has to live in `chrome.storage` so it survives restarts. Not relevant yet, but coming.

**Each context has its own dev tools window.**
- Background script logs → click "service worker" link on the extension card in `chrome://extensions`
- Popup logs → right-click inside the popup and choose "Inspect" while popup is open
- They never mix. Always know which console you're looking at.

**Reload required after manifest or background changes.**
Editing `manifest.json` or `background.js` requires manually clicking the circular reload icon on the extension card in `chrome://extensions`. Popup changes don't — the popup reloads each time it opens. Forgetting to reload is the #1 source of "why isn't my change working" frustration in extension dev.

**Message convention: every message has a `type` field.**
Pattern: `{ type: "ping" }`, `{ type: "startSession", workDuration: 15 }`, etc. The background script switches on `type` to decide what to do. Establishes a clean protocol between popup and background.

**Console in DevTools has two functions: display logs, and run JS on demand.**
The bottom input line executes JavaScript when you press enter. Pasting random text there will throw a syntax error. For just reading logs, ignore the input line entirely.

---

## Session 1 — Extension fundamentals

**`manifest.json` is the entry point of every Chrome extension.**
Chrome reads it first to figure out what the extension is and what files do what. No manifest = not an extension. Required fields: `manifest_version` (always 3 for new projects), `name`, `version`, `description`.

**`action.default_popup` declares the popup HTML file.**
When the user clicks the toolbar icon, Chrome opens this file as a small window. The popup is just a tiny webpage — same HTML/CSS/JS skills as a regular site, just at smaller dimensions and with explicit width set in CSS.

**Popup needs explicit width in CSS.**
Without `body { width: 240px; }`, Chrome makes the popup weirdly narrow. Always set width.

**Loading an unpacked extension is the dev-loop equivalent of `vercel deploy`.**
1. `chrome://extensions` → toggle Developer mode on
2. "Load unpacked" → select the folder
3. Edit files → click reload icon → see changes

**Filenames in the manifest must match exactly.**
If `manifest.json` says `popup.html` and the file is named `pop.html`, Chrome silently fails. Spotted this when `ls -la` showed the wrong filename — the eye-check on every change saves time.

**`mv` does both rename and move.**
`mv pop.html popup.html` (rename) and `mv folder/ ../other/` (move) are the same command, just with different argument shapes. One of those Unix quirks worth memorizing.

**Branch naming: prefer `main` over `master`.**
Modern convention. `git branch -M main` (or `-m`) renames the current branch. GitHub creates new repos with `main` as the default; mismatching causes push errors. Worth running on every freshly-init'd repo.