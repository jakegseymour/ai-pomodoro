// background.js — runs in the background, independent of popup or tabs

console.log("ai-pomodoro: background script loaded");

// ---- Constants ----
const DEFAULT_WORK_MINUTES = 15;
const DEFAULT_OPEN_MINUTES = 15;
const TICK_INTERVAL_SECONDS = 1;

// ---- State helpers ----
// State shape:
// {
//   mode: "idle" | "work" | "open",
//   running: boolean,
//   endsAt: number (ms timestamp) | null,
//   pausedRemainingMs: number | null,  // set when paused, used to resume
//   workMinutes: number,
//   openMinutes: number
// }

const DEFAULT_STATE = {
    mode: "idle",
    running: false,
    endsAt: null,
    pausedRemainingMs: null,
    workMinutes: DEFAULT_WORK_MINUTES,
    openMinutes: DEFAULT_OPEN_MINUTES,
};

async function getState() {
    const result = await chrome.storage.local.get("state");
    return result.state || { ...DEFAULT_STATE };
}

async function setState(state) {
    await chrome.storage.local.set({ state });
}

// ---- Public actions ----

async function startSession(workMinutes, openMinutes) {
    const now = Date.now();
    const state = {
        mode: "work",
        running: true,
        endsAt: now + workMinutes * 60 * 1000,
        pausedRemainingMs: null,
        workMinutes,
        openMinutes,
    };
    await setState(state);
    console.log("ai-pomodoro: session started", state);
}

async function pause() {
    const state = await getState();
    if (!state.running || state.mode === "idle") return;
    const remainingMs = Math.max(0, state.endsAt - Date.now());
    state.running = false;
    state.pausedRemainingMs = remainingMs;
    state.endsAt = null;
    await setState(state);
    console.log("ai-pomodoro: paused", state);
}

async function resume() {
    const state = await getState();
    if (state.running || state.mode === "idle" || state.pausedRemainingMs == null) return;
    state.running = true;
    state.endsAt = Date.now() + state.pausedRemainingMs;
    state.pausedRemainingMs = null;
    await setState(state);
    console.log("ai-pomodoro: resumed", state);
}

async function reset() {
    await setState({ ...DEFAULT_STATE });
    console.log("ai-pomodoro: reset");
}

// ---- Tick: check whether current block has ended, advance if so ----

async function tick() {
    const state = await getState();
    if (!state.running || state.mode === "idle" || state.endsAt == null) return;

    if (Date.now() >= state.endsAt) {
        // Block ended; advance to the next mode
        if (state.mode === "work") {
            state.mode = "open";
            state.endsAt = Date.now() + state.openMinutes * 60 * 1000;
        } else if (state.mode === "open") {
            state.mode = "work";
            state.endsAt = Date.now() + state.workMinutes * 60 * 1000;
        }
        await setState(state);
        console.log("ai-pomodoro: mode advanced", state);
    }
}

// ---- Set up the tick interval ----
// Note: setInterval inside a service worker is unreliable because the worker can sleep.
// We'll switch to chrome.alarms in a later session for robustness. For now, this works
// while the worker is active, and the popup will also trigger checks when it opens.
setInterval(tick, TICK_INTERVAL_SECONDS * 1000);

// ---- Message handler: how the popup talks to the background ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("ai-pomodoro: received message", message);

    // We use an async IIFE because onMessage listeners can't be async directly,
    // but we still want async/await for storage calls.
    (async () => {
        try {
            switch (message.type) {
                case "getState": {
                    // Run a tick first so the state we return is fresh
                    await tick();
                    const state = await getState();
                    sendResponse({ ok: true, state });
                    break;
                }
                case "startSession": {
                    const workMinutes = message.workMinutes ?? DEFAULT_WORK_MINUTES;
                    const openMinutes = message.openMinutes ?? DEFAULT_OPEN_MINUTES;
                    await startSession(workMinutes, openMinutes);
                    const state = await getState();
                    sendResponse({ ok: true, state });
                    break;
                }
                case "pause": {
                    await pause();
                    const state = await getState();
                    sendResponse({ ok: true, state });
                    break;
                }
                case "resume": {
                    await resume();
                    const state = await getState();
                    sendResponse({ ok: true, state });
                    break;
                }
                case "reset": {
                    await reset();
                    const state = await getState();
                    sendResponse({ ok: true, state });
                    break;
                }
                default:
                    sendResponse({ ok: false, error: "unknown message type" });
            }
        } catch (err) {
            console.error("ai-pomodoro: error handling message", err);
            sendResponse({ ok: false, error: String(err) });
        }
    })();

    // Returning true tells Chrome we'll call sendResponse asynchronously.
    return true;
});