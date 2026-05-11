# v0.2.x todo

Small fixes deferred from session 4. Newest at the top.

## Completed (session 6)

- ~~Service worker tick reliability.~~ Done. Migrated from `setInterval` to `chrome.alarms` with 30-second cadence. Alarm registered on `onInstalled`, `onStartup`, and script load (idempotent). Survives service worker death.

- ~~Existing tabs don't get blocked when session starts.~~ Done. `blockOpenTabs` scans open tabs and redirects blocklisted ones to the block page. Called on `startSession`, `resume`, and when tick auto-advances into work mode.

- ~~Block pages don't clear on pause/reset/auto-advance to open.~~ Done. `clearBlockPages` returns block-page tabs to their original URL. Called on `pause`, `reset`, and when tick auto-advances into open mode.

## Completed (session 5)

- ~~Badge format ≥ 10 minutes.~~ Done. Shows minutes-only above 10, MM:SS below.
- ~~Subdomain override mismatch.~~ Done. `hasActiveOverride` now applies the same subdomain logic as `isHostBlocked` — overriding a root domain covers its subdomains.
- ~~Popup didn't show active overrides.~~ Done. Popup now displays active overrides with host + countdown, sorted by soonest expiring. Auto-hides when none active.

## Outstanding

- **30-second granularity trade-off.** `chrome.alarms` minimum interval is 30 seconds. Mode transitions and override expirations can lag by up to 30 seconds. Acceptable for the tool's purpose. Document, don't fix.

- **Override symmetry.** Overriding a root (`claude.ai`) covers subdomains (`www.claude.ai`). The reverse doesn't. Consistent with `isHostBlocked` behavior, but worth flagging if users complain.

- **`previouslyActive` variable in `tick` is misleadingly named.** Currently filters `o.expiresAt > 0`, which is all overrides in practice. Logic works correctly but variable name suggests "active before this tick" which isn't what it does. Rename when next touched.