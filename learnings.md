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

## Session 3 — State machine, persistence, and the permissions model

**Timestamp-based timers are robust; counter-based timers are fragile.**
Storing `endsAt` (a fixed millisecond timestamp) and computing remaining time as `endsAt - Date.now()` survives popup closes, service worker death, browser restart, and even closing the laptop. Storing `secondsRemaining` and decrementing with setInterval breaks the moment any of those happen. This is the most important architectural decision in the project.

**Chrome APIs require explicit permissions in the manifest.**
`chrome.storage` is undefined unless `"permissions": ["storage"]` is declared. The error "Cannot read properties of undefined (reading 'local')" is the signature of a missing permission. Same pattern will apply to `chrome.notifications`, `chrome.alarms`, and `chrome.declarativeNetRequest` later.

**Read errors top-to-bottom; the first line is the actual problem.**
Stack traces look intimidating but the top line tells you what went wrong. The rest is just where. "Cannot read properties of undefined" almost always means "the thing you're trying to access wasn't initialized" — could be missing import, missing permission, missing data.

**chrome.storage.local is the persistence layer.**
Async, key-value, survives restarts. Read with `chrome.storage.local.get("key")`, write with `chrome.storage.local.set({ key: value })`. All access through `getState()`/`setState()` helpers — only one place in the file knows how state is stored, so changes are localized.

**setInterval inside a service worker is a stopgap, not a solution.**
Service workers sleep and get killed; intervals die with them. Acceptable for v1 because the popup's getState calls also trigger ticks. Will replace with `chrome.alarms` (purpose-built for "wake me up at this time") in a later session.

**onMessage listeners can't be async; use an async IIFE inside.**
Pattern: `chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { (async () => { ... })(); return true; })`. The `return true` tells Chrome to keep the message channel open for an async response. Without it, async responses get dropped.

**Render-from-state, not render-from-events.**
The popup doesn't try to track what changed. It calls `getState`, gets back the full state, and re-renders everything from scratch every second. Simpler than diffing, less prone to UI getting out of sync with data.

**Buttons should be disabled, not absent, when not applicable.**
The four buttons (Start/Pause/Resume/Reset) are always visible; their `disabled` state changes based on the mode. Keeps the UI shape constant; user always knows what's possible.

**A working UI doesn't mean a working app.**
The popup rendered fine while every getState call was silently failing in the background. Always check both consoles, not just whether the UI looks reasonable.

**Math.ceil for time display, not Math.floor.**
With 1.4s remaining, you want "00:02" until it really hits zero, not "00:01" for 1.4 seconds. ceil rounds up; floor rounds down. Wrong choice makes the timer appear to lose a second at the start of every minute.

## Session 4 — Blocking, overrides, and the badge

**`chrome.webNavigation.onBeforeNavigate` is the V3 way to intercept navigations.**
Fires before a tab loads a URL. Receive a `details` object, decide whether to redirect, and call `chrome.tabs.update` if so. The `frameId !== 0` early return skips iframes (most navigations are iframes; only the top-level page matters for blocking).

**Three-step early-return pattern keeps the listener fast and readable.**
Check mode → check blocklist → check overrides. Each is an early return. By the time you reach the redirect logic, all three conditions are satisfied. No nested ifs.

**Subdomain matching needs the leading-dot guard.**
`host.endsWith("." + entry)` matches `www.claude.ai` against `claude.ai`. Without the leading dot, `evilclaude.ai` would also match — silent security bug. The leading dot makes the boundary explicit.

**`chrome.runtime.getURL` builds extension-local URLs without hardcoding the extension ID.**
Use it instead of typing `chrome-extension://[id]/path`. The ID is environment-dependent; `getURL` resolves it correctly.

**`encodeURIComponent` is required when stuffing a URL into a query parameter.**
Otherwise the `?`, `&`, `=` in the original URL would break parsing. The receiving page uses `URLSearchParams.get()` to unwrap it cleanly.

**Per-host override state has natural pruning via tick.**
Overrides are `{host, expiresAt}` objects. Every tick, filter out the ones whose `expiresAt < now`. No special "expire override" event needed — passive cleanup.

**Detecting "just expired" overrides means diffing tick to tick.**
List of overrides at the start of tick → list after pruning → the difference is what just expired. Drives the auto-redirect of open tabs that were using those overrides.

**`chrome.tabs.query({})` lets the background see all open tabs.**
Requires the `tabs` permission. Each tab has a `url` and `id`. To force-redirect, parse the URL, check the host, then call `chrome.tabs.update(tab.id, {url: newUrl})`.

**Toolbar badges max ~4 characters.**
`chrome.action.setBadgeText({text})` and `setBadgeBackgroundColor({color})` are the badge APIs. Anything over 4 chars gets clipped. Format choices: drop seconds when ≥ 10 minutes, or use a shorter notation. (Deferred fix in v0.2.x.)

**Static state corruption survives restart and breaks silently.**
Markdown-formatted string (`[www.perplexity.ai](https://...)`) ended up in the blocklist via copy-paste mishap. Code didn't crash, just silently failed to match perplexity. Caught by directly inspecting `chrome.storage.local`. Reinforces: when state lives outside the codebase, sometimes the bug is in storage, not in code.

**`chrome.storage.local.clear()` is the nuclear-reset for persisted state.**
Useful when migrating schema or recovering from corruption. State recreates from defaults on next action.