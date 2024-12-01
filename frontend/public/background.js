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
    summarizeTranscript(message.transcript)
      .then((summary) => {
        console.log("Summary generated successfully:", summary);
        sendResponse({ success: true, summary });
      })
      .catch((error) => {
        console.error("Error summarizing transcript:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates asynchronous response
  }
});

// Summarization logic using Chrome AI API or another API
async function summarizeTranscript(transcript) {
  const apiKey = "YOUR_CHROME_AI_API_KEY"; // Replace with your API key

  const response = await fetch("https://api.chromeai.google.com/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text: transcript,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to summarize the transcript.");
  }

  const data = await response.json();
  return data.summary;
}
