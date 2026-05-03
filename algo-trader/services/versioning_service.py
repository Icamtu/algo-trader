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

    def _run_git(self, cmd: str, args: List[str]) -> str:
        """
        Executes a git command with strict validation to prevent injection.
        Uses a mapping to ensure the command itself is never tainted.
        """
        COMMAND_MAP = {
            "log": "log",
            "add": "add",
            "status": "status",
            "commit": "commit",
            "rev-parse": "rev-parse",
            "diff": "diff",
            "show": "show"
        }
        
        if cmd not in COMMAND_MAP:
            logger.error(f"Unauthorized Git command attempted: {cmd}")
            raise PermissionError(f"Git command '{cmd}' is not allowed.")

        safe_cmd = COMMAND_MAP[cmd]

        # Flag and argument validation
        for arg in args:
            # Prevent shell injection characters
            if any(c in arg for c in ";;|&><`$()"):
                 logger.error(f"Unsafe character in git argument: {arg}")
                 raise PermissionError(f"Unsafe character in git argument: {arg}")
            
            # Prevent dangerous git flags
            if arg.startswith("-"):
                # Only allow specific safe patterns for flags
                if not all(c.isalnum() or c in "-=_:" for c in arg[1:]):
                     logger.warning(f"Potentially unsafe git flag rejected: {arg}")
                     raise PermissionError(f"Potentially unsafe git flag detected: {arg}")

        full_cmd = ["git", safe_cmd] + args
        try:
            # Use check=True for automatic error handling
            # Use shell=False (default) to prevent shell-based injection
            res = subprocess.run(full_cmd, cwd=self.strategies_path, capture_output=True, text=True, check=True)
            return res.stdout
        except subprocess.CalledProcessError as e:
            logger.error(f"Git Error ({safe_cmd}): {e.stderr}")
            raise Exception(f"Git Error: {e.stderr}")
        except Exception as e:
            logger.error(f"Execution Error ({safe_cmd}): {e}")
            raise

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
            self._run_git("add", [filename])
            # Check if there are changes to commit
            status = self._run_git("status", ["--short", filename])
            if not status:
                return {"status": "success", "message": "No changes to commit"}

            self._run_git("commit", ["-m", f"Strategy Update [{strategy_id}]: {message}"])

            # Get latest hash
            last_hash = self._run_git("rev-parse", ["HEAD"]).strip()

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
            return self._run_git("diff", [hash_a, hash_b, "--", filename])
        except Exception as e:
            return f"Error fetching diff: {str(e)}"

# Singleton
versioning_service = StrategyVersioningService()
