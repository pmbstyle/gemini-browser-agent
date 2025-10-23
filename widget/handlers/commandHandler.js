// Command processing handler for Gemini Browser Agent
// This module handles command execution, safety decisions, and response management

import { actions } from '../actions/browserActions.js';
import { createActionDescription } from '../utils/actionDescriptions.js';
import { getWebSocket } from '../utils/websocket.js';

/**
 * Handle commands from Python server
 * @param {object} data - Command data
 * @param {string} data.cmd - Command name
 * @param {object} data.args - Command arguments
 * @param {string} data.id - Command ID
 * @returns {Promise<void>}
 */
export async function handleCommand(data) {
  const { cmd, args = {}, id } = data;
  
  try {
    console.log(`[bridge] Executing ${cmd} with args:`, args);
    
    // Check for safety decision
    if (args.safety_decision && args.safety_decision.decision === 'require_confirmation') {
      console.log(`[bridge] Safety decision required for ${cmd}`);
      
      // Send permission request to sidebar
      const requestId = Math.random().toString(36).substr(2, 9);
      chrome.runtime.sendMessage({
        type: 'permission_request',
        explanation: args.safety_decision.explanation,
        action: `${cmd}(${JSON.stringify(args)})`,
        requestId: requestId
      }).catch(() => {}); // Ignore if sidebar not open
      
      // Wait for permission response
      const permissionResponse = await new Promise((resolve) => {
        const listener = (message) => {
          if (message.type === 'permission_response' && message.requestId === requestId) {
            chrome.runtime.onMessage.removeListener(listener);
            resolve(message.allowed);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(false);
        }, 30000);
      });
      
      if (!permissionResponse) {
        console.log(`[bridge] Permission denied for ${cmd}`);
        const ws = getWebSocket();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            id,
            ok: false,
            error: 'Permission denied by user'
          }));
        }
        return;
      }
      
      console.log(`[bridge] Permission granted for ${cmd}`);
    }
    
    if (actions[cmd]) {
      const result = await actions[cmd](args);
      console.log(`[bridge] Command ${cmd} completed, result:`, result);
      
      // Send informative result to sidebar
      const resultDescription = createActionDescription(cmd, args, result);
      chrome.runtime.sendMessage({
        type: 'model_action',
        action: resultDescription
      }).catch((error) => {
        console.log('[bridge] Could not send result to sidebar:', error);
      });
      
      // Send response back
      const ws = getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`[bridge] Sending response for ${cmd}:`, { id, ok: true, result });
        ws.send(JSON.stringify({
          id,
          ok: true,
          result
        }));
      } else {
        console.error(`[bridge] Cannot send response - WebSocket not open. State: ${ws ? ws.readyState : 'null'}`);
      }
    } else {
      console.log(`[bridge] Unknown command: ${cmd}`);
      
      // Send error message to sidebar
      chrome.runtime.sendMessage({
        type: 'model_action',
        action: `❌ Unknown command: ${cmd}`
      }).catch((error) => {
        console.log('[bridge] Could not send error to sidebar:', error);
      });
      
      const ws = getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id,
          ok: false,
          error: `unknown cmd: ${cmd}`
        }));
      }
    }
  } catch (error) {
    console.error(`[bridge] Error executing ${cmd}:`, error);
    
    // Send error message to sidebar
    chrome.runtime.sendMessage({
      type: 'model_action',
      action: `❌ Error in ${cmd}: ${error.message}`
    }).catch((error) => {
      console.log('[bridge] Could not send error to sidebar:', error);
    });
    
    const ws = getWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`[bridge] Sending error response for ${cmd}:`, { id, ok: false, error: error.message });
      ws.send(JSON.stringify({
        id,
        ok: false,
        error: error.message
      }));
    } else {
      console.error(`[bridge] Cannot send error response - WebSocket not open. State: ${ws ? ws.readyState : 'null'}`);
    }
  }
}
