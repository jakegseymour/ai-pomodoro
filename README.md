# AI Pomodoro

A Chrome extension that time-blocks chatbots so your first thinking is actually yours.

## What it does

You set how long you want chatbots blocked, hit start, and they're blocked. When time's up, everything unblocks. That's Simple mode — the default.

If you want more structure, there's a Cycles mode that alternates between solo-thinking blocks and AI-assist blocks across multiple rounds.

If you genuinely need to break a block — to look up syntax, copy a snippet, or admit you're stuck — you can override per-site by typing a sentence verbatim. The override lasts 2 minutes. It's deliberately enough friction to make the override a real decision, not a reflex.

By default, the extension blocks claude.ai, chatgpt.com, gemini.google.com, perplexity.ai, and copilot.microsoft.com. You can add or remove sites from the settings page.

## Why I built it

Chatbots are excellent at refining ideas you've already had and bad at originating them. The more you reach for AI before forming your own take, the more your thinking starts to sound like everyone else's — because AI averages, and you can't unsee what you've already read. This extension blocks chatbots so you start from a blank page.

Solo first, AI after.

## Install (development build)

Until this is on the Chrome Web Store, install manually:

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked**.
5. Select the `ai-pomodoro` folder.
6. Click the AI Pomodoro icon in your Chrome toolbar to start a session.

## Use

1. Click the extension icon.
2. Default is Simple mode: set how many minutes to block AI, hit Start session.
3. For Cycles mode, click the Cycles tab. Set Solo, Assist, and Rounds durations.
4. The toolbar badge shows a live countdown — rust for solo-thinking, green for AI-assist.
5. Visiting a blocked site during a solo-thinking block redirects to a block page. To override, type the displayed sentence exactly.
6. When the session ends, a "Session complete" notification fires and everything unblocks.

## Tech stack

- Manifest V3 Chrome extension
- Plain HTML / CSS / JavaScript, no framework, no build step
- State persisted via `chrome.storage.local`
- Tick driven by `chrome.alarms` for service-worker reliability
- Blocking via `chrome.webNavigation.onBeforeNavigate`

## Status

Active development. Functional, used daily by the author. Not yet on the Chrome Web Store.

See [CHANGELOG.md](./CHANGELOG.md) for what's shipped and what's coming.

## License

[GNU Affero General Public License v3.0](./LICENSE).

If you modify this code and run it as a network service, you must make your modifications available under the same license. See [LICENSE](./LICENSE) for full terms.