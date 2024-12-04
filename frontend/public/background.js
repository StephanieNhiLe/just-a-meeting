const ORIGIN_TRIAL_TOKEN = ""; // Replace with your actual token

// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed and background script is running.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);

  // Handle Microphone Errors
  if (message.type === "MICROPHONE_ERROR") {
    console.error("Microphone Error:", message.error);
  }

  // Handle Microphone Status Updates
  if (message.type === "MICROPHONE_STATUS") {
    console.log("Microphone Status:", message.status);
  }

  // Handle Summarization Request
  if (message.type === "SUMMARIZE_TRANSCRIPT") {
    const transcript = message.transcript;

    // Check if the Summarizer API is supported
    if (!("summarizer" in navigator)) {
      console.error("Summarizer API is not supported in this browser.");
      sendResponse({ success: false, error: "Summarizer API not supported." });
      return false;
    }

    summarizeTranscript(transcript)
      .then((summary) => {
        console.log("Summary generated successfully:", summary);
        sendResponse({ success: true, summary });
      })
      .catch((error) => {
        console.error("Error summarizing transcript:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keeps the message channel open for async response
  }
});

// Summarization logic using the Chrome Summarizer API
async function summarizeTranscript(transcript) {
  const input = new Blob([transcript], { type: "text/plain" });
  const options = { summaryType: "paragraphs" }; // or "bullets"

  try {
    const result = await navigator.summarizer.summarize(input, options);
    return result.summary;
  } catch (error) {
    console.error("Summarizer API error:", error);
    throw new Error("Failed to summarize the text.");
  }
}
