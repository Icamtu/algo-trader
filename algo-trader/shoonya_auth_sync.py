import os
import json
import hashlib
import sqlite3
import base64
import requests
import subprocess
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# --- CONFIG ---
USER_ID      = os.getenv("SHOONYA_USER_ID")
SECRET_KEY   = os.getenv("BROKER_API_SECRET")
FULL_KEY      = os.getenv("BROKER_API_KEY")
CLIENT_ID    = FULL_KEY.split(":::")[1] if FULL_KEY and ":::" in FULL_KEY else FULL_KEY

# Validate required configuration
if not all([USER_ID, SECRET_KEY, FULL_KEY]):
    raise EnvironmentError("Missing required Shoonya credentials in environment (SHOONYA_USER_ID, BROKER_API_SECRET, BROKER_API_KEY)")

# Path Resolution
DEFAULT_DB = "/app/storage/openalgo.db"
DB_PATH = os.getenv("OPENALGO_DB_PATH", DEFAULT_DB)

def get_encrypted_token(raw_token):
    pepper = os.getenv('API_KEY_PEPPER')
    if not pepper:
         raise EnvironmentError("API_KEY_PEPPER not set in environment")
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b'openalgo_static_salt', iterations=100000)
    key = base64.urlsafe_b64encode(kdf.derive(pepper.encode()))
    f = Fernet(key)
    return f.encrypt(raw_token.encode()).decode()

def run_sync():
    print("--- SHOONYA OAUTH SYNCHRONIZATION (CONTAINER ENGINE) ---")

    # 1. Capture Code via Selenium
    print("Step 1: Capturing authorization code...")
    cmd = ["python3", "/app/utils/get_shoonya_token.py"]

    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)

    auth_code = None
    for line in result.stdout.split("\n"):
        if "CAPTURED_CODE=" in line:
            auth_code = line.split("CAPTURED_CODE=")[1].strip()
            break

    if not auth_code:
        print("Error: Failed to capture authorization code.")
        print(f"Error Output: {result.stderr}")
        return

    # 2. Handshake: Get Access Token
    print(f"Step 2: Performing handshake for code {auth_code[:5]}***")
    url = "https://api.shoonya.com/NorenWClientAPI/GenAcsTok"
    checksum_input = f"{CLIENT_ID}{SECRET_KEY}{auth_code}"
    checksum = hashlib.sha256(checksum_input.encode()).hexdigest()

    payload = {"code": auth_code, "checksum": checksum}
    payload_str = "jData=" + json.dumps(payload)
    headers = {"Content-Type": "text/plain"}

    resp = requests.post(url, data=payload_str, headers=headers, timeout=10)
    print(f"Handshake Status: {resp.status_code}")
    data = resp.json()
    print(f"DEBUG: Shoonya Handshake Response: {json.dumps(data)}")

    if data.get("stat") != "Ok":
        print(f"Error: Handshake failed. {data.get('emsg', 'Unknown error')}")
        return

    # Try to find the token in known keys
    access_token = data.get("access_token") or data.get("susertoken")
    if not access_token:
        print(f"Error: Could not find access_token or susertoken in response. Keys: {list(data.keys())}")
        return

    print(f"Success: Access token received. ({access_token[:5]}...)")

    # 3. Inject into Database
    print("Step 3: Injecting token into database...")
    encrypted_token = get_encrypted_token(access_token)

    conn = sqlite3.connect(DB_PATH, timeout=30)
    cur = conn.cursor()

    # Update all rows where broker is 'shoonya'
    cur.execute("UPDATE auth SET auth=?, user_id=?, is_revoked=0 WHERE broker='shoonya'",
                (encrypted_token, USER_ID))
    print(f"Updated {cur.rowcount} auth rows for shoonya")

    # Also ensure AetherDesk entry exists
    target_name = os.getenv("OPENALGO_USER_ID", "AetherDesk")
    existing = cur.execute("SELECT id FROM auth WHERE name=?", (target_name,)).fetchone()
    if not existing:
        cur.execute("INSERT INTO auth (name, auth, broker, user_id, is_revoked) VALUES (?, ?, 'shoonya', ?, 0)",
                    (target_name, encrypted_token, USER_ID))
        print(f"Inserted new auth row for {target_name}")

    conn.commit()
    conn.close()
    print("Step 4: Triggering engine reconciliation...")
    try:
        engine_url = "http://localhost:18788/api/v1/system/reconcile"
        headers = {"apikey": os.getenv("API_KEY", "AetherDesk_Unified_Key_2026")}
        reconcile_resp = requests.post(engine_url, headers=headers, timeout=5)
        if reconcile_resp.status_code == 200:
            print("Engine reconciliation triggered successfully.")
        else:
            print(f"Warning: Engine reconciliation failed with status {reconcile_resp.status_code}")
    except Exception as e:
        print(f"Warning: Could not connect to engine for reconciliation: {e}")

    print("--- SYNCHRONIZATION COMPLETE ---")

if __name__ == "__main__":
    run_sync()
