// This file contains the background script for the extension. It manages events and can handle long-running processes.

chrome.runtime.onInstalled.addListener(() => {
  // Remove any existing items first to prevent duplicates on re-install/update
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "extractLinksFromTargetPage",
      title: "Show links from this hyperlink's target page", // Static title
      contexts: ["link"]
      // 'enabled: true' is the default, so no need to set it explicitly here
      // The menu will always be visually enabled.
    });
    console.log("Context menu created (always enabled).");
  });
});

// Function to check if a domain is permitted (uses normalized domains)
async function isDomainPermitted(hostname) {
  let normalizedHostname = hostname;
  if (normalizedHostname.startsWith('www.')) {
    normalizedHostname = normalizedHostname.substring(4);
  }
  // console.log(`[isDomainPermitted] Original hostname: "${hostname}", Normalized for check: "${normalizedHostname}"`);

  return new Promise((resolve) => {
    chrome.storage.local.get('permittedDomains', (result) => {
      const permittedDomains = result.permittedDomains || [];
      // console.log(`[isDomainPermitted] Stored permitted domains (normalized):`, permittedDomains);

      if (permittedDomains.length === 0) {
        // console.log(`[isDomainPermitted] No domains permitted. Resolving false.`);
        resolve(false);
        return;
      }

      if (permittedDomains.includes(normalizedHostname)) {
        // console.log(`[isDomainPermitted] Exact normalized match found for "${normalizedHostname}". Resolving true.`);
        resolve(true);
        return;
      }

      const domainParts = normalizedHostname.split('.');
      if (domainParts.length > 1) {
        for (let i = 1; i < domainParts.length - 1 ; i++) {
          const parentDomain = domainParts.slice(i).join('.');
          if (parentDomain && permittedDomains.includes(parentDomain)) {
            // console.log(`[isDomainPermitted] Parent domain match: "${parentDomain}" (derived from "${normalizedHostname}") is permitted. Resolving true.`);
            resolve(true);
            return;
          }
        }
      }
      
      // console.log(`[isDomainPermitted] No match found for "${normalizedHostname}". Resolving false.`);
      resolve(false);
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "extractLinksFromTargetPage" && info.linkUrl) {
    // console.log(`[onClicked] Context menu clicked for link: ${info.linkUrl}`);
    try {
      const url = new URL(info.linkUrl);
      const hostname = url.hostname;

      // Ensure content script is injected and ready to receive messages
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["scripts/content.js"]
        });
        // console.log("[onClicked] Content script injected/ensured.");
      } catch (scriptError) {
        console.error("[onClicked] Failed to inject content script:", scriptError);
        // Notify user if content script injection fails, as hover box won't work
        // This could be a chrome.notifications.create() call for a more visible error.
        alert(`Link Extractor Error: Could not prepare the page for displaying links. (${scriptError.message})`);
        return; 
      }

      const isPermitted = await isDomainPermitted(hostname);
      // console.log(`[onClicked] Domain "${hostname}" permission status: ${isPermitted}`);

      if (isPermitted) {
        // console.log(`[onClicked] Domain "${hostname}" is permitted. Fetching links.`);
        fetchAndProcessLinks(info.linkUrl, tab.id);
      } else {
        // console.log(`[onClicked] Domain "${hostname}" is NOT permitted. Sending message to content script.`);
        chrome.tabs.sendMessage(tab.id, {
          action: 'showMessage',
          message: `Domain "${hostname}" is not permitted. Please add it via the extension popup to extract links.`,
          type: 'warning', // content.js can use this to style the message
          sourceUrl: info.linkUrl // Provide source URL for context in the message if needed
        });
      }
    } catch (error) {
      console.error("[onClicked] Error in context menu handler:", error);
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showMessage',
          message: `Error processing link: ${error.message}`,
          type: 'error',
          sourceUrl: info.linkUrl
        });
      } catch (sendMessageError) {
        console.error("[onClicked] Error sending error message to content script:", sendMessageError);
      }
    }
  }
});

async function fetchAndProcessLinks(url, tabId) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Try to provide a more specific error message if possible
      let errorDetail = response.statusText;
      if (response.status === 0) { // Often indicates a CORS issue or network error
        errorDetail = "Network error or CORS issue. The extension might not have permission to access this URL directly.";
      } else if (response.status === 403) {
        errorDetail = "Access Forbidden. The server denied access to this URL.";
      } else if (response.status === 404) {
        errorDetail = "Page Not Found.";
      }
      throw new Error(`HTTP error ${response.status} (${errorDetail}) when fetching ${url}`);
    }
    const htmlString = await response.text();
    
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(https?:\/\/[^"']+)\1/gi;
    const links = [];
    let match;
    while ((match = linkRegex.exec(htmlString)) !== null) {
      if (match[2] && !links.includes(match[2])) {
        links.push(match[2]);
      }
    }
    // console.log(`[fetchAndProcessLinks] Extracted ${links.length} links from ${url}`);
    chrome.tabs.sendMessage(tabId, {
      action: 'showLinks',
      links: links,
      sourceUrl: url 
    });
  } catch (error) {
    console.error("[fetchAndProcessLinks] Error:", error);
    // Send error to content script to be displayed in the hover box
    chrome.tabs.sendMessage(tabId, {
      action: 'showMessage', // Re-use 'showMessage' or the 'error' parameter of displayInHoverBox
      message: error.message, // Send the specific error message
      type: 'error',
      sourceUrl: url
    });
  }
}

// Listener for messages from content scripts (e.g., for the fallback button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openUrlInNewTab') {
      chrome.tabs.create({ url: request.url });
      // If you want to automatically try fetching after opening in new tab,
      // you might need more complex logic, perhaps involving the new tab's ID.
      // For now, just opening it. The user would then right-click again in the new tab.
      sendResponse({status: "URL opening in new tab"});
      return true; // Indicates an asynchronous response.
  }
  if (request.action === 'addDomain' && request.domain) {
    let normalized = request.domain.startsWith('www.')
      ? request.domain.slice(4)
      : request.domain;
    chrome.storage.local.get('permittedDomains', (res) => {
      const list = res.permittedDomains || [];
      if (!list.includes(normalized)) {
        list.push(normalized);
        chrome.storage.local.set({ permittedDomains: list }, () => {
          sendResponse({ status: 'success', domain: normalized });
        });
      } else {
        sendResponse({ status: 'exists', domain: normalized });
      }
    });
    return true; // keep message channel open for async sendResponse
  }
  // Handle other potential messages from content scripts if any
  return false; // Default for synchronous handling or no response
});
