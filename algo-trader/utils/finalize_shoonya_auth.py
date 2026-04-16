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
AUTH_CODE    = "555ced3a-b6d5-482b-b744-d7830c87d4ab"
USER_ID      = os.getenv("SHOONYA_USER_ID", "FA257063")
SECRET_KEY   = os.getenv("BROKER_API_SECRET", "15ZHfDJjxb77RBJIIcchEbf0G2ridCZJDN2KIiELA7rG5fPdoIAORNaHqe6hD29l")
FULL_KEY      = os.getenv("BROKER_API_KEY", "FA257063:::FA257063_U")
CLIENT_ID    = FULL_KEY.split(":::")[1] if ":::" in FULL_KEY else FULL_KEY
DB_PATH      = "openalgo/db/openalgo.db"

def get_encrypted_token(raw_token):
    # Dynamically resolve pepper from environment or use a safe default for development
    # In production, this MUST be set in the engine environment.
    pepper = os.getenv('API_KEY_PEPPER', 'a25d94718479b170c16278e321ea6c989358bf499a658fd20c90033cef8ce772')
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b'openalgo_static_salt', iterations=100000)
    key = base64.urlsafe_b64encode(kdf.derive(pepper.encode()))
    f = Fernet(key)
    return f.encrypt(raw_token.encode()).decode()

def finalize_shoonya_session(auth_code, user_id=None, api_secret=None, broker_api_key=None, target_name='AetherDesk'):
    """Performs handshake and injects session into OpenAlgo DB."""
    uid = user_id or os.getenv("SHOONYA_USER_ID", "FA257063")
    secret = api_secret or os.getenv("BROKER_API_SECRET", "15ZHfDJjxb77RBJIIcchEbf0G2ridCZJDN2KIiELA7rG5fPdoIAORNaHqe6hD29l")
    full_key = broker_api_key or os.getenv("BROKER_API_KEY", "FA257063:::FA257063_U")
    client_id = full_key.split(":::")[1] if ":::" in full_key else full_key

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
    checksum = hashlib.sha256(checksum_input.encode()).hexdigest()

    payload = {"code": auth_code, "checksum": checksum}
    payload_str = "jData=" + json.dumps(payload)
    headers = {"Content-Type": "text/plain"}

    try:
        resp = requests.post(url, data=payload_str, headers=headers, timeout=10)
        data = resp.json()
    except Exception as e:
        return {"status": "error", "message": f"Handshake request failed: {str(e)}"}

    if data.get("stat") != "Ok" or "access_token" not in data:
        return {"status": "error", "message": f"Handshake failed: {data.get('emsg', 'Unknown error')}"}

    access_token = data["access_token"]
    print("Success: Access token received.")

    # 2. Inject
    print(f"Injecting into database at {db_path}...")
    try:
        encrypted_token = get_encrypted_token(access_token)

        if not os.path.exists(db_path):
             return {"status": "error", "message": f"Database not found at {db_path}"}

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
    except Exception as e:
        return {"status": "error", "message": f"Database injection failed: {str(e)}"}

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python finalize_shoonya_auth.py <auth_code>")
        sys.exit(1)

    code = sys.argv[1]
    res = finalize_shoonya_session(code)
    print(res)
