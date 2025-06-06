// This file contains the background script for the extension. It manages events and can handle long-running processes.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extractLinksFromTargetPage",
    title: "Show links from this hyperlink's target page",
    contexts: ["link"]
  });

  // Setup tab change handler to update context menu visibility
  setupTabListeners();
});

// Function to set up tab event listeners
function setupTabListeners() {
  // Update context menu when active tab changes
  chrome.tabs.onActivated.addListener(activeInfo => {
    updateContextMenuForTab(activeInfo.tabId);
  });

  // Update context menu when tab URL changes
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      updateContextMenuForTab(tabId);
    }
  });

  // Initial check for the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs.length > 0) {
      updateContextMenuForTab(tabs[0].id);
    }
  });
}

// Update the context menu based on the current tab's domain
async function updateContextMenuForTab(tabId) {
  try {
    // Get the current tab information
    const tab = await chrome.tabs.get(tabId);

    if (!tab.url || !tab.url.startsWith('http')) {
      // Not a webpage - disable context menu
      await chrome.contextMenus.update("extractLinksFromTargetPage", { 
        enabled: false,
        title: "Not available on this page"
      });
      return;
    }

    // Get the domain of the current tab
    const url = new URL(tab.url);
    const domain = url.hostname;

    // Check if the domain is permitted
    const isPermitted = await isDomainPermitted(domain);

    // Update context menu state
    if (isPermitted) {
      await chrome.contextMenus.update("extractLinksFromTargetPage", { 
        enabled: true,
        title: "Show links from this hyperlink's target page"
      });
    } else {
      await chrome.contextMenus.update("extractLinksFromTargetPage", { 
        enabled: false,
        title: "Current site not in permitted domains"
      });
    }
  } catch (error) {
    console.error("Error updating context menu:", error);
  }
}

// Listen for changes to the permitted domains list and update context menus
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.permittedDomains) {
    // When domains change, update menus for current tab
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs.length > 0) {
        updateContextMenuForTab(tabs[0].id);
      }
    });
  }
});

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Check if the current browser supports offscreen documents
const supportsOffscreenDocuments = typeof chrome.runtime.getContexts === 'function' && typeof chrome.offscreen === 'object';

async function setupOffscreenDocument(path) {
  if (!supportsOffscreenDocuments) {
    // Safari fallback implementation
    console.log('Running in Safari - using alternative implementation');
    return false;
  }

  // Chrome implementation using offscreen documents
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(path)]
  });

  if (existingContexts.length > 0) {
    return true; // Offscreen document already exists
  }

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['CLIPBOARD', 'AUDIO_PLAYBACK'], // adjust based on your needs
    justification: 'Needed for processing data'
  });

  return true;
}

// Helper function to parse HTML in Safari (since we can't use offscreen documents)
function parseHtmlForLinks(htmlString) {
  // Use regex pattern to extract links instead of DOMParser
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(https?:\/\/[^"']+)\1/gi;
  const links = [];
  let match;

  while ((match = linkRegex.exec(htmlString)) !== null) {
    const url = match[2];
    if (url && !links.includes(url)) {
      links.push(url);
    }
  }

  return links;
}

// Function to check if a domain is permitted
async function isDomainPermitted(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get('permittedDomains', (result) => {
      const permittedDomains = result.permittedDomains || [];

      // Check if the exact domain is in the list
      if (permittedDomains.includes(domain)) {
        resolve(true);
        return;
      }

      // Check if a parent domain is in the list
      // For example, if sub.example.com is requested and example.com is in the list
      const domainParts = domain.split('.');
      for (let i = 1; i < domainParts.length - 1; i++) {
        const parentDomain = domainParts.slice(i).join('.');
        if (permittedDomains.includes(parentDomain)) {
          resolve(true);
          return;
        }
      }

      resolve(false);
    });
  });
}

// When context menu is clicked
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "extractLinksFromTargetPage" && info.linkUrl) {
    try {
      // Parse the URL to get the host
      const url = new URL(info.linkUrl);
      const hostname = url.hostname;

      // Check if this domain is permitted
      const isPermitted = await isDomainPermitted(hostname);

      // First inject content script into the active tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scripts/content.js"]
      });

      if (isPermitted) {
        // Domain is permitted, proceed with extraction
        fetchAndProcessLinks(info.linkUrl, tab.id);
      } else {
        // Domain is not permitted, show notification
        chrome.tabs.sendMessage(tab.id, {
          action: 'showMessage',
          message: `Domain "${hostname}" is not in your permitted list. Add it from the extension popup.`,
          type: 'warning'
        });
      }
    } catch (error) {
      console.error("Error in context menu handler:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: 'showMessage',
        message: `Error: ${error.message}`,
        type: 'error'
      });
    }
  }
});

// Listen for permission response
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'permissionResponse') {
    chrome.storage.local.get(['pendingUrlExtraction', 'pendingTabId'], async (data) => {
      if (!data.pendingUrlExtraction) {
        sendResponse({ status: 'No pending URL found' });
        return;
      }

      const targetUrl = data.pendingUrlExtraction;
      const tabId = data.pendingTabId;

      if (message.granted) {
        // Save "allow all domains" setting if provided
        if (message.allowAllDomains === true) {
          chrome.storage.local.set({ 'allowAllDomains': true });
        }
        
        // Request host permission
        const urlObj = new URL(targetUrl);
        const hostPattern = `*://${urlObj.hostname}/*`;
        
        chrome.permissions.request({
          origins: [hostPattern]
        }, (granted) => {
          if (granted) {
            // Permission granted, proceed with fetching
            fetchAndProcessLinks(targetUrl, tabId);
            sendResponse({ status: 'Permission granted, fetching links' });
          } else {
            // User denied permission in browser dialog
            chrome.tabs.sendMessage(tabId, {
              action: 'showMessage',
              message: 'Permission denied to access the URL.',
              type: 'error'
            });
            sendResponse({ status: 'Permission denied in browser dialog' });
          }
          
          // Clear pending state
          chrome.storage.local.remove(['pendingUrlExtraction', 'pendingTabId']);
        });
      } else {
        // User denied in our custom dialog
        chrome.tabs.sendMessage(tabId, {
          action: 'showMessage',
          message: 'You declined permission to access the target page.',
          type: 'info'
        });
        
        // Clear pending state
        chrome.storage.local.remove(['pendingUrlExtraction', 'pendingTabId']);
        
        sendResponse({ status: 'Permission denied in custom dialog' });
      }
    });

    // We must return true to indicate we'll respond asynchronously
    return true;
  }

  // For all other messages, we're not sending a response
  return false;
});

// Function to fetch and process links
async function fetchAndProcessLinks(url, tabId) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const htmlString = await response.text();
    let links = [];

    if (supportsOffscreenDocuments) {
      // Chrome path using offscreen documents
      await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

      const offscreenResponse = await chrome.runtime.sendMessage({
        action: 'parseHtmlForLinks',
        htmlString: htmlString
      });

      if (offscreenResponse && offscreenResponse.links) {
        links = offscreenResponse.links;
      }
    } else {
      // Safari path using regex
      links = parseHtmlForLinks(htmlString);
    }

    // Send extracted links to content script for display
    chrome.tabs.sendMessage(tabId, {
      action: 'showLinks',
      links: links,
      sourceUrl: url
    });

    // Also store for popup
    chrome.storage.local.set({
      'linksForPopup': links,
      'sourceUrl': url
    });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: 'showMessage',
      message: `Error: ${error.message}`,
      type: 'error'
    });
  }
}
