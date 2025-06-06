chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLinks') {
        const linkElements = document.querySelectorAll('a');
        const links = [];
        linkElements.forEach(link => {
            if (link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
                links.push(link.href);
            }
        });
        sendResponse({ links: links });
        return true; // Indicates you wish to send a response asynchronously (important for MV3)
    }
});

let hoverBox = null;
let linkListContainer = null;

// Add these variables to track mouse position
let lastClickX = 0;
let lastClickY = 0;

// Add event listener to track right-click position
document.addEventListener('mousedown', function(e) {
    if (e.button === 2) { // Right click
        lastClickX = e.clientX;
        lastClickY = e.clientY;
    }
});

// Modify createHoverBox function
function createHoverBox() {
    if (hoverBox) {
        document.body.removeChild(hoverBox); // Remove old one if exists
    }

    hoverBox = document.createElement('div');
    hoverBox.id = 'link-extractor-hover-box';
    hoverBox.style.position = 'fixed';
    
    // Position near the cursor, but ensure it stays in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const boxWidth = 350; // Same as width below
    const boxHeight = 400; // Maximum height defined below
    
    // Calculate position - keep box within viewport
    let leftPos = Math.min(lastClickX, viewportWidth - boxWidth - 20);
    let topPos = Math.min(lastClickY, viewportHeight - 100);
    
    // Ensure minimum distance from edges
    leftPos = Math.max(10, leftPos);
    topPos = Math.max(10, topPos);
    
    hoverBox.style.left = `${leftPos}px`;
    hoverBox.style.top = `${topPos}px`;
    
    // Other styles
    hoverBox.style.width = '350px';
    hoverBox.style.maxHeight = '400px';
    hoverBox.style.overflowY = 'auto';
    hoverBox.style.backgroundColor = 'white';
    hoverBox.style.border = '1px solid #ccc';
    hoverBox.style.borderRadius = '5px';
    hoverBox.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    hoverBox.style.zIndex = '999999'; // Ensure it's on top
    hoverBox.style.padding = '15px';
    hoverBox.style.fontFamily = 'Arial, sans-serif';
    hoverBox.style.fontSize = '14px';
    hoverBox.style.color = '#333';
    hoverBox.style.textAlign = 'left'; // Explicitly align content to left

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
        if (hoverBox) hoverBox.style.display = 'none';
    };

    linkListContainer = document.createElement('div');
    linkListContainer.style.textAlign = 'left'; // Ensure links are left-aligned

    hoverBox.appendChild(title);
    hoverBox.appendChild(closeButton);
    hoverBox.appendChild(linkListContainer);
    document.body.appendChild(hoverBox);
    
    // Add draggable functionality
    makeDraggable(hoverBox, title);
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

function displayInHoverBox(links, error, sourceUrl = null) {
    if (!hoverBox || hoverBox.style.display === 'none') {
        createHoverBox();
    }
    hoverBox.style.display = 'block';
    linkListContainer.innerHTML = ''; // Clear previous content

    if (sourceUrl) {
        const sourceElement = document.createElement('p');
        sourceElement.textContent = `Source: ${getDomain(sourceUrl)}`;
        sourceElement.style.fontSize = '12px';
        sourceElement.style.color = '#666';
        sourceElement.style.marginBottom = '10px';
        linkListContainer.appendChild(sourceElement);
    }

    if (error) {
        const errorElement = document.createElement('p');
        errorElement.textContent = error;
        errorElement.style.color = 'red';
        linkListContainer.appendChild(errorElement);
        return;
    }

    if (!links || links.length === 0) {
        const noLinksElement = document.createElement('p');
        noLinksElement.textContent = 'No HTTP(S) links found or processed.';
        linkListContainer.appendChild(noLinksElement);
        return;
    }
    
    // Add count info
    const countElement = document.createElement('p');
    countElement.textContent = `Found ${links.length} links`;
    countElement.style.fontSize = '12px';
    countElement.style.color = '#666';
    countElement.style.marginBottom = '10px';
    linkListContainer.appendChild(countElement);

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
        linkListContainer.appendChild(linkElement);
    });
}

function displayFetchErrorWithFallback(error, url) {
    if (!hoverBox || hoverBox.style.display === 'none') {
        createHoverBox();
    }
    hoverBox.style.display = 'block';
    linkListContainer.innerHTML = ''; // Clear previous content
    
    // Error message
    const errorElement = document.createElement('p');
    errorElement.textContent = error;
    errorElement.style.color = 'red';
    linkListContainer.appendChild(errorElement);
    
    // Fallback message
    const fallbackMsg = document.createElement('p');
    fallbackMsg.textContent = 'Would you like to open the page in a new tab instead?';
    linkListContainer.appendChild(fallbackMsg);
    
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
        linkListContainer.innerHTML = '<p>Opening page in new tab and extracting links...</p>';
    };
    
    linkListContainer.appendChild(fallbackButton);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showHoverBoxWithLinks') {
        // If sourceUrl is provided, show it as the source
        if (request.sourceUrl) {
            displayInHoverBox(request.links, null, request.sourceUrl);
        } else {
            displayInHoverBox(request.links, null);
        }
        sendResponse({ status: "Hover box displayed with links" });
    } else if (request.action === 'showHoverBoxWithError') {
        displayInHoverBox(null, request.error);
        sendResponse({ status: "Hover box displayed with error" });
    } else if (request.action === 'showFetchErrorWithFallback') {
        displayFetchErrorWithFallback(request.error, request.url);
        sendResponse({ status: "Hover box displayed with error and fallback" });
    }
    return true;
});

// Optional: Add a way to remove the hover box if the user navigates away
// or if the content script is re-injected.
// window.addEventListener('beforeunload', () => {
//   if (hoverBox && hoverBox.parentNode) {
//     document.body.removeChild(hoverBox);
//   }
// });