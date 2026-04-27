import os
import jwt
import asyncio
import logging
import inspect
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

# Security configuration
JWT_SECRET = os.environ.get("JWT_SECRET")

def require_auth(f):
    """
    Unified decorator that handles BOTH synchronous and asynchronous Flask routes.
    Automatically detects if the decorated function is a coroutine and returns the appropriate wrapper.
    """

    def _check_auth():
        """Internal helper to validate token and return payload or error response."""
        # Allow OPTIONS requests for CORS
        if request.method == "OPTIONS":
            return True, None

        auth_header = request.headers.get("Authorization")
        api_key_header = request.headers.get("apikey")
        internal_key = request.headers.get("X-Internal-Key")
        heartbeat_key = request.headers.get("X-Heartbeat-Token")

        # 1. Internal Key Bypass (System services or trusted triggers)
        if (internal_key == JWT_SECRET or
            api_key_header == os.environ.get("OPENALGO_API_KEY") or
            heartbeat_key == JWT_SECRET):
            return True, {"email": "internal@aetherdesk.dev", "role": "internal", "iat": 0}

        # 2. JWT Validation (Standard Frontend Auth)
        if not auth_header or not auth_header.startswith("Bearer "):
            # Special bypass for test environment if tokens aren't available
            if auth_header == "Bearer test-token" or os.environ.get("DEBUG_AUTH") == "true":
                logger.info("Auth: Using test-token bypass")
                return True, {"email": "guest@aetherdesk.dev", "role": "guest", "iat": 0}
            return False, (jsonify({"status": "error", "message": "Missing Authorization Token"}), 401)

        token = auth_header.replace("Bearer ", "")
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return True, payload
        except jwt.ExpiredSignatureError:
            logger.warning("Auth: Token has expired")
            return False, (jsonify({"status": "error", "message": "Token has expired"}), 401)
        except jwt.InvalidTokenError as e:
            logger.warning(f"Auth Failure for Token [{token[:10]}...]: {e}")
            # If in debug mode, allow through with guest perms even on failure (caution!)
            if os.environ.get("DEBUG_AUTH") == "true":
                return True, {"email": "debug-guest@aetherdesk.dev", "role": "guest", "iat": 0}
            return False, (jsonify({"status": "error", "message": f"Auth Failure: {str(e)}"}), 401)

    @wraps(f)
    async def async_wrapper(*args, **kwargs):
        success, result = _check_auth()
        if not success:
            return result
        request.user = result
        return await f(*args, **kwargs)

    @wraps(f)
    def sync_wrapper(*args, **kwargs):
        success, result = _check_auth()
        if not success:
            return result
        request.user = result

        # If f is async but we are in a sync wrapper (should not happen with inspect logic),
        # we run it using a new event loop.
        if inspect.iscoroutinefunction(f):
            return asyncio.run(f(*args, **kwargs))

        return f(*args, **kwargs)

    # Route logic based on function type
    if inspect.iscoroutinefunction(f):
        return async_wrapper
    return sync_wrapper
