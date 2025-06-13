document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const savedSetsSection = document.getElementById('savedSetsSection');
  const noSetsMessage = document.getElementById('noSetsMessage');
  const savedSetsBody = document.getElementById('savedSetsBody');
  const openSettingsLink = document.getElementById('openSettings');
  
  // Load saved sets for the current domain
  loadSavedSets();
  
  // Open options page when link is clicked
  openSettingsLink.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        try {
          // Extract just the domain from the URL
          const url = new URL(tabs[0].url);
          const domain = url.hostname;
          
          // Save domain to storage temporarily
          chrome.storage.local.set({ 'tempDomain': domain }, function() {
            // Open options page after saving domain
            chrome.runtime.openOptionsPage();
          });
        } catch(e) {
          console.error("Error parsing URL:", e);
          chrome.runtime.openOptionsPage();
        }
      } else {
        chrome.runtime.openOptionsPage();
      }
    });
  });
  
  // Function to load saved sets from Chrome storage
  function loadSavedSets() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
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
          
          // Filter sets to only match current domain (even disabled ones)
          const matchingSets = savedSets.filter(set => 
            set.domain && currentDomain.includes(set.domain)
          );
          
          // Clear the current table
          savedSetsBody.innerHTML = '';
          
          if (matchingSets.length > 0) {
            // Show the saved sets section
            savedSetsSection.style.display = 'block';
            noSetsMessage.style.display = 'none';
            
            // Add each saved set to the table
            matchingSets.forEach(function(set) {
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
                toggleRuleState(set.id, currentDomain);
              });
              
              const sliderSpan = document.createElement('span');
              sliderSpan.className = 'slider';
              
              switchLabel.appendChild(checkbox);
              switchLabel.appendChild(sliderSpan);
              statusCell.appendChild(switchLabel);
              
              // Data columns
              const tagCell = document.createElement('td');
              tagCell.textContent = set.tagName;
              
              const findCell = document.createElement('td');
              findCell.textContent = set.findText;
              
              const replaceCell = document.createElement('td');
              replaceCell.textContent = set.replaceText;
              
              // Append cells to row
              row.appendChild(statusCell);
              row.appendChild(tagCell);
              row.appendChild(findCell);
              row.appendChild(replaceCell);
              
              savedSetsBody.appendChild(row);
            });
          } else {
            // No matching sets
            savedSetsSection.style.display = 'none';
            noSetsMessage.style.display = 'block';
            noSetsMessage.textContent = `No replacement sets for "${currentDomain}".`;
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
  
  // Function to toggle rule state
  function toggleRuleState(id, currentDomain) {
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
        // Refresh the UI
        loadSavedSets();
        
        // Reload the current tab to apply changes
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    });
  }
});