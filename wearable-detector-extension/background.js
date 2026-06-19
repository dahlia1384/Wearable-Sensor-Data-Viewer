'use strict';

// Update extension badge when the active tab changes
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.includes('github.com')) {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch {
    // Tab may have been closed
  }
});

// Clear badge when navigating away from GitHub
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'loading' && !tab.url?.includes('github.com')) {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
