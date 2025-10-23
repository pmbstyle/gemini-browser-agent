// Tab management utilities for Gemini Browser Agent
// This module handles tab operations and script execution

let currentTabId = null;

/**
 * Set the current tab ID
 * @param {number} tabId - The tab ID to set as current
 */
export function setCurrentTab(tabId) {
  currentTabId = tabId;
  console.log(`[bridge] Set current tab to: ${tabId}`);
}

/**
 * Get the current tab ID
 * @returns {number|null} The current tab ID or null
 */
export function getCurrentTab() {
  return currentTabId;
}

/**
 * Ensure we have a current tab set
 * @throws {Error} If no current tab is set
 */
export function ensureTab() {
  if (!currentTabId) {
    throw new Error('No current tab set');
  }
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
  ensureTab();
  return runInPage(currentTabId, func, args);
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
