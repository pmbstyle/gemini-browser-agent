# Gemini Browser Agent

## Overview
Gemini Browser Agent is a local automation companion that bridges a Chrome extension with Google’s Gemini Computer Use API. It observes the active tab, exchanges screenshots and events with the model, and performs actions directly in your own browser—no hosted sandbox or virtual machine required.

## Why Use It
- **Runs in your browser:** Automation happens in the tab you already have open, making debugging and verification straightforward.
- **No remote sandbox:** Keep data local and avoid the latency or limits of third-party environments.
- **Rapid experiments:** Extend the agent with JavaScript modules or Python utilities without additional infrastructure.

## Setup
1. Install Python 3.10+ and Chrome (or Chromium-based) browser.
2. Clone this repository and open a terminal in the project directory.
3. (Optional) Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
4. Run the setup helper to install dependencies and scaffold `.env`:
   ```bash
   python setup.py
   ```
5. Visit <https://aistudio.google.com/api-keys> to create a Gemini API key, then place it in the generated `.env` file as `GEMINI_API_KEY=...`.

## Usage
1. Start the Python WebSocket bridge:
   ```bash
   python websocket_agent.py
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the `widget/` directory from this project.
4. Open the sidebar, click **Connect** to link the extension with the Python agent, and provide your automation goal.
5. Press **Start AI Agent** to let Gemini plan, execute actions, and stream log updates directly in your browser.

When finished, click **Stop Agent** or disconnect, then close the terminal running the bridge. The agent is ready for iterative prompts and extensions from your local machine.***
