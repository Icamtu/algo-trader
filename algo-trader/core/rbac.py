from enum import Enum
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class Role(str, Enum):
    ADMIN = "admin"
    TRADER = "trader"
    VIEWER = "viewer"

# Permission Matrix
# format: {Role: [Allowed Resources/Actions]}
PERMISSIONS: Dict[Role, List[str]] = {
    Role.ADMIN: ["*"], # Full access
    Role.TRADER: [
        "orders:read", "orders:write",
        "strategies:read", "strategies:toggle",
        "telemetry:read", "system:health",
        "brokers:read",
        "alerts:read", "alerts:write",
        "terminal:execute"
    ],
    Role.VIEWER: [
        "orders:read",
        "strategies:read",
        "telemetry:read", "system:health",
        "brokers:read",
        "alerts:read"
    ]
}

class RBACManager:
    """Manages role-based access control for the engine."""

    @staticmethod
    def has_permission(user_role: str, action: str) -> bool:
        """
        Checks if a role has permission to perform an action.
        Action format: 'resource:operation' (e.g., 'orders:write')
        """
        try:
            role = Role(user_role.lower())
        except ValueError:
            logger.warning(f"Unknown role attempt: {user_role}")
            return False

        allowed_actions = PERMISSIONS.get(role, [])

        if "*" in allowed_actions:
            return True

        return action in allowed_actions

def require_role(allowed_roles: List[Role]):
    """Decorator or Dependency placeholder for FastAPI integration."""
    # Logic will be implemented in middleware or as FastAPI dependencies
    pass
