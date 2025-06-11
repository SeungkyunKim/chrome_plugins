// Apply all saved replacements when page is fully loaded
window.addEventListener('load', function() {
  applyAllSavedReplacements();
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'replaceText') {
    const result = performTextReplacement(message.tagName, message.findText, message.replaceText);
    sendResponse(result);
    return true;
  }
});

// Function to apply all saved replacements
function applyAllSavedReplacements() {
  // Get current domain
  const currentDomain = window.location.hostname;
  
  chrome.storage.local.get('savedSets', function(data) {
    const savedSets = data.savedSets || [];
    
    // Filter sets to only those matching current domain or with no domain (for backward compatibility)
    const matchingSets = savedSets.filter(set => !set.domain || set.domain === currentDomain);
    
    // Apply each matching set
    matchingSets.forEach(function(set) {
      performTextReplacement(set.tagName, set.findText, set.replaceText);
    });
  });
}

// Function to perform text replacement
function performTextReplacement(tagName, findText, replaceText) {
  try {
    // Get all elements with the specified tag name
    const elements = document.getElementsByTagName(tagName);
    let replacementCount = 0;
    
    // Loop through all matching elements
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      // Get all text nodes within this element (including nested ones)
      const textNodes = getTextNodesIn(element);
      
      // Process each text node
      for (let j = 0; j < textNodes.length; j++) {
        const node = textNodes[j];
        const text = node.nodeValue;
        
        if (text.includes(findText)) {
          // Replace text in the node
          node.nodeValue = text.split(findText).join(replaceText);
          replacementCount++;
        }
      }
    }
    
    return {
      success: true,
      count: replacementCount
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

// Helper function to get all text nodes within an element (recursive)
function getTextNodesIn(element) {
  const textNodes = [];
  
  function getTextNodes(node) {
    if (node.nodeType === 3) { // Text node
      textNodes.push(node);
    } else if (node.nodeType === 1 || node.nodeType === 9 || node.nodeType === 11) { // Element, Document, or DocumentFragment
      for (let i = 0; i < node.childNodes.length; i++) {
        getTextNodes(node.childNodes[i]);
      }
    }
  }
  
  getTextNodes(element);
  return textNodes;
}