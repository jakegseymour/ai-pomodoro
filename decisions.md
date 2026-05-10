# Decisions

Locked design decisions for ai-pomodoro. Each entry: the decision, the reasoning, and what was considered and rejected.

---

## Project shape

**Browser extension, not a webpage.**
The whole point is to keep running in the background regardless of which tab is focused, with the ability to intercept site loads. A webpage can't do that. Chrome extension format gives us all the primitives we need.

**Manifest V3, Chrome target.**
V3 is the current standard; V2 is being deprecated. Chrome is primary; the extension will work in Edge/Brave/Arc since they share the format. Firefox is similar but has differences — not in scope for v1.

**Plain HTML/CSS/JS. No framework, no build step.**
Same stack as the personal site. The complexity is in the extension architecture (manifest, background, message passing) and Chrome APIs, not in framework choice. Adding React or a bundler now would obscure what's actually new.

---

## Block strength

**Medium block: site replacement during focus periods.**
Visiting a blocked site during a focus block redirects to a block page. No easy bypass button.

**Override mechanism: type a fixed sentence (exact match, case-insensitive).**
The friction is meaningful enough to defeat reflexive AI-reaches but not so high it becomes punitive. Override applies only to that block period; doesn't end the session.

Considered and rejected:
- **Soft block (visual nudge with bypass button):** too easily ignored. Not a real commitment device.
- **Hard block (must disable extension to bypass):** too binary. Once disabled, hard to remember to re-enable. The in-extension override is more graceful.
- **Wait-it-out timer override:** friction without meaning. Typing a sentence forces a moment of articulation.
- **State a reason in 50+ characters:** good idea, more meaningful, but heavier than what's needed for v1. Possible v2 upgrade.
- **Solve a puzzle:** punitive without being reflective.

**Build the override mechanism with a seam for future customization.**
v1 ships with a fixed sentence. Future settings option lets users change the sentence to their own. Architecture supports it from day one without making it a v1 feature.

---

## Schedule and cycle

**Set time blocked / time open at session start, not in advance.**
Each session you choose durations. Defaults remember your last choice; one click to change.

**Manual start, not fixed schedule.**
You click "start session" when ready. v2 may add a fixed-schedule mode (e.g. always block during :00–:15 of every hour), but v1 is fully on-demand.

**Auto-advance: blocks and open periods alternate continuously.**
Once a session starts, blocks and open periods cycle automatically until you stop. Matches the rhythm of the original idea ("15 minutes every 30 minutes").

**Default: 15 min blocked, 15 min open.**
Configurable. Likely to be tuned through use. Defaults are a starting point, not a prescription.

---

## Startup behavior

**Desktop notification on Chrome launch asking "Start a session?"**
Triggered by `chrome.runtime.onStartup`. User can say yes or no. If yes, popup opens for time selection (with last-used values pre-filled).

Considered and rejected:
- **Toolbar badge as the prompt:** too subtle. The whole point is "noticeable but unobtrusive" — desktop notification fits better.
- **Auto-start on launch:** too aggressive. The user should always opt in to a session.

---

## Blocklist

**User-defined, with sensible AI-site defaults pre-populated.**
Default list: claude.ai, chatgpt.com, gemini.google.com, perplexity.ai, copilot.microsoft.com. User can add, remove, or edit through a settings page.

**Why user-defined:** the AI landscape changes fast. New tools appear constantly. A hardcoded list goes stale. The user knows what they actually reach for.

**Out of scope: blocking AI features embedded in non-AI products.**
Notion AI, Linear AI, Gmail Smart Compose, etc. Blocking these would require either blocking the entire host product (too disruptive) or DOM manipulation per-site (huge maintenance burden). v1 covers primary AI chat interfaces only. Acknowledged limitation.

---

## Persistence

**State survives browser restart.**
A focus session in progress when Chrome closes resumes when Chrome opens. Implemented via `chrome.storage`, not in-memory variables, because service workers can be killed and restarted by Chrome at any time.

---

## Coverage limitations (acknowledged, not solved)

**Browser-only.** Cannot block desktop AI apps (Claude desktop, ChatGPT desktop, Cursor, Claude Code). Mitigation: don't install desktop AI apps; keep AI usage in the browser where the extension governs. macOS Screen Time can supplement for desktop coverage if desired. v2 may expose extension state to a system-level companion tool.

**No mobile support.** Chrome extensions don't run on mobile. Out of scope.

---

## Naming and identity

**Name: `ai-pomodoro`.**
Folder name, repo name, display name (capitalized as "AI Pomodoro" in the manifest). Plain and descriptive over evocative — this is a personal-use tool, not a product I'm marketing.

**Repo: private.**
Personal-discipline tool, not a portfolio piece. No reason to be public. Can flip to public later if it becomes interesting to others.

**GitHub handle: `jakegseymour`.**
Same as personal site. Documented in personal site decisions.md; same applies here.

## Session 4 — Blocking architecture

**Blocking via `chrome.webNavigation` + `chrome.tabs.update`, not `declarativeNetRequest`.**
DNR is the modern V3 path but requires syncing a rules database with timer state. webNavigation puts all blocking logic alongside the existing state machine — simpler for v1. May migrate later for performance/privacy if the extension goes wider.

**Block page is a regular HTML file declared as `web_accessible_resources`.**
Not an extension popup, not a content script. Tabs get redirected here. The original URL travels as a query parameter so the page knows what to display and where to send the user back to after override.

**Override scope: per-host, expires at `min(now + 2min, endOfBlock)`.**
Each bypass is an isolated decision. 2-minute fixed cap keeps friction repeatable; end-of-block cap prevents overrides leaking across natural boundaries.

**Override sentence (v1, hardcoded):**
"I am choosing to break my focus block and use AI right now. My ability to critically think for myself is at risk."
The second sentence names the actual stake. Match is case-insensitive, whitespace-normalized, otherwise strict.

**Auto-redirect on override expiry, target = block page with original URL.**
When override expires, the tab gets force-redirected to the block page. Original URL travels as a query param so a re-override lands the user back where they were. Most ergonomic of the three options considered (alternatives: bare block page, close tab).

**Toolbar badge precedence: active override countdown > work block countdown > open period countdown > empty.**
Badge always shows the most-actionable countdown. Override (urgent) wins. Color: rust for override and work, forest green for open.

**Badge format under 10 minutes: `M:SS`. Above 10 minutes: deferred fix.**
Currently shows `10:00` clipped at 4 chars. Acceptable for v1; will fix in v0.2.x.

**Blocklist hardcoded in `background.js` AND mirrored in `manifest.json` `host_permissions`.**
Two-file dependency flagged in code comments. User-defined blocklist editing deferred to a settings UI in a later session — that work will need to update both places.

**State migration handled via backfills in `getState`, not formal migrations.**
When new fields appear in `DEFAULT_STATE`, `getState` checks for missing fields and fills them with defaults. Acceptable while schema is small and changes are additive. Real migration framework is overkill for v1.