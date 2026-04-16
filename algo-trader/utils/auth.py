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
    @wraps(f)
    async def decorated(*args, **kwargs):
        # Allow OPTIONS requests for CORS
        if request.method == "OPTIONS":
            if asyncio.iscoroutinefunction(f):
                return await f(*args, **kwargs)
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization")
        internal_key = request.headers.get("X-Internal-Key")

        # Internal bypass for verification scripts
        if internal_key == JWT_SECRET:
            request.user = {"email": "internal@aetherdesk.dev", "role": "internal"}
            if asyncio.iscoroutinefunction(f):
                return await f(*args, **kwargs)
            return f(*args, **kwargs)

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ")[1]
        try:
            # Note: We decode with HS256 as used by Supabase local
            # Using verify=True (default) to check signature and exp
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False} # Local Supabase tokens often have varying aud
            )
            request.user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token attempt: {e}")
            return jsonify({"error": "Invalid token"}), 401

        if asyncio.iscoroutinefunction(f):
            return await f(*args, **kwargs)
        return f(*args, **kwargs)
    return decorated
