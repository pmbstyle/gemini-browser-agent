// Chrome Extension Background Script for Gemini Browser Agent
// This is the main entry point that coordinates all modules

console.log('[bridge] Background script loaded!');
import { setupMessageListener, setupIconClickHandler } from './handlers/messageHandler.js';

// Initialize the extension
async function initialize() {
  console.log('[bridge] Initializing Gemini Browser Agent...');
  
  // Setup message handling
  setupMessageListener();
  
  // Setup icon click handler
  setupIconClickHandler();
  
  console.log('[bridge] Gemini Browser Agent initialized successfully!');
}

// Start the extension
initialize().catch(error => {
  console.error('[bridge] Failed to initialize:', error);
});
