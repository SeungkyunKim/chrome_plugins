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
    // First, try to convert URLs to domain names
    try {
        if (domain.startsWith('http://') || domain.startsWith('https://')) {
            const url = new URL(domain);
            domain = url.hostname;
        }
    } catch (e) {
        // Not a URL, continue with original input
    }

    // Make sure it's a domain with at least one dot
    if (!domain.includes('.') || domain === '.' || domain.endsWith('.') || domain.startsWith('.')) {
        alert('Please enter a valid domain (e.g., example.com)');
        return;
    }

    chrome.storage.local.get('permittedDomains', (result) => {
        const permittedDomains = result.permittedDomains || [];

        // Check if domain is already in the list
        if (permittedDomains.includes(domain)) {
            alert('This domain is already permitted.');
            return;
        }

        // Add to the list
        permittedDomains.push(domain);

        // Save the updated list
        chrome.storage.local.set({ 'permittedDomains': permittedDomains }, () => {
            // Display success and reload list
            console.log(`Domain ${domain} added successfully`);
            loadDomainsList();

            // Optional: Request permission for this domain (may not be necessary)
            try {
                const hostPattern = `*://*.${domain}/*`;
                chrome.permissions.request({
                    origins: [hostPattern]
                }, (granted) => {
                    if (!granted) {
                        console.log('Browser permission not granted, but domain is still in our allowed list');
                    }
                });
            } catch (err) {
                console.error('Error requesting permission:', err);
                // Continue anyway since we've already saved to our list
            }
        });
    });
}

// Function to remove a domain from the permitted list
function removeDomain(domain) {
    chrome.storage.local.get('permittedDomains', (result) => {
        const permittedDomains = result.permittedDomains || [];
        const newList = permittedDomains.filter(d => d !== domain);

        chrome.storage.local.set({ 'permittedDomains': newList }, () => {
            // Try to remove the permission as well
            const hostPattern = `*://*.${domain}/*`;

            chrome.permissions.remove({
                origins: [hostPattern]
            }, () => {
                loadDomainsList();
            });
        });
    });
}
