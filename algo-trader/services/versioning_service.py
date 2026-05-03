import os
import subprocess
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class StrategyVersioningService:
    """
    Manages strategy code versioning using Git.
    Provides audit trails and rollback capabilities for trading algorithms.
    """

    def __init__(self, strategies_path: str = "strategies/"):
        self.strategies_path = strategies_path
        # Ensure we are in a git repo
        self._ensure_git()

    def _ensure_git(self):
        try:
            subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                           cwd=self.strategies_path, check=True, capture_output=True)
        except:
            logger.warning(f"Strategies path {self.strategies_path} is not in a git repository. Versioning will be limited.")

    def _run_git(self, args: List[str]) -> str:
        """
        Executes a git command with sanitization.
        """
        ALLOWED_COMMANDS = {"log", "add", "status", "commit", "rev-parse", "diff", "show"}
        
        if not args or args[0] not in ALLOWED_COMMANDS:
            raise Exception(f"Unauthorized Git command: {args[0] if args else 'None'}")
    def _run_git(self, cmd: str, args: List[str]) -> str:
        """
        Executes a git command with strict validation to prevent injection.
        """
        if cmd not in self.ALLOWED_COMMANDS:
            raise PermissionError(f"Git command '{cmd}' is not allowed.")

        # Flag validation: only allow simple flags, no --ext-diff, --upload-pack, etc.
        for arg in args:
            if arg.startswith("-") and not all(c in "abcdefghijklmnopqrstuvwxyz-" for c in arg[1:]):
                 raise PermissionError(f"Potentially unsafe git flag detected: {arg}")
            if ";" in arg or "&" in arg or "|" in arg or ">" in arg:
                 raise PermissionError(f"Unsafe character in git argument: {arg}")

        full_cmd = ["git", cmd] + args
        res = subprocess.run(full_cmd, cwd=self.strategies_path, capture_output=True, text=True)

        if res.returncode != 0:
            logger.error(f"Git Error ({cmd}): {res.stderr}")
            raise Exception(f"Git Error: {res.stderr}")
        return res.stdout

    def get_strategy_history(self, strategy_id: str) -> List[Dict[str, Any]]:
        """
        Returns the commit history for a specific strategy file.
        """
        # Security: Validate strategy_id to prevent command injection or path traversal
        if not all(c.isalnum() or c in "-_" for c in strategy_id):
            logger.error(f"Invalid strategy_id: {strategy_id}")
            return []

        filename = f"{strategy_id}.py"
        try:
            # git log --pretty=format:"%H|%an|%ad|%s" filename
            output = self._run_git("log", ["--pretty=format:%H|%an|%ai|%s", "--", filename])

            history = []
            if not output: return history

            for line in output.split("\n"):
                parts = line.split("|")
                if len(parts) >= 4:
                    history.append({
                        "hash": parts[0],
                        "author": parts[1],
                        "date": parts[2],
                        "message": parts[3]
                    })
            return history
        except Exception as e:
            logger.error(f"Failed to fetch history for {strategy_id}: {e}")
            return []

    def commit_strategy(self, strategy_id: str, message: str) -> Dict[str, Any]:
        """
        Stages and commits a strategy file change.
        """
        # Security: Validate strategy_id
        if not all(c.isalnum() or c in "-_" for c in strategy_id):
            return {"status": "error", "message": "Invalid strategy ID"}

        filename = f"{strategy_id}.py"
        try:
            self._run_git(["add", filename])
            # Check if there are changes to commit
            status = self._run_git(["status", "--short", filename])
            if not status:
                return {"status": "success", "message": "No changes to commit"}

            self._run_git(["commit", "-m", f"Strategy Update [{strategy_id}]: {message}"])

            # Get latest hash
            last_hash = self._run_git(["rev-parse", "HEAD"]).strip()

            return {
                "status": "success",
                "message": f"Strategy {strategy_id} versioned.",
                "hash": last_hash
            }
        except Exception as e:
            logger.error(f"Failed to commit strategy {strategy_id}: {e}")
            return {"status": "error", "message": str(e)}

    def get_strategy_diff(self, strategy_id: str, hash_a: str, hash_b: str = "HEAD") -> str:
        """
        Returns the diff between two versions of a strategy.
        """
        # Security: Validate strategy_id and hashes
        if not all(c.isalnum() or c in "-_" for c in strategy_id):
            return "Error: Invalid strategy ID"
        
        # Basic hash validation (alphanumeric)
        if not all(c.isalnum() for c in hash_a) or not all(c.isalnum() or c == "HEAD" for c in hash_b):
             return "Error: Invalid version hashes"

        filename = f"{strategy_id}.py"
        try:
            return self._run_git(["diff", hash_a, hash_b, "--", filename])
        except Exception as e:
            return f"Error fetching diff: {str(e)}"

# Singleton
versioning_service = StrategyVersioningService()
