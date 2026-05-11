# AI Pomodoro

A Chrome extension that enforces AI-free intervals during focused work — so you build the muscle of thinking through hard problems on your own, without reaching for Claude or ChatGPT the moment you get stuck.

## What it does

You set how many minutes you want to spend blocked from AI sites, how many minutes you want to be free, and how many rounds of this cycle to do. The extension blocks the major AI chat tools during your focus blocks and unblocks them during your open blocks. After the configured rounds complete, the session ends and everything is unblocked.

If you genuinely need to break a block — to look up syntax, copy a snippet, or admit you're stuck — you can override per-site by typing a sentence verbatim. The override lasts 2 minutes, or until the focus block ends, whichever comes first. It's deliberately enough friction to make the override a real decision, not a reflex.

By default, the extension blocks claude.ai, chatgpt.com, gemini.google.com, perplexity.ai, and copilot.microsoft.com. (Settings UI to customize this list is in development.)

## Why I built it

[edit — this paragraph should be in your voice, not mine. Suggested:]

AI tools are so good at smoothing over the "stuck" feeling that I never developed the muscle of sitting with a hard problem. The struggle is where the learning happens. If I reach for Claude every time I'm confused, I'm outsourcing the exact cognitive work I need to be doing. This extension forces honest intervals — and a deliberate, sentence-typed bypass when I really need one.

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
2. Set Work minutes, Open minutes, and Rounds. Defaults are 15 / 15 / 4.
3. Click Start.
4. The toolbar badge shows a live countdown. Mode (WORK / OPEN) and round progress are visible in the popup.
5. Visiting a blocked site during a work block redirects to a block page. To override, type the displayed sentence exactly.
6. After all rounds complete, a "Session complete" notification fires and everything unblocks.

## Tech stack

- Manifest V3 Chrome extension
- Plain HTML / CSS / JavaScript, no framework, no build step
- State persisted via `chrome.storage.local`
- Tick driven by `chrome.alarms` for service-worker reliability
- Blocking via `chrome.webNavigation.onBeforeNavigate`

## Status

Active development. Functional, used daily by the author. Not yet on the Chrome Web Store.

See [CHANGELOG.md](./v0.2.x-todo.md) for what's shipped and what's coming.

## License

[edit — pick one. MIT is the default for personal projects you don't mind others using or forking. If unsure, MIT.]