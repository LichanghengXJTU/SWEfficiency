#!/usr/bin/env python3
"""
Docker permission check and handling script
Used to check and handle Docker permissions on macOS
"""

import subprocess
import sys
import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def check_docker_installed():
    """Check if Docker is installed"""
    try:
        result = subprocess.run(['docker', '--version'], 
                              capture_output=True, text=True)
        return result.returncode == 0, result.stdout.strip()
    except FileNotFoundError:
        return False, "Docker not installed"

def check_docker_running():
    """Check if Docker is running"""
    try:
        result = subprocess.run(['docker', 'info'], 
                              capture_output=True, text=True)
        return result.returncode == 0, result.stdout.strip()
    except Exception as e:
        return False, f"Docker running check failed: {e}"

def check_docker_permissions():
    """Check Docker permissions"""
    try:
        # Try to run a simple Docker command
        result = subprocess.run(['docker', 'run', '--rm', 'hello-world'], 
                              capture_output=True, text=True)
        return result.returncode == 0, "Docker permissions normal"
    except Exception as e:
        return False, f"Docker permission check failed: {e}"

def get_docker_status():
    """Get complete Docker status"""
    installed, install_msg = check_docker_installed()
    if not installed:
        return {
            "installed": False,
            "running": False,
            "permissions": False,
            "message": install_msg,
            "setup_instructions": []
        }
    
    running, run_msg = check_docker_running()
    if not running:
        return {
            "installed": True,
            "running": False,
            "permissions": False,
            "message": "Docker installed but not running",
            "setup_instructions": []
        }
    
    permissions, perm_msg = check_docker_permissions()
    return {
        "installed": True,
        "running": True,
        "permissions": permissions,
        "message": perm_msg,
        "setup_instructions": []
    }

@app.route("/check_docker", methods=["GET"])
def check_docker():
    """API endpoint to check Docker status"""
    status = get_docker_status()
    return jsonify(status)

@app.route("/test_docker", methods=["POST"])
def test_docker():
    """API endpoint to test Docker functionality"""
    try:
        data = request.json
        image_tag = data.get("image_tag", "hello-world")
        
        # Try to pull and run the specified image
        result = subprocess.run(['docker', 'run', '--rm', image_tag], 
                              capture_output=True, text=True)
        
        return jsonify({
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        })

if __name__ == "__main__":
    app.run(debug=True, port=5679, use_reloader=False) 