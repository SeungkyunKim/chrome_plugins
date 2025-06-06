// Guard against multiple injections by checking for a global flag
if (typeof window.linkExtractorInitialized === 'undefined') {
  window.linkExtractorInitialized = true;

  // Put all variable declarations inside this guard
  window.hoverBox = null;
  window.linkListContainer = null;
  window.lastClickX = 0;
  window.lastClickY = 0;
  window.mouseX = 0;
  window.mouseY = 0;

  // Update mouse position on mouse move
  document.addEventListener('mousemove', (e) => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
  });

  // Add event listener to track right-click position
  document.addEventListener('mousedown', function(e) {
    if (e.button === 2) { // Right click
      window.lastClickX = e.clientX;
      window.lastClickY = e.clientY;
    }
  });

  // Modify createHoverBox function
  window.createHoverBox = function() {
    if (window.hoverBox) {
      document.body.removeChild(window.hoverBox); // Remove old one if exists
    }

    window.hoverBox = document.createElement('div');
    window.hoverBox.id = 'link-extractor-hover-box';
    window.hoverBox.style.position = 'fixed';

    // Position near the cursor, but ensure it stays in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const boxWidth = 350; // Same as width below
    const boxHeight = 400; // Maximum height defined below

    // Calculate position - keep box within viewport
    let leftPos = Math.min(window.lastClickX, viewportWidth - boxWidth - 20);
    let topPos = Math.min(window.lastClickY, viewportHeight - 100);

    // Ensure minimum distance from edges
    leftPos = Math.max(10, leftPos);
    topPos = Math.max(10, topPos);

    window.hoverBox.style.left = `${leftPos}px`;
    window.hoverBox.style.top = `${topPos}px`;

    // Other styles
    window.hoverBox.style.width = '350px';
    window.hoverBox.style.maxHeight = '400px';
    window.hoverBox.style.overflowY = 'auto';
    window.hoverBox.style.backgroundColor = 'white';
    window.hoverBox.style.border = '1px solid #ccc';
    window.hoverBox.style.borderRadius = '5px';
    window.hoverBox.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    window.hoverBox.style.zIndex = '999999'; // Ensure it's on top
    window.hoverBox.style.padding = '15px';
    window.hoverBox.style.fontFamily = 'Arial, sans-serif';
    window.hoverBox.style.fontSize = '14px';
    window.hoverBox.style.color = '#333';
    window.hoverBox.style.textAlign = 'left'; // Explicitly align content to left

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
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#aaa';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';
    closeButton.style.lineHeight = '20px';
    closeButton.style.borderRadius = '50%';
    closeButton.style.textAlign = 'center';
    closeButton.onmouseover = () => {
        closeButton.style.color = '#333';
        closeButton.style.backgroundColor = '#f2f2f2';
    };
    closeButton.onmouseout = () => {
        closeButton.style.color = '#aaa';
        closeButton.style.backgroundColor = 'transparent';
    };
    closeButton.onclick = () => {
        if (window.hoverBox) window.hoverBox.style.display = 'none';
    };

    window.linkListContainer = document.createElement('div');
    window.linkListContainer.style.textAlign = 'left'; // Ensure links are left-aligned

    window.hoverBox.appendChild(title);
    window.hoverBox.appendChild(closeButton);
    window.hoverBox.appendChild(window.linkListContainer);
    document.body.appendChild(window.hoverBox);

    // Add draggable functionality
    makeDraggable(window.hoverBox, title);
  }
}

// Add draggable functionality to the hover box
function makeDraggable(element, dragHandle) {
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

// Add this helper function to extract domain from URL
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        // If URL parsing fails, return the original
        return url;
    }
}

window.displayInHoverBox = function(links, error, sourceUrl = null) {
    if (!window.hoverBox || window.hoverBox.style.display === 'none') {
        window.createHoverBox();
    }
    window.hoverBox.style.display = 'block';
    window.linkListContainer.innerHTML = ''; // Clear previous content

    if (sourceUrl) {
        const sourceElement = document.createElement('p');
        sourceElement.textContent = `Source: ${getDomain(sourceUrl)}`;
        sourceElement.style.fontSize = '12px';
        sourceElement.style.color = '#666';
        sourceElement.style.marginBottom = '10px';
        window.linkListContainer.appendChild(sourceElement);
    }

    if (error) {
        const errorElement = document.createElement('p');
        errorElement.textContent = error;
        errorElement.style.color = 'red';
        window.linkListContainer.appendChild(errorElement);
        return;
    }

    if (!links || links.length === 0) {
        const noLinksElement = document.createElement('p');
        noLinksElement.textContent = 'No HTTP(S) links found or processed.';
        window.linkListContainer.appendChild(noLinksElement);
        return;
    }

    // Add count info
    const countElement = document.createElement('p');
    countElement.textContent = `Found ${links.length} links`;
    countElement.style.fontSize = '12px';
    countElement.style.color = '#666';
    countElement.style.marginBottom = '10px';
    window.linkListContainer.appendChild(countElement);

    // Create links with index and domain only
    links.forEach((link, index) => {
        const linkElement = document.createElement('a');
        linkElement.href = link;

        // Display format: [index] domain.com
        const domain = getDomain(link);
        linkElement.textContent = `[${index + 1}] ${domain}`;

        // Set the full URL as title for hover tooltip
        linkElement.title = link;

        linkElement.target = '_blank';
        linkElement.style.display = 'block';
        linkElement.style.marginBottom = '5px';
        linkElement.style.wordBreak = 'break-all';
        linkElement.style.color = '#007bff';
        linkElement.style.textDecoration = 'none';
        linkElement.style.textAlign = 'left';
        linkElement.style.paddingRight = '10px'; 
        linkElement.onmouseover = () => linkElement.style.textDecoration = 'underline';
        linkElement.onmouseout = () => linkElement.style.textDecoration = 'none';
        window.linkListContainer.appendChild(linkElement);
    });
}

function displayFetchErrorWithFallback(error, url) {
    if (!window.hoverBox || window.hoverBox.style.display === 'none') {
        window.createHoverBox();
    }
    window.hoverBox.style.display = 'block';
    window.linkListContainer.innerHTML = ''; // Clear previous content

    // Error message
    const errorElement = document.createElement('p');
    errorElement.textContent = error;
    errorElement.style.color = 'red';
    window.linkListContainer.appendChild(errorElement);

    // Fallback message
    const fallbackMsg = document.createElement('p');
    fallbackMsg.textContent = 'Would you like to open the page in a new tab instead?';
    window.linkListContainer.appendChild(fallbackMsg);

    // Create button for fallback
    const fallbackButton = document.createElement('button');
    fallbackButton.textContent = 'Open in New Tab';
    fallbackButton.style.backgroundColor = '#007bff';
    fallbackButton.style.color = 'white';
    fallbackButton.style.border = 'none';
    fallbackButton.style.padding = '8px 12px';
    fallbackButton.style.borderRadius = '4px';
    fallbackButton.style.cursor = 'pointer';
    fallbackButton.style.marginTop = '10px';
    fallbackButton.onclick = () => {
        // Send message to background script to open URL in new tab
        chrome.runtime.sendMessage({
            action: 'openUrlInNewTab',
            url: url
        });

        // Update hover box to show loading
        window.linkListContainer.innerHTML = '<p>Opening page in new tab and extracting links...</p>';
    };

    window.linkListContainer.appendChild(fallbackButton);
}

// Keep message listeners outside the initialization guard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showHoverBoxWithLinks') {
    // If sourceUrl is provided, show it as the source
    if (request.sourceUrl) {
      window.displayInHoverBox(request.links, null, request.sourceUrl);
    } else {
      window.displayInHoverBox(request.links, null);
    }
    sendResponse({ status: "Hover box displayed with links" });
  } else if (request.action === 'showHoverBoxWithError') {
    window.displayInHoverBox(null, request.error);
    sendResponse({ status: "Hover box displayed with error" });
  } else if (request.action === 'showFetchErrorWithFallback') {
    window.displayFetchErrorWithFallback(request.error, request.url);
    sendResponse({ status: "Hover box displayed with error and fallback" });
  } else if (request.action === 'showPermissionRequest') {
    window.showPermissionDialog(request.url, request.host);
    sendResponse({ status: "Permission dialog shown" });
  } else if (request.action === 'showLinks') {
    window.displayLinksOnPage(request.links, request.sourceUrl);
    sendResponse({ status: "Links displayed" });
  } else if (request.action === 'showMessage') {
    window.showNotification(request.message, request.type);
    sendResponse({ status: "Notification shown" });
  }
  return true;
});

// Function to show permission dialog
function showPermissionDialog(url, hostname) {
  // First, remove any existing permission dialogs
  const existingDialog = document.getElementById('link-extractor-permission-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Create and style the dialog container
  const dialogContainer = document.createElement('div');
  dialogContainer.id = 'link-extractor-permission-dialog';
  dialogContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999999;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: Arial, sans-serif;
  `;

  // Create unique IDs for this instance of the dialog
  const allowBtnId = 'le-allow-btn-' + Date.now();
  const denyBtnId = 'le-deny-btn-' + Date.now();

  // Create the dialog content without the checkbox section
  dialogContainer.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
      <h2 style="margin-top: 0;">Domain Permission Request</h2>
      <p>Link Extractor needs permission to access this domain:</p>
      <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 18px; font-weight: bold; text-align: center;">${hostname}</p>
      <p>Approving will allow Link Extractor to access content from this domain. This is required to extract links from the target page.</p>
      <p style="font-size: 12px; color: #666;">Target page: ${url}</p>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button id="${denyBtnId}" style="padding: 8px 16px; border: 1px solid #ccc; background: #f5f5f5; border-radius: 4px; cursor: pointer;">Deny</button>
        <button id="${allowBtnId}" style="padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Allow Domain Access</button>
      </div>
    </div>
  `;

  // Append dialog to body
  document.body.appendChild(dialogContainer);

  // Add event listeners using the dynamic IDs
  const allowBtn = document.getElementById(allowBtnId);
  const denyBtn = document.getElementById(denyBtnId);

  // Make sure we found our elements
  if (allowBtn && denyBtn) {
    allowBtn.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.runtime.sendMessage({ 
        action: 'permissionResponse', 
        granted: true
      });
      dialogContainer.remove();
    });

    denyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'permissionResponse', granted: false });
      dialogContainer.remove();
    });
  } else {
    console.error('Could not find permission dialog buttons');
  }

  // Add a safety cleanup - remove dialog if extension messaging fails
  setTimeout(() => {
    if (document.body.contains(dialogContainer)) {
      dialogContainer.remove();
    }
  }, 30000); // 30 seconds timeout
}

// Function to display links on the page near mouse position
function displayLinksOnPage(links, sourceUrl) {
  // Create link display container
  const container = document.createElement('div');
  container.id = 'link-extractor-results';

  // Position near mouse but ensure it stays in viewport
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Calculate position (keep the box within viewport)
  let posX = window.mouseX + 10; // 10px offset from cursor
  let posY = window.mouseY + 10;

  // Box dimensions (estimated)
  const boxWidth = 350;
  const boxHeight = Math.min(500, links.length * 30 + 100); // Rough estimate

  // Adjust if box would go off-screen
  if (posX + boxWidth > windowWidth) {
    posX = window.mouseX - boxWidth - 10;
  }

  if (posY + boxHeight > windowHeight) {
    posY = window.mouseY - boxHeight - 10;
  }

  // Ensure box doesn't go off-screen on left/top
  posX = Math.max(10, posX);
  posY = Math.max(10, posY);

  container.style.cssText = `
    position: fixed;
    top: ${posY}px;
    left: ${posX}px;
    width: 350px;
    max-height: 500px;
    background: white;
    z-index: 9999998;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    overflow: hidden;
    font-family: Arial, sans-serif;
  `;

  // Create header with close button
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 10px 15px;
    background: #f5f5f5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ddd;
  `;
  header.innerHTML = `
    <div>Links from: ${getDomain(sourceUrl)}</div>
    <button id="le-close-btn" style="background: none; border: none; cursor: pointer; font-size: 16px;">✕</button>
  `;

  // Create content area with links
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 10px 15px;
    max-height: 400px;
    overflow-y: auto;
  `;

  if (links.length === 0) {
    content.innerHTML = '<p>No links found on this page.</p>';
  } else {
    // Add count info
    const countElement = document.createElement('p');
    countElement.textContent = `Found ${links.length} links`;
    countElement.style.cssText = `
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
    `;
    content.appendChild(countElement);

    const linkList = document.createElement('ul');
    linkList.style.cssText = `
      list-style: none;
      padding: 0;
      margin: 0;
    `;

    links.forEach((link, index) => {
      const item = document.createElement('li');
      item.style.margin = '8px 0';

      const linkElement = document.createElement('a');
      linkElement.href = link;

      // Display format: [index] domain.com
      const domain = getDomain(link);
      linkElement.textContent = `[${index + 1}] ${domain}`;

      // Set the full URL as title for hover tooltip
      linkElement.title = link;

      linkElement.target = '_blank';
      linkElement.style.cssText = `
        display: block;
        word-break: break-all;
        color: #007bff;
        text-decoration: none;
        text-align: left;
      `;

      linkElement.onmouseover = () => linkElement.style.textDecoration = 'underline';
      linkElement.onmouseout = () => linkElement.style.textDecoration = 'none';

      item.appendChild(linkElement);
      linkList.appendChild(item);
    });

    content.appendChild(linkList);
  }

  // Assemble and add to page
  container.appendChild(header);
  container.appendChild(content);
  document.body.appendChild(container);

  // Add event listener to close button
  document.getElementById('le-close-btn').addEventListener('click', () => {
    container.remove();
  });

  // Make the box draggable for better user experience
  makeElementDraggable(container, header);
}

// Function to make elements draggable
function makeElementDraggable(element, dragHandle) {
  let offsetX = 0, offsetY = 0;
  let isDragging = false;

  dragHandle.style.cursor = 'grab';

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    dragHandle.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    dragHandle.style.cursor = 'grab';
  });
}

// Function to show notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 4px;
    color: white;
    z-index: 9999999;
    max-width: 300px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
    opacity: 0.95;
  `;

  // Set background color based on type
  if (type === 'error') {
    notification.style.backgroundColor = '#d93025';
  } else if (type === 'success') {
    notification.style.backgroundColor = '#1e8e3e';
  } else {
    notification.style.backgroundColor = '#1a73e8';
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
