#!/usr/bin/env python3
"""
Diagnostic script to verify if orders can be placed.
Checks all prerequisites: DB connection, OpenAlgo server, API key, and network.
"""

import os
import sys
import requests
import sqlite3
from typing import Tuple

def check_environment_variables() -> Tuple[bool, str]:
    """Check if required environment variables are set."""
    print("\n[1] Checking Environment Variables...")

    required_vars = [
        "OPENALGO_API_KEY"
    ]

    missing = []
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)

    if missing:
        print(f"    ❌ Missing variables: {', '.join(missing)}")
        return False, f"Missing: {missing}"
    else:
        print(f"    ✅ All required environment variables are set")
        return True, "OK"

def check_openalgo_connection() -> Tuple[bool, str]:
    """Check if OpenAlgo server is reachable."""
    print("\n[2] Checking OpenAlgo Server Connection...")

    base_url = os.getenv("OPENALGO_BASE_URL", "http://openalgo-web:5000")
    api_key = os.getenv("OPENALGO_API_KEY", "")

    try:
        headers = {"X-API-KEY": api_key}
        response = requests.get(f"{base_url}/api/v1/holdings", headers=headers, timeout=5)

        if response.status_code == 200:
            print(f"    ✅ OpenAlgo server is reachable at {base_url}")
            return True, f"Connected to {base_url}"
        elif response.status_code == 401:
            print(f"    ❌ Invalid API Key: {api_key[:10]}...")
            return False, "Invalid API Key"
        else:
            print(f"    ❌ OpenAlgo returned status code {response.status_code}")
            print(f"       Response: {response.text[:100]}")
            return False, f"Status {response.status_code}"
    except requests.exceptions.ConnectionError:
        print(f"    ❌ Cannot connect to OpenAlgo at {base_url}")
        print(f"       Make sure OpenAlgo is running!")
        return False, "Connection refused"
    except Exception as e:
        print(f"    ❌ Error: {str(e)}")
        return False, str(e)

def check_database_connection() -> Tuple[bool, str]:
    """Check if SQLite trade log DB is writable."""
    print("\n[3] Checking SQLite Database...")

    db_path = os.path.join(os.path.dirname(__file__), "trades.db")
    try:
        conn = sqlite3.connect(db_path, timeout=5)
        cursor = conn.cursor()
        cursor.execute("SELECT 1;")
        conn.close()
        print(f"    ✅ SQLite database is accessible at {db_path}")
        return True, "Connected"
    except sqlite3.OperationalError as e:
        print(f"    ❌ SQLite database error: {str(e)}")
        return False, f"SQLite Error: {str(e)}"
    except Exception as e:
        print(f"    ❌ Unexpected error: {str(e)}")
        return False, str(e)

def check_order_placement_capability() -> Tuple[bool, str]:
    """Check if we can actually place an order (dry run)."""
    print("\n[4] Testing Order Placement Capability...")

    base_url = os.getenv("OPENALGO_BASE_URL", "http://openalgo-web:5000")
    api_key = os.getenv("OPENALGO_API_KEY", "")

    # Test order payload (using a common symbol)
    test_order = {
        "symbol": "SBIN-EQ",
        "action": "BUY",
        "quantity": 1,
        "product": "MIS",
        "pricetype": "MARKET",
        "price": 0.0,
        "strategy": "TEST",
        "exchange": "NSE",
        "apikey": api_key
    }

    try:
        headers = {
            "Content-Type": "application/json"
        }
        response = requests.post(
            f"{base_url}/api/v1/placeorder",
            json=test_order,
            headers=headers,
            timeout=5
        )

        if response.status_code in [200, 201]:
            data = response.json()
            print(f"    ✅ Order placement endpoint is accessible")
            print(f"       Response: {data}")
            return True, "Can place orders"
        else:
            print(f"    ⚠️  Order endpoint returned {response.status_code}")
            print(f"       Response: {response.text[:200]}")
            return False, f"Status {response.status_code}"
    except Exception as e:
        print(f"    ❌ Error testing order placement: {str(e)}")
        return False, str(e)

def print_summary(results: dict):
    """Print summary of all checks."""
    print("\n" + "="*60)
    print("DIAGNOSTIC SUMMARY")
    print("="*60)

    all_passed = True
    for check_name, (passed, message) in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{check_name:40} {status:10} {message}")
        if not passed:
            all_passed = False

    print("="*60)
    if all_passed:
        print("✅ ALL CHECKS PASSED - You can place orders!")
    else:
        print("❌ Some checks failed - Please fix the issues above")
    print("="*60 + "\n")

    return all_passed

def main():
    print("\n🔍 Order Placement Diagnostic Check\n")
    print("This script verifies if your system is ready to place orders.\n")

    results = {
        "Environment Variables":  check_environment_variables(),
        "OpenAlgo Connection":     check_openalgo_connection(),
        "Database Connection":     check_database_connection(),
        "Order Placement Test":    check_order_placement_capability(),
    }

    all_passed = print_summary(results)

    # Print quick start guide
    if not all_passed:
        print("\n📋 TROUBLESHOOTING GUIDE:\n")
        print("1. Missing Environment Variables:")
        print("   → Set OPENALGO_API_KEY")
        print("   → In Docker: Add to docker-compose.yml environment section")
        print("   → Locally: Export variables: export OPENALGO_API_KEY=your_key\n")

        print("2. OpenAlgo Not Running:")
        print("   → Start OpenAlgo: docker-compose up openalgo")
        print("   → Or run: python -m openalgo.app\n")

        print("3. SQLite Not Writable:")
        print("   → Check file permissions for trades.db")
        print("   → Ensure the working directory is writable\n")

        print("4. Invalid API Key:")
        print("   → Generate new API key in OpenAlgo dashboard")
        print("   → Update OPENALGO_API_KEY environment variable\n")
    else:
        print("\n✨ Next Steps:")
        print("   → You can now place orders using: from execution.order_manager import place_order")
        print("   → Example: place_order('SBIN-EQ', 'BUY', 10, product='MIS', order_type='MARKET')\n")

if __name__ == "__main__":
    main()
