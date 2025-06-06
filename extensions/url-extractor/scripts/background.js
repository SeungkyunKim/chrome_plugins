// This file contains the background script for the extension. It manages events and can handle long-running processes.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extractLinksFromTargetPage",
    title: "Show links from this hyperlink's target page",
    contexts: ["link"]
  });
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
          } else {
            throw new Error('Failed to parse HTML via offscreen document');
          }
        } else {
          // Safari path doing parsing directly in the background script
          // Inject a content script to do the parsing
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: function(htmlString) {
              // This runs in content script context where DOMParser is available
              const parser = new DOMParser();
              const doc = parser.parseFromString(htmlString, 'text/html');
              const linkElements = doc.querySelectorAll('a');
              const links = [];
              
              linkElements.forEach(link => {
                if (link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
                  links.push(link.href);
                }
              });
              
              return links;
            },
            args: [htmlString]
          }).then(injectionResults => {
            const links = injectionResults[0].result;
            chrome.tabs.sendMessage(tab.id, {
              action: 'showHoverBoxWithLinks',
              links: links,
              sourceUrl: targetUrl
            });
          });
        }
        
        chrome.tabs.sendMessage(tab.id, {
          action: 'showHoverBoxWithLinks',
          links: links,
          sourceUrl: targetUrl
        });
        
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