# algo-trader/utils/auth.py
import os
import asyncio
import logging
import jwt
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ["JWT_SECRET"]  # MUST be set — no fallback allowed

def require_auth(f):
    """Decorator to require a valid Supabase JWT."""
    
    def _check_auth():
        # Allow OPTIONS requests for CORS
        if request.method == "OPTIONS":
            return True, None

        auth_header = request.headers.get("Authorization")
        internal_key = request.headers.get("X-Internal-Key")

        # Internal bypass for verification scripts
        if internal_key == JWT_SECRET:
            request.user = {"email": "internal@aetherdesk.dev", "role": "internal"}
            return True, None

        if not auth_header or not auth_header.startswith("Bearer "):
            return False, (jsonify({"error": "Missing or invalid Authorization header"}), 401)

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            request.user = payload
            return True, None
        except jwt.ExpiredSignatureError:
            return False, (jsonify({"error": "Token has expired"}), 401)
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token attempt: {e}")
            return False, (jsonify({"error": "Invalid token"}), 401)

    if asyncio.iscoroutinefunction(f):
        @wraps(f)
        async def decorated(*args, **kwargs):
            success, error_resp = _check_auth()
            if not success:
                if error_resp is None: # OPTIONS case
                     return await f(*args, **kwargs)
                return error_resp
            return await f(*args, **kwargs)
        return decorated
    else:
        @wraps(f)
        def decorated(*args, **kwargs):
            success, error_resp = _check_auth()
            if not success:
                if error_resp is None: # OPTIONS case
                     return f(*args, **kwargs)
                return error_resp
            return f(*args, **kwargs)
        return decorated
