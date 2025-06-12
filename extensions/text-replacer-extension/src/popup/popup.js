document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const savedSetsSection = document.getElementById('savedSetsSection');
  const savedSetsBody = document.getElementById('savedSetsBody');
  
  // Load saved sets on popup open
  loadSavedSets();
  
  // Handle save button click - both saves and applies
  saveBtn.addEventListener('click', function() {
    const tagName = document.getElementById('tagName').value.trim();
    const findText = document.getElementById('findText').value;
    const replaceText = document.getElementById('replaceText').value;
    
    // Validate inputs
    if (!tagName) {
      statusDiv.textContent = 'Error: Please enter a tag name';
      statusDiv.style.color = 'red';
      return;
    }
    
    if (!findText) {
      statusDiv.textContent = 'Error: Please enter text to find';
      statusDiv.style.color = 'red';
      return;
    }
    
    // Save to Chrome storage and apply immediately
    saveInputSet(tagName, findText, replaceText);
  });
  
  // Function to save input set to Chrome storage
  function saveInputSet(tagName, findText, replaceText) {
    // Get current tab to determine domain
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        statusDiv.textContent = 'Error: Cannot determine current domain';
        statusDiv.style.color = 'red';
        return;
      }
      
      // Extract domain from current URL
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      
      chrome.storage.local.get('savedSets', function(data) {
        const savedSets = data.savedSets || [];
        
        // Create a unique ID for this set
        const id = Date.now().toString();
        
        // Create new set with domain and always enable regex
        const newSet = {
          id: id,
          tagName: tagName,
          findText: findText,
          replaceText: replaceText,
          domain: domain,
          useRegex: true  // Always use regex by default
        };
        
        // Add new set
        savedSets.push(newSet);
        
        // Save back to storage
        chrome.storage.local.set({ savedSets: savedSets }, function() {
          // Apply the text replacement immediately
          applyTextReplacement(newSet, function(response) {
            if (response && response.success) {
              statusDiv.textContent = `Set saved and applied. Replaced ${response.count} instances.`;
              statusDiv.style.color = 'green';
            } else {
              statusDiv.textContent = 'Set saved but failed to apply: ' + 
                (response?.message || 'Failed to replace text');
              statusDiv.style.color = 'orange';
            }
            
            // Reload the saved sets
            loadSavedSets();
          });
        });
      });
    });
  }
  
  // Function to apply text replacement
  function applyTextReplacement(set, callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: 'replaceText',
            tagName: set.tagName,
            findText: set.findText,
            replaceText: set.replaceText
          }
        ).then(response => {
          callback(response);
        }).catch(error => {
          callback({
            success: false,
            message: 'Could not communicate with the page'
          });
        });
      } else {
        callback({
          success: false,
          message: 'No active tab found'
        });
      }
    });
  }
  
  // Function to load saved sets from Chrome storage
  function loadSavedSets() {
    chrome.storage.local.get('savedSets', function(data) {
      const savedSets = data.savedSets || [];
      
      if (savedSets.length > 0) {
        // Show the saved sets section
        savedSetsSection.style.display = 'block';
        
        // Clear the current table
        savedSetsBody.innerHTML = '';
        
        // Add header for domain column if not already present
        const headerRow = document.querySelector('#savedSetsTable thead tr');
        if (headerRow && !headerRow.querySelector('th[data-column="domain"]')) {
          const domainHeader = document.createElement('th');
          domainHeader.textContent = 'Domain';
          domainHeader.setAttribute('data-column', 'domain');
          headerRow.insertBefore(domainHeader, headerRow.querySelector('th:last-child'));
        }
        
        // Add each saved set to the table
        savedSets.forEach(function(set) {
          const row = document.createElement('tr');
          row.className = 'saved-set-row';
          
          // Add columns
          const tagCell = document.createElement('td');
          tagCell.textContent = set.tagName;
          
          const findCell = document.createElement('td');
          findCell.textContent = set.findText;
          
          const replaceCell = document.createElement('td');
          replaceCell.textContent = set.replaceText;
          
          const domainCell = document.createElement('td');
          domainCell.textContent = set.domain || 'All domains';
          
          const actionCell = document.createElement('td');
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.className = 'delete-btn';
          
          // Add event listener for delete button
          deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent row click from firing
            deleteSavedSet(set.id);
          });
          
          actionCell.appendChild(deleteBtn);
          
          row.appendChild(tagCell);
          row.appendChild(findCell);
          row.appendChild(replaceCell);
          row.appendChild(domainCell); // Add domain column
          row.appendChild(actionCell);
          
          // Add click event to load this set into the form
          row.addEventListener('click', function() {
            loadSetIntoForm(set);
          });
          
          savedSetsBody.appendChild(row);
        });
      } else {
        // Hide the saved sets section if no sets are saved
        savedSetsSection.style.display = 'none';
      }
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
        statusDiv.textContent = 'Set deleted';
        statusDiv.style.color = 'green';
        
        // Reload the page to reset all text replacements and then reapply the remaining sets
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id, {}, function() {
              // The content script will automatically apply all saved sets when the page reloads
              loadSavedSets(); // Update the UI to reflect the deleted set
            });
          } else {
            loadSavedSets(); // Just update the UI if we can't reload
          }
        });
      });
    });
  }
  
  // Function to load a set into the form
  function loadSetIntoForm(set) {
    document.getElementById('tagName').value = set.tagName;
    document.getElementById('findText').value = set.findText;
    document.getElementById('replaceText').value = set.replaceText;
    
    statusDiv.textContent = 'Set loaded';
    statusDiv.style.color = 'green';
  }
});