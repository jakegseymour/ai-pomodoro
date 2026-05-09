// background.js — runs in the background, independent of popup or tabs

console.log("ai-pomodoro: background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("ai-pomodoro: received message", message);
    sendResponse({ status: "received" });
});