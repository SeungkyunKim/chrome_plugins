// Guard against multiple injections by checking for a global flag
if (typeof window.linkExtractorInitialized === 'undefined') {
  window.linkExtractorInitialized = true;

  // Declare all global state variables for the extension on the window object
  window.extHoverBox = null; // Renamed to avoid any potential global conflicts, though 'hoverBox' on window was specific.
  window.extLinkListContainer = null;
  window.extLastClickX = 0;
  window.extLastClickY = 0;
  // window.extMouseX = 0; // mouseX and mouseY are not used in createHoverBox, can be removed if not used elsewhere
  // window.extMouseY = 0;

  // Update mouse position on mouse move - only if needed for positioning.
  // document.addEventListener('mousemove', (e) => {
  //   window.extMouseX = e.clientX;
  //   window.extMouseY = e.clientY;
  // });

  // Add event listener to track right-click position
  document.addEventListener('mousedown', function(e) {
    if (e.button === 2) { // Right click
      window.extLastClickX = e.clientX;
      window.extLastClickY = e.clientY;
    }
  });

  // Function to create the hover box
  window.createExtensionHoverBox = function() {
    // If an old hoverBox exists, remove it from the DOM
    if (window.extHoverBox) {
      if (window.extHoverBox.parentNode) {
        window.extHoverBox.parentNode.removeChild(window.extHoverBox);
      }
      window.extHoverBox = null; // Clear the reference
    }

    window.extHoverBox = document.createElement('div');
    window.extHoverBox.id = 'link-extractor-hover-box';
    window.extHoverBox.style.position = 'fixed';

    const viewportWidth  = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const boxWidth       = 350;
    const boxHeight      = 400; // This is max-height, actual height might be less.
                                // For positioning, we primarily care about width for right alignment.

    let leftPos, topPos;

    // Always position at top-right
    leftPos = viewportWidth - boxWidth - 20;  // 20px offset from the right edge
    topPos  = 20;                             // 20px offset from the top edge

    // Ensure the box stays within viewport boundaries, especially if the viewport is very small.
    // Adjust left position to prevent overflow on the right (should be handled by initial calc, but good for safety).
    leftPos = Math.min(leftPos, viewportWidth  - boxWidth  - 10); // Ensure at least 10px margin from right
    // Adjust top position to prevent overflow on the bottom (using boxHeight as a reference for max potential height).
    topPos  = Math.min(topPos,  viewportHeight - boxHeight - 10); // Ensure at least 10px margin from bottom if box is full height

    // Ensure the box is not positioned off-screen to the left or top.
    leftPos = Math.max(10, leftPos); // Ensure at least 10px margin from left
    topPos  = Math.max(10, topPos);  // Ensure at least 10px margin from top

    window.extHoverBox.style.left = `${leftPos}px`;
    window.extHoverBox.style.top  = `${topPos}px`;

    window.extHoverBox.style.width = `${boxWidth}px`;
    window.extHoverBox.style.maxHeight = `${boxHeight}px`;
    window.extHoverBox.style.overflowY = 'auto';
    window.extHoverBox.style.backgroundColor = 'white';
    window.extHoverBox.style.border = '1px solid #ccc';
    window.extHoverBox.style.borderRadius = '5px';
    window.extHoverBox.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    window.extHoverBox.style.zIndex = '2147483647'; // Max z-index
    window.extHoverBox.style.padding = '15px';
    window.extHoverBox.style.fontFamily = 'Arial, sans-serif';
    window.extHoverBox.style.fontSize = '14px';
    window.extHoverBox.style.color = '#333';
    window.extHoverBox.style.textAlign = 'left';

    const title = document.createElement('h4');
    title.textContent = 'Extracted Links';
    title.style.marginTop = '0';
    title.style.marginBottom = '10px';
    title.style.borderBottom = '1px solid #eee';
    title.style.paddingBottom = '5px';
    title.style.textAlign = 'left';

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px'; // Slightly larger for easier clicking
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#aaa';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';
    closeButton.style.lineHeight = '30px'; // Center the 'x'
    closeButton.style.borderRadius = '50%';
    closeButton.style.textAlign = 'center';
    closeButton.style.padding = '0';
    closeButton.onmouseover = () => {
        closeButton.style.color = '#333';
        closeButton.style.backgroundColor = '#f2f2f2';
    };
    closeButton.onmouseout = () => {
        closeButton.style.color = '#aaa';
        closeButton.style.backgroundColor = 'transparent';
    };
    closeButton.onclick = () => {
        if (window.extHoverBox) window.extHoverBox.style.display = 'none';
    };

    window.extLinkListContainer = document.createElement('div');
    window.extLinkListContainer.style.textAlign = 'left';

    window.extHoverBox.appendChild(title);
    window.extHoverBox.appendChild(closeButton);
    window.extHoverBox.appendChild(window.extLinkListContainer);
    document.body.appendChild(window.extHoverBox);

    makeExtensionDraggable(window.extHoverBox, title);
  };

  // Draggable functionality
  function makeExtensionDraggable(element, dragHandle) {
    let offsetX = 0, offsetY = 0;
    let isDragging = false;

    dragHandle.style.cursor = 'move';
    dragHandle.addEventListener('mousedown', startDrag);

    function startDrag(e) {
      e.preventDefault();
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
    }

    function drag(e) {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      element.style.left = `${Math.max(0, Math.min(window.innerWidth - element.offsetWidth, x))}px`;
      element.style.top = `${Math.max(0, Math.min(window.innerHeight - element.offsetHeight, y))}px`;
    }

    function stopDrag() {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', stopDrag);
    }
  }

  // Helper function to extract domain from URL
  function getExtensionDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url; // Fallback for invalid URLs
    }
  }

  // Function to display links or messages in the hover box
  window.displayInExtensionHoverBox = function(links, messageContent, sourceUrl = null, messageType = 'info') {
    // Always create a new box, ensuring the old one is removed.
    window.createExtensionHoverBox();
    // window.extHoverBox.style.display = 'block'; // createExtensionHoverBox already appends it, making it visible.
    // window.extLinkListContainer.innerHTML = ''; // createExtensionHoverBox provides a fresh container.

    if (sourceUrl) {
      const sourceElement = document.createElement('p');
      sourceElement.textContent = `Source: ${getExtensionDomain(sourceUrl)}`;
      sourceElement.style.fontSize = '12px';
      sourceElement.style.color = '#666';
      sourceElement.style.marginBottom = '10px';
      sourceElement.style.marginTop = '0'; // Adjust if title is present
      window.extLinkListContainer.appendChild(sourceElement);
    }

    if (messageContent) {
      const messageElement = document.createElement('p');
      messageElement.textContent = messageContent;
      if (messageType === 'error') {
        messageElement.style.color = 'red';
      } else if (messageType === 'warning') {
        messageElement.style.color = 'orange';
      }
      window.extLinkListContainer.appendChild(messageElement);
      // If it's a "domain not permitted" message, you might not want the fallback button.
      // Consider if displayFetchErrorWithFallback is still needed or if its logic should be merged here.
      if (messageType === 'error' && sourceUrl && messageContent.toLowerCase().includes("http error")) { // Example condition for fallback
          displayFetchErrorWithFallbackButton(messageContent, sourceUrl); // Simplified fallback
      }
      if (messageType === 'warning' && sourceUrl) {
        // show “Add domain” button
        const domain = getExtensionDomain(sourceUrl);
        const addBtn = document.createElement('button');
        addBtn.textContent = `Add “${domain}” to Permitted Domains`;
        addBtn.style.marginTop = '10px';
        addBtn.style.padding = '6px 12px';
        addBtn.style.backgroundColor = '#4285f4';
        addBtn.style.color = '#fff';
        addBtn.style.border = 'none';
        addBtn.style.borderRadius = '4px';
        addBtn.style.cursor = 'pointer';
        addBtn.onclick = () => {
          // send request to background to add it
          chrome.runtime.sendMessage(
            { action: 'addDomain', domain: domain },
            (response) => {
              if (response.status === 'success') {
                addBtn.textContent = 'Domain added ✓';
                addBtn.onclick = () => {
                  if (window.extHoverBox) {
                    window.extHoverBox.style.display = 'none';
                  }
                };
              } else if (response.status === 'exists') {
                addBtn.textContent = 'Already permitted';
                addBtn.disabled = true;
              }
            }
          );
        };
        window.extLinkListContainer.appendChild(addBtn);
        return;
      }
      return;
    }

    if (!links || links.length === 0) {
      const noLinksElement = document.createElement('p');
      noLinksElement.textContent = 'No HTTP(S) links found.';
      window.extLinkListContainer.appendChild(noLinksElement);
      return;
    }

    const countElement = document.createElement('p');
    countElement.textContent = `Found ${links.length} links:`;
    countElement.style.fontSize = '12px';
    countElement.style.color = '#666';
    countElement.style.marginBottom = '10px';
    window.extLinkListContainer.appendChild(countElement);

    links.forEach((link, index) => {
      const linkElement = document.createElement('a');
      linkElement.href = link;
      const domain = getExtensionDomain(link);
      linkElement.textContent = `[${index + 1}] ${domain}`; // Display domain for brevity
      linkElement.title = link; // Full link in title
      linkElement.target = '_blank';
      linkElement.style.display = 'block';
      linkElement.style.marginBottom = '5px';
      linkElement.style.wordBreak = 'break-all';
      linkElement.style.color = '#007bff';
      linkElement.style.textDecoration = 'none';
      linkElement.onmouseover = () => linkElement.style.textDecoration = 'underline';
      linkElement.onmouseout = () => linkElement.style.textDecoration = 'none';
      window.extLinkListContainer.appendChild(linkElement);
    });
  };

  // Simplified fallback button display
  function displayFetchErrorWithFallbackButton(errorMessage, url) {
    // This function assumes extLinkListContainer is already cleared and error message is shown by caller.
    // It just adds the fallback part.
    const fallbackMsg = document.createElement('p');
    fallbackMsg.textContent = 'This might be due to network issues or page restrictions. Would you like to try opening the page in a new tab?';
    fallbackMsg.style.marginTop = '10px';
    window.extLinkListContainer.appendChild(fallbackMsg);

    const fallbackButton = document.createElement('button');
    fallbackButton.textContent = 'Open in New Tab & Retry';
    fallbackButton.style.backgroundColor = '#007bff';
    fallbackButton.style.color = 'white';
    // ... (add other styles as in your original displayFetchErrorWithFallback)
    fallbackButton.style.border = 'none';
    fallbackButton.style.padding = '8px 12px';
    fallbackButton.style.borderRadius = '4px';
    fallbackButton.style.cursor = 'pointer';
    fallbackButton.style.marginTop = '10px';
    fallbackButton.onclick = () => {
      chrome.runtime.sendMessage({ action: 'openUrlInNewTab', url: url });
      if (window.extHoverBox) window.extHoverBox.style.display = 'none'; // Close box after clicking
    };
    window.extLinkListContainer.appendChild(fallbackButton);
  }


  // Message listener from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showLinks') {
      window.displayInExtensionHoverBox(request.links, null, request.sourceUrl);
      sendResponse({ status: "Hover box displayed with links" });
      return true;
    } else if (request.action === 'showMessage') {
      window.displayInExtensionHoverBox(null, request.message, request.sourceUrl, request.type || 'info');
      sendResponse({ status: "Message displayed in hover box" });
      return true;
    }
    // Return false if not handling the message or not sending an async response
    return false;
  });

  // Close hover box with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (window.extHoverBox && window.extHoverBox.style.display !== 'none') {
        window.extHoverBox.style.display = 'none';
      }
    }
  });

} // End of window.linkExtractorInitialized guard
