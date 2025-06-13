document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const savedSetsBody = document.getElementById('savedSetsBody');
  const noSetsDiv = document.getElementById('noSets');
  
  // Load saved sets on page load
  loadSavedSets();
  
  // Handle save button click
  saveBtn.addEventListener('click', async function() {
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
  });
  
  // Function to save input set to Chrome storage
  function saveInputSet(tagName, findText, replaceText, domain) {
    chrome.storage.local.get('savedSets', function(data) {
      const savedSets = data.savedSets || [];
      
      // Create a unique ID for this set
      const id = Date.now().toString();
      
      // Create new set
      const newSet = {
        id: id,
        tagName: tagName,
        findText: findText,
        replaceText: replaceText,
        domain: domain
      };
      
      // Add new set
      savedSets.push(newSet);
      
      // Save back to storage
      chrome.storage.local.set({ savedSets: savedSets }, function() {
        showStatus('Replacement set saved successfully!', 'success');
        clearForm();
        loadSavedSets();
      });
    });
  }
  
  // Function to show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  }
  
  // Function to clear form inputs
  function clearForm() {
    document.getElementById('tagName').value = '';
    document.getElementById('findText').value = '';
    document.getElementById('replaceText').value = '';
    document.getElementById('domain').value = '';
  }
  
  // Function to load saved sets from Chrome storage
  function loadSavedSets() {
    chrome.storage.local.get('savedSets', function(data) {
      const savedSets = data.savedSets || [];
      
      if (savedSets.length > 0) {
        // Hide no sets message and show table
        noSetsDiv.style.display = 'none';
        savedSetsBody.innerHTML = '';
        
        // Add each saved set to the table
        savedSets.forEach(function(set) {
          const row = document.createElement('tr');
          row.className = 'saved-set-row';
          
          // Create action cell with delete button (now first)
          const actionCell = document.createElement('td');
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.className = 'delete-btn';
          deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent row click from firing
            deleteSavedSet(set.id);
          });
          
          actionCell.appendChild(deleteBtn);
          
          // Create other cells
          const tagCell = document.createElement('td');
          tagCell.textContent = set.tagName;
          
          const findCell = document.createElement('td');
          findCell.textContent = set.findText;
          
          const replaceCell = document.createElement('td');
          replaceCell.textContent = set.replaceText;
          
          const domainCell = document.createElement('td');
          domainCell.textContent = set.domain || 'All domains';
          
          // Append cells in new order - action first
          row.appendChild(actionCell);
          row.appendChild(tagCell);
          row.appendChild(findCell);
          row.appendChild(replaceCell);
          row.appendChild(domainCell);
          
          // Make the entire row clickable to edit
          row.addEventListener('click', function() {
            loadSetIntoForm(set);
          });
          
          savedSetsBody.appendChild(row);
        });
      } else {
        // Show no sets message and hide table
        noSetsDiv.style.display = 'block';
      }
    });
  }
  
  // Function to load a set into the form
  function loadSetIntoForm(set) {
    document.getElementById('tagName').value = set.tagName;
    document.getElementById('findText').value = set.findText;
    document.getElementById('replaceText').value = set.replaceText;
    document.getElementById('domain').value = set.domain || '';
    
    showStatus('Set loaded into form for editing', 'success');
    
    // Scroll to form section
    document.querySelector('.section:last-child').scrollIntoView({
      behavior: 'smooth'
    });
  }
  
  // Function to delete a saved set
  function deleteSavedSet(id) {
    chrome.storage.local.get('savedSets', function(data) {
      let savedSets = data.savedSets || [];
      
      // Filter out the set with the matching ID
      savedSets = savedSets.filter(set => set.id !== id);
      
      // Save back to storage
      chrome.storage.local.set({ savedSets: savedSets }, function() {
        showStatus('Replacement set deleted', 'success');
        loadSavedSets();
      });
    });
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