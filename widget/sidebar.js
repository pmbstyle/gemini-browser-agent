let isConnected = false;
let isAgentRunning = false;

// DOM elements
const statusEl = document.getElementById('status');
const connectToggleBtn = document.getElementById('connectToggleBtn');
const agentToggleBtn = document.getElementById('agentToggleBtn');

const agentGoalInput = document.getElementById('agentGoal');
const maxStepsInput = document.getElementById('maxSteps');
const logEntriesEl = document.getElementById('logEntries');
const resultOutputEl = document.getElementById('resultOutput');
const resultOutputContainer = document.getElementById('resultOutputContainer');
const serverOutputEl = document.getElementById('serverOutput');
const serverOutputContainer = document.getElementById('serverOutputContainer');
const modelActionsEl = document.getElementById('modelActions');
const modelActionsContainer = document.getElementById('modelActionsContainer');
const permissionContainer = document.getElementById('permissionContainer');
const permissionContent = document.getElementById('permissionContent');
const allowBtn = document.getElementById('allowBtn');
const rejectBtn = document.getElementById('rejectBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const copyResultBtn = document.getElementById('copyResultBtn');

// Initialize when DOM is ready
function initialize() {
  try {
    
    // Check if all required elements exist
    if (!connectToggleBtn || !agentToggleBtn) {
      console.error('Required DOM elements not found:', {
        connectToggleBtn: !!connectToggleBtn,
        agentToggleBtn: !!agentToggleBtn
      });
      return;
    }
    
    updateUI();
    loadStoredGoal();
    
    if (connectToggleBtn) {
      connectToggleBtn.addEventListener('click', toggleConnection);
      console.log('Connect toggle listener attached');
    } else {
      console.error('connectToggleBtn not found!');
    }
    
    if (agentToggleBtn) {
      agentToggleBtn.addEventListener('click', toggleAgent);
      console.log('Agent toggle listener attached');
    } else {
      console.error('agentToggleBtn not found!');
    }

    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', clearActivityLog);
    }

    if (copyResultBtn) {
      copyResultBtn.addEventListener('click', copyResultToClipboard);
    }

    setCopyButtonEnabled(false);

  } catch (error) {
    console.error('Error in initialize:', error);
    alert('ERROR in initialize: ' + error.message);
  }
}

// Try to initialize immediately, but also wait for DOM if needed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Listen for connection status updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'connection_status') {
    if (message.status === 'connected') {
      isConnected = true;
      updateStatus('connected', 'Connected');
      updateUI();
      log('Connected to WebSocket server!', 'success');
    } else if (message.status === 'disconnected') {
      isConnected = false;
      isAgentRunning = false;
      updateStatus('disconnected', 'Disconnected');
      updateUI();
      log('Disconnected from WebSocket server', 'warning');
    }
  } else if (message.type === 'server_output') {
    console.log('Server output:', message.text); // Only logging to console
  } else if (message.type === 'agent_result') {
    console.log('Received agent result:', message.result);
    showResult(message.result);
    // Agent completed, update status and UI
    isAgentRunning = false;
    updateStatus('connected', 'Agent Completed');
    updateUI();
    // Add completion message to activity log
    log('Agent completed successfully!', 'success');
  } else if (message.type === 'model_action') {
    addModelAction(message.action);
  } else if (message.type === 'permission_request') {
    showPermissionRequest(message.explanation, message.action, (allowed) => {
      // Send permission response back to background script
      chrome.runtime.sendMessage({
        type: 'permission_response',
        allowed: allowed,
        requestId: message.requestId
      });
    });
  }
});

// Store goal in localStorage
agentGoalInput.addEventListener('input', () => {
  localStorage.setItem('aiAgentGoal', agentGoalInput.value);
});

// Load stored goal
function loadStoredGoal() {
  const stored = localStorage.getItem('aiAgentGoal');
  if (stored) {
    agentGoalInput.value = stored;
  }
}

// Connect to WebSocket
// Toggle connection
function toggleConnection() {
  console.log('toggleConnection called! isConnected:', isConnected);
  if (isConnected) {
    disconnect();
  } else {
    connect();
  }
}

// Toggle agent
function toggleAgent() {
  if (isAgentRunning) {
    stopAgent();
  } else {
    startAgent();
  }
}

async function connect() {
  try {
    updateStatus('connecting', 'Connecting...');
    
    // Send connect message to background script
    console.log('Sending connect message to background script...');
    chrome.runtime.sendMessage({ type: 'connect' }, (response) => {
      console.log('Connect response:', response);
      if (chrome.runtime.lastError) {
        console.error('Message sending error:', chrome.runtime.lastError);
        log(`Connection error: ${chrome.runtime.lastError.message}`, 'error');
        updateStatus('error', `Connection failed: ${chrome.runtime.lastError.message}`);
      }
    });
    
  } catch (error) {
    alert('Connect error:' +error); // Debug log
    log(`Connection error: ${error.message}`, 'error');
    updateStatus('error', `Connection failed: ${error.message}`);
  }
}

// Disconnect from WebSocket
async function disconnect() {
  try {
    log('Disconnecting...', 'info');
    chrome.runtime.sendMessage({ type: 'disconnect' });
    updateStatus('disconnected', 'Disconnected');
    isConnected = false;
    updateUI();
    
    // Clear and hide output containers
    if (serverOutputEl) {
      serverOutputEl.innerHTML = '';
    }
    if (resultOutputEl) {
      resultOutputEl.innerHTML = '';
    }
    if (resultOutputContainer) {
      resultOutputContainer.classList.add('hidden');
    }
    setCopyButtonEnabled(false);
  } catch (error) {
    log(`Disconnect error: ${error.message}`, 'error');
  }
}

// Start AI agent
async function startAgent() {
  const goal = agentGoalInput.value.trim();
  if (!goal) {
    log('Please enter an agent goal first', 'warning');
    return;
  }
  
  if (!isConnected) {
    log('Please connect to WebSocket first', 'warning');
    return;
  }
  
  try {
    log(`Starting AI agent with goal: ${goal}`, 'info');
    
    // Clear previous results when starting new agent
    if (resultOutputEl) {
      resultOutputEl.innerHTML = '';
    }
    if (resultOutputContainer) {
      resultOutputContainer.classList.add('hidden');
    }
    setCopyButtonEnabled(false);
    
    // Set current tab to active tab before starting agent
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.runtime.sendMessage({
          type: 'set_tab',
          tabId: tabs[0].id
        }, (response) => {
          log(`Set active tab to: ${tabs[0].title}`, 'info');
          
          // Send start agent message AFTER tab is set
          const maxSteps = parseInt(maxStepsInput.value) || 10;
          chrome.runtime.sendMessage({ 
            type: 'start_agent', 
            goal: goal,
            maxSteps: maxSteps
          });
        });
      } else {
        log('No active tab found', 'error');
      }
    });
    
    isAgentRunning = true;
    updateUI();
    
  } catch (error) {
    log(`Failed to start agent: ${error.message}`, 'error');
  }
}

// Stop AI agent
async function stopAgent() {
  try {
    log('Stopping AI agent...', 'info');
    
    // Send stop agent message to background script
    chrome.runtime.sendMessage({ type: 'stop_agent' });
    
    isAgentRunning = false;
    updateUI();
    
  } catch (error) {
    log(`Failed to stop agent: ${error.message}`, 'error');
  }
}

// Handle connection state updates
function handleConnectionState(state) {
  switch (state) {
    case 'connected':
      isConnected = true;
      updateStatus('connected', 'Connected to WebSocket');
      log('Successfully connected to WebSocket server', 'success');
      break;
    case 'disconnected':
      isConnected = false;
      isAgentRunning = false;
      updateStatus('disconnected', 'Disconnected');
      log('Disconnected from WebSocket server', 'warning');
      break;
    case 'error':
      isConnected = false;
      isAgentRunning = false;
      updateStatus('error', 'Connection error');
      log('WebSocket connection error', 'error');
      break;
    case 'attached':
      updateStatus('attached', 'Connected & Tab Attached');
      log('Tab attached to agent', 'success');
      break;
  }
  updateUI();
}

// Update status display
function updateStatus(type, message) {
  statusEl.className = `status status-${type}`;
  statusEl.textContent = message;
}

// Update UI based on current state
function updateUI() {
  // Update connect toggle button
  if (isConnected) {
    connectToggleBtn.textContent = 'Disconnect';
    connectToggleBtn.className = 'btn btn-danger';
  } else {
    connectToggleBtn.textContent = 'Connect';
    connectToggleBtn.className = 'btn btn-primary';
  }
  
  // Update agent toggle button
  if (isAgentRunning) {
    agentToggleBtn.textContent = 'Stop Agent';
    agentToggleBtn.className = 'btn btn-danger';
    agentToggleBtn.disabled = false;
  } else {
    agentToggleBtn.textContent = 'Start AI Agent';
    agentToggleBtn.className = isConnected ? 'btn btn-primary' : 'btn btn-secondary';
    agentToggleBtn.disabled = !isConnected;
  }
}

// Reset to initial state after agent completion
function resetToInitialState() {
  console.log('Resetting to initial state...');
  
  // Clear all logs and outputs
  if (logEntriesEl) {
    logEntriesEl.innerHTML = '';
  }
  if (serverOutputEl) {
    serverOutputEl.innerHTML = '';
  }
  if (resultOutputEl) {
    resultOutputEl.innerHTML = '';
  }
  
  // Hide output containers
  if (serverOutputContainer) {
  }
  if (resultOutputContainer) {
    resultOutputContainer.classList.add('hidden');
  }
  setCopyButtonEnabled(false);
  
  // Reset status to connected (ready for next task)
  updateStatus('connected', 'Connected - Ready for next task');
  updateUI();
  
  // Add ready message
  log('System reset and ready for next task', 'info');
}

function clearActivityLog() {
  if (!logEntriesEl) {
    return;
  }

  logEntriesEl.innerHTML = '';

  const logContainer = logEntriesEl.parentElement;
  if (logContainer) {
    logContainer.scrollTop = 0;
  }
}

function setCopyButtonEnabled(enabled) {
  if (copyResultBtn) {
    copyResultBtn.disabled = !enabled;
  }
}

async function copyResultToClipboard() {
  if (!resultOutputEl) {
    log('Result area not found for copy', 'error');
    return;
  }

  const text = resultOutputEl.innerText.trim();
  if (!text) {
    log('No result available to copy yet', 'warning');
    return;
  }

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    log('Clipboard API unavailable in this browser context', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    log('Result copied to clipboard', 'success');
  } catch (error) {
    console.error('Failed to copy result:', error);
    log('Failed to copy result to clipboard', 'error');
  }
}

// Log messages
function log(message, type = 'info') {
  if (!logEntriesEl) {
    console.error('logEntriesEl not found, cannot log message:', message);
    return;
  }
  
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  logEntriesEl.appendChild(logEntry);
  
  // Scroll the parent container (log-container) to bottom
  const logContainer = logEntriesEl.parentElement;
  if (logContainer) {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      logContainer.scrollTop = logContainer.scrollHeight;
    }, 10);
  }
  
  // Keep only last 50 log entries
  while (logEntriesEl.children.length > 50) {
    logEntriesEl.removeChild(logEntriesEl.firstChild);
  }
}


function showResult(result) {
  console.log('showResult called with:', result);
  console.log('resultOutputEl:', resultOutputEl);
  console.log('resultOutputContainer:', resultOutputContainer);
  
  if (!resultOutputEl || !resultOutputContainer) {
    console.error('Result output elements not found, cannot show result:', result);
    return;
  }
  
  // Show container when result is added
  resultOutputContainer.classList.remove('hidden');
  console.log('Result container shown');
  
  resultOutputEl.innerHTML = '';
  const entry = document.createElement('div');
  entry.className = 'log-entry success';
  entry.textContent = result;
  resultOutputEl.appendChild(entry);
  console.log('Result entry added to DOM');
  setCopyButtonEnabled(true);
}

function addModelAction(action) {
  // Add model action to the combined activity log
  log(`🤖 ${action}`, 'info');
}

function showPermissionRequest(explanation, action, callback) {
  if (!permissionContainer || !permissionContent) {
    console.error('Permission elements not found');
    return;
  }
  
  // Show permission container
  permissionContainer.classList.remove('hidden');
  
  // Set up content
  permissionContent.innerHTML = `
    <div class="log-entry warning">
      <strong>Model Request:</strong> ${action}
    </div>
    <div class="log-entry">
      <strong>Explanation:</strong> ${explanation}
    </div>
  `;
  
  // Set up button handlers
  allowBtn.onclick = () => {
    permissionContainer.classList.add('hidden');
    callback(true);
  };
  
  rejectBtn.onclick = () => {
    permissionContainer.classList.add('hidden');
    callback(false);
  };
}

// Listen for agent action updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'agent.action') {
    log(`Action: ${message.action}`, 'info');
  } else if (message.type === 'agent.completed') {
    isAgentRunning = false;
    updateUI();
    log('Agent completed successfully', 'success');
  } else if (message.type === 'agent.error') {
    isAgentRunning = false;
    updateUI();
    log(`Agent error: ${message.error}`, 'error');
  }
});

// Auto-connect on load if previously connected
chrome.storage.local.get(['autoConnect'], (result) => {
  if (result.autoConnect) {
    connect();
  }
});

// Save auto-connect preference
function setAutoConnect(enabled) {
  chrome.storage.local.set({ autoConnect: enabled });
}
