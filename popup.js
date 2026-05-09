// popup.js — runs when the popup is open

document.getElementById("ping").addEventListener("click", () => {
    console.log("ai-pomodoro: popup button clicked, sending message");
    chrome.runtime.sendMessage({ type: "ping" }, (response) => {
        console.log("ai-pomodoro: got response from background", response);
    });
});