// background.js — runs in the background, independent of popup or tabs

console.log("ai-pomodoro: background script loaded");

// ---- Constants ----

const DEFAULT_WORK_MINUTES = 15;
const DEFAULT_OPEN_MINUTES = 15;
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
    lastPromptedAt: null,
};

async function getState() {
    const result = await chrome.storage.local.get("state");
    const state = result.state || { ...DEFAULT_STATE };
    if (!state.overrides) state.overrides = [];
    if (!state.blocklist) state.blocklist = [...DEFAULT_BLOCKLIST];
    if (state.lastPromptedAt === undefined) state.lastPromptedAt = null;
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
    await blockOpenTabs(state);
}

async function pause() {
    const state = await getState();
    if (!state.running || state.mode === "idle") return;
    const now = Date.now();
    const remainingMs = Math.max(0, state.endsAt - now);
    state.running = false;
    state.pausedRemainingMs = remainingMs;
    state.endsAt = null;
    // Freeze active overrides into a paused form so they don't expire on wall clock.
    state.overrides = state.overrides.map((o) => {
        if (o.expiresAt != null) {
            const overrideRemaining = Math.max(0, o.expiresAt - now);
            return { host: o.host, pausedRemainingMs: overrideRemaining };
        }
        return o;
    });
    await setState(state);
    console.log("ai-pomodoro: paused", state);
    await clearBlockPages();
}

async function resume() {
    const state = await getState();
    if (state.running || state.mode === "idle" || state.pausedRemainingMs == null) return;
    const now = Date.now();
    state.running = true;
    state.endsAt = now + state.pausedRemainingMs;
    state.pausedRemainingMs = null;
    // Unfreeze paused overrides into active form.
    state.overrides = state.overrides.map((o) => {
        if (o.pausedRemainingMs != null) {
            return { host: o.host, expiresAt: now + o.pausedRemainingMs };
        }
        return o;
    });
    await setState(state);
    console.log("ai-pomodoro: resumed", state);
    await blockOpenTabs(state);
}

async function reset() {
    const state = await getState();
    await setState({
        ...DEFAULT_STATE,
        blocklist: state.blocklist,
        workMinutes: state.workMinutes,
        openMinutes: state.openMinutes,
    });
    console.log("ai-pomodoro: reset");
    await clearBlockPages();
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
        if (!isStillValid(o, now)) return false;
        return hostsMatch(host, o.host);
    });
}

// Two hosts match if they are equal, or one is a subdomain of the other.
function hostsMatch(a, b) {
    if (a === b) return true;
    if (a.endsWith("." + b)) return true; // a is a subdomain of b
    if (b.endsWith("." + a)) return true; // b is a subdomain of a
    return false;
}

// Of two related hosts, return the more general (shorter) one.
// Assumes hostsMatch(a, b) is true.
function moreGeneralHost(a, b) {
    if (a === b) return a;
    // If a is a subdomain of b, b is more general. Vice versa.
    return a.length < b.length ? a : b;
}

function isStillValid(override, now) {
    if (override.pausedRemainingMs != null) return true; // paused, frozen
    return override.expiresAt > now;
}

// Drops expired overrides from the list.
function pruneOverrides(overrides, now) {
    return overrides.filter((o) => {
        if (o.pausedRemainingMs != null) return true;
        return o.expiresAt > now;
    });
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

// ---- Tab-side enforcement helpers ----

// Force any currently-open tab whose host is on the blocklist (and not overridden)
// to navigate to the block page. Used when a session starts.
async function blockOpenTabs(state) {
    if (state.mode !== "work" || !state.running) return;
    const now = Date.now();
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.url || tab.id == null) continue;
        let host;
        try {
            host = new URL(tab.url).host;
        } catch {
            continue;
        }
        if (!isHostBlocked(host, state.blocklist)) continue;
        if (hasActiveOverride(host, state.overrides, now)) continue;
        // Skip tabs already on our block page so we don't loop.
        if (tab.url.startsWith(chrome.runtime.getURL(""))) continue;

        const blockedUrl = chrome.runtime.getURL(
            "blocked.html?url=" + encodeURIComponent(tab.url)
        );
        chrome.tabs.update(tab.id, { url: blockedUrl });
        console.log("ai-pomodoro: blocked open tab", host);
    }
}

