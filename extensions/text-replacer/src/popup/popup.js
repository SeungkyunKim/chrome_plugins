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
        // If no active tab, show no sets message
        savedSetsSection.style.display = 'none';
        noSetsMessage.style.display = 'block';
        noSetsMessage.textContent = 'No active tab detected.';
        return;
      }
      
      try {
        // Extract domain from current URL
        const url = new URL(tabs[0].url);
        const currentDomain = url.hostname;
        
        chrome.storage.local.get('savedSets', function(data) {
          const savedSets = data.savedSets || [];
          
          // Filter sets to only those matching current domain
          const matchingSets = savedSets.filter(set => 
            set.domain && currentDomain.includes(set.domain)
          );
          
          // Clear the current table regardless of whether there are matches
          savedSetsBody.innerHTML = '';
          
          if (matchingSets.length > 0) {
            // Show the saved sets section
            savedSetsSection.style.display = 'block';
            noSetsMessage.style.display = 'none';
            
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
            noSetsMessage.textContent = `No replacement sets configured for "${currentDomain}".`;
          }
        });
      } catch (e) {
        console.error("Error parsing URL:", e);
        savedSetsSection.style.display = 'none';
        noSetsMessage.style.display = 'block';
        noSetsMessage.textContent = 'Cannot determine current page domain.';
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
        // Get current tab info first to ensure we have it for loadSavedSets
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          // If savedSets is now empty, notify background script
          if (savedSets.length === 0) {
            // Send message to background script that all rules are gone
            chrome.runtime.sendMessage({ action: "allRulesDeleted" });
          }
          
          // Update the UI
          loadSavedSets();
          
          // Reload the current tab if available
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    });
  }
});