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

// Open options page when extension icon is clicked with Alt key
chrome.action.onClicked.addListener((tab, info) => {
  // We only get here if the popup failed to open (popup takes precedence)
  chrome.runtime.openOptionsPage();
});

// Listen for tab updates to inject content script when a permitted tab loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only proceed if the tab is completely loaded and has a URL
  if (changeInfo.status === 'complete' && tab.url && 
      (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
    
    const url = new URL(tab.url);
    const currentDomain = url.hostname;
    const currentOriginPattern = `*://${currentDomain}/*`;
    
    // First check if we have permission for this domain
    chrome.permissions.contains({ origins: [currentOriginPattern] }, (granted) => {
      if (granted) {
        // Then check if we have any rules specifically for this domain
        chrome.storage.local.get('savedSets', (data) => {
          const savedSets = data.savedSets || [];
          
          // Only look for rules with a domain that matches this page
          // Removed the "!set.domain ||" condition
          const hasMatchingRule = savedSets.some(set => 
            set.domain && currentDomain.includes(set.domain)
          );
          
          if (hasMatchingRule) {
            // Inject content script
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['src/content/content.js']
            }).then(() => {
              // Send message to apply rules
              chrome.tabs.sendMessage(tabId, { action: 'applyAllRules' })
                .catch(err => console.log("Error applying rules:", err));
            }).catch(err => console.log("Error injecting script:", err));
          }
        });
      }
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "replaceText") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        // First check if content script is already injected,
        // if not, inject it before sending message
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['src/content/content.js']
        }).then(() => {
          // Now send the message
          chrome.tabs.sendMessage(tabs[0].id, message)
            .then(response => {
              sendResponse(response);
            })
            .catch(error => {
              sendResponse({
                success: false,
                message: "Failed to communicate with the page."
              });
            });
        }).catch(error => {
          sendResponse({
            success: false,
            message: "Failed to inject content script."
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
  } else if (message.action === "allRulesDeleted") {
    // Reload the options page if it's open
    chrome.runtime.openOptionsPage();
    return true;
  }
});

// Open options page when extension icon is clicked with Alt key
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});

// Listen for permission changes
chrome.permissions.onAdded.addListener((permissions) => {
  if (permissions.origins && permissions.origins.length > 0) {
    permissions.origins.forEach(originPattern => {
      chrome.tabs.query({ url: originPattern }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        
        // Get domain from the origin pattern
        let domain = '';
        try {
          // Extract domain from pattern like "*://example.com/*"
          const match = originPattern.match(/\*:\/\/([^\/]+)\/\*/);
          if (match && match[1]) {
            domain = match[1];
          }
        } catch (e) {
          console.error("Could not extract domain from pattern:", originPattern);
          return;
        }
        
        if (!domain) return;
        
        // Check if we have rules for this specific domain
        chrome.storage.local.get('savedSets', (data) => {
          const savedSets = data.savedSets || [];
          const matchingSets = savedSets.filter(set => 
            set.domain && domain.includes(set.domain)
          );
          
          if (matchingSets.length > 0) {
            tabs.forEach((tab) => {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['src/content/content.js']
              }).then(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'applyAllRules' });
              }).catch(e => console.log("Error injecting script after permission granted:", e));
            });
          }
        });
      });
    });
  }
});

// Rest of your background.js code...