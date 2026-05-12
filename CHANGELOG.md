# Changelog

Tracked fixes and features across versions. Newest at the top.

## v0.3.0 — Round-count and structural changes

- ~~Round count not configurable; sessions cycled infinitely.~~ Done. State now tracks `rounds` (target) and `currentRound` (counter). Popup has a Rounds input (1-20, default 4). Session ends after the configured rounds complete. End-of-session notification fires with completion count. Reset preserves last-used `rounds` alongside duration prefs.
- ~~"One round" semantics ambiguous.~~ Decided: one round = one work block + one open block (full pair). Session ends after the final open block completes.

## v0.2.4 — Override symmetry and startup prompt (session 8)

- ~~Override symmetry: overriding `claude.ai` covered `www.claude.ai` but not the reverse.~~ Done. `hasActiveOverride` now treats hostnames symmetrically — any subdomain relationship in either direction counts as a match.
- ~~Multiple overrides for related hosts cluttered the popup.~~ Done. Overrides for related hosts now merge into one canonical entry using the more general (shorter) host name.
- ~~Override didn't release related-host block pages.~~ Done. Granting an override now scans open tabs and releases any block pages whose original URL is on a related host.
- ~~No startup prompt as specced.~~ Done. `chrome.runtime.onStartup` triggers a desktop notification asking to start a session. Yes button starts session with last-used settings. 5-hour recency gate prevents re-prompting on quick Chrome restarts. Session-in-progress check prevents prompting during active sessions.

## v0.2.3 — Icon and gitignore

- ~~No extension icon.~~ Done. Custom 128x128 icon (rust tomato can with "AI" label) declared in manifest and used for notifications. (Future: render at 16/32/48 sizes for crisper toolbar display.)
- ~~Missing .gitignore.~~ Done. Local plus global gitignore for `.DS_Store`.

## v0.2.2 — Bug-bash from real testing (session 7)

- ~~Time-picker in popup.~~ Done. Two number inputs at popup top, validated 1-60 integers.
- ~~Override duration label off-by-one.~~ Done. `Math.ceil` instead of `Math.floor`.
- ~~Override timer drained on wall clock during pause.~~ Done. Pause freezes overrides; resume restores them with full remaining time.
- ~~Reset wiped duration preferences.~~ Done. Reset preserves `workMinutes` and `openMinutes`.
- ~~`previouslyActive` variable misnamed.~~ Done.

## v0.2.1 — Polish (session 5)

- ~~Badge format ≥ 10 minutes.~~ Done. Minutes-only above 10, MM:SS below.
- ~~Subdomain override mismatch.~~ Done.
- ~~Popup didn't show active overrides.~~ Done.

## v0.2.0 — Blocking core (session 4)

- Blocking via `chrome.webNavigation`. Override with sentence + per-host expiry. Badge countdowns. Auto-redirect on override expiry. Tab enforcement on session state changes.

## Outstanding

### Required before Chrome Web Store publish

- **Override sentence customization.** Deferred from v0.4.0 — out of scope for the settings UI session. May not be needed for v1.0.
- **Block paste in override textbox.** Currently copy-paste-able, which defeats the friction. Final step before submission to keep testing fast.
- **Privacy policy hosted publicly.** Required for store with current permission set. GitHub Pages is the easy host.
- **Chrome Web Store developer account.** $5 one-time.
- **Store listing assets.** Screenshots (likely popup mid-session, block page, options page), description, promotional tile, permission justifications.
- **Final pause decision.** Currently kept; semantics documented in code. May remove before v1.0 if it stays unused in practice.

### Quality of life

- **30-second tick granularity feels laggy.** Real trade-off of the alarms migration. Hybrid (alarms + popup-driven setInterval) is an option if needed.
- **Badge "PAUS" truncated.** 4-char limit. Could use pause emoji.
- **Pause behavior under review.** Currently clears block pages. May want to preserve them with frozen countdown.
- **Subdomain matching of edge-case domains** (bbc.co.uk type hierarchies) is naive — fine for AI sites, not general-purpose.

### Future feature ideas

- Long-break-every-4-rounds (classic Pomodoro pattern; optional).
- Session history / override log for self-reflection.
- Per-day stats / streaks.
- Hosting privacy policy on jakeseymourg.com once the domain is live.

## v0.4.1 — Discoverability of settings page

- ~~Options page invisible to users who don't right-click the icon or know about chrome://extensions.~~ Done. "Modify blocked sites" link added to popup footer, opens options page in a new tab via `chrome.runtime.openOptionsPage()`. Small low-priority styling so it doesn't compete with the main controls.

## v0.4.0 — Settings UI for blocklist

- ~~Blocklist hardcoded; users couldn't add their own AI sites.~~ Done. New options page (`options.html` + `options.js`) with a form to view, add, and remove blocked hosts. Add input is permissive — accepts hostnames, full URLs, paths, mixed case — and normalizes to lowercased hostname before storing.
- ~~`chrome.permissions.request()` failed with "must be called during a user gesture" when called from the background script.~~ Done. Permission requests now happen in `options.js` directly inside the Add button's click handler, where the user gesture is still in scope. Background script only handles state mutation. Same logic, different ownership — permission flow lives in the UI layer, state flow lives in the background.
- ~~Default sites (claude.ai, chatgpt.com, gemini.google.com, www.perplexity.ai, copilot.microsoft.com) need to be removable or not?~~ Decided: immutable. Locked icon (🔒) in the UI, no Remove button. Defaults are baked into manifest's `host_permissions` and pre-populated in default state.
- Manifest declares `optional_host_permissions: ["*://*/*"]` so users can grant access to arbitrary sites at runtime. Each new site triggers Chrome's native permission prompt.
- `options_page` field in manifest registers the page with Chrome (shows up in right-click extension menu, `chrome://extensions` Details panel).