// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed and background script is running.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);

  if (message.type === "MICROPHONE_ERROR") {
    console.error("Microphone Error:", message.error);
  }
  if (message.type === "MICROPHONE_STATUS") {
    console.log("Microphone Status:", message.status);
  }
});
