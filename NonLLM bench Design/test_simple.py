#!/usr/bin/env python3
"""
Simplified test script
"""

import requests
import json

def test_backend_api():
    """Test backend API"""
    url = "http://localhost:5678/run_benchmark"
    
    data = {
        "pr_url": "https://github.com/astropy/astropy/pull/6940",
        "imports": "import numpy as np\nimport astropy.units as u",
        "setup": "global c\nc = np.arange(100)",
        "workload": "global c\nc * 2",
        "number": 10,
        "repeat": 5
    }
    
    try:
        print("🚀 Testing backend API...")
        print(f"Request data: {json.dumps(data, indent=2)}")
        
        response = requests.post(url, json=data, timeout=300)
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ API call successful")
            print(f"Image tag: {result.get('image_tag')}")
            print(f"Error message: {result.get('error')}")
            print(f"Initial results: {result.get('before', '')[:200]}...")
            print(f"Results after patch: {result.get('after', '')[:200]}...")
        else:
            print(f"❌ API call failed: {response.text}")
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    test_backend_api() 