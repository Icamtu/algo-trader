import os
import logging
import jwt
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from core.rbac import RBACManager

logger = logging.getLogger(__name__)
JWT_SECRET = os.environ.get("JWT_SECRET", "")

def _extract_role_from_request(request: Request) -> str:
    """Extract role from JWT Bearer token claim. Falls back to 'viewer'."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return "viewer"
    token = auth_header.removeprefix("Bearer ").strip()
    if not token or not JWT_SECRET:
        return "viewer"
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"],
                             options={"verify_aud": False, "leeway": 60})
        return payload.get("role", "viewer").lower()
    except Exception:
        return "viewer"

class RBACMiddleware(BaseHTTPMiddleware):
    """FastAPI Middleware for Role-Based Access Control via JWT claims."""
    async def dispatch(self, request: Request, call_next):
        user_role = _extract_role_from_request(request)

        path = request.url.path
        method = request.method

        # Mapping paths to permissions
        action = None
        if path.startswith("/api/v1/action-center") or path.startswith("/api/v1/orders"):
            action = "orders:write" if method in ["POST", "PUT", "DELETE"] else "orders:read"
        elif path.startswith("/api/v1/strategies"):
            action = "strategies:toggle" if method in ["POST", "PATCH"] else "strategies:read"
        elif path.startswith("/api/v1/telemetry"):
            action = "telemetry:read"
        elif path.startswith("/api/v1/brokers"):
            action = "brokers:write" if method in ("POST", "PUT", "PATCH", "DELETE") else "brokers:read"
        elif path.startswith("/api/v1/alerts"):
            action = "alerts:write" if method in ("POST", "PUT", "PATCH", "DELETE") else "alerts:read"
        elif path.startswith("/api/v1/webhooks"):
            action = "webhooks:trigger"
        elif path.startswith("/api/v1/terminal"):
            action = "terminal:execute"
        elif path.startswith("/health") or path.startswith("/api/v1/system"):
            action = "system:health"

        if action and not RBACManager.has_permission(user_role, action):
            logger.warning(f"RBAC DENY: Role={user_role} Action={action} Path={path}")
            raise HTTPException(status_code=403, detail="INSUFFICIENT_PERMISSIONS")

        response = await call_next(request)
        return response
