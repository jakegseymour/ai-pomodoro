# AI Pomodoro

A Chrome extension that time-blocks chatbots so your first thinking is actually yours.

## What it does

You set how long your solo-thinking blocks should be, how long your AI-assist blocks should be, and how many rounds. During solo-thinking blocks, the extension blocks the major chatbots. During AI-assist blocks, everything's open and you can use the chatbots to refine what you started. After the configured rounds complete, the session ends.

If you genuinely need to break a solo-thinking block — to look up syntax, copy a snippet, or admit you're stuck — you can override per-site by typing a sentence verbatim. The override lasts 2 minutes, or until the block ends, whichever comes first. It's deliberately enough friction to make the override a real decision, not a reflex.

By default, the extension blocks claude.ai, chatgpt.com, gemini.google.com, perplexity.ai, and copilot.microsoft.com. You can add or remove sites from the settings page.

## Why I built it

Chatbots are excellent at refining ideas you've already had and bad at originating them. The more you reach for AI before forming your own take, the more your thinking starts to sound like everyone else's — because AI averages, and you can't unsee what you've already read. This extension blocks chatbots during solo-thinking blocks so you start from a blank page, then unblocks them during AI-assist blocks for refining what you started.

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
2. Set Solo minutes, Assist minutes, and Rounds. Defaults are 15 / 15 / 4.
3. Click Start session.
4. The toolbar badge shows a live countdown, rust for solo-thinking and green for AI-assist. The popup shows mode (SOLO / ASSIST), time remaining, and round progress.
5. Visiting a blocked site during a solo-thinking block redirects to a block page. To override, type the displayed sentence exactly.
6. After all rounds complete, a "Session complete" notification fires and everything unblocks.

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

MIT. See [LICENSE](./LICENSE).