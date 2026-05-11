// popup.js — runs when the popup is open

const modeEl = document.getElementById("mode");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");
const resetBtn = document.getElementById("reset");
const overridesEl = document.getElementById("overrides");
const workInput = document.getElementById("work-input");
const openInput = document.getElementById("open-input");

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

    // Active overrides
    renderOverrides(state.overrides || []);

    // Disable inputs when not idle. Values are seeded once on popup open
    // (see one-time init at bottom of file), then owned by the user until Start.
    const isIdle = state.mode === "idle";
    workInput.disabled = !isIdle;
    openInput.disabled = !isIdle;

    // Button availability based on state
    startBtn.disabled = !isIdle;
    pauseBtn.disabled = isIdle || !state.running;
    resumeBtn.disabled = isIdle || state.running;
    resetBtn.disabled = isIdle;
}

function renderOverrides(overrides) {
    const now = Date.now();
    const visible = overrides.filter((o) => {
        if (o.pausedRemainingMs != null) return true;
        return o.expiresAt > now;
    });
    if (visible.length === 0) {
        overridesEl.innerHTML = "";
        return;
    }
    // Sort: active by soonest expiring first, then paused at end
    visible.sort((a, b) => {
        const aPaused = a.pausedRemainingMs != null;
        const bPaused = b.pausedRemainingMs != null;
        if (aPaused && !bPaused) return 1;
        if (!aPaused && bPaused) return -1;
        if (aPaused && bPaused) return 0;
        return a.expiresAt - b.expiresAt;
    });
    overridesEl.innerHTML = visible
        .map((o) => {
            const isPaused = o.pausedRemainingMs != null;
            const label = isPaused ? "PAUSED" : formatTime(o.expiresAt - now);
            return `
        <div class="override-row">
          <span class="override-host">${escapeHtml(o.host)}</span>
          <span class="override-time">${label}</span>
        </div>
      `;
        })
        .join("");
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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
    // Validate inputs
    const workMinutes = parseInt(workInput.value, 10);
    const openMinutes = parseInt(openInput.value, 10);

    const workValid = Number.isInteger(workMinutes) && workMinutes >= 1 && workMinutes <= 60;
    const openValid = Number.isInteger(openMinutes) && openMinutes >= 1 && openMinutes <= 60;

    // Visual feedback for invalid inputs
    workInput.classList.toggle("duration-input-error", !workValid);
    openInput.classList.toggle("duration-input-error", !openValid);

    if (!workValid || !openValid) {
        // Don't send; let the user fix the inputs
        return;
    }

    await send({ type: "startSession", workMinutes, openMinutes });
    await refresh();
});

workInput.addEventListener("input", () => {
    workInput.classList.remove("duration-input-error");
});
openInput.addEventListener("input", () => {
    openInput.classList.remove("duration-input-error");
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

// One-time: seed input values from state when the popup opens.
// After this, the inputs belong to the user until Start is clicked.
(async () => {
    const response = await send({ type: "getState" });
    if (response && response.ok) {
        workInput.value = response.state.workMinutes ?? 15;
        openInput.value = response.state.openMinutes ?? 15;
    }
})();