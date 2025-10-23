#!/usr/bin/env python3
"""
WebSocket-based Gemini Computer Use agent
Uses Chrome extension for browser automation
"""
import asyncio
import base64
import json
import os
import uuid
import websockets
from typing import Any, Dict, List
from io import BytesIO

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.types import Content, Part

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️  Warning: PIL/Pillow not installed. Screenshot verification disabled.")


load_dotenv()

MODEL = "gemini-2.5-computer-use-preview-10-2025" # this specific model is required, otherwise error

def denorm_x(x: int, viewport_width: int) -> int:
    """Convert normalized x coordinate (0-1000) to actual pixels."""
    if not (0 <= x <= 1000):
        raise ValueError(f"Normalized x must be 0-1000, got {x}")
    return int(x / 1000 * viewport_width)

def denorm_y(y: int, viewport_height: int) -> int:
    """Convert normalized y coordinate (0-1000) to actual pixels."""
    if not (0 <= y <= 1000):
        raise ValueError(f"Normalized y must be 0-1000, got {y}")
    return int(y / 1000 * viewport_height)

async def get_current_state(ws):
    """Get screenshot, viewport dimensions, and URL together for synchronization."""
    screenshot_data = await execute_action(ws, "screenshot", {})
    url_data = await execute_action(ws, "current_url", {})

    # Get viewport dimensions DIRECTLY from screenshot for 100% accuracy
    # This ensures Gemini's coordinates match exactly what we use for denormalization
    if PIL_AVAILABLE and screenshot_data and "dataUrl" in screenshot_data:
        data_url = screenshot_data["dataUrl"]
        if "," in data_url:
            b64_data = data_url.split(",")[1]
            missing_padding = len(b64_data) % 4
            if missing_padding:
                b64_data += "=" * (4 - missing_padding)

            image_bytes = base64.b64decode(b64_data)
            image = Image.open(BytesIO(image_bytes))
            screenshot_width, screenshot_height = image.size

            viewport_data = {
                "width": screenshot_width,
                "height": screenshot_height,
                "devicePixelRatio": 1,
                "source": "screenshot"
            }
            print(f"📸 Viewport from screenshot: {screenshot_width}x{screenshot_height}")
        else:
            # Fallback if screenshot format is unexpected
            viewport_data = await execute_action(ws, "get_viewport", {})
            viewport_data["source"] = "fallback"
    else:
        # Fallback if PIL not available or no screenshot
        viewport_data = await execute_action(ws, "get_viewport", {})
        viewport_data["source"] = "fallback"

    if not viewport_data or "width" not in viewport_data or "height" not in viewport_data:
        raise RuntimeError("Failed to get viewport dimensions")

    return {
        'screenshot': screenshot_data,
        'viewport': viewport_data,
        'url': url_data.get("url", "") if url_data else ""
    }

def verify_dimensions_match(screenshot_data: Dict, viewport_data: Dict) -> bool:
    """
    Verify that screenshot dimensions match viewport dimensions.
    This is CRITICAL for coordinate accuracy.
    """
    if not PIL_AVAILABLE:
        return True  # Can't verify, assume OK

    try:
        if screenshot_data and "dataUrl" in screenshot_data:
            data_url = screenshot_data["dataUrl"]
            if "," in data_url:
                b64_data = data_url.split(",")[1]
                missing_padding = len(b64_data) % 4
                if missing_padding:
                    b64_data += "=" * (4 - missing_padding)

                image_bytes = base64.b64decode(b64_data)
                image = Image.open(BytesIO(image_bytes))
                screenshot_width, screenshot_height = image.size

                viewport_width = viewport_data["width"]
                viewport_height = viewport_data["height"]
                dpr = viewport_data.get("devicePixelRatio", 1)

                print(f"📸 Screenshot: {screenshot_width}x{screenshot_height}")
                print(f"🖥️  Viewport: {viewport_width}x{viewport_height} (DPR: {dpr})")

                if screenshot_width == viewport_width and screenshot_height == viewport_height:
                    print(f"✅ PERFECT MATCH! Dimensions are identical - 100% coordinate accuracy expected")
                    return True
                elif screenshot_width == int(viewport_width * dpr) and screenshot_height == int(viewport_height * dpr):
                    print(f"⚠️  WARNING: Screenshot is at PHYSICAL pixels, viewport is LOGICAL pixels")
                    print(f"   Screenshot: {screenshot_width}x{screenshot_height}")
                    print(f"   Viewport * DPR: {int(viewport_width * dpr)}x{int(viewport_height * dpr)}")
                    print(f"   FIX: Update get_viewport() to multiply by DPR")
                    return False
                else:
                    print(f"❌ DIMENSION MISMATCH! This WILL cause coordinate errors!")
                    print(f"   Screenshot: {screenshot_width}x{screenshot_height}")
                    print(f"   Viewport: {viewport_width}x{viewport_height}")
                    print(f"   Ratio: {screenshot_width/viewport_width:.2f}x")
                    return False

    except Exception as e:
        print(f"⚠️  Could not verify dimensions: {e}")
        return True  # Don't fail on verification error

    return True

# Global WebSocket connection and agent task
ws_connection = None
agent_task = None
PENDING_RESPONSES = {}

async def execute_action(ws, action_name: str, args: Dict[str, Any]) -> Any:
    """Execute a single action via WebSocket - matches agent.py approach"""
    if ws.state != 1:  # WebSocket not open
        raise RuntimeError("WebSocket connection closed")
    
    msg_id = str(uuid.uuid4())
    message = {
        "id": msg_id,
        "cmd": action_name,
        "args": args
    }
    
    # Create future for response
    future = asyncio.Future()
    PENDING_RESPONSES[msg_id] = future
    
    try:
        await ws.send(json.dumps(message))
        
        # Wait for response with timeout
        response = await asyncio.wait_for(future, timeout=60.0)
        return response.get("result")
        
    except asyncio.TimeoutError:
        print(f"[execute_action] Timeout waiting for {action_name} (msg_id: {msg_id})")
        raise RuntimeError(f"Timeout waiting for {action_name}")
    finally:
        PENDING_RESPONSES.pop(msg_id, None)

async def exec_calls_websocket(candidate, ws) -> List[tuple[str, Dict[str, Any]]]:
    """Execute all function_call from model response"""
    results: List[tuple[str, Dict[str, Any]]] = []
    function_calls = [p.function_call for p in candidate.content.parts if getattr(p, "function_call", None)]

    # Get FRESH viewport for this action batch
    viewport_data = await execute_action(ws, "get_viewport", {})
    if not viewport_data or "width" not in viewport_data or "height" not in viewport_data:
        raise RuntimeError("Failed to get viewport dimensions for action execution")

    vw = viewport_data['width']
    vh = viewport_data['height']
    print(f"Executing actions with viewport: {vw}x{vh}")

    for fc in function_calls:
        name = fc.name
        args = dict(fc.args or {})
        extra: Dict[str, Any] = {}

        print(f"→ {name} {args}")
        try:
            if name == "open_web_browser":
                pass  # browser already open
            elif name == "wait_5_seconds":
                await asyncio.sleep(5)
            elif name == "go_back":
                await execute_action(ws, "go_back", {})
            elif name == "go_forward":
                await execute_action(ws, "go_forward", {})
            elif name == "search":
                await execute_action(ws, "goto", {"url": "https://www.google.com"})
            elif name == "navigate":
                await execute_action(ws, "goto", {"url": args["url"]})
            elif name == "click_at":
                x, y = denorm_x(args["x"], vw), denorm_y(args["y"], vh)
                print(f"Click: norm=({args['x']}, {args['y']}) → actual=({x}, {y}) viewport={vw}x{vh}")
                await execute_action(ws, "click", {"x": x, "y": y})
            elif name == "hover_at":
                x, y = denorm_x(args["x"], vw), denorm_y(args["y"], vh)
                await execute_action(ws, "hover", {"x": x, "y": y})
            elif name == "type_text_at":
                x, y = denorm_x(args["x"], vw), denorm_y(args["y"], vh)
                print(f"Type: norm=({args['x']}, {args['y']}) → actual=({x}, {y}) viewport={vw}x{vh}")
                # Click first, then type
                await execute_action(ws, "click", {"x": x, "y": y})
                if args.get("clear_before_typing", True):
                    await execute_action(ws, "press", {"key": "Meta+A"})
                    await execute_action(ws, "press", {"key": "Backspace"})
                await execute_action(ws, "type", {"x": x, "y": y, "text": args["text"]})
                if args.get("press_enter", True):
                    await execute_action(ws, "press", {"key": "Enter"})
            elif name == "key_combination":
                await execute_action(ws, "press", {"key": args["keys"]})
            elif name == "scroll_document":
                direction = args.get("direction", "down").lower()
                if direction == "down":
                    await execute_action(ws, "press", {"key": "PageDown"})
                elif direction == "up":
                    await execute_action(ws, "press", {"key": "PageUp"})
                elif direction == "left":
                    await execute_action(ws, "evaluate", {"expression": "window.scrollBy(-400, 0)"})
                elif direction == "right":
                    await execute_action(ws, "evaluate", {"expression": "window.scrollBy(400, 0)"})
            elif name == "scroll_at":
                x, y = denorm_x(args["x"], vw), denorm_y(args["y"], vh)
                await execute_action(ws, "hover", {"x": x, "y": y})
                magnitude = int(args.get("magnitude", 800))
                # FIX: Denormalize magnitude to actual pixels
                actual_magnitude = int(magnitude / 1000 * vh)
                direction = args.get("direction", "down").lower()
                dy = actual_magnitude if direction == "down" else -actual_magnitude
                await execute_action(ws, "evaluate", {"expression": f"window.scrollBy(0, {dy})"})
            elif name == "drag_and_drop":
                sx, sy = denorm_x(args["x"], vw), denorm_y(args["y"], vh)
                dx, dy = denorm_x(args["destination_x"], vw), denorm_y(args["destination_y"], vh)
                # Simple drag and drop implementation
                await execute_action(ws, "evaluate", {
                    "expression": f"""
                    const startEl = document.elementFromPoint({sx}, {sy});
                    const endEl = document.elementFromPoint({dx}, {dy});
                    if (startEl && endEl) {{
                        startEl.dispatchEvent(new MouseEvent('mousedown', {{bubbles: true}}));
                        endEl.dispatchEvent(new MouseEvent('mouseup', {{bubbles: true}}));
                    }}
                    """
                })
            else:
                print(f"⚠ Not implemented: {name}")
                extra["warning"] = "unimplemented_action"

            # Wait for rendering/navigation
            await asyncio.sleep(0.6)
            results.append((name, extra))

        except Exception as e:
            print(f"Error in {name}: {e}")
            results.append((name, {"error": str(e), **extra}))

    return results

async def build_function_responses_websocket(ws, results: List[tuple[str, Dict[str, Any]]]) -> List[types.FunctionResponse]:
    """Build function responses with screenshot"""
    # Get FRESH state after actions
    state = await get_current_state(ws)

    # Decode screenshot
    screenshot_data = state['screenshot']
    if screenshot_data and "dataUrl" in screenshot_data:
        data_url = screenshot_data["dataUrl"]
        if "," in data_url:
            b64_data = data_url.split(",")[1]
            # Add padding if needed
            missing_padding = len(b64_data) % 4
            if missing_padding:
                b64_data += "=" * (4 - missing_padding)
            screenshot = base64.b64decode(b64_data)
        else:
            screenshot = b""
    else:
        screenshot = b""

    url = state['url']
    viewport = state['viewport']
    print(f"Screenshot captured with viewport: {viewport['width']}x{viewport['height']}")

    responses: List[types.FunctionResponse] = []

    for name, payload in results:
        data = {"url": url, **payload}
        responses.append(
            types.FunctionResponse(
                name=name,
                response=data,
                parts=[types.FunctionResponsePart(
                    inline_data=types.FunctionResponseBlob(mime_type="image/png", data=screenshot)
                )],
            )
        )
    return responses

async def handle_websocket_connection(ws):
    """Handle WebSocket connection from Chrome extension"""
    global ws_connection, agent_task
    ws_connection = ws
    print(f"Extension connected from {ws.remote_address}")
    
    try:
        async for message in ws:
            try:
                data = json.loads(message)
                msg_id = data.get("id")
                
                if msg_id and msg_id in PENDING_RESPONSES:
                    # This is a response to a pending request
                    future = PENDING_RESPONSES[msg_id]
                    future.set_result(data)
                else:
                    # This is a new command from the extension
                    if data.get("cmd") == "start_agent":
                        goal = data.get("args", {}).get("goal", "")
                        max_steps = data.get("args", {}).get("maxSteps", 10)
                        print(f"Starting agent with goal: {goal}, max steps: {max_steps}")
                        # Send to extension
                        await ws.send(json.dumps({"type": "server_output", "text": f"Starting agent with goal: {goal}, max steps: {max_steps}"}))
                        
                        # Clean up any existing agent task before starting new one
                        if agent_task and not agent_task.done():
                            print("Stopping previous agent task...")
                            agent_task.cancel()
                            try:
                                await agent_task
                            except asyncio.CancelledError:
                                pass
                        
                        # Run agent in background task so message handler stays responsive
                        agent_task = asyncio.create_task(start_agent_loop(ws, goal, max_steps))
                        
                    elif data.get("cmd") == "stop_agent":
                        print("Stopping agent...")
                        # Send to extension
                        await ws.send(json.dumps({"type": "server_output", "text": "Stopping agent..."}))
                        
                        # Clean up agent task
                        if agent_task and not agent_task.done():
                            agent_task.cancel()
                            try:
                                await agent_task
                            except asyncio.CancelledError:
                                pass
                        agent_task = None
                        
                        # Send completion message
                        await ws.send(json.dumps({"type": "agent_result", "result": "Agent stopped by user."}))
                        
            except json.JSONDecodeError as e:
                print(f"Invalid JSON received: {e}")
            except Exception as e:
                print(f"Error processing message: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        print("WebSocket connection closed")
    finally:
        # Cancel agent task if still running
        if agent_task and not agent_task.done():
            agent_task.cancel()
        agent_task = None
        ws_connection = None

async def start_agent_loop(ws, goal: str, max_steps: int = 10):
    """Main agent loop - matches agent.py exactly"""
    global agent_task
    client = genai.Client()

    # Get INITIAL state (screenshot + viewport + URL together)
    print("Getting initial state...")
    state = await get_current_state(ws)
    
    # Decode initial screenshot
    screenshot_data = state['screenshot']
    viewport = state['viewport']
    print(f"Initial viewport: {viewport['width']}x{viewport['height']}")

    if screenshot_data and "dataUrl" in screenshot_data:
        data_url = screenshot_data["dataUrl"]
        if "," in data_url:
            b64_data = data_url.split(",")[1]
            missing_padding = len(b64_data) % 4
            if missing_padding:
                b64_data += "=" * (4 - missing_padding)
            initial_png = base64.b64decode(b64_data)

            # Save screenshot to file for inspection
            with open("screenshot_0_initial.png", "wb") as f:
                f.write(initial_png)
            print(f"Saved screenshot_0_initial.png (viewport: {viewport['width']}x{viewport['height']})")
        else:
            initial_png = b""
    else:
        initial_png = b""
    
    # Config with Computer Use tool
    config = types.GenerateContentConfig(
        tools=[types.Tool(
            computer_use=types.ComputerUse(
                environment=types.Environment.ENVIRONMENT_BROWSER,
            )
        )],
        thinking_config=types.ThinkingConfig(include_thoughts=True),
    )

    # Initial content (goal + screenshot)
    contents: List[Content] = [Content(
        role="user",
        parts=[Part(text=goal),
               Part.from_bytes(data=initial_png, mime_type="image/png")]
    )]

    # Agent loop
    for turn in range(max_steps):
        print(f"\n----- TURN {turn+1} -----")
        # Send to extension
        await ws.send(json.dumps({"type": "server_output", "text": f"----- TURN {turn+1} -----"}))
        resp = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=config,
        )

        candidates = getattr(resp, "candidates", None) or []
        if not candidates:
            feedback = getattr(resp, "prompt_feedback", None)
            block_reason = getattr(feedback, "block_reason", None)
            reason_text = f" (block reason: {block_reason})" if block_reason else ""
            msg = f"⚠️ Gemini response missing candidates{reason_text}."
            print(msg)
            await ws.send(json.dumps({"type": "server_output", "text": msg}))
            await ws.send(json.dumps({"type": "agent_result", "result": "Agent stopped: Gemini returned no candidates."}))
            agent_task = None
            break

        cand = candidates[0]
        if not getattr(cand, "content", None) or not getattr(cand.content, "parts", None):
            msg = "⚠️ Gemini candidate missing content; stopping agent."
            print(msg)
            await ws.send(json.dumps({"type": "server_output", "text": msg}))
            await ws.send(json.dumps({"type": "agent_result", "result": "Agent stopped: Gemini returned empty content."}))
            agent_task = None
            break

        contents.append(cand.content)

        # If model didn't return function_call — output text and exit
        if not any(getattr(p, "function_call", None) for p in cand.content.parts):
            final_text = " ".join([p.text for p in cand.content.parts if getattr(p, "text", None)])
            print(f"\n✅ Done: {final_text}")
            # Send result to extension
            await ws.send(json.dumps({"type": "agent_result", "result": final_text}))
            # Clean up: reset agent task
            agent_task = None
            break

        # Execute actions and return FunctionResponse with new screenshot
        print("▶ Executing actions…")
        await ws.send(json.dumps({"type": "server_output", "text": "▶ Executing actions…"}))
        results = await exec_calls_websocket(cand, ws)
        frs = await build_function_responses_websocket(ws, results)
        contents.append(Content(role="user", parts=[Part(function_response=fr) for fr in frs]))

    else:
        print(f"\n⏹ Reached step limit ({max_steps} steps). Stopping.")
        # Send step limit message to widget
        if ws_connection:
            await ws_connection.send(json.dumps({
                "type": "agent_result", 
                "result": f"Reached maximum steps limit ({max_steps} steps). Agent stopping."
            }))
        # Clean up: reset agent task
        agent_task = None

async def main():
    """Main function"""
    print("Gemini Browser Agent WebSocket Server")
    print("Waiting for Chrome extension to connect...")
    
    # Start WebSocket server
    server = await websockets.serve(handle_websocket_connection, "127.0.0.1", 8765)
    print("Server running on ws://127.0.0.1:8765")
    
    try:
        await server.wait_closed()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.close()
        await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
