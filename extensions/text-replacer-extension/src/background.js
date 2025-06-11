// This script handles communication between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // If the message is from popup to replace text
  if (message.action === "replaceText") {
    // Forward the message to the active tab's content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message)
          .then(response => {
            sendResponse(response);
          })
          .catch(error => {
            sendResponse({
              success: false,
              message: "Failed to communicate with the page. Make sure you're on a compatible webpage."
            });
          });
      } else {
        sendResponse({
          success: false,
          message: "No active tab found"
        });
      }
    });
    return true; // Keep the message channel open for async response
  }
});