// Tab management utilities for Gemini Browser Agent
// This module handles tab operations and script execution

/**
 * Set the current tab ID
 * Uses chrome.storage.session for MV3 service worker persistence
 * @param {number} tabId - The tab ID to set as current
 */
export async function setCurrentTab(tabId) {
  await chrome.storage.session.set({ currentTabId: tabId });
  console.log(`[bridge] Set current tab to: ${tabId}`);
}

/**
 * Get the current tab ID
 * Uses chrome.storage.session for MV3 service worker persistence
 * @returns {Promise<number|null>} The current tab ID or null
 */
export async function getCurrentTab() {
  const result = await chrome.storage.session.get('currentTabId');
  return result.currentTabId || null;
}

/**
 * Ensure we have a current tab set
 * @throws {Error} If no current tab is set
 */
export async function ensureTab() {
  const tabId = await getCurrentTab();
  if (!tabId) {
    throw new Error('No current tab set');
  }
  return tabId;
}

/**
 * Run code in a specific tab
 * @param {number} tabId - The tab ID to run the code in
 * @param {function} func - The function to execute
 * @param {object} args - Arguments to pass to the function
 * @returns {Promise} Promise that resolves with the function result
 */
export async function runInPage(tabId, func, args = {}) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: func,
      args: [args]
    }, (results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(results[0].result);
      }
    });
  });
}

/**
 * Run code in the current tab
 * @param {function} func - The function to execute
 * @param {object} args - Arguments to pass to the function
 * @returns {Promise} Promise that resolves with the function result
 */
export async function runInCurrentTab(func, args = {}) {
  const tabId = await ensureTab();
  return runInPage(tabId, func, args);
}

/**
 * Get the current active tab
 * @returns {Promise<object>} Promise that resolves with the active tab info
 */
export async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

/**
 * Update a tab (navigate to URL, etc.)
 * @param {number} tabId - The tab ID to update
 * @param {object} updateProperties - Properties to update
 * @returns {Promise<object>} Promise that resolves with the updated tab info
 */
export async function updateTab(tabId, updateProperties) {
  return chrome.tabs.update(tabId, updateProperties);
}

/**
 * Get all tabs
 * @returns {Promise<Array>} Promise that resolves with array of tab info
 */
export async function getAllTabs() {
  return chrome.tabs.query({});
}