// Release any block-page tabs whose original URL is for a host related to
// `overrideHost`. Used after granting an override to free related open tabs.
async function releaseRelatedBlockPages(overrideHost) {
    const blockPagePrefix = chrome.runtime.getURL("blocked.html");
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.url || tab.id == null) continue;
        if (!tab.url.startsWith(blockPagePrefix)) continue;
        try {
            const params = new URL(tab.url).searchParams;
            const original = params.get("url");
            if (!original) continue;
            const originalHost = new URL(original).host;
            if (!hostsMatch(originalHost, overrideHost)) continue;
            chrome.tabs.update(tab.id, { url: original });
            console.log("ai-pomodoro: released related block page for", originalHost);
        } catch {
            // ignore
        }
    }
}

// Find any open tab currently sitting on our block page and send it back
// to the original URL. Used when a session pauses or resets.
async function clearBlockPages() {
    const blockPagePrefix = chrome.runtime.getURL("blocked.html");
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.url || tab.id == null) continue;
        if (!tab.url.startsWith(blockPagePrefix)) continue;
        // Extract the original URL from the query string.
        try {
            const params = new URL(tab.url).searchParams;
            const original = params.get("url");
            if (!original) continue;
            chrome.tabs.update(tab.id, { url: original });
            console.log("ai-pomodoro: cleared block page, returning to", original);
        } catch {
            // ignore
        }
    }
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

    // Paused state takes precedence — show PAUS regardless of overrides.
    if (state.mode !== "idle" && !state.running) {
        text = "PAUS";
        color = "#888888";
        await chrome.action.setBadgeText({ text });
        await chrome.action.setBadgeBackgroundColor({ color });
        return;
    }

    // Find the soonest-expiring ACTIVE (non-paused) override
    const activeOverrides = state.overrides.filter(
        (o) => o.expiresAt != null && o.expiresAt > now
    );
    if (activeOverrides.length > 0) {
        const soonest = activeOverrides.reduce((min, o) =>
            o.expiresAt < min.expiresAt ? o : min
        );
        text = formatBadge(soonest.expiresAt - now);
        color = "#b85c38";
    } else if (state.mode === "work" && state.running && state.endsAt) {
        text = formatBadge(state.endsAt - now);
        color = "#b85c38";
    } else if (state.mode === "open" && state.running && state.endsAt) {
        text = formatBadge(state.endsAt - now);
        color = "#2d5f3f";
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
    const expiresAt = Math.min(now + OVERRIDE_MAX_MS, state.endsAt);

    // Find any existing override on a related host (subdomain in either direction).
    // Collapse all related entries into one canonical entry using the more general host.
    let canonicalHost = host;
    const unrelatedOverrides = [];
    for (const o of state.overrides) {
        if (hostsMatch(o.host, host)) {
            canonicalHost = moreGeneralHost(canonicalHost, o.host);
        } else {
            unrelatedOverrides.push(o);
        }
    }

    unrelatedOverrides.push({ host: canonicalHost, expiresAt });
    state.overrides = unrelatedOverrides;
    await setState(state);
    console.log("ai-pomodoro: override granted", { host: canonicalHost, expiresAt });

    // Release any block-page tabs whose original URL is for a related host.
    await releaseRelatedBlockPages(canonicalHost);

    return { ok: true, expiresAt };
}



// ---- Tick: advance mode if block ended; prune expired overrides ----

async function tick() {
    const state = await getState();
    const now = Date.now();
    let changed = false;

    // Find overrides that JUST expired (so we can redirect their tabs)
    // Only active (non-paused) overrides can expire.
    const previouslyActive = state.overrides.filter((o) => o.expiresAt != null);
    const stillActive = pruneOverrides(state.overrides, now);
    const expiredHosts = previouslyActive
        .filter((o) => !stillActive.some((s) => s.host === o.host))
        .map((o) => o.host);

    if (stillActive.length !== state.overrides.length) {
        state.overrides = stillActive;
        changed = true;
    }

    // Advance mode if current block ended
    let justEnteredOpen = false;
    let justEnteredWork = false;
    if (state.running && state.mode !== "idle" && state.endsAt && now >= state.endsAt) {
        if (state.mode === "work") {
            state.mode = "open";
            state.endsAt = now + state.openMinutes * 60 * 1000;
            state.overrides = [];
            justEnteredOpen = true;
        } else if (state.mode === "open") {
            state.mode = "work";
            state.endsAt = now + state.workMinutes * 60 * 1000;
            justEnteredWork = true;
        }
        changed = true;
        console.log("ai-pomodoro: mode advanced", state);
    }

    if (changed) {
        await setState(state);
    }

    // If a work block just ended, clear existing block pages.
    if (justEnteredOpen) {
        await clearBlockPages();
    }
    // If a new work block just started, block any currently-open tabs on the blocklist.
    if (justEnteredWork) {
        await blockOpenTabs(state);
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

// ---- Startup prompt ----
// On Chrome startup, fire a desktop notification asking the user if they want
// to start a session. Gated by a minimum interval (5 hours) so it doesn't
// fire on every micro-restart of Chrome.

const STARTUP_PROMPT_NOTIFICATION_ID = "ai-pomodoro-startup";
const STARTUP_PROMPT_MIN_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 hours

async function maybeShowStartupPrompt() {
    const state = await getState();

    // Don't prompt if a session is already running.
    if (state.mode !== "idle") {
        console.log("ai-pomodoro: skipping startup prompt; session in progress");
        return;
    }

    const now = Date.now();
    if (
        state.lastPromptedAt != null &&
        now - state.lastPromptedAt < STARTUP_PROMPT_MIN_INTERVAL_MS
    ) {
        const minutesAgo = Math.floor((now - state.lastPromptedAt) / 60000);
        console.log(`ai-pomodoro: skipping startup prompt; last prompted ${minutesAgo} min ago`);
        return;
    }

    // Update lastPromptedAt before firing so we don't double-prompt on a race.
    state.lastPromptedAt = now;
    await setState(state);

    chrome.notifications.create(STARTUP_PROMPT_NOTIFICATION_ID, {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon.png"),
        title: "Start a focus session?",
        message: `Work ${state.workMinutes} min / open ${state.openMinutes} min, repeating.`,
        buttons: [
            { title: "Yes, start now" },
            { title: "Not now" },
        ],
        requireInteraction: true,
    });

    console.log("ai-pomodoro: startup prompt fired");
}

// Handle clicks on notification buttons.
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (notificationId !== STARTUP_PROMPT_NOTIFICATION_ID) return;

    // Clear the notification regardless of which button was clicked.
    chrome.notifications.clear(STARTUP_PROMPT_NOTIFICATION_ID);

    if (buttonIndex === 0) {
        // "Yes, start now" — start a session with last-used durations.
        const state = await getState();
        await startSession(state.workMinutes, state.openMinutes);
        console.log("ai-pomodoro: session started from startup prompt");
    }
    // buttonIndex === 1 ("Not now") — already cleared; do nothing.
});

// Also clear if the user dismisses without clicking a button.
chrome.notifications.onClosed.addListener((notificationId) => {
    if (notificationId === STARTUP_PROMPT_NOTIFICATION_ID) {
        console.log("ai-pomodoro: startup prompt dismissed");
    }
});

// ---- Alarm-based tick ----
// Service workers can be killed by Chrome at any time; setInterval dies with them.
// chrome.alarms is registered at the browser level and survives worker death.
// Minimum interval is 30 seconds in production extensions.

const TICK_ALARM_NAME = "ai-pomodoro-tick";

async function registerTickAlarm() {
    // Calling create() with the same name updates an existing alarm. Safe to re-call.
    await chrome.alarms.create(TICK_ALARM_NAME, { periodInMinutes: 0.5 });
    console.log("ai-pomodoro: tick alarm registered");
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TICK_ALARM_NAME) {
        tick();
    }
});

// Register on installation, on browser startup, and on every script load (idempotent).
chrome.runtime.onInstalled.addListener(() => {
    registerTickAlarm();
});

chrome.runtime.onStartup.addListener(() => {
    registerTickAlarm();
    maybeShowStartupPrompt();
});

// Also call once on script load. Harmless if alarm already exists.
registerTickAlarm();

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