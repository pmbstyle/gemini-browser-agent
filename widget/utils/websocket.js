// WebSocket connection management for Gemini Browser Agent
// This module handles all WebSocket communication with the Python backend

import { setCurrentTab } from './tabManager.js';
import { handleCommand } from '../handlers/commandHandler.js';

let ws = null;

/**
 * Connect to the WebSocket server
 */
export async function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[bridge] Already connected');
    return;
  }

  try {
    ws = new WebSocket('ws://127.0.0.1:8765');
    
    ws.onopen = async () => {
      console.log('[bridge] WS connected');
      // Auto-set current tab when connected
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        await setCurrentTab(tabs[0].id);
        console.log(`[bridge] Auto-set current tab: ${tabs[0].id}`);
      }
      
      // Notify sidebar that connection is established
      chrome.runtime.sendMessage({ 
        type: 'connection_status', 
        status: 'connected' 
      }).catch(() => {
        // Ignore error if no receiver (sidebar not open)
        console.log('[bridge] No sidebar receiver for connection status');
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[bridge] Received message:', data);
        
        if (data.cmd) {
          console.log('[bridge] Processing command:', data.cmd);
          handleCommand(data).catch(error => {
            console.error('[bridge] Error in handleCommand:', error);
          });
        } else if (data.id) {
          // This is a response to a pending request
          chrome.runtime.sendMessage({ type: 'ws_response', data });
        } else if (data.type === 'agent_result') {
          // Forward agent result to sidebar
          console.log('[bridge] Forwarding agent result to sidebar:', data.result);
          chrome.runtime.sendMessage({
            type: 'agent_result',
            result: data.result
          }).catch((error) => {
            console.log('[bridge] Could not send agent result to sidebar:', error);
          });
        } else if (data.type === 'server_output') {
          // Forward server output to sidebar
          chrome.runtime.sendMessage({
            type: 'server_output',
            text: data.text
          }).catch((error) => {
            console.log('[bridge] Could not send server output to sidebar:', error);
          });
        }
      } catch (e) {
        console.error('[bridge] Error parsing message:', e);
      }
    };

    ws.onclose = (event) => {
      console.log('[bridge] WS disconnected - Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean);
      ws = null;
      
      // Notify sidebar that connection is lost
      chrome.runtime.sendMessage({ 
        type: 'connection_status', 
        status: 'disconnected' 
      }).catch(() => {
        // Ignore error if no receiver (sidebar not open)
        console.log('[bridge] No sidebar receiver for disconnection status');
      });
    };

    ws.onerror = (error) => {
      console.error('[bridge] WS error:', error);
    };

  } catch (error) {
    console.error('[bridge] Connection failed:', error);
  }
}

/**
 * Send message to Python server
 * @param {object} message - The message to send
 * @param {number} timeout - Timeout in ms before rejecting
 * @returns {Promise} Promise that resolves with the response
 */
export async function send(message, timeout = 30000) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }
  
  const id = Math.random().toString(36).substr(2, 9);
  const messageWithId = { id, ...message };
  
  ws.send(JSON.stringify(messageWithId));
  return new Promise((resolve, reject) => {
    const listener = (response) => {
      const { data } = response || {};
      if (data && data.id === id) {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(data);
      }
    };

    const timeoutId = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error(`Response timeout for message ${id}`));
    }, timeout);

    chrome.runtime.onMessage.addListener(listener);
  });
}

/**
 * Disconnect from the WebSocket server
 */
export function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

/**
 * Check if WebSocket is connected
 * @returns {boolean} True if connected, false otherwise
 */
export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}

/**
 * Get the current WebSocket instance
 * @returns {WebSocket|null} The WebSocket instance or null
 */
export function getWebSocket() {
  return ws;
}
