document.addEventListener('DOMContentLoaded', function() {
  // Get DOM references
  const savedSetsSection = document.getElementById('savedSetsSection');
  const noSetsMessage = document.getElementById('noSetsMessage');
  const savedSetsBody = document.getElementById('savedSetsBody');
  const saveBtn = document.getElementById('saveBtn');
  const domainInput = document.getElementById('domain');
  const statusDiv = document.getElementById('status'); // Add this line
  
  // Check for domain passed from popup or background
  chrome.storage.local.get('tempDomain', function(data) {
    if (data.tempDomain && domainInput) {
      // Set the domain input value
      domainInput.value = data.tempDomain;
      
      // Clear the temporary storage
      chrome.storage.local.remove('tempDomain');
    }
  });
  
  // Initialize UI and add event listeners
  loadSavedSets();
  
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveClick);
  }
  
  // Function to load saved sets
  function loadSavedSets() {
    chrome.storage.local.get('savedSets', data => {
      const savedSets = data.savedSets || [];
      
      if (!savedSetsBody) {
        console.error("savedSetsBody element not found!");
        return;
      }
      
      // Clear the table
      savedSetsBody.innerHTML = '';
      
      if (savedSets.length > 0) {
        // Show the saved sets section
        if (savedSetsSection) savedSetsSection.style.display = 'block';
        if (noSetsMessage) noSetsMessage.style.display = 'none';
        
        savedSets.forEach(set => {
          const row = document.createElement('tr');
          // Add disabled class if rule is disabled
          if (set.enabled === false) {
            row.classList.add('disabled-rule');
          }
          
          // Status column with toggle switch
          const statusCell = document.createElement('td');
          const switchLabel = document.createElement('label');
          switchLabel.className = 'switch';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = set.enabled !== false; // Default to true if property is missing
          checkbox.addEventListener('change', function() {
            toggleRuleState(set.id);
          });
          
          const sliderSpan = document.createElement('span');
          sliderSpan.className = 'slider';
          
          switchLabel.appendChild(checkbox);
          switchLabel.appendChild(sliderSpan);
          statusCell.appendChild(switchLabel);
          
          // Action column (delete button)
          const actionCell = document.createElement('td');
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.className = 'delete-btn';
          deleteBtn.addEventListener('click', function() {
            deleteSet(set.id);
          });
          actionCell.appendChild(deleteBtn);
          
          // Other data cells
          const tagCell = document.createElement('td');
          tagCell.textContent = set.tagName;
          
          const findCell = document.createElement('td');
          findCell.textContent = set.findText;
          
          const replaceCell = document.createElement('td');
          replaceCell.textContent = set.replaceText;
          
          const domainCell = document.createElement('td');
          domainCell.textContent = set.domain || '';
          
          // Append all cells to row
          row.appendChild(statusCell);
          row.appendChild(actionCell);
          row.appendChild(tagCell);
          row.appendChild(findCell);
          row.appendChild(replaceCell);
          row.appendChild(domainCell);
          
          savedSetsBody.appendChild(row);
        });
      } else {
        // No saved sets
        if (savedSetsSection) savedSetsSection.style.display = 'none';
        if (noSetsMessage) noSetsMessage.style.display = 'block';
      }
    });
  }
  
  // Function to toggle rule state
  function toggleRuleState(id) {
    chrome.storage.local.get('savedSets', data => {
      const savedSets = data.savedSets || [];
      
      const updatedSets = savedSets.map(set => {
        if (set.id === id) {
          // Toggle the enabled state
          return { ...set, enabled: set.enabled === false ? true : false };
        }
        return set;
      });
      
      chrome.storage.local.set({ savedSets: updatedSets }, () => {
        loadSavedSets(); // Refresh the UI
        
        // Find the affected domain to refresh any open tabs with that domain
        const affectedSet = updatedSets.find(set => set.id === id);
        if (affectedSet && affectedSet.domain) {
          const originPattern = `*://${affectedSet.domain}/*`;
          chrome.tabs.query({ url: originPattern }, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                // Reload the tab to apply or remove rules
                chrome.tabs.reload(tab.id);
              }
            });
          });
        }
      });
    });
  }
  
  // Function to delete a rule
  function deleteSet(id) {
    chrome.storage.local.get('savedSets', data => {
      let savedSets = data.savedSets || [];
      savedSets = savedSets.filter(set => set.id !== id);
      
      chrome.storage.local.set({ savedSets }, () => {
        loadSavedSets();
        showStatus('Rule deleted successfully', 'success');
      });
    });
  }
  
  // Handle save button click
  async function handleSaveClick() {
    const tagName = document.getElementById('tagName').value.trim();
    const findText = document.getElementById('findText').value;
    const replaceText = document.getElementById('replaceText').value;
    const domainInput = document.getElementById('domain').value.trim();
    const cleanDomain = extractDomain(domainInput);
    
    // Validate inputs
    if (!tagName) {
      showStatus('Please enter a tag name', 'error');
      return;
    }
    
    if (!findText) {
      showStatus('Please enter text to find', 'error');
      return;
    }
    
    // Validate regex pattern
    try {
      new RegExp(findText);
    } catch (e) {
      showStatus('Invalid regular expression in find text', 'error');
      return;
    }

    // Require domain field
    if (!cleanDomain) {
      showStatus('Please enter a specific domain where this rule should apply', 'error');
      return;
    }
    
    // Request permission for the domain
    const permissionGranted = await requestDomainPermission(cleanDomain);
    if (!permissionGranted) {
      showStatus('Permission not granted for domain: ' + cleanDomain, 'error');
      // You could return here to prevent saving, or continue to save the rule anyway
      // return;
    }
    
    // Save the rule with the domain
    saveInputSet(tagName, findText, replaceText, cleanDomain);
  }
  
  // Update the saveInputSet function to include 'enabled' flag
  function saveInputSet(tagName, findText, replaceText, domain) {
    chrome.storage.local.get('savedSets', data => {
      const savedSets = data.savedSets || [];
      savedSets.push({ 
        id: Date.now().toString(), 
        tagName, 
        findText, 
        replaceText, 
        domain,
        enabled: true  // Default to enabled when creating new rules
      });
      chrome.storage.local.set({ savedSets }, () => {
        showStatus('Replacement set saved!', 'success');
        loadSavedSets();
        clearForm();
      });
    });
  }
  
  // Function to show status message
  function showStatus(message, type) {
    if (!statusDiv) {
      console.error("Status div not found");
      return;
    }
    
    statusDiv.textContent = message;
    statusDiv.className = type;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.className = '';
      }
    }, 3000);
  }
  
  // Function to clear form inputs
  function clearForm() {
    document.getElementById('tagName').value = '';
    document.getElementById('findText').value = '';
    document.getElementById('replaceText').value = '';
    document.getElementById('domain').value = '';
  }
  
  // Add this function to parse domain from URL
  function extractDomain(url) {
    // Handle empty input
    if (!url) return '';
    
    // Check if it's a URL with protocol
    if (url.includes('://')) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch (e) {
        // If URL parsing fails, continue with other methods
      }
    }
    
    // Remove any paths, query params, etc.
    return url.split('/')[0].split('?')[0].split('#')[0];
  }
  
  // Format domain input into a valid permission pattern
  function formatOriginPattern(domain) {
    if (!domain) return null;
    
    // Handle case where user entered a full URL
    if (domain.includes('://')) {
      try {
        const url = new URL(domain);
        return url.origin + '/*';
      } catch (e) {
        console.error("Invalid URL:", domain);
        return null;
      }
    }
    
    // Simple domain - add the pattern format
    return `*://${domain}/*`;
  }
  
  // Request permission for a domain and apply rules to existing open tabs if granted
  async function requestDomainPermission(domain) {
    if (!domain) return true; // No domain means apply to all permitted sites
    
    const originPattern = formatOriginPattern(domain);
    if (!originPattern) {
      showStatus(`Invalid domain format: ${domain}`, 'error');
      return false;
    }
    
    try {
      const granted = await new Promise(resolve => {
        chrome.permissions.request({ origins: [originPattern] }, (result) => {
          if (chrome.runtime.lastError) {
            console.error("Permission request error:", chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(result);
          }
        });
      });
      
      if (granted) {
        showStatus(`Permission granted for ${domain}`, 'success');
        
        // Apply rule immediately to any matching open tabs
        chrome.tabs.query({ url: originPattern }, (tabs) => {
          tabs.forEach((tab) => {
            if (!tab.id) return;
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/content.js']
            }).then(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'applyAllRules' })
                .catch(e => console.log("Tab might not be ready yet:", e));
            }).catch(e => console.log("Injection error:", e));
          });
        });
        
        return true;
      } else {
        showStatus(`Permission denied for ${domain}`, 'error');
        return false;
      }
    } catch (error) {
      showStatus(`Error requesting permission: ${error.message}`, 'error');
      return false;
    }
  }
  
  // Add a listener to handle storage changes
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.savedSets) {
      // If the savedSets array is now empty, reload the page
      if (changes.savedSets.newValue && changes.savedSets.newValue.length === 0) {
        // Reload the options page
        window.location.reload();
      }
    }
  });
});