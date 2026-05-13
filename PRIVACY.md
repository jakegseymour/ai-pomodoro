# Privacy Policy

**Effective date:** May 13, 2026

AI Pomodoro is a Chrome extension that time-blocks chatbots during user-defined work sessions. This policy explains what data the extension handles, where that data lives, and what it never does.

## Summary

AI Pomodoro does not collect, transmit, or share any of your data. All information used by the extension is stored locally on your device and never leaves it.

## What data is stored locally

The extension uses `chrome.storage.local` to persist the following on your device only:

- Your session preferences (durations and round count).
- Your configured blocklist of sites to block during solo-thinking blocks.
- Your override history: timestamps and host names of overrides you have granted during solo-thinking blocks.
- Current session state: whether a session is running, the timer's end time, which round you are in, and any active overrides.
- The timestamp of the last startup notification, used only to determine whether to show the next one.

This data persists on your device until you uninstall the extension or clear Chrome's extension storage. None of this data is transmitted to any server or shared with any third party.

## What the extension does not do

- The extension does not contact any external server. It makes no network requests of any kind.
- The extension does not use analytics, telemetry, error reporting, or any third-party service.
- The extension does not read, store, or transmit the contents of any web page you visit.
- The extension does not track your browsing history.
- The extension does not access your bookmarks, passwords, downloads, or any data outside its own storage.
- The extension does not share data with the developer or anyone else.

## Why each permission is requested

- **storage**: To save your preferences, blocklist, and session state locally on your device.
- **webNavigation**: To detect when you are navigating to a site on your blocklist during a solo-thinking block, so the extension can redirect the tab to its in-extension block page.
- **tabs**: To redirect open tabs to the block page when a session starts, and to release block pages back to their original URLs when a session pauses, resets, or ends.
- **alarms**: To run the timer reliably across the service worker's sleep cycles, as required by Chrome's Manifest V3 architecture.
- **notifications**: To display the startup prompt asking if you want to begin a session, and the notification that fires when a session completes.
- **host_permissions** for the default blocklist (claude.ai, chatgpt.com, gemini.google.com, www.perplexity.ai, copilot.microsoft.com): Required to intercept navigation to these sites during solo-thinking blocks.
- **optional_host_permissions**: When you add a custom site to your blocklist through the extension's settings page, the extension requests permission for that specific site at that moment. You see Chrome's native permission prompt and can deny it. Permissions are only granted for sites you explicitly add.

## Children

The extension is not directed at children under 13 and does not knowingly collect any information from anyone.

## Changes to this policy

If this policy is updated, the new version will be published at the same URL with an updated effective date.

## Contact

Questions or concerns about this policy can be filed as issues on the extension's GitHub repository: [github.com/jakegseymour/ai-pomodoro/issues](https://github.com/jakegseymour/ai-pomodoro/issues)