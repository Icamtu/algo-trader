#!/usr/bin/env python3
"""
Test script to verify OpenAlgo API error handling with the updated client
"""
import sys
sys.path.insert(0, '/home/algo-kamaleswar/trading-workspace/algo-trader')

from execution.openalgo_client import OpenAlgoClient

client = OpenAlgoClient(
    base_url="https://kamaleswaralgo-vcn.tail716e1a.ts.net",
    api_key="test"
)

print("=" * 70)
print("Testing OpenAlgo API Error Handling")
print("=" * 70)

# Test 1: Health endpoint (should work)
print("\n[Test 1] Testing health endpoint (should return JSON)...")
result = client._request("GET", "/health/status")
print(f"Result: {result}")

# Test 2: Invalid API endpoint (will return HTML - tests our error handling)
print("\n[Test 2] Testing invalid endpoint (known to return HTML)...")
result = client._request("GET", "/api/v1/nonexistent")
print(f"Result: {result}")

# Test 3: Ping with POST (should work or fail gracefully)
print("\n[Test 3] Testing ping endpoint...")
result = client._request("POST", "/api/v1/ping", {"apikey": "test"})
print(f"Result: {result}")

print("\n" + "=" * 70)
print("✅ Error handling test complete")
print("=" * 70)
