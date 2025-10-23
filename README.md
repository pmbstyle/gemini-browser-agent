# Gemini Browser Agent

## Overview
Gemini Browser Agent is an automation agent that bridges a Chrome extension with Google’s Gemini Computer Use API. It observes the active tab, exchanges screenshots and events with the model, and performs actions directly in your own browser, no sandbox or virtual machine required.

**Runs in your actual browser.**

Automation happens in the tab you already have open. The agent can use your browser sessions for better results.
<p align="center">
<a href="https://www.youtube.com/watch?v=0K437iL5I_U"><img src="https://github.com/user-attachments/assets/27649062-bcf0-49b5-a682-fe63323baecf" /></a>
</p>


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
