import hashlib
import json
import os
import httpx

from utils.httpx_client import get_httpx_client
from utils.logging import get_logger

logger = get_logger(__name__)

def sha256_hash(text):
    """Generate SHA256 hash."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def authenticate_broker(*args):
    """
    Polymorphic authentication function for Shoonya.
    
    Signatures:
    1. authenticate_broker(code) -> OAuth flow
    2. authenticate_broker(userid, password, totp) -> Manual/Programmatic flow
    """
    if len(args) == 1:
        return _authenticate_oauth(args[0])
    elif len(args) == 3:
        return _authenticate_manual(args[0], args[1], args[2])
    else:
        return None, f"Invalid number of arguments for Shoonya auth: {len(args)}"

def _authenticate_oauth(code):
    """Exchanges authorization code for a session token."""
    try:
        full_api_key = os.getenv("BROKER_API_KEY")
        if not full_api_key or ":::" not in full_api_key:
            return None, "BROKER_API_KEY must be in format userid:::client_id"
        
        parts = full_api_key.split(":::", 1)
        client_id = parts[1]
        secret_key = os.getenv("BROKER_API_SECRET")
        
        if not secret_key:
            return None, "BROKER_API_SECRET is required"

        url = "https://api.shoonya.com/NorenWClientAPI/GenAcsTok"

        checksum_input = f"{client_id}{secret_key}{code}"
        checksum = hashlib.sha256(checksum_input.encode()).hexdigest()

        payload = {
            "code": code,
            "checksum": checksum,
            "uid": parts[0] # The userid part of BROKER_API_KEY
        }

        payload_str = "jData=" + json.dumps(payload, separators=(',', ':'))
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        }

        logger.info(f"Shoonya GenAcsTok request to {url}")
        client = get_httpx_client()
        response = client.post(url, data=payload_str, headers=headers, timeout=15.0)

        if response.status_code == 200:
            data = response.json()
            if data.get("stat") == "Ok" and "susertoken" in data:
                return data["susertoken"], None
            return None, data.get("emsg", "OAuth failed")
        return None, f"HTTP Error {response.status_code}"

    except Exception as e:
        logger.exception(f"Shoonya OAuth exception: {e}")
        return None, str(e)

def _authenticate_manual(userid, password, totp_code):
    """Performs programmatic login using userid, password, and TOTP."""
    try:
        userid = userid.strip() if userid else ""
        password = password.strip() if password else ""
        totp_code = totp_code.strip() if totp_code else ""
        
        api_secretkey = os.getenv("BROKER_API_SECRET", "").strip()
        full_api_key = os.getenv("BROKER_API_KEY", "").strip()
        # Per SHOONYA_AUTH_CONFIGURATION.md: vendor_code is the part after ::: or the full key if no :::
        vendor_code = full_api_key.split(":::")[-1] if ":::" in full_api_key else full_api_key
        imei = os.getenv("BROKER_IMEI", "abc1234").strip()

        # Shoonya Retail API endpoint (Corrected as per Configuration MD)
        url = "https://api.shoonya.com/NorenWClient/QuickAuth"
        
        # appkey hash is SHA256 of (userid + vendor_code)
        appkey_input = f"{userid}{vendor_code}"
        appkey_hash = sha256_hash(appkey_input)

        payload = {
            "apkkey": vendor_code,         # Added as per MD
            "uid": userid,
            "pwd": sha256_hash(password),
            "factor2": totp_code,
            "apkversion": "1.1.3",
            "appkey": appkey_hash,
            "imei": imei,
            "vc": vendor_code,
            "source": "API",
        }
        
        payload_data = json.dumps(payload, separators=(',', ':'))
        payload_str = f"jData={payload_data}"
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        logger.info(f"Shoonya Manual Login attempt (Synced with MD) for User: {userid}")
        
        client = get_httpx_client()
        response = client.post(url, content=payload_str, headers=headers, timeout=15.0)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("stat") == "Ok":
                return data.get("susertoken"), None
            logger.error(f"Shoonya Login Rejected: {data}")
            return None, data.get("emsg", "Manual login failed")
        
        logger.error(f"Shoonya HTTP {response.status_code}: {response.text}")
        return None, f"HTTP Error {response.status_code}: {response.text[:100]}"
    except Exception as e:
        logger.exception(f"Shoonya manual login exception: {e}")
        return None, str(e)
