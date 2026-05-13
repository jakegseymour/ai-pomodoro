// AI Pomodoro
// Copyright (C) 2026 Jake Seymour
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.

// end.js — runs on the end friction page

const END_SENTENCE =
    "I am ending my session before it finishes. I am choosing to stop the work I committed to.";

const sessionStateEl = document.getElementById("session-state");
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

// ---- Render what the user would lose ----

async function refreshSessionState() {
    const response = await send({ type: "getState" });
    if (!response || !response.ok) return;
    const state = response.state;

    // If already idle, nothing to end. Close the tab.
    if (state.mode === "idle") {
        window.close();
        return;
    }

    // Figure out remaining time. Mirror popup logic.
    let remainingMs;
    if (state.endsAt != null) {
        remainingMs = state.endsAt - Date.now();
    } else if (state.overridePausedRemainingMs != null) {
        remainingMs = state.overridePausedRemainingMs;
    } else if (state.pausedRemainingMs != null) {
        remainingMs = state.pausedRemainingMs;
    } else {
        remainingMs = 0;
    }

    const modeLabel = state.mode === "work" ? "solo-thinking block" : "AI-assist block";
    const timeStr = formatTime(remainingMs);

    if (state.currentRound > 0 && state.rounds > 0) {
        sessionStateEl.innerHTML =
            `Round <strong>${state.currentRound} of ${state.rounds}</strong>, ` +
            `<strong>${timeStr}</strong> remaining in the ${modeLabel}.`;
    } else {
        sessionStateEl.innerHTML =
            `<strong>${timeStr}</strong> remaining in the ${modeLabel}.`;
    }
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
    const expected = normalize(END_SENTENCE);

    if (typed !== expected) {
        feedbackEl.textContent = "That doesn't match the sentence above. Try again.";
        feedbackEl.className = "feedback error";
        return;
    }

    submitBtn.disabled = true;
    const response = await send({ type: "reset" });
    if (response && response.ok) {
        feedbackEl.textContent = "Session ended. Closing…";
        feedbackEl.className = "feedback success";
        setTimeout(() => {
            window.close();
        }, 800);
    } else {
        submitBtn.disabled = false;
        feedbackEl.textContent =
            (response && response.error) || "End failed. Try again.";
        feedbackEl.className = "feedback error";
    }
});

backBtn.addEventListener("click", () => {
    window.close();
});

// ---- Init ----

sentenceEl.textContent = END_SENTENCE;
refreshSessionState();
setInterval(refreshSessionState, 1000);