// Chrome extension message handling for Gemini Browser Agent
// This module handles all messages from the sidebar

import { connect, disconnect, getWebSocket } from '../utils/websocket.js';
import { setCurrentTab } from '../utils/tabManager.js';

/**
 * Setup message listener for Chrome extension messages
 */
export function setupMessageListener() {
  console.log('[bridge] Setting up message listener...'); // Debug log
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[bridge] Received message:', request); // Debug log
    
    if (request.type === 'test') {
      sendResponse({ success: true, message: 'Background script is responding' });
    } else if (request.type === 'connect') {
      connect();
      sendResponse({ success: true });
    } else if (request.type === 'disconnect') {
      disconnect();
      sendResponse({ success: true });
    } else if (request.type === 'start_agent') {
      const ws = getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          cmd: 'start_agent',
          args: { 
            goal: request.goal,
            maxSteps: request.maxSteps || 10
          }
        }));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Not connected' });
      }
    } else if (request.type === 'stop_agent') {
      const ws = getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          cmd: 'stop_agent',
          args: {}
        }));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Not connected' });
      }
    } else if (request.type === 'set_tab') {
      console.log(`[bridge] Setting current tab to: ${request.tabId}`);
      (async () => {
        await setCurrentTab(request.tabId);
        sendResponse({ success: true });
      })();
      return true; // Keep channel open for async response
    } else if (request.type === 'permission_response') {
      // This is handled by the permission request system
      sendResponse({ success: true });
    }
  });
}

/**
 * Setup extension icon click handler
 */
export function setupIconClickHandler() {
  // Open sidebar when extension icon is clicked
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (error) {
      console.error('Failed to open sidebar:', error);
    }
  });
}
