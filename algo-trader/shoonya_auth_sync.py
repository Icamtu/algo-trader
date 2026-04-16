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
USER_ID      = os.getenv("SHOONYA_USER_ID", "FA257063")
SECRET_KEY   = os.getenv("BROKER_API_SECRET", "15ZHfDJjxb77RBJIIcchEbf0G2ridCZJDN2KIiELA7rG5fPdoIAORNaHqe6hD29l")
FULL_KEY      = os.getenv("BROKER_API_KEY", "FA257063:::FA257063_U")
CLIENT_ID    = FULL_KEY.split(":::")[1] if ":::" in FULL_KEY else FULL_KEY
# Path Resolution
DEFAULT_DB = "/app/storage/openalgo.db"
DB_PATH = os.getenv("OPENALGO_DB_PATH", DEFAULT_DB)

def get_encrypted_token(raw_token):
    pepper = 'a25d94718479b170c16278e321ea6c989358bf499a658fd20c90033cef8ce772'
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

    resp = requests.post(url, data=payload_str, headers=headers)
    print(f"Handshake Status: {resp.status_code}")
    data = resp.json()

    if data.get("stat") != "Ok" or "access_token" not in data:
        print(f"Error: Handshake failed. {data.get('emsg', 'Unknown error')}")
        return

    access_token = data["access_token"]
    print("Success: Access token received.")

    # 3. Inject into Database
    print("Step 3: Injecting token into database...")
    encrypted_token = get_encrypted_token(access_token)

    conn = sqlite3.connect(DB_PATH, timeout=30)
    cur = conn.cursor()

    # We target 'AetherDesk' for the unified system handle
    target_name = 'AetherDesk'
    existing = cur.execute("SELECT id FROM auth WHERE name=?", (target_name,)).fetchone()
    if existing:
        cur.execute("UPDATE auth SET auth=?, broker='shoonya', user_id=?, is_revoked=0 WHERE name=?",
                    (encrypted_token, USER_ID, target_name))
        print(f"Updated auth row for {target_name}")
    else:
        cur.execute("INSERT INTO auth (name, auth, broker, user_id, is_revoked) VALUES (?, ?, 'shoonya', ?, 0)",
                    (target_name, encrypted_token, USER_ID))
        print(f"Inserted new auth row for {target_name}")

    conn.commit()
    conn.close()
    print("--- SYNCHRONIZATION COMPLETE ---")

if __name__ == "__main__":
    run_sync()
