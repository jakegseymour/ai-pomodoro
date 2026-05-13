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

// options.js — runs on the settings page

// Defaults that are baked into host_permissions and cannot be removed.
const DEFAULT_HOSTS = new Set([
    "claude.ai",
    "chatgpt.com",
    "gemini.google.com",
    "www.perplexity.ai",
    "copilot.microsoft.com",
]);

const addInput = document.getElementById("add-input");
const addBtn = document.getElementById("add-btn");
const feedbackEl = document.getElementById("feedback");
const blocklistEl = document.getElementById("blocklist");

// ---- Normalize a user-typed input into a clean hostname ----
// Permissive: accepts hostnames, full URLs, paths, uppercase, etc.
// Returns a lowercased hostname, or null if input can't be parsed.
function normalizeHost(input) {
    if (!input) return null;
    let raw = input.trim();
    if (!raw) return null;

    // If they didn't include a scheme, add one so URL parses cleanly.
    if (!raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
        raw = "https://" + raw;
    }

    try {
        const url = new URL(raw);
        let host = url.hostname.toLowerCase();
        if (!host) return null;
        // Basic sanity: must contain a dot, no spaces.
        if (!host.includes(".")) return null;
        if (host.includes(" ")) return null;
        return host;
    } catch {
        return null;
    }
}

// ---- Talk to the background ----
function sendMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => resolve(response));
    });
}

// ---- Render the blocklist ----
function render(blocklist) {
    if (!blocklist || blocklist.length === 0) {
        blocklistEl.innerHTML = '<div class="empty">No sites blocked. Add one above.</div>';
        return;
    }

    blocklistEl.innerHTML = blocklist
        .map((host) => {
            const isDefault = DEFAULT_HOSTS.has(host);
            return `
        <div class="blocklist-row ${isDefault ? "is-default" : ""}">
          <div>
            <span class="host-label">${escapeHtml(host)}</span>
            ${isDefault ? '<span class="host-meta">default</span>' : ""}
          </div>
          ${isDefault
                    ? '<span class="lock-icon" title="Default sites cannot be removed">🔒</span>'
                    : `<button class="remove-btn" data-host="${escapeHtml(host)}">Remove</button>`
                }
        </div>
      `;
        })
        .join("");

    // Wire up remove buttons
    blocklistEl.querySelectorAll(".remove-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const host = btn.dataset.host;
            await removeHost(host);
        });
    });
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ---- Feedback helpers ----
function showFeedback(message, kind = "error") {
    feedbackEl.textContent = message;
    feedbackEl.className = "feedback " + kind;
}
function clearFeedback() {
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";
}

// ---- Actions ----
async function refresh() {
    const response = await sendMessage({ type: "getState" });
    if (response && response.ok) {
        render(response.state.blocklist);
    }
}

async function addHost(host) {
    const response = await sendMessage({ type: "addBlocklistHost", host });
    if (response && response.ok) {
        showFeedback(`Added ${host}`, "success");
        addInput.value = "";
        addInput.classList.remove("input-error");
        await refresh();
    } else {
        showFeedback((response && response.error) || "Could not add.", "error");
    }
}

async function removeHost(host) {
    // Tell background to update state first.
    const response = await sendMessage({ type: "removeBlocklistHost", host });
    if (!response || !response.ok) {
        showFeedback((response && response.error) || "Could not remove.", "error");
        return;
    }

    // Then relinquish the permission. (Doesn't require user gesture for remove,
    // but kept in options.js for symmetry with add.)
    try {
        await chrome.permissions.remove({ origins: [`*://${host}/*`] });
    } catch {
        // Default hosts cannot have permissions removed — that's fine.
    }

    showFeedback(`Removed ${host}`, "success");
    await refresh();
}

// ---- Event listeners ----
addBtn.addEventListener("click", async () => {
    clearFeedback();
    const raw = addInput.value;
    const host = normalizeHost(raw);

    if (!host) {
        addInput.classList.add("input-error");
        showFeedback("Enter a valid hostname like 'character.ai'.", "error");
        return;
    }

    if (DEFAULT_HOSTS.has(host)) {
        addInput.classList.add("input-error");
        showFeedback(`${host} is already in the default blocklist.`, "error");
        return;
    }

    // Critical: request permission HERE, in the user-gesture context.
    // Cannot delegate to background — Chrome rejects the request as non-gesture.
    let granted;
    try {
        granted = await chrome.permissions.request({
            origins: [`*://${host}/*`],
        });
    } catch (err) {
        showFeedback("Permission request failed: " + String(err), "error");
        return;
    }

    if (!granted) {
        showFeedback("Permission denied. Site not added.", "error");
        return;
    }

    // Permission granted. Now tell the background to add it to state.
    addBtn.disabled = true;
    try {
        await addHost(host);
    } finally {
        addBtn.disabled = false;
    }
});

addInput.addEventListener("input", () => {
    addInput.classList.remove("input-error");
    clearFeedback();
});

addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        addBtn.click();
    }
});

// ---- Init ----
refresh();