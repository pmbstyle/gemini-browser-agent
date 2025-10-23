// Browser automation actions for Gemini Browser Agent
// This module contains all the browser interaction functions

import { ensureTab, runInCurrentTab, updateTab, getAllTabs, setCurrentTab, getCurrentTab } from '../utils/tabManager.js';

/**
 * Click at specific coordinates
 * @param {object} params - Click parameters
 * @param {number} params.x - X coordinate
 * @param {number} params.y - Y coordinate
 * @returns {Promise<object>} Click result with debug info
 */
export async function click({ x, y }) {
  try {
    return runInCurrentTab(({ x, y }) => {
      // Add visual debug indicator - red dot at click coordinates
      console.log(`[bridge] Click coordinates received: (${x}, ${y})`);
      
      // Add debugging info about the page
      console.log(`[bridge] Page scroll: (${window.scrollX}, ${window.scrollY})`);
      console.log(`[bridge] Viewport: ${window.innerWidth}x${window.innerHeight}`);
      console.log(`[bridge] Screen: ${screen.width}x${screen.height}`);

      // Debug dot at ACTUAL click coordinates (no offset)
      const debugDot = document.createElement('div');
      debugDot.style.position = 'fixed';
      debugDot.style.left = (x - 5) + 'px';
      debugDot.style.top = (y - 5) + 'px';
      debugDot.style.width = '10px';
      debugDot.style.height = '10px';
      debugDot.style.backgroundColor = 'red';
      debugDot.style.borderRadius = '50%';
      debugDot.style.zIndex = '999999';
      debugDot.style.pointerEvents = 'none';
      debugDot.style.boxShadow = '0 0 10px red';
      document.body.appendChild(debugDot);
      
      // Remove debug dot after 2 seconds
      setTimeout(() => {
        try {
          if (debugDot && debugDot.parentNode) {
            debugDot.parentNode.removeChild(debugDot);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 2000);
      
      const el = document.elementFromPoint(x, y);
      const debug = {
        elementAt: el ? `${el.tagName}#${el.id}.${el.className}` : 'none',
        nearbyInput: null,
        clickableElements: [],
        forcedCurrentTab: false,
        coords: { x, y },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
      
      if (el) {
        // Force links to open in current tab to prevent new tab issues
        // This ensures the agent stays in the same tab and can continue its workflow
        if (el.tagName === 'A') {
          console.log(`[bridge] Forcing link to open in current tab: ${el.href}`);
          el.target = '_self';
          debug.forcedCurrentTab = true;
        }
        
        // Prevent unwanted form submissions that might cause page refreshes
        // This is a generic approach that works for any website
        const form = el.closest('form');
        if (form && (form.onsubmit || form.querySelector('button[type="submit"]'))) {
          console.log(`[bridge] Temporarily disabling form submission to prevent page refresh`);
          const originalOnSubmit = form.onsubmit;
          form.onsubmit = null;
          // Also prevent submit buttons from triggering form submission
          const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
          submitButtons.forEach(btn => {
            btn.type = 'button';
            setTimeout(() => {
              btn.type = 'submit';
            }, 100);
          });
          setTimeout(() => {
            form.onsubmit = originalOnSubmit;
          }, 100);
        }
        
        // Direct click approach - no nearby element detection
        el.focus();
        el.click();
        
        // Method 2: Mouse events with actual coordinates
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });
        
        el.dispatchEvent(mouseDownEvent);
        el.dispatchEvent(mouseUpEvent);
        el.dispatchEvent(clickEvent);
        
        return { clicked: true, debug, element: debug.elementAt };
      }
      
      return { clicked: false, debug };
    }, { x, y });
  } catch (error) {
    console.log(`[bridge] runInPage failed for click: ${error.message}`);
    return { clicked: false, error: error.message };
  }
}

/**
 * Type text at specific coordinates
 * @param {object} params - Type parameters
 * @param {string} params.text - Text to type
 * @param {number} params.x - X coordinate
 * @param {number} params.y - Y coordinate
 * @returns {Promise<object>} Type result with debug info
 */
export async function type({ text, x, y }) {
  try {
    return runInCurrentTab(({ text, x, y }) => {
      // Add visual debug indicator - blue dot at type coordinates
      console.log(`[bridge] Type coordinates received: (${x}, ${y})`);
      
      // Add debugging info about the page
      console.log(`[bridge] Page scroll: (${window.scrollX}, ${window.scrollY})`);
      console.log(`[bridge] Viewport: ${window.innerWidth}x${window.innerHeight}`);

      // Debug dot at ACTUAL type coordinates (no offset)
      const debugDot = document.createElement('div');
      debugDot.style.position = 'fixed';
      debugDot.style.left = (x - 5) + 'px';
      debugDot.style.top = (y - 5) + 'px';
      debugDot.style.width = '10px';
      debugDot.style.height = '10px';
      debugDot.style.backgroundColor = 'blue';
      debugDot.style.borderRadius = '50%';
      debugDot.style.zIndex = '999999';
      debugDot.style.pointerEvents = 'none';
      debugDot.style.boxShadow = '0 0 10px blue';
      document.body.appendChild(debugDot);
      
      // Remove debug dot after 2 seconds
      setTimeout(() => {
        try {
          if (debugDot && debugDot.parentNode) {
            debugDot.parentNode.removeChild(debugDot);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 2000);
      
      const el = document.elementFromPoint(x, y);
      const debug = {
        elementAt: el ? `${el.tagName}#${el.id}.${el.className}` : 'none',
        isInput: el ? (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) : false,
        isContentEditable: el ? (el.contentEditable === 'true') : false,
        nearbyInput: null,
        coords: { x, y },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
      
      if (el) {
        // Try to click the element first to ensure it's focused and ready for input
        el.click();
        
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('keyup', { bubbles: true }));
          el.dispatchEvent(new Event('keydown', { bubbles: true }));
          return { typed: true, debug, element: debug.elementAt, value: el.value };
        } else if (el.contentEditable === 'true' || el.contentEditable === true) {
          el.focus();
          el.textContent = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('keyup', { bubbles: true }));
          el.dispatchEvent(new Event('keydown', { bubbles: true }));
          return { typed: true, debug, element: debug.elementAt, value: el.textContent };
        } else {
          // Generic approach: Look for any input-capable elements within the clicked element
          // Priority order: direct inputs > contenteditable elements > any other input-capable elements
          
          // 1. Look for standard input elements first
          const inputEl = el.querySelector('input, textarea');
          if (inputEl) {
            console.log(`[bridge] Found input child element: ${inputEl.tagName}#${inputEl.id}`);
            inputEl.focus();
            inputEl.value = text;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            inputEl.dispatchEvent(new Event('keyup', { bubbles: true }));
            inputEl.dispatchEvent(new Event('keydown', { bubbles: true }));
            return { typed: true, debug: { ...debug, elementAt: `${inputEl.tagName}#${inputEl.id}` }, element: `${inputEl.tagName}#${inputEl.id}`, value: inputEl.value };
          }
          
          // 2. Look for contenteditable elements
          const contentEditableEl = el.querySelector('[contenteditable="true"], [contenteditable=true], [contenteditable]');
          if (contentEditableEl) {
            console.log(`[bridge] Found contenteditable child element: ${contentEditableEl.tagName}#${contentEditableEl.id}`);
            contentEditableEl.focus();
            contentEditableEl.textContent = text;
            contentEditableEl.dispatchEvent(new Event('input', { bubbles: true }));
            contentEditableEl.dispatchEvent(new Event('change', { bubbles: true }));
            contentEditableEl.dispatchEvent(new Event('keyup', { bubbles: true }));
            contentEditableEl.dispatchEvent(new Event('keydown', { bubbles: true }));
            return { typed: true, debug: { ...debug, elementAt: `${contentEditableEl.tagName}#${contentEditableEl.id}` }, element: `${contentEditableEl.tagName}#${contentEditableEl.id}`, value: contentEditableEl.textContent };
          }
          
          // 3. Look for elements with role="textbox" or similar input roles
          const roleInputEl = el.querySelector('[role="textbox"], [role="searchbox"], [role="combobox"]');
          if (roleInputEl) {
            console.log(`[bridge] Found role-based input element: ${roleInputEl.tagName}#${roleInputEl.id}`);
            roleInputEl.focus();
            if (roleInputEl.value !== undefined) {
              roleInputEl.value = text;
            } else {
              roleInputEl.textContent = text;
            }
            roleInputEl.dispatchEvent(new Event('input', { bubbles: true }));
            roleInputEl.dispatchEvent(new Event('change', { bubbles: true }));
            roleInputEl.dispatchEvent(new Event('keyup', { bubbles: true }));
            roleInputEl.dispatchEvent(new Event('keydown', { bubbles: true }));
            return { typed: true, debug: { ...debug, elementAt: `${roleInputEl.tagName}#${roleInputEl.id}` }, element: `${roleInputEl.tagName}#${roleInputEl.id}`, value: roleInputEl.value || roleInputEl.textContent };
          }
        }
      }
      
      return { typed: false, debug, reason: 'no suitable input found' };
    }, { text, x, y });
  } catch (error) {
    console.log(`[bridge] runInPage failed for type: ${error.message}`);
    return { typed: false, error: error.message };
  }
}

/**
 * Press a key
 * @param {object} params - Key press parameters
 * @param {string} params.key - Key to press
 * @returns {Promise<boolean>} Success status
 */
export async function press({ key }) {
  return runInCurrentTab(({ key }) => {
    const activeEl = document.activeElement;
    if (activeEl) {
      // Handle special keys
      if (key === 'PageDown') {
        window.scrollBy(0, 800);
        return true;
      } else if (key === 'PageUp') {
        window.scrollBy(0, -800);
        return true;
      } else {
        // Create and dispatch multiple keyboard events for better compatibility
        const keydownEvent = new KeyboardEvent('keydown', { 
          key: key, 
          code: key === 'Enter' ? 'Enter' : key,
          keyCode: key === 'Enter' ? 13 : 0,
          which: key === 'Enter' ? 13 : 0,
          bubbles: true, 
          cancelable: true 
        });
        
        const keypressEvent = new KeyboardEvent('keypress', { 
          key: key, 
          code: key === 'Enter' ? 'Enter' : key,
          keyCode: key === 'Enter' ? 13 : 0,
          which: key === 'Enter' ? 13 : 0,
          bubbles: true, 
          cancelable: true 
        });
        
        const keyupEvent = new KeyboardEvent('keyup', { 
          key: key, 
          code: key === 'Enter' ? 'Enter' : key,
          keyCode: key === 'Enter' ? 13 : 0,
          which: key === 'Enter' ? 13 : 0,
          bubbles: true, 
          cancelable: true 
        });
        
        // Dispatch all events
        activeEl.dispatchEvent(keydownEvent);
        activeEl.dispatchEvent(keypressEvent);
        activeEl.dispatchEvent(keyupEvent);
        
        // For Enter key, also try to submit the form
        if (key === 'Enter') {
          console.log('[bridge] Enter key pressed, looking for form');
          const form = activeEl.closest('form');
          if (form) {
            console.log('[bridge] Found form, submitting:', form);
            form.submit();
          } else {
            console.log('[bridge] No form found for Enter key');
            // Try to find search button
            const searchButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button[aria-label*="search" i]');
            console.log('[bridge] Found search buttons:', searchButtons.length);
            for (const button of searchButtons) {
              if (button.offsetParent !== null) {
                console.log('[bridge] Clicking search button:', button);
                button.click();
                break;
              }
            }
          }
        }
        
        return true;
      }
    }
    return false;
  }, { key });
}

/**
 * Evaluate JavaScript expression
 * @param {object} params - Evaluation parameters
 * @param {string} params.expression - JavaScript expression to evaluate
 * @returns {Promise<any>} Evaluation result
 */
export async function evaluate({ expression }) {
  return runInCurrentTab(({ expression }) => {
    try {
      return eval(expression);
    } catch (e) {
      throw new Error(`evaluation failed: ${e.message}`);
    }
  }, { expression });
}

/**
 * Navigate to a URL
 * @param {object} params - Navigation parameters
 * @param {string} params.url - URL to navigate to
 * @returns {Promise<object>} Navigation result
 */
export async function goto({ url }) {
  const tabId = await ensureTab();
  try {
    console.log(`[bridge] Navigating to: ${url} in tab: ${tabId}`);
    const result = await updateTab(tabId, { url });
    console.log(`[bridge] Navigation result:`, result);
    return result;
  } catch (error) {
    console.error(`[bridge] Navigation failed:`, error);
    throw error;
  }
}

/**
 * Go back in browser history
 * @returns {Promise<boolean>} Success status
 */
export async function go_back() {
  return runInCurrentTab(() => {
    window.history.back();
    return true;
  });
}

/**
 * Go forward in browser history
 * @returns {Promise<boolean>} Success status
 */
export async function go_forward() {
  return runInCurrentTab(() => {
    window.history.forward();
    return true;
  });
}

/**
 * Hover at specific coordinates
 * @param {object} params - Hover parameters
 * @param {number} params.x - X coordinate
 * @param {number} params.y - Y coordinate
 * @returns {Promise<boolean>} Success status
 */
export async function hover({ x, y }) {
  return runInCurrentTab(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    if (el) {
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      return true;
    }
    return false;
  }, { x, y });
}

/**
 * Take a screenshot
 * @returns {Promise<object>} Screenshot data URL
 */
export async function screenshot() {
  const tabId = await ensureTab();
  try {
    // Try to activate the tab first to ensure we can take a screenshot
    await updateTab(tabId, { active: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
    
    // Check if the screenshot is too large (> 500KB)
    const base64Data = dataUrl.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    console.log(`[bridge] Screenshot size: ${Math.round(sizeInBytes / 1024)}KB`);
    
    if (sizeInBytes > 500000) { // 500KB limit
      console.log('[bridge] Screenshot too large, taking lower quality version');
      const lowQualityDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 30 });
      
      // Check if still too large
      const lowQualityBase64 = lowQualityDataUrl.split(',')[1];
      const lowQualitySize = (lowQualityBase64.length * 3) / 4;
      console.log(`[bridge] Low quality screenshot size: ${Math.round(lowQualitySize / 1024)}KB`);
      
      if (lowQualitySize > 500000) {
        console.log('[bridge] Still too large, taking very low quality version');
        const veryLowQualityDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 10 });
        return { dataUrl: veryLowQualityDataUrl };
      }
      
      return { dataUrl: lowQualityDataUrl };
    }
    
    return { dataUrl };
  } catch (error) {
    console.error(`[bridge] Screenshot failed: ${error.message}`);
    // Return a placeholder image if screenshot fails
    return { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' };
  }
}

/**
 * Get current URL
 * @returns {Promise<object>} Current URL info
 */
export async function current_url() {
  const tabId = await ensureTab();
  const tab = await chrome.tabs.get(tabId);
  return { url: tab.url };
}

/**
 * List all tabs
 * @returns {Promise<Array>} Array of tab info
 */
export async function list_tabs() {
  const tabs = await getAllTabs();
  return tabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title
  }));
}

/**
 * Set the current tab
 * @param {object} params - Tab parameters
 * @param {number} params.tabId - Tab ID to set as current
 * @returns {Promise<object>} Success status
 */
export async function set_tab({ tabId }) {
  await setCurrentTab(tabId);
  return { ok: true };
}

/**
 * Scroll the document
 * @param {object} params - Scroll parameters
 * @param {string} params.direction - Scroll direction (up, down, left, right)
 * @returns {Promise<object>} Scroll result
 */
export async function scroll_document({ direction }) {
  return runInCurrentTab(({ direction }) => {
    if (direction === 'down') {
      window.scrollBy(0, 800);
      return { scrolled: true, direction: 'down', amount: 800 };
    } else if (direction === 'up') {
      window.scrollBy(0, -800);
      return { scrolled: true, direction: 'up', amount: -800 };
    } else if (direction === 'left') {
      window.scrollBy(-800, 0);
      return { scrolled: true, direction: 'left', amount: -800 };
    } else if (direction === 'right') {
      window.scrollBy(800, 0);
      return { scrolled: true, direction: 'right', amount: 800 };
    }
    return { scrolled: false, error: 'Invalid direction' };
  }, { direction });
}

/**
 * Get viewport dimensions
 * @returns {Promise<object>} Viewport dimensions
 */
export async function get_viewport() {
  const tabId = await ensureTab();
  console.log(`[bridge] Getting viewport dimensions for tab: ${tabId}`);

  // Get actual viewport from page
  try {
    return await runInCurrentTab(() => {
      const dpr = window.devicePixelRatio || 1;

      // Return logical CSS pixels (what elementFromPoint uses)
      // Chrome's captureVisibleTab returns image at logical resolution
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: dpr  // For debugging
      };

      console.log(`[bridge] Viewport: ${viewport.width}x${viewport.height} (DPR: ${dpr})`);
      return viewport;
    });
  } catch (error) {
    console.log(`[bridge] Cannot inject script (restricted URL): ${error.message}`);
    console.log(`[bridge] Python backend will extract dimensions from screenshot instead`);

    // Return placeholder - Python will get actual dimensions from screenshot
    return {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      needsScreenshotDimensions: true
    };
  }
}

export const actions = {
  click,
  type,
  press,
  evaluate,
  goto,
  go_back,
  go_forward,
  hover,
  screenshot,
  current_url,
  list_tabs,
  set_tab,
  scroll_document,
  get_viewport
};
