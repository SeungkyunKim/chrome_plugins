// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'replaceText') {
    const result = performTextReplacement(message.tagName, message.findText, message.replaceText);
    sendResponse(result);
    return true;
  } else if (message.action === 'applyAllRules') {
    // Apply all relevant rules for this page
    applyAllSavedReplacements()
      .then(result => {
        sendResponse({ 
          success: true, 
          count: result.count,
          message: `Applied ${result.count} replacements`
        });
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          message: error.message || "Failed to apply rules" 
        });
      });
    return true; // Indicates async response
  }
});

// Update to return a Promise
function applyAllSavedReplacements() {
  return new Promise((resolve) => {
    const currentDomain = window.location.hostname;
    let totalReplacements = 0;
    
    chrome.storage.local.get('savedSets', function(data) {
      const savedSets = data.savedSets || [];
      
      // Only apply rules with a domain that matches the current page
      // Remove the "!set.domain ||" condition to eliminate the "all domains" behavior
      const matchingSets = savedSets.filter(set => 
        set.domain && currentDomain.includes(set.domain)
      );
      
      // Apply each matching set
      matchingSets.forEach(function(set) {
        const result = performTextReplacement(set.tagName, set.findText, set.replaceText);
        if (result.success) {
          totalReplacements += result.count;
        }
      });
      
      resolve({ 
        count: totalReplacements, 
        rulesApplied: matchingSets.length 
      });
    });
  });
}

// Function to perform text replacement
function performTextReplacement(tagName, findText, replaceText) {
  try {
    let replacementCount = 0;
    
    // Check if tag input contains a property specification (tagName;propertyName)
    if (tagName.includes(';')) {
      const [actualTagName, propertyName] = tagName.split(';');
      
      // Get all elements with the specified tag name
      const elements = document.getElementsByTagName(actualTagName);
      
      // Loop through all matching elements
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Check if the element has the specified property
        if (element.hasAttribute(propertyName)) {
          const propertyValue = element.getAttribute(propertyName);
          
          try {
            // Always treat as regex first
            const regexPattern = new RegExp(findText, 'g');
            
            // Check if there's a match
            if (regexPattern.test(propertyValue)) {
              // Reset lastIndex property
              regexPattern.lastIndex = 0;
              
              // Replace using regex
              const newValue = propertyValue.replace(regexPattern, replaceText);
              element.setAttribute(propertyName, newValue);
              replacementCount++;
            }
          } catch (regexError) {
            console.log("Treating as plain text due to invalid regex:", regexError);
            
            // Fallback to plain text if regex is invalid
            if (propertyValue.includes(findText)) {
              const newValue = propertyValue.split(findText).join(replaceText);
              element.setAttribute(propertyName, newValue);
              replacementCount++;
            }
          }
        }
      }
    } 
    // Original text node replacement logic
    else {
      // Get all elements with the specified tag name
      const elements = document.getElementsByTagName(tagName);
      
      // Loop through all matching elements
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Get all text nodes within this element (including nested ones)
        const textNodes = getTextNodesIn(element);
        
        // Process each text node
        for (let j = 0; j < textNodes.length; j++) {
          const node = textNodes[j];
          const text = node.nodeValue;
          
          try {
            // Always treat as regex first
            const regexPattern = new RegExp(findText, 'g');
            
            // Check if there's a match
            if (regexPattern.test(text)) {
              // Reset lastIndex property
              regexPattern.lastIndex = 0;
              
              // Replace using regex
              node.nodeValue = text.replace(regexPattern, replaceText);
              replacementCount++;
            }
          } catch (regexError) {
            console.log("Treating as plain text due to invalid regex:", regexError);
            
            // Fallback to plain text if regex is invalid
            if (text.includes(findText)) {
              node.nodeValue = text.split(findText).join(replaceText);
              replacementCount++;
            }
          }
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