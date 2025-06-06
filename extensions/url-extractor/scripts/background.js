// This file contains the background script for the extension. It manages events and can handle tasks that require long-running processes.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extractLinksFromTargetPage",
    title: "Show links from this hyperlink's target page",
    contexts: ["link"]
  });
});

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function hasOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });
  return existingContexts.length > 0;
}

async function setupOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: 'Parse HTML string to extract links',
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "extractLinksFromTargetPage" && info.linkUrl) {
    try {
      // Store the URL we're processing in case we need it for the fallback mechanism
      const targetUrl = info.linkUrl;
      
      try {
        const response = await fetch(info.linkUrl, {
          // Adding these headers can sometimes help with CORS issues
          headers: {
            'User-Agent': navigator.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const htmlString = await response.text();
        await setupOffscreenDocument();
        
        const offscreenResponse = await chrome.runtime.sendMessage({
          action: 'parseHtmlForLinks',
          htmlString: htmlString
        });
        
        if (offscreenResponse && offscreenResponse.links) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showHoverBoxWithLinks',
            links: offscreenResponse.links,
            sourceUrl: targetUrl
          });
        } else {
          throw new Error('Failed to parse HTML');
        }
      } catch (fetchError) {
        // If the fetch fails, show an error with a fallback option
        chrome.tabs.sendMessage(tab.id, {
          action: 'showFetchErrorWithFallback',
          error: `Could not fetch content directly: ${fetchError.message}`,
          url: targetUrl
        });
      }
    } catch (error) {
      console.error("Error in context menu handler:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: 'showHoverBoxWithError',
        error: `Error: ${error.message}`
      });
    }
  }
});

// Add this handler to open links in new tab when requested by the fallback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openUrlInNewTab') {
    chrome.tabs.create({ url: request.url }, newTab => {
      // We'll inject a content script into the new tab to extract links as soon as it loads
      chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        function: extractLinksAndCloseTab,
        args: [sender.tab.id]  // Pass the original tab ID to send results back
      });
    });
    sendResponse({ status: "Opening new tab..." });
    return true;
  }
});

// This function runs in the context of the newly opened tab
function extractLinksAndCloseTab(originalTabId) {
  // Wait for the page to fully load
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => doExtraction(originalTabId));
  } else {
    doExtraction(originalTabId);
  }
  
  function doExtraction(originalTabId) {
    // Extract all links
    const linkElements = document.querySelectorAll('a');
    const links = [];
    linkElements.forEach(link => {
      if (link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
        links.push(link.href);
      }
    });
    
    // Send links back to the original tab
    chrome.tabs.sendMessage(originalTabId, {
      action: 'showHoverBoxWithLinks',
      links: links,
      sourceUrl: window.location.href
    });
    
    // Close this tab after a short delay
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'closeThisTab' });
    }, 500);
  }
}

// Add this handler to close the tab when requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'closeThisTab' && sender.tab) {
    chrome.tabs.remove(sender.tab.id);
  }
});