// pause.js — runs on the pause friction page

const PAUSE_SENTENCE =
    "I am pausing my session. I will resume it, not abandon it.";

const timeEl = document.getElementById("time");
const sentenceEl = document.getElementById("sentence");
const inputEl = document.getElementById("input");
const submitBtn = document.getElementById("submit");
const backBtn = document.getElementById("back");
const feedbackEl = document.getElementById("feedback");

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

    // If the session is no longer active, this page has no purpose. Close it.
    if (state.mode === "idle") {
        window.close();
        return;
    }

    // If the session is already paused (user opened pause page, then paused
    // some other way), close — nothing to do here.
    if (state.pausedRemainingMs != null) {
        window.close();
        return;
    }

    // Figure out remaining time. Mirror popup logic.
    let remainingMs;
    if (state.endsAt != null) {
        remainingMs = state.endsAt - Date.now();
    } else if (state.overridePausedRemainingMs != null) {
        remainingMs = state.overridePausedRemainingMs;
    } else {
        timeEl.textContent = "--:--";
        return;
    }

    timeEl.textContent = formatTime(remainingMs);
}

// ---- Friction: block paste/drop/right-click/keyboard paste ----

function normalize(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function showPasteBlocked() {
    feedbackEl.textContent = "Type the sentence; don't paste.";
    feedbackEl.className = "feedback error";
}

inputEl.addEventListener("paste", (e) => {
    e.preventDefault();
    showPasteBlocked();
});

inputEl.addEventListener("drop", (e) => {
    e.preventDefault();
    showPasteBlocked();
});

inputEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

inputEl.addEventListener("keydown", (e) => {
    const isPasteShortcut =
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") ||
        (e.shiftKey && e.key === "Insert");
    if (isPasteShortcut) {
        e.preventDefault();
        showPasteBlocked();
    }
});

// ---- Submit ----

submitBtn.addEventListener("click", async () => {
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";

    const typed = normalize(inputEl.value);
    const expected = normalize(PAUSE_SENTENCE);

    if (typed !== expected) {
        feedbackEl.textContent = "That doesn't match the sentence above. Try again.";
        feedbackEl.className = "feedback error";
        return;
    }

    submitBtn.disabled = true;
    const response = await send({ type: "pause" });
    if (response && response.ok) {
        feedbackEl.textContent = "Paused. Closing…";
        feedbackEl.className = "feedback success";
        setTimeout(() => {
            window.close();
        }, 800);
    } else {
        submitBtn.disabled = false;
        feedbackEl.textContent =
            (response && response.error) || "Pause failed. Try again.";
        feedbackEl.className = "feedback error";
    }
});

backBtn.addEventListener("click", () => {
    window.close();
});

// ---- Init ----

sentenceEl.textContent = PAUSE_SENTENCE;
refreshTime();
setInterval(refreshTime, 1000);