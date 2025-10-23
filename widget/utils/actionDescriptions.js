// Action description utilities for creating informative sidebar messages
// This module handles converting command results into user-friendly descriptions

/**
 * Create informative action descriptions for the sidebar
 * @param {string} cmd - The command that was executed
 * @param {object} args - The arguments passed to the command
 * @param {object} result - The result returned from the command
 * @returns {string} A user-friendly description of what happened
 */
export function createActionDescription(cmd, args, result) {
  switch (cmd) {
    case 'click':
      if (result.clicked) {
        const element = result.element || result.debug?.elementAt || 'unknown element';
        return `🖱️ Clicked on ${element} at (${args.x}, ${args.y})`;
      } else {
        return `❌ Click failed at (${args.x}, ${args.y})`;
      }
    
    case 'type':
      if (result.typed) {
        const element = result.element || result.debug?.elementAt || 'unknown element';
        return `⌨️ Typed "${args.text}" into ${element}`;
      } else {
        return `❌ Typing failed: ${result.reason || 'unknown reason'}`;
      }
    
    case 'press':
      return `⌨️ Pressed key: ${args.key}`;
    
    case 'goto':
      return `🌐 Navigated to: ${args.url}`;
    
    case 'screenshot':
      const size = result.dataUrl ? Math.round(result.dataUrl.length / 1024) : 0;
      return `📸 Took screenshot (${size}KB)`;
    
    case 'current_url':
      return `🔗 Current URL: ${result.url}`;
    
    case 'get_viewport':
      return `📐 Viewport: ${result.width}x${result.height}`;
    
    case 'scroll_document':
      return `📜 Scrolled ${args.direction}`;
    
    case 'set_tab':
      return `🎯 Set active tab to: ${args.tabId}`;
    
    case 'list_tabs':
      const tabCount = result ? result.length : 0;
      return `📋 Listed ${tabCount} tabs`;
    
    default:
      return `🤖 ${cmd}(${JSON.stringify(args)})`;
  }
}
