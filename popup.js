// popup.js — runs when the popup is open

const modeEl = document.getElementById("mode");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");
const resetBtn = document.getElementById("reset");

let renderInterval = null;

// ---- Talk to the background script ----

function send(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            resolve(response);
        });
    });
}

// ---- Format time remaining as MM:SS ----

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---- Render the current state into the DOM ----

function render(state) {
    // Mode label and color
    modeEl.textContent = state.mode;
    modeEl.className = "mode " + state.mode;

    // Time remaining
    if (state.mode === "idle") {
        timeEl.textContent = "--:--";
    } else if (state.running && state.endsAt != null) {
        const remaining = state.endsAt - Date.now();
        timeEl.textContent = formatTime(remaining);
    } else if (state.pausedRemainingMs != null) {
        timeEl.textContent = formatTime(state.pausedRemainingMs);
    } else {
        timeEl.textContent = "--:--";
    }

    // Button availability based on state
    const isIdle = state.mode === "idle";
    startBtn.disabled = !isIdle;
    pauseBtn.disabled = isIdle || !state.running;
    resumeBtn.disabled = isIdle || state.running;
    resetBtn.disabled = isIdle;
}

// ---- Refresh state from background and render ----

async function refresh() {
    const response = await send({ type: "getState" });
    if (response && response.ok) {
        render(response.state);
    }
}

// ---- Button handlers ----

startBtn.addEventListener("click", async () => {
    await send({ type: "startSession", workMinutes: 15, openMinutes: 15 });
    await refresh();
});

pauseBtn.addEventListener("click", async () => {
    await send({ type: "pause" });
    await refresh();
});

resumeBtn.addEventListener("click", async () => {
    await send({ type: "resume" });
    await refresh();
});

resetBtn.addEventListener("click", async () => {
    await send({ type: "reset" });
    await refresh();
});

// ---- On popup open: render once, then re-render every second ----

refresh();
renderInterval = setInterval(refresh, 1000);

// Clean up the interval when the popup closes
window.addEventListener("unload", () => {
    if (renderInterval) clearInterval(renderInterval);
});