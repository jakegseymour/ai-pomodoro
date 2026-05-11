// blocked.js — runs on the block page

const OVERRIDE_SENTENCE =
    "I am choosing to break my focus block and use AI right now. My ability to critically think for myself is at risk.";

const hostEl = document.getElementById("host");
const timeEl = document.getElementById("time");
const sentenceEl = document.getElementById("sentence");
const inputEl = document.getElementById("input");
const submitBtn = document.getElementById("submit");
const backBtn = document.getElementById("back");
const feedbackEl = document.getElementById("feedback");

let blockedUrl = null;
let blockedHost = null;

// ---- Read the original URL from the query string ----

function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    if (!url) return { url: null, host: null };
    try {
        const parsed = new URL(url);
        return { url, host: parsed.host };
    } catch {
        return { url: null, host: null };
    }
}

// ---- Talk to the background ----

function send(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => resolve(response));
    });
}

// ---- Format MM:SS ----

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---- Render time remaining ----

async function refreshTime() {
    const response = await send({ type: "getState" });
    if (!response || !response.ok) return;
    const state = response.state;
    if (state.mode !== "work" || !state.endsAt) {
        // Block is over (mode flipped). Send user back to original URL.
        if (blockedUrl) {
            window.location.replace(blockedUrl);
        }
        return;
    }
    const remaining = state.endsAt - Date.now();
    timeEl.textContent = formatTime(remaining);
}

// ---- Override flow ----

function normalize(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}

submitBtn.addEventListener("click", async () => {
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";

    const typed = normalize(inputEl.value);
    const expected = normalize(OVERRIDE_SENTENCE);

    if (typed !== expected) {
        feedbackEl.textContent = "That doesn't match the sentence above. Try again.";
        feedbackEl.className = "feedback error";
        return;
    }

    if (!blockedHost || !blockedUrl) {
        feedbackEl.textContent = "Couldn't determine which site to override. Try going back and reloading.";
        feedbackEl.className = "feedback error";
        return;
    }

    submitBtn.disabled = true;
    const response = await send({ type: "requestOverride", host: blockedHost });
    if (response && response.ok) {
        // Compute how long the override actually lasts (might be less than 2min if block ends sooner)
        const remainingMs = Math.max(0, response.expiresAt - Date.now());
        const minutes = Math.ceil(remainingMs / 60000);
        const seconds = Math.ceil((remainingMs % 60000) / 1000);
        const durationLabel =
            minutes > 0
                ? `${minutes} minute${minutes !== 1 ? "s" : ""}`
                : `${Math.max(1, seconds)} seconds`;
        feedbackEl.textContent = `Override granted. You have ${durationLabel}. Loading the site…`;
        feedbackEl.className = "feedback success";
        setTimeout(() => {
            window.location.replace(blockedUrl);
        }, 1200); // longer pause so the user sees the duration
    } else {
        submitBtn.disabled = false;
        feedbackEl.textContent =
            (response && response.error) || "Override failed. Try again.";
        feedbackEl.className = "feedback error";
    }
});

backBtn.addEventListener("click", () => {
    history.length > 1 ? history.back() : window.close();
});

// ---- Init ----

const { url, host } = parseQuery();
blockedUrl = url;
blockedHost = host;

if (host) {
    hostEl.textContent = host;
}
sentenceEl.textContent = OVERRIDE_SENTENCE;

refreshTime();
setInterval(refreshTime, 1000);