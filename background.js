// background.js — runs in the background, independent of popup or tabs

console.log("ai-pomodoro: background script loaded");

// ---- Constants ----

const DEFAULT_WORK_MINUTES = 15;
const DEFAULT_OPEN_MINUTES = 15;
const TICK_INTERVAL_SECONDS = 1;
const OVERRIDE_MAX_MS = 2 * 60 * 1000; // 2 minutes

// Default blocklist. Hardcoded for v1; user-defined editing is a later session.
// IMPORTANT: changes here must be mirrored in manifest.json's host_permissions.
const DEFAULT_BLOCKLIST = [
    "claude.ai",
    "chatgpt.com",
    "gemini.google.com",
    "www.perplexity.ai",
    "copilot.microsoft.com",
];

// ---- State helpers ----
// State shape:
// {
//   mode: "idle" | "work" | "open",
//   running: boolean,
//   endsAt: number (ms timestamp) | null,
//   pausedRemainingMs: number | null,
//   workMinutes: number,
//   openMinutes: number,
//   overrides: Array<{ host: string, expiresAt: number }>,
//   blocklist: Array<string>
// }

const DEFAULT_STATE = {
    mode: "idle",
    running: false,
    endsAt: null,
    pausedRemainingMs: null,
    workMinutes: DEFAULT_WORK_MINUTES,
    openMinutes: DEFAULT_OPEN_MINUTES,
    overrides: [],
    blocklist: [...DEFAULT_BLOCKLIST],
};

async function getState() {
    const result = await chrome.storage.local.get("state");
    const state = result.state || { ...DEFAULT_STATE };
    // Backfill new fields for state stored before they existed.
    if (!state.overrides) state.overrides = [];
    if (!state.blocklist) state.blocklist = [...DEFAULT_BLOCKLIST];
    return state;
}

async function setState(state) {
    await chrome.storage.local.set({ state });
}

// ---- Action functions ----

async function startSession(workMinutes, openMinutes) {
    const now = Date.now();
    const current = await getState();
    const state = {
        ...DEFAULT_STATE,
        blocklist: current.blocklist,
        mode: "work",
        running: true,
        endsAt: now + workMinutes * 60 * 1000,
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
    const state = await getState();
    await setState({
        ...DEFAULT_STATE,
        blocklist: state.blocklist,
    });
    console.log("ai-pomodoro: reset");
}

// ---- Override helpers ----

// Returns true if `host` is on the blocklist (also matches subdomains).
function isHostBlocked(host, blocklist) {
    if (!host) return false;
    return blocklist.some(
        (entry) => host === entry || host.endsWith("." + entry)
    );
}

// Returns true if `host` currently has a non-expired override.
function hasActiveOverride(host, overrides, now) {
    return overrides.some((o) => {
        if (o.expiresAt <= now) return false;
        // Match exact host OR subdomain of overridden host.
        return host === o.host || host.endsWith("." + o.host);
    });
}

// Drops expired overrides from the list.
function pruneOverrides(overrides, now) {
    return overrides.filter((o) => o.expiresAt > now);
}

// ---- Badge helpers ----
// Badge precedence: active override countdown > work block countdown > empty.

function formatBadge(ms) {
    if (ms <= 0) return "";
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    // Chrome badges fit ~4 chars. Use "M:SS" under 10 min, otherwise just minutes.
    if (minutes >= 10) return String(minutes);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ---- Auto-redirect tabs when overrides expire ----
// Called when we detect that an override just expired. Finds open tabs whose
// host matches the expired override and redirects them to the block page.

async function redirectExpiredOverrideTabs(expiredHosts, blocklist, mode, running) {
    // Only redirect if we're in a running work block; otherwise blocking is off.
    if (mode !== "work" || !running) return;
    if (expiredHosts.length === 0) return;

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.url || tab.id == null) continue;
        let host;
        try {
            host = new URL(tab.url).host;
        } catch {
            continue;
        }
        // Only redirect tabs whose host is on the blocklist AND was just overridden
        if (!isHostBlocked(host, blocklist)) continue;
        if (!expiredHosts.some((eh) => host === eh || host.endsWith("." + eh))) continue;

        const blockedUrl = chrome.runtime.getURL(
            "blocked.html?url=" + encodeURIComponent(tab.url)
        );
        chrome.tabs.update(tab.id, { url: blockedUrl });
        console.log("ai-pomodoro: redirecting expired-override tab", host);
    }
}

async function updateBadge(state, now) {
    let text = "";
    let color = "#888888";

    // Find the soonest-expiring active override
    const activeOverrides = state.overrides.filter((o) => o.expiresAt > now);
    if (activeOverrides.length > 0) {
        const soonest = activeOverrides.reduce((min, o) =>
            o.expiresAt < min.expiresAt ? o : min
        );
        text = formatBadge(soonest.expiresAt - now);
        color = "#b85c38"; // rust — matches the "warning" tone
    } else if (state.mode === "work" && state.running && state.endsAt) {
        text = formatBadge(state.endsAt - now);
        color = "#b85c38"; // rust for work mode
    } else if (state.mode === "open" && state.running && state.endsAt) {
        text = formatBadge(state.endsAt - now);
        color = "#2d5f3f"; // forest green for open mode
    }

    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
}

async function requestOverride(host) {
    const state = await getState();
    if (state.mode !== "work" || !state.endsAt) {
        return { ok: false, error: "Not in a work block" };
    }
    const now = Date.now();
    // Override expires at min(now + 2min, end of current block)
    const expiresAt = Math.min(now + OVERRIDE_MAX_MS, state.endsAt);
    // Remove any prior override for this host, then add the new one
    const filtered = state.overrides.filter((o) => o.host !== host);
    filtered.push({ host, expiresAt });
    state.overrides = filtered;
    await setState(state);
    console.log("ai-pomodoro: override granted", { host, expiresAt });
    return { ok: true, expiresAt };
}

// ---- Tick: advance mode if block ended; prune expired overrides ----

async function tick() {
    const state = await getState();
    const now = Date.now();
    let changed = false;

    // Find overrides that JUST expired (so we can redirect their tabs)
    const previouslyActive = state.overrides.filter((o) => o.expiresAt > 0);
    const stillActive = pruneOverrides(state.overrides, now);
    const expiredHosts = previouslyActive
        .filter((o) => !stillActive.some((s) => s.host === o.host))
        .map((o) => o.host);

    if (stillActive.length !== state.overrides.length) {
        state.overrides = stillActive;
        changed = true;
    }

    // Advance mode if current block ended
    if (state.running && state.mode !== "idle" && state.endsAt && now >= state.endsAt) {
        if (state.mode === "work") {
            state.mode = "open";
            state.endsAt = now + state.openMinutes * 60 * 1000;
            state.overrides = [];
        } else if (state.mode === "open") {
            state.mode = "work";
            state.endsAt = now + state.workMinutes * 60 * 1000;
        }
        changed = true;
        console.log("ai-pomodoro: mode advanced", state);
    }

    if (changed) {
        await setState(state);
    }

    // Redirect tabs whose overrides just expired
    if (expiredHosts.length > 0) {
        await redirectExpiredOverrideTabs(expiredHosts, state.blocklist, state.mode, state.running);
    }

    // Update the toolbar badge
    await updateBadge(state, now);
}

// ---- Redirect interceptor ----
// Fires on every top-level navigation. We check the URL against the blocklist
// and the current state, and redirect to the block page if needed.

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Only intercept top-level navigations (not iframes, prefetches, etc.)
    if (details.frameId !== 0) return;

    let host;
    try {
        host = new URL(details.url).host;
    } catch {
        return; // Not a parseable URL; let it through
    }

    const state = await getState();

    // Only block during a running work block
    if (state.mode !== "work" || !state.running) return;

    // Check if host is on the blocklist
    if (!isHostBlocked(host, state.blocklist)) return;

    // Check if there's an active override for this host
    if (hasActiveOverride(host, state.overrides, Date.now())) return;

    // All checks passed: redirect to block page
    const blockedUrl = chrome.runtime.getURL(
        "blocked.html?url=" + encodeURIComponent(details.url)
    );
    chrome.tabs.update(details.tabId, { url: blockedUrl });
    console.log("ai-pomodoro: blocked navigation to", host);
});


setInterval(tick, TICK_INTERVAL_SECONDS * 1000);

// ---- Message handler ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("ai-pomodoro: received message", message);

    (async () => {
        try {
            switch (message.type) {
                case "getState": {
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
                    sendResponse({ ok: true, state: await getState() });
                    break;
                }
                case "resume": {
                    await resume();
                    sendResponse({ ok: true, state: await getState() });
                    break;
                }
                case "reset": {
                    await reset();
                    sendResponse({ ok: true, state: await getState() });
                    break;
                }
                case "requestOverride": {
                    if (!message.host) {
                        sendResponse({ ok: false, error: "Missing host" });
                        break;
                    }
                    const result = await requestOverride(message.host);
                    sendResponse(result);
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

    return true;
});