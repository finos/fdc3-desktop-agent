// Saves options to chrome.storage
function save_options() {
    const appd_url = document.getElementById('appd_url').value;
    const default_global = document.getElementById('default_global').checked;
    chrome.storage.sync.set({
      appd_url: appd_url,
      default_global:default_global
    }, function() {
      // Update status to let user know options were saved.
      var status = document.getElementById('status');
      status.textContent = 'Options saved.';
      status.style.display = 'block';
      setTimeout(function() {
        status.textContent = '';
        status.style.display = 'none';
      }, 750);
    });
  }
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  function restore_options() {
    // Use default value for appd
    chrome.storage.sync.get(['appd_url','default_global'], function(items) {
      document.getElementById('appd_url').value = items.appd_url ? items.appd_url : "https://appd.kolbito.com";
      document.getElementById('default_global').checked = items.default_global;
    });
  }

  document.addEventListener('DOMContentLoaded', restore_options);
  document.getElementById('save').addEventListener('click',
      save_options);