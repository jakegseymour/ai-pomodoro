# Permission Justifications

Copy these into the Chrome Web Store submission form. Each section maps to one permission listed in `manifest.json`.

---

## storage

The extension uses `chrome.storage.local` to persist timer state, user preferences, blocklist, override history, and the timestamp of the last startup prompt. All data remains on the user's device; nothing is transmitted anywhere.

## webNavigation

The extension listens for top-level page navigations (`chrome.webNavigation.onBeforeNavigate`) to detect when the user is loading a site on their configured blocklist during a solo-thinking block. If the navigation matches a blocked host and no active override is in place, the extension redirects that tab to its in-extension block page. The listener does not inspect page content; it only checks the destination URL.

## tabs

The extension uses `chrome.tabs.query` and `chrome.tabs.update` for two purposes:
1. When a session starts (or resumes after pause, or auto-advances into a new solo-thinking block), the extension scans already-open tabs and force-redirects any whose host is on the blocklist to the block page.
2. When a session is paused, reset, or ends naturally, the extension scans for tabs currently displaying the in-extension block page and returns them to their original URLs.

The extension does not read page content, track browsing activity, or otherwise interact with tab data beyond URL inspection and redirection.

## alarms

The extension uses `chrome.alarms` to run its timer tick reliably. Service workers in Manifest V3 are killed when idle, which makes `setInterval` unreliable for long-running timers. The extension registers a 30-second alarm at install, startup, and on every service worker load. The alarm's only callback is the internal `tick()` function that checks whether the current block has ended and advances mode if so. No other use of alarms.

## notifications

The extension uses `chrome.notifications` to display two specific notifications:
1. A startup prompt notification on `chrome.runtime.onStartup`, asking the user whether they want to begin a session. Includes Yes/No buttons. Gated by a 5-hour minimum interval between prompts to prevent over-prompting.
2. A session-complete notification when the configured round count finishes, informing the user that the session is over.

No other notifications are fired. No silent or background notifications. No notifications based on browsing activity.

## host_permissions (declared)

The extension declares static `host_permissions` for the default blocklist of AI chat tools: claude.ai, chatgpt.com, gemini.google.com, www.perplexity.ai, copilot.microsoft.com. These permissions are required to intercept navigation to these sites and redirect to the block page during solo-thinking blocks. The extension does not read content from these sites; it only intercepts the navigation event.

## optional_host_permissions

The extension declares `optional_host_permissions: ["*://*/*"]` so users can add arbitrary sites to their blocklist through the in-extension settings page. When a user adds a site via the Settings UI, the extension calls `chrome.permissions.request` for that specific host in the user-gesture context of the user's click. Chrome shows its native permission prompt, and the user can grant or deny. Permissions are only ever granted for sites the user explicitly adds to their blocklist.

---

# Single-sentence versions (if the form requires brevity)

- storage: Persist timer state, preferences, blocklist, and override history locally on the user's device.
- webNavigation: Detect when the user navigates to a blocked site during a solo-thinking block and redirect to the in-extension block page.
- tabs: Redirect open tabs to/from the block page when a session starts, pauses, resets, or ends.
- alarms: Run the timer tick reliably across service worker sleep cycles (Manifest V3 requirement).
- notifications: Display the startup prompt and the session-complete notification.
- host_permissions: Required to intercept navigation on the default AI-tool blocklist.
- optional_host_permissions: Allow users to add custom sites to their blocklist via runtime permission requests.