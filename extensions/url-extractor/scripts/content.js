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

function createHoverBox() {
    if (hoverBox) {
        document.body.removeChild(hoverBox); // Remove old one if exists
    }

    hoverBox = document.createElement('div');
    hoverBox.id = 'link-extractor-hover-box';
    hoverBox.style.position = 'fixed';
    hoverBox.style.top = '20px';
    hoverBox.style.right = '20px';
    hoverBox.style.width = '350px';
    hoverBox.style.maxHeight = '400px';
    hoverBox.style.overflowY = 'auto';
    hoverBox.style.backgroundColor = 'white';
    hoverBox.style.border = '1px solid #ccc';
    hoverBox.style.borderRadius = '5px';
    hoverBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    hoverBox.style.zIndex = '999999'; // Ensure it's on top
    hoverBox.style.padding = '15px';
    hoverBox.style.fontFamily = 'Arial, sans-serif';
    hoverBox.style.fontSize = '14px';
    hoverBox.style.color = '#333';

    const title = document.createElement('h4');
    title.textContent = 'Extracted Links';
    title.style.marginTop = '0';
    title.style.marginBottom = '10px';
    title.style.borderBottom = '1px solid #eee';
    title.style.paddingBottom = '5px';

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
    closeButton.onclick = () => {
        if (hoverBox) hoverBox.style.display = 'none';
    };

    linkListContainer = document.createElement('div');

    hoverBox.appendChild(title);
    hoverBox.appendChild(closeButton);
    hoverBox.appendChild(linkListContainer);
    document.body.appendChild(hoverBox);
}

function displayInHoverBox(links, error, sourceUrl = null) {
    if (!hoverBox || hoverBox.style.display === 'none') {
        createHoverBox();
    }
    hoverBox.style.display = 'block';
    linkListContainer.innerHTML = ''; // Clear previous content

    if (sourceUrl) {
        const sourceElement = document.createElement('p');
        sourceElement.textContent = `Source: ${sourceUrl}`;
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

    links.forEach(link => {
        const linkElement = document.createElement('a');
        linkElement.href = link;
        linkElement.textContent = link;
        linkElement.target = '_blank';
        linkElement.style.display = 'block';
        linkElement.style.marginBottom = '5px';
        linkElement.style.wordBreak = 'break-all';
        linkElement.style.color = '#007bff';
        linkElement.style.textDecoration = 'none';
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