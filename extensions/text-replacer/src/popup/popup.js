document.addEventListener('DOMContentLoaded', function() {
  const savedSetsSection = document.getElementById('savedSetsSection');
  const savedSetsBody = document.getElementById('savedSetsBody');
  const noSetsMessage = document.getElementById('noSetsMessage');
  
  // Load saved sets on popup open
  loadSavedSets();
  
  // Add event listener for settings link
  document.getElementById('openSettings').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // Function to load saved sets from Chrome storage
  function loadSavedSets() {
    // Get current tab to determine domain
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        noSetsMessage.style.display = 'block';
        return;
      }
      
      // Extract domain from current URL
      const url = new URL(tabs[0].url);
      const currentDomain = url.hostname;
      
      chrome.storage.local.get('savedSets', function(data) {
        const savedSets = data.savedSets || [];
        
        // Filter sets to only those matching current domain
        const matchingSets = savedSets.filter(set => 
          set.domain && currentDomain.includes(set.domain)
        );
        
        if (matchingSets.length > 0) {
          // Show the saved sets section
          savedSetsSection.style.display = 'block';
          noSetsMessage.style.display = 'none';
          
          // Clear the current table
          savedSetsBody.innerHTML = '';
          
          // Add each saved set to the table
          matchingSets.forEach(function(set) {
            const row = document.createElement('tr');
            row.className = 'saved-set-row';
            
            // Create action cell first
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
            
            // Create other cells
            const tagCell = document.createElement('td');
            tagCell.textContent = set.tagName;
            
            const findCell = document.createElement('td');
            findCell.textContent = set.findText;
            
            const replaceCell = document.createElement('td');
            replaceCell.textContent = set.replaceText;
            
            const domainCell = document.createElement('td');
            domainCell.textContent = set.domain || 'All domains';
            
            // Add cells in new order - action first
            row.appendChild(actionCell);
            row.appendChild(tagCell);
            row.appendChild(findCell);
            row.appendChild(replaceCell);
            row.appendChild(domainCell);
            
            savedSetsBody.appendChild(row);
          });
        } else {
          // Hide the saved sets section if no sets are saved
          savedSetsSection.style.display = 'none';
          noSetsMessage.style.display = 'block';
        }
      });
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
  
  // Create an "Apply Rules" button
  const applyRulesBtn = document.createElement('button');
  applyRulesBtn.textContent = 'Apply Rules to This Page';
  applyRulesBtn.className = 'apply-btn';
  document.querySelector('.container').insertBefore(applyRulesBtn, document.querySelector('.footer'));
  
  // Add event listener
  applyRulesBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.runtime.sendMessage({
          action: "applyAllRules",
          tabId: tabs[0].id
        }, function(response) {
          const statusDiv = document.createElement('div');
          statusDiv.id = 'status';
          if (response && response.success) {
            statusDiv.textContent = response.message;
            statusDiv.className = 'success';
          } else {
            statusDiv.textContent = response?.message || "Failed to apply rules";
            statusDiv.className = 'error';
          }
          document.querySelector('.container').insertBefore(statusDiv, document.querySelector('.footer'));
          setTimeout(() => {
            if (statusDiv.parentNode) statusDiv.parentNode.removeChild(statusDiv);
          }, 3000);
        });
      }
    });
  });
});