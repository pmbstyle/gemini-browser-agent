#!/usr/bin/env python3
"""
Setup script for Gemini Browser Agent
"""
import subprocess
import sys
import os

def install_requirements():
    """Install required Python packages."""
    print("Installing Python requirements...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    print("Requirements installed successfully!")

def create_env_file():
    """Create .env file if it doesn't exist."""
    if not os.path.exists(".env"):
        print("Creating .env file...")
        with open(".env", "w") as f:
            f.write("# Google Gemini API Key\n")
            f.write("# Get your API key from: https://aistudio.google.com/\n")
            f.write("GEMINI_API_KEY=your_gemini_api_key_here\n")
        print("Created .env file")
        print("   Please edit .env and add your actual GEMINI_API_KEY")
        return False
    return True

def check_env_vars():
    """Check for required environment variables."""
    if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here":
        print("Warning: GEMINI_API_KEY not properly configured")
        print("   Please edit .env file and add your actual API key")
        return False
    print("GEMINI_API_KEY is set")
    return True

def main():
    print("Gemini Browser Agent Setup")
    print("=" * 40)
    
    # Install requirements
    install_requirements()
    
    # Create .env file if needed
    env_created = create_env_file()
    
    # Check environment
    env_configured = check_env_vars()
    
    print("\nSetup complete!")
    print("\nNext steps:")
    if not env_created or not env_configured:
        print("1. Edit .env file and add your GEMINI_API_KEY")
        print("2. Get your API key from: https://aistudio.google.com/")
    print("3. Load the Chrome extension from the 'widget' folder")
    print("4. Run: python websocket_agent.py")
    print("5. Connect the extension and start automating!")

if __name__ == "__main__":
    main()
