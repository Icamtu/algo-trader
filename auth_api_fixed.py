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


def authenticate_broker(userid, password, totp_code):
    """
    Authenticate with Shoonya and return the auth token.
    """
    # Get the Shoonya API key and other credentials from environment variables
    api_secretkey = os.getenv("BROKER_API_SECRET")
    vendor_code = os.getenv("BROKER_API_KEY")
    # Read the custom IMEI from .env if it exists
    imei = os.getenv("BROKER_IMEI", "abc1234")

    try:
        # Use the stable QuickAuth endpoint; the TP variant is currently
        # returning a raw 502 even for empty test posts.
        url = "https://api.shoonya.com/NorenWClient/QuickAuth"

        # Prepare login payload
        payload = {
            "uid": userid,  # User ID
            "pwd": sha256_hash(password),  # SHA256 hashed password
            "factor2": totp_code,  # PAN/TOTP/DOB (second factor)
            "apkversion": "1.0.0",  # Stable per Shoonya spec
            # Shoonya expects SHA256 of "userid|API_KEY" (API key comes from Prism portal)
            "appkey": sha256_hash(f"{userid}|{api_secretkey}"),
            "imei": imei,  # IMEI or MAC address
            "vc": vendor_code,  # Vendor code
            "source": "API",  # Source of login request
        }

        # Set headers for the API request
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        # BUILDING DATA BODY
        # We must use compact JSON (no spaces) as required by many trading APIs.
        # Use a raw string with 'jData=' prefix to prevent double URL-encoding by the HTTP client.
        json_payload = json.dumps(payload, separators=(',', ':'))
        payload_str = f"jData={json_payload}"

        # Get the shared httpx client and send the POST request
        client = get_httpx_client()
        # Pass payload_str directly as 'data' (non-dict) to prevent httpx from encoding braces
        # We manually set headers to ensure Shoonya recognizes the format
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        response = client.post(url, data=payload_str, headers=headers, timeout=10.0)

        # Handle the response
        if response.status_code == 200:
            data = response.json()
            if data.get("stat") == "Ok":
                logger.info(f"Shoonya auth successful for user {userid}")
                return data.get("susertoken"), None
            
            # Log server-side error details for debugging
            emsg = data.get("emsg", "Unknown Error")
            logger.error(f"Shoonya auth failed: stat={data.get('stat')} emsg={emsg} resp={data}")
            
            # Special handling for whitelisting errors to alert the user
            if "not whitelisted" in emsg.lower() or "not_ok" in data.get("stat", "").lower():
                return None, f"Shoonya Error: {emsg}. Please ensure your IP 80.225.231.3 is whitelisted."
            
            return None, f"Shoonya Error: {emsg}"

        logger.error(f"Shoonya auth HTTP error {response.status_code}: {response.text}")
        return None, f"Shoonya HTTP Error {response.status_code}: {response.text}"

    except Exception as e:
        return None, str(e)
