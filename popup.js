// popup.js — runs when the popup is open

const modeEl = document.getElementById("mode");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("start");
const clearBtn = document.getElementById("clear");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");
const endBtn = document.getElementById("end");
const overridesEl = document.getElementById("overrides");
const workInput = document.getElementById("work-input");
const openInput = document.getElementById("open-input");
const roundsInput = document.getElementById("rounds-input");
const roundProgressEl = document.getElementById("round-progress");
const openOptionsLink = document.getElementById("open-options");

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
    // Mode label and color. isPaused here covers BOTH manual and override pause
    // because the label should show "(PAUSED)" for either.
    const isPaused = (state.overridePausedRemainingMs != null || state.pausedRemainingMs != null) && state.mode !== "idle";
    if (isPaused) {
        modeEl.innerHTML = `${state.mode}<span class="mode-suffix"> (PAUSED)</span>`;
    } else {
        modeEl.textContent = state.mode;
    }
    modeEl.className = "mode " + state.mode;

    // Time remaining
    if (state.mode === "idle") {
        timeEl.textContent = "--:--";
        timeEl.classList.remove("time-frozen");
    } else if (state.running && state.endsAt != null) {
        const remaining = state.endsAt - Date.now();
        timeEl.textContent = formatTime(remaining);
        timeEl.classList.remove("time-frozen");
    } else if (state.overridePausedRemainingMs != null) {
        // Timer is auto-paused while overrides are active.
        timeEl.textContent = formatTime(state.overridePausedRemainingMs);
    } else if (state.pausedRemainingMs != null) {
        // Manually paused.
        timeEl.textContent = formatTime(state.pausedRemainingMs);
    } else {
        timeEl.textContent = "--:--";
        timeEl.classList.remove("time-frozen");
    }

    // Active overrides
    renderOverrides(state.overrides || []);

    // Disable inputs when not idle. Values are seeded once on popup open
    // (see one-time init at bottom of file), then owned by the user until Start.
    const isIdle = state.mode === "idle";
    workInput.disabled = !isIdle;
    openInput.disabled = !isIdle;
    roundsInput.disabled = !isIdle;

    // Round progress
    if (state.mode !== "idle" && state.currentRound > 0 && state.rounds > 0) {
        roundProgressEl.textContent = `Round ${state.currentRound} of ${state.rounds}`;
    } else {
        roundProgressEl.textContent = "";
    }

    // Button visibility based on state. isManuallyPaused governs Pause/Resume
    // visibility specifically — override-pause is automatic and shouldn't
    // surface a Resume button, since the user can't manually resume from it.
    const isManuallyPaused = state.pausedRemainingMs != null;

    startBtn.style.display = isIdle ? "" : "none";
    clearBtn.style.display = isIdle ? "" : "none";
    pauseBtn.style.display = (!isIdle && !isManuallyPaused) ? "" : "none";
    resumeBtn.style.display = (!isIdle && isManuallyPaused) ? "" : "none";
    endBtn.style.display = !isIdle ? "" : "none";
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
    const workMinutes = parseInt(workInput.value, 10);
    const openMinutes = parseInt(openInput.value, 10);
    const rounds = parseInt(roundsInput.value, 10);

    const workValid = Number.isInteger(workMinutes) && workMinutes >= 1 && workMinutes <= 60;
    const openValid = Number.isInteger(openMinutes) && openMinutes >= 1 && openMinutes <= 60;
    const roundsValid = Number.isInteger(rounds) && rounds >= 1 && rounds <= 20;

    workInput.classList.toggle("duration-input-error", !workValid);
    openInput.classList.toggle("duration-input-error", !openValid);
    roundsInput.classList.toggle("duration-input-error", !roundsValid);

    if (!workValid || !openValid || !roundsValid) return;

    await send({ type: "startSession", workMinutes, openMinutes, rounds });
    await refresh();
});

roundsInput.addEventListener("input", () => {
    roundsInput.classList.remove("duration-input-error");
});

workInput.addEventListener("input", () => {
    workInput.classList.remove("duration-input-error");
});
openInput.addEventListener("input", () => {
    openInput.classList.remove("duration-input-error");
});

clearBtn.addEventListener("click", () => {
    workInput.value = "--";
    openInput.value = "--";
    roundsInput.value = "--";
    workInput.classList.remove("duration-input-error");
    openInput.classList.remove("duration-input-error");
    roundsInput.classList.remove("duration-input-error");
});

pauseBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("pause.html") });
    window.close();
});

resumeBtn.addEventListener("click", async () => {
    await send({ type: "resume" });
    await refresh();
});

endBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("end.html") });
    window.close();
});

openOptionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
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
        roundsInput.value = response.state.rounds ?? 4;
    }
})();