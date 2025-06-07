const displayLinks = (links, error, container) => {
    container.innerHTML = '';

    if (error) {
        container.innerHTML = `<p style="color: red;">${error}</p>`;
        return;
    }

    if (!links || links.length === 0) {
        container.innerHTML = '<p>No HTTP(S) links found or processed.</p>';
        return;
    }

    const header = document.createElement('h3');
    header.textContent = `Found ${links.length} Links`;
    container.appendChild(header);

    const linksList = document.createElement('ul');
    linksList.className = 'links-list';

    links.forEach((link, index) => {
        try {
            const url = new URL(link);
            const domain = url.hostname;

            const item = document.createElement('li');
            const linkElement = document.createElement('a');
            linkElement.href = link;
            linkElement.textContent = `[${index + 1}] ${domain}`;
            linkElement.title = link;
            linkElement.target = '_blank';

            item.appendChild(linkElement);
            linksList.appendChild(item);
        } catch (e) {
            // Skip invalid URLs
            console.warn('Invalid URL:', link);
        }
    });

    container.appendChild(linksList);
};

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('domain-container');

    // Title and description
    const header = document.createElement('div');
    header.innerHTML = `
        <h3>Domain Management</h3>
        <p>Manage domains that Link Extractor is allowed to access.</p>
    `;
    container.appendChild(header);

    // Create domain management UI directly
    const domainsContent = document.createElement('div');
    domainsContent.id = 'domains-content';
    container.appendChild(domainsContent);

    // Set up the domain management UI
    setupDomainManagement(domainsContent);

    // Load domains list immediately
    loadDomainsList();
});

// Function to load and display the list of permitted domains
function loadDomainsList() {
    const domainsContent = document.getElementById('domains-content');

    chrome.storage.local.get('permittedDomains', (result) => {
        const permittedDomains = result.permittedDomains || [];

        const domainsList = document.getElementById('domains-list') || document.createElement('div');
        domainsList.id = 'domains-list';
        domainsList.innerHTML = '';

        if (permittedDomains.length === 0) {
            domainsList.innerHTML = '<p>No domains have been permitted yet.</p>';
        } else {
            const list = document.createElement('ul');
            list.className = 'domains-list';

            permittedDomains.forEach(domain => {
                const item = document.createElement('li');
                item.className = 'domain-item';

                const domainText = document.createElement('span');
                domainText.textContent = domain;
                domainText.className = 'domain-text';

                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Remove';
                removeBtn.className = 'remove-domain-btn';
                removeBtn.title = 'Remove domain';
                removeBtn.onclick = () => removeDomain(domain);

                item.appendChild(domainText);
                item.appendChild(removeBtn);
                list.appendChild(item);
            });

            domainsList.appendChild(list);
        }

        // Only add if it's not already in the DOM
        if (!document.getElementById('domains-list')) {
            domainsContent.appendChild(domainsList);
        }
    });
}

// Function to set up the domain management UI
function setupDomainManagement(container) {
    container.innerHTML = `
        <div class="add-domain-form">
            <input type="text" id="new-domain" placeholder="example.com" />
            <button id="add-domain-btn">Add Domain</button>
        </div>

        <div class="domains-header">
            <h4>Permitted Domains</h4>
        </div>

        <div id="domains-list">
            <p>Loading domains...</p>
        </div>
    `;

    // Set up the add domain button
    document.getElementById('add-domain-btn').addEventListener('click', () => {
        const domainInput = document.getElementById('new-domain');
        const domain = domainInput.value.trim();

        if (domain) {
            addDomain(domain);
            domainInput.value = '';
        }
    });

    // Add keyboard event listener for Enter key
    document.getElementById('new-domain').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            const domain = e.target.value.trim();
            if (domain) {
                addDomain(domain);
                e.target.value = '';
            }
        }
    });
}

// Function to add a new domain to the permitted list
function addDomain(domain) {
    let normalizedDomain = domain.trim();
    try {
        if (normalizedDomain.startsWith('http://') || normalizedDomain.startsWith('https://')) {
            const url = new URL(normalizedDomain);
            normalizedDomain = url.hostname;
        }
    } catch (e) {
        // Not a URL, continue with original input
    }

    // Normalize by removing www. prefix
    if (normalizedDomain.startsWith('www.')) {
        normalizedDomain = normalizedDomain.substring(4);
    }

    // Validate the normalized domain
    if (!normalizedDomain || !normalizedDomain.includes('.') || normalizedDomain === '.' || normalizedDomain.endsWith('.') || normalizedDomain.startsWith('.')) {
        alert('Please enter a valid domain (e.g., example.com). The "www." prefix is automatically handled.');
        return;
    }

    chrome.storage.local.get('permittedDomains', (result) => {
        const permittedDomains = result.permittedDomains || [];

        if (permittedDomains.includes(normalizedDomain)) {
            alert(`Domain "${normalizedDomain}" is already permitted.`);
            return;
        }

        permittedDomains.push(normalizedDomain);

        chrome.storage.local.set({ 'permittedDomains': permittedDomains }, () => {
            console.log(`Domain "${normalizedDomain}" added successfully.`);
            loadDomainsList(); // Refresh the displayed list

            // Optional: Request host permission for the original input if needed,
            // but the primary permission check will use the normalized list.
            // For simplicity, this part can be omitted if direct host permissions
            // are not strictly managed beyond the custom list.
            // const hostPattern = `*://${domain.startsWith('www.') ? domain : 'www.' + domain}/*`; // or construct based on original input
            // chrome.permissions.request({ origins: [`*://${normalizedDomain}/*`, `*://www.${normalizedDomain}/*`] }, ...);
        });
    });
}

// Function to remove a domain from the permitted list
function removeDomain(domain) {
    chrome.storage.local.get('permittedDomains', (result) => {
        const permittedDomains = result.permittedDomains || [];
        const newList = permittedDomains.filter(d => d !== domain);

        chrome.storage.local.set({ 'permittedDomains': newList }, () => {
            console.log("loadDoainList() $domain");
            loadDomainsList();
        });
    });
}

// Create context menu once during installation
chrome.runtime.onInstalled.addListener(() => {
  // Remove any existing items first to prevent duplicates
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "extractLinksFromTargetPage",
      title: "Show links from this hyperlink's target page",
      contexts: ["link"]
    });
  });
});

// Function to check if a domain is permitted - must be in background.js
function isDomainPermitted(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get('permittedDomains', (result) => {
      const permittedDomains = result.permittedDomains || [];

      // Check if the exact domain is in the list
      if (permittedDomains.includes(domain)) {
        resolve(true);
        return;
      }

      // Check if a parent domain is in the list
      const domainParts = domain.split('.');
      for (let i = 1; i < domainParts.length - 1; i++) {
        const parentDomain = domainParts.slice(i).join('.');
        if (permittedDomains.includes(parentDomain)) {
          resolve(true);
          return;
        }
      }

      resolve(false);
    });
  });
}

// When context menu is clicked
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "extractLinksFromTargetPage" && info.linkUrl) {
    try {
      // Parse the URL to get the host
      const url = new URL(info.linkUrl);
      const hostname = url.hostname;

      // Check if this domain is permitted
      const isPermitted = await isDomainPermitted(hostname);

      // First inject content script into the active tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scripts/content.js"]
      });

      if (isPermitted) {
        // Domain is permitted, proceed with extraction
        fetchAndProcessLinks(info.linkUrl, tab.id);
      } else {
        // Domain is not permitted, show notification
        chrome.tabs.sendMessage(tab.id, {
          action: 'showMessage',
          message: `Domain "${hostname}" is not in your permitted list. Add it from the extension popup.`,
          type: 'warning'
        });
      }
    } catch (error) {
      console.error("Error in context menu handler:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: 'showMessage',
        message: `Error: ${error.message}`,
        type: 'error'
      });
    }
  }
});

