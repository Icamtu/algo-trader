# Shoonya Broker Authentication Configuration

## Overview
This document details the Shoonya (Finvasia) broker authentication setup in the trading-workspace, including how OpenAlgo integrates with Shoonya for live trading.

---

## 1. Files Defining Shoonya Authentication

### Primary Authentication File
- **File**: [auth_api_fixed.py](auth_api_fixed.py)
  - **Location**: Root workspace directory
  - **Purpose**: Contains the Shoonya authentication logic
  - **Mounted in OpenAlgo**: Via docker-compose.yml as `/app/broker/shoonya/api/auth_api.py`

### Configuration File
- **File**: [.env](.env#L53-L60)
  - **Section**: Section 5 - BROKER CONFIGURATION (Shoonya)
  - **Contains**: API credentials and broker settings

---

## 2. Shoonya Authentication Payload Structure

### Endpoint
```
POST https://api.shoonya.com/NorenWClient/QuickAuth
```

### Login Payload Fields

The authentication is performed through the `authenticate_broker()` function in [auth_api_fixed.py](auth_api_fixed.py#L14-L70). The payload includes:

```python
payload = {
    "apkkey": vendor_code,                              # API KEY - ADDED MISSING FIELD
    "uid": userid,                                      # User ID
    "pwd": sha256_hash(password),                       # SHA256 hashed password
    "factor2": totp_code,                               # PAN or TOTP or DOB (second factor)
    "apkversion": "1.1.3",                              # RECENT STABLE VERSION
    "appkey": sha256_hash(f"{userid}{vendor_code}"),   # SYNCED SECURITY ID
    "imei": imei,                                       # USER SPECIFIED DEVICE ID
    "vc": vendor_code,                                  # Vendor code
    "source": "API",                                    # Source of login request
}
```

### Payload Formatting

The payload is sent as:
```
POST content: jData={json.dumps(payload)}
Content-Type: application/x-www-form-urlencoded
```

---

## 3. Configuration Variables for Shoonya

### Environment Variables (from [.env](.env#L53-L60))

```env
# 5. BROKER CONFIGURATION (Shoonya)
VALID_BROKERS=shoonya
BROKER_API_KEY='FA257063_U'                              # Vendor/API key
BROKER_API_SECRET='15ZHfDJjxb77RBJIIcchEbf0G2ridCZJDN2KIiELA7rG5fPdoIAORNaHqe6hD29l'
BROKER_IMEI='abc1234'                                   # Device identifier
VENDOR_CODE='FA257063_U'                                # Same as BROKER_API_KEY
REDIRECT_URL='https://hermine-subglobular-inappreciatively.ngrok-free.dev/shoonya/callback'
```

### Variable Usage in Code

From [auth_api_fixed.py](auth_api_fixed.py#L19-L24):
```python
api_secretkey = os.getenv("BROKER_API_SECRET")       # Currently unused
vendor_code = os.getenv("BROKER_API_KEY")            # Used as apkkey & vc
imei = os.getenv("BROKER_IMEI", "abc1234")           # Device ID
```

---

## 4. Authentication Response

### Success Response
```python
if data["stat"] == "Ok":
    return data["susertoken"], None  # Returns authentication token
```

### Key Response Field
- `susertoken`: The authentication token to be used for subsequent API calls

### Error Handling
```python
else:
    return None, data.get("emsg", "Authentication failed. Please try again.")
```

---

## 5. OpenAlgo Integration

### Docker Mount Configuration
From [docker-compose.yml](docker-compose.yml#L101):
```yaml
volumes:
  - ./auth_api_fixed.py:/app/broker/shoonya/api/auth_api.py:ro
```

This mounts the local auth_api_fixed.py file as read-only into the OpenAlgo container's Shoonya broker plugin.

### OpenAlgo Service
```yaml
openalgo:
  image: icamtu/openalgo-arm64:latest
  container_name: openalgo-web
  ports:
    - "5000:5000"
    - "8765:8765"
  env_file: .env
```

---

## 6. Authentication Flow

```
1. User provides credentials (userid, password, 2FA code)
   ↓
2. authenticate_broker() in auth_api_fixed.py is called
   ↓
3. Password is SHA256 hashed
   ↓
4. Payload is constructed with all required fields
   ↓
5. POST request sent to https://api.shoonya.com/NorenWClient/QuickAuth
   ↓
6. Response contains susertoken on success
   ↓
7. Token is returned for use in subsequent API calls
```

---

## 7. HTTP Headers

From [auth_api_fixed.py](auth_api_fixed.py#L48-L53):

```python
headers = {
    "Content-Type": "application/x-www-form-urlencoded", 
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
```

**Note**: User-Agent is set to mimic browser requests for compatibility.

---

## 8. Important Notes

### access_type Field
⚠️ **CRITICAL**: The current implementation does NOT include an `access_type` field in the Shoonya authentication payload. 

**Possible values for access_type** (based on Shoonya/Finvasia standards):
- `M` - Master account (full access)
- `I` - Investor (limited access)
- `H` - HNI (High Net worth Individual)

If your Shoonya broker has restricted access levels or requires specific `access_type` specification, you may need to:
1. Add `access_type` parameter to the payload
2. Verify with your broker what access level is configured for your credentials

### Current Implementation State
- The auth_api_fixed.py is a custom implementation designed for this specific setup
- It's mounted directly into OpenAlgo's broker plugin directory
- Password is hashed with SHA256 (industry standard)
- IMEI/device identification is configurable

---

## 9. Broker Selection and Valid Brokers

From [.env](.env#L55):
```env
VALID_BROKERS=shoonya
```

From [trading-ui/src/routes/apply/+page.svelte](trading-ui/src/routes/apply/+page.svelte#L8):
```typescript
{ id: 'shoonya', name: 'Shoonya', logo: 'SH' }
```

---

## Related Files

- [docker-compose.yml](docker-compose.yml) - Container orchestration
- [algo-trader/execution/openalgo_client.py](algo-trader/execution/openalgo_client.py) - OpenAlgo API client
- [algo-trader/core/config.py](algo-trader/core/config.py) - Configuration management
