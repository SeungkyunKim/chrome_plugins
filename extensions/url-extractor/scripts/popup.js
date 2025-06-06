const displayLinks = (links, error) => {
    const linkContainer = document.getElementById('link-container');
    linkContainer.innerHTML = ''; // Clear previous content

    if (error) {
        linkContainer.innerHTML = `<p style="color: red;">${error}</p>`;
        return;
    }

    if (!links || links.length === 0) {
        linkContainer.innerHTML = '<p>No HTTP(S) links found or processed.</p>';
        return;
    }

    links.forEach(link => {
        const linkElement = document.createElement('a');
        linkElement.href = link;
        linkElement.textContent = link;
        linkElement.target = '_blank'; // Open link in a new tab
        linkContainer.appendChild(linkElement);
        linkContainer.appendChild(document.createElement('br')); // Add line break
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const linkContainer = document.getElementById('link-container');
    if (linkContainer) {
        linkContainer.innerHTML = '<p>Loading links...</p>';
    }

    // Try to get links processed by the context menu action
    chrome.storage.local.get(['linksForPopup', 'error'], (data) => {
        if (chrome.runtime.lastError) {
            console.error("Error retrieving from storage:", chrome.runtime.lastError);
            displayLinks(null, "Error retrieving stored links.");
            return;
        }

        if (data.linksForPopup !== undefined) {
            displayLinks(data.linksForPopup, data.error);
            // Clear the stored links and error after displaying them
            chrome.storage.local.remove(['linksForPopup', 'error']);
        } else {
            // Fallback or default message if no context menu action has stored links
            // You could re-implement the "get links from current page" logic here if desired
            // For now, it will just show a default message if displayLinks is called with undefined.
            displayLinks(null, "Right-click a link and use the context menu to extract links from its target page.");
        }
    });
});