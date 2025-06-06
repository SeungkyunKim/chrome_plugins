// This script runs in the offscreen document

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'parseHtmlForLinks') {
    try {
      const parser = new DOMParser(); // DOMParser is available here
      const doc = parser.parseFromString(request.htmlString, "text/html");
      const linkElements = doc.querySelectorAll('a');
      const extractedLinks = [];
      linkElements.forEach(link => {
        if (link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
          extractedLinks.push(link.href);
        }
      });
      sendResponse({ links: extractedLinks });
    } catch (e) {
      console.error('Offscreen document parsing error:', e);
      sendResponse({ error: e.message });
    }
    return true; // Indicates you wish to send a response asynchronously
  }
});