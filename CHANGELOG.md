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

- **Settings UI for blocklist editing.** Currently hardcoded in `background.js` + `manifest.json` host_permissions. Required for store; users can't customize what's blocked.
- **Override sentence customization.** Currently hardcoded; original spec called for user-editable.
- **Privacy policy hosted publicly.** Required for store with current permission set.
- **Chrome Web Store developer account.** $5 one-time.
- **Store listing assets.** Screenshots, description, permission justifications.
- **README.md.** Repo has none.
- **Icon at 16, 32, 48 sizes.** Have 128; Chrome scales but looks fuzzy.

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