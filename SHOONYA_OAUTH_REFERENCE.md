# Shoonya OAuth (GenAcsTok) Technical Reference

This document serves as the official reference for the algorithmic trading platform's integration with the Shoonya (Finvasia) broker, following the April 2026 OAuth migration.

## 1. Authentication Architecture
The authentication follows the `GenAcsTok` flow, replacing the legacy `QuickAuth`. It involves a two-stage handshake:

1.  **Authorize**: User logs in via a specific Shoonya URL to generate an `auth_code`.
2.  **Exchange**: The system exchanges the `auth_code` for a permanent `access_token` using a SHA-256 checksum.

### Handshake Formula
The checksum used for the token exchange is:
```python
checksum = sha256(client_id + secret_key + auth_code)
```

## 2. Prerequisites
The following must be active for the authentication to succeed:
- **IP Whitelisting**: The host IP (`80.225.231.3`) must be whitelisted in the Shoonya Developer Portal.
- **Account Status**: The account must not be "Blocked" (which occurs after 3 unsuccessful login attempts). Unblocking requires manual PAN/DOB entry.
- **Environment Variables**:
  - `SHOONYA_USER_ID`: Finvasia Client ID.
  - `BROKER_API_KEY`: Format `userid:::vendor_code` (e.g., `FA257063:::FA257063_U`).
  - `BROKER_API_SECRET`: The 64-character API secret.
  - `SHOONYA_TOTP_SECRET`: 32-character base32 secret.

## 3. Automation Scripts
The following files are used to automate and stabilize the connection:

### [get_shoonya_token.py](file:///home/ubuntu/trading-workspace/algo-trader/utils/get_shoonya_token.py)
**Purpose**: Automated authorization code capture via Selenium.
- **Logic**: Uses Chrome `performance` logs to monitor network events for the `code=` redirect.
- **Robustness**: Uses positional input selection (`visible_inputs[0]`) to handle potential UI changes in the Shoonya login portal.
- **Note**: This script is tailored for the containerized environment but can be bypassed using an external browser agent (like Antigravity Browser Subagent) if local Chromium crashes on ARM64.

### [finalize_shoonya_auth.py](file:///home/ubuntu/trading-workspace/scratch/finalize_shoonya_auth.py)
**Purpose**: Token exchange and Database injection.
- **Process**:
  1. Takes the captured `auth_code`.
  2. Computes the SHA-256 checksum.
  3. POSTs to `https://api.shoonya.com/NorenWClientAPI/GenAcsTok`.
  4. Encrypts the resulting `access_token` using OpenAlgo's PBKDF2 + Fernet logic.
  5. Updates the `auth` table in `openalgo/db/openalgo.db`.

## 4. Maintenance & Refresh Flow
Whenever the session expires (typically daily or on broker logout):
1.  Generate a fresh **TOTP**.
2.  Navigate to the **Auth URL** (found in `get_shoonya_token.py`).
3.  Perform the login to get a new `auth_code`.
4.  Run `finalize_shoonya_auth.py` with the new code to update the platform.

## 5. Summary of Process Followed
1.  **Forensic Audit**: Identified that `QuickAuth` was returning `Invalid Vendor Code` due to Shoonya's migration to OAuth.
2.  **Official Alignment**: Researched the `Shoonya_oAuthAPI-py` repository and "Change in Retail API Access" tutorial.
3.  **Dependency Fix**: Installed `chromium-driver`, `selenium`, and `pyotp` in the `openalgo-web` container.
4.  **Credential Sync**: Verified password and TOTP secrets in `.env`.
5.  **Environment Stability**: Handled ARM64 browser "tab crashes" by migrating final capture logic to high-stability performance log scanning.
6.  **Verification**: Confirmed successful handshake with `stat: Ok` and user profile retrieval for `KAMALESWAR MOHANTA`.

---
**Warning: Do not change the fingerprinting or checksum logic in these files, as it will break the secure handshake with Shoonya servers.**
