// popup.js — runs when the popup is open

const stateLineEl = document.getElementById("state-line");
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
const openOptionsBtn = document.getElementById("open-options");
const durationsEl = document.getElementById("durations");
const sectionDividerEl = document.getElementById("section-divider");

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

// ---- SVG icon strings for the state line ----
// Same lock shapes as on the input labels, scaled up.

const LOCK_CLOSED_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>`;

const LOCK_OPEN_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
    </svg>`;

// ---- Render the current state into the DOM ----

function render(state) {
    const isIdle = state.mode === "idle";
    const isManuallyPaused = state.pausedRemainingMs != null;
    const isOverridePaused = state.overridePausedRemainingMs != null;

    // ---- State line: icon + label, only when running ----
    // Hidden when idle (no state to show).
    // Color via class: work → rust, open → green, manual pause → gray.

    if (isIdle) {
        stateLineEl.style.display = "none";
        stateLineEl.innerHTML = "";
        stateLineEl.className = "state-line";
    } else {
        stateLineEl.style.display = "";
        const icon = state.mode === "work" ? LOCK_CLOSED_SVG : LOCK_OPEN_SVG;
        const label = state.mode === "work" ? "Solo" : "Assist";
        const suffix = isManuallyPaused ? `<span class="state-suffix">(paused)</span>` : "";
        stateLineEl.innerHTML = `${icon}<span>${label}</span>${suffix}`;
        // Class controls color. Manual pause overrides mode color to gray.
        stateLineEl.className =
            "state-line " + (isManuallyPaused ? "paused" : state.mode);
    }

    // ---- Time remaining ----
    // Idle: "--:--". Running: countdown from endsAt. Paused (either kind):
    // the frozen remaining value.

    if (isIdle) {
        timeEl.style.display = "none";
        timeEl.textContent = "";
    } else {
        timeEl.style.display = "";
        if (state.running && state.endsAt != null) {
            timeEl.textContent = formatTime(state.endsAt - Date.now());
        } else if (isOverridePaused) {
            timeEl.textContent = formatTime(state.overridePausedRemainingMs);
        } else if (isManuallyPaused) {
            timeEl.textContent = formatTime(state.pausedRemainingMs);
        } else {
            timeEl.textContent = "--:--";
        }
    }
    // Time desaturates on manual pause only — override pause keeps full color
    // because the underlying state (in work block) is still active.
    timeEl.classList.toggle("paused", isManuallyPaused);

    // ---- Round progress ----

    if (!isIdle && state.currentRound > 0 && state.rounds > 0) {
        roundProgressEl.textContent = `Round ${state.currentRound} of ${state.rounds}`;
    } else {
        roundProgressEl.textContent = "";
    }

    // ---- Active overrides ----

    renderOverrides(state.overrides || []);

    // ---- Inputs section: only visible when idle ----
    // When running, the user can't change config, so the inputs disappear
    // entirely (cleaner than disabled grayed-out boxes).

    durationsEl.style.display = isIdle ? "" : "none";
    sectionDividerEl.style.display = isIdle ? "" : "none";

    // ---- Button visibility ----
    // isManuallyPaused governs Pause/Resume — override-pause doesn't surface
    // a Resume button (the user can't manually resume from an override).

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
    // Sort: active by soonest expiring first, then paused at end.
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

    workInput.closest(".duration-input-row").classList.toggle("duration-input-error", !workValid);
    openInput.closest(".duration-input-row").classList.toggle("duration-input-error", !openValid);
    roundsInput.closest(".duration-input-row").classList.toggle("duration-input-error", !roundsValid);

    if (!workValid || !openValid || !roundsValid) return;

    await send({ type: "startSession", workMinutes, openMinutes, rounds });
    await refresh();
});

roundsInput.addEventListener("input", () => {
    roundsInput.closest(".duration-input-row").classList.remove("duration-input-error");
});

workInput.addEventListener("input", () => {
    workInput.closest(".duration-input-row").classList.remove("duration-input-error");
});
openInput.addEventListener("input", () => {
    openInput.closest(".duration-input-row").classList.remove("duration-input-error");
});

clearBtn.addEventListener("click", () => {
    workInput.value = "";
    openInput.value = "";
    roundsInput.value = "";
    workInput.closest(".duration-input-row").classList.remove("duration-input-error");
    openInput.closest(".duration-input-row").classList.remove("duration-input-error");
    roundsInput.closest(".duration-input-row").classList.remove("duration-input-error");
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

openOptionsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

// ---- On popup open: render once, then re-render every second ----

refresh();
renderInterval = setInterval(refresh, 1000);

window.addEventListener("unload", () => {
    if (renderInterval) clearInterval(renderInterval);
});

// One-time: seed input values from state when the popup opens.

(async () => {
    const response = await send({ type: "getState" });
    if (response && response.ok) {
        workInput.value = response.state.workMinutes ?? 15;
        openInput.value = response.state.openMinutes ?? 15;
        roundsInput.value = response.state.rounds ?? 4;
    }
})();