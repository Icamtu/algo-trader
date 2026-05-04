import os
import json
import hashlib
import sqlite3
import base64
import requests
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# --- CONFIG ---
AUTH_CODE    = os.getenv("SHOONYA_AUTH_CODE", "") # Should be passed as argument, empty default
USER_ID      = os.getenv("SHOONYA_USER_ID")
SECRET_KEY   = os.getenv("BROKER_API_SECRET")
FULL_KEY      = os.getenv("BROKER_API_KEY")
CLIENT_ID    = FULL_KEY.split(":::")[1] if FULL_KEY and ":::" in FULL_KEY else FULL_KEY

def get_encrypted_token(raw_token):
    # Dynamically resolve pepper from environment
    pepper = os.getenv('API_KEY_PEPPER')
    if not pepper:
         raise EnvironmentError("API_KEY_PEPPER not set in environment")
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b'openalgo_static_salt', iterations=100000)
    key = base64.urlsafe_b64encode(kdf.derive(pepper.encode()))
    f = Fernet(key)
    return f.encrypt(raw_token.encode()).decode()

def finalize_shoonya_session(auth_code, user_id=None, api_secret=None, broker_api_key=None, target_name='AetherDesk'):
    """Performs handshake and injects session into OpenAlgo DB."""
    uid = user_id or os.getenv("SHOONYA_USER_ID")
    secret = api_secret or os.getenv("BROKER_API_SECRET")
    full_key = broker_api_key or os.getenv("BROKER_API_KEY")

    if not all([uid, secret, full_key]):
        return {"status": "error", "message": "Missing required Shoonya credentials in environment"}

    client_id = full_key.split(":::")[1] if full_key and ":::" in full_key else full_key

    # Use environment-aware DB path
    default_db = "/data/db/openalgo.db"
    db_path = os.getenv("OPENALGO_DB_PATH", default_db)

    # Check for local fallback if in workspace
    if not os.path.exists(db_path):
        # Try container path
        container_db = "/app/storage/openalgo.db"
        if os.path.exists(container_db):
            db_path = container_db
        else:
            # Try local workspace path
            workspace_db = "/home/ubuntu/trading-workspace/algo-trader/database/openalgo.db"
            if os.path.exists(os.path.dirname(workspace_db)):
                db_path = workspace_db

    print(f"--- FINALIZING AUTH FOR {uid} ---")
    print(f"Using database: {db_path}")

    # 1. Handshake
    print(f"Performing handshake with code {auth_code[:5]}...")
    url = "https://api.shoonya.com/NorenWClientAPI/GenAcsTok"
    checksum_input = f"{client_id}{secret}{auth_code}"
    # SHA256 is mandated by the Finvasia/Shoonya API contract for this authentication handshake.
    checksum = hashlib.sha256(checksum_input.encode()).hexdigest()  # codeql [py/weak-cryptographic-hash-on-sensitive-data] - Mandatory broker API contract requirement

    payload = {"code": auth_code, "checksum": checksum}
    payload_str = "jData=" + json.dumps(payload)
    headers = {"Content-Type": "text/plain"}

    try:
        resp = requests.post(url, data=payload_str, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return {"status": "error", "message": "Handshake request failed"}

    if data.get("stat") != "Ok" or "access_token" not in data:
        return {"status": "error", "message": "Handshake failed: Invalid response from broker"}

    access_token = data["access_token"]
    print("Success: Access token received.")

    # 2. Inject
    print(f"Injecting into database at {db_path}...")
    try:
        encrypted_token = get_encrypted_token(access_token)

        if not os.path.exists(db_path):
             return {"status": "error", "message": "Database not found"}

        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Update session for the target user in OpenAlgo's auth table
        # We use the target_name provided, which should match the api_keys.user_id
        if not target_name:
            target_name = 'kamaleswar'

        cur.execute("UPDATE auth SET auth=?, broker='shoonya', user_id=?, is_revoked=0 WHERE name=?",
                    (encrypted_token, uid, target_name))

        # If no row updated, it means the user doesn't exist in auth table yet
        if cur.rowcount == 0:
            cur.execute("INSERT INTO auth (name, auth, broker, user_id, is_revoked) VALUES (?, ?, 'shoonya', ?, 0)",
                        (target_name, encrypted_token, uid))

        conn.commit()
        conn.close()
        print("Database updated.")
        return {"status": "success", "message": "Auth finalized and session injected."}
    except Exception:
        return {"status": "error", "message": "Database injection failed"}

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python finalize_shoonya_auth.py <auth_code>")
        sys.exit(1)

    code = sys.argv[1]
    res = finalize_shoonya_session(code)
    print(res)
