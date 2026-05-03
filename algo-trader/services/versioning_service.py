import os
import subprocess
import logging
import re
import shlex
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

    def _validate_args(self, args: List[str]) -> bool:
        """Strict validation for command line arguments."""
        safe_pattern = re.compile(r'^[a-zA-Z0-9\._\-\/ @:=]+$')
        allowed_flags = {
            '-m', '-n', '--pretty', '--name-only', '--graph', 
            '--abbrev-commit', '--date', '-p', '-U0', 'HEAD',
            '--short', '--pretty=format:%H|%an|%ai|%s', '--'
        }

        for arg in args[1:]:
            if arg.startswith('-'):
                if arg not in allowed_flags:
                    # Special case for --pretty=format: with dynamic content if needed
                    # but here we use a hardcoded one, so we check equality.
                    return False
            
            # Prevent command injection through shell metacharacters in any argument
            if any(c in arg for c in ";|&><$`\\"):
                return False

        return True

    def _run_git(self, args: List[str]) -> str:
        """
        Executes a git command with strict validation to prevent injection.
        """
        if not self._validate_args(args):
            logger.error(f"Unsafe git arguments blocked: {args}")
            raise PermissionError("Security Violation: Unsafe command execution attempt.")

        # Ensure we always use the base 'git' command and it's not overridden
        full_cmd = ["/usr/bin/git"] + args
        try:
            # We use check=True and capture_output=True
            # No shell=True, preventing shell injection
            res = subprocess.run(
                full_cmd, 
                cwd=self.strategies_path, 
                capture_output=True, 
                text=True, 
                check=True,
                env={"GIT_CONFIG_NOSYSTEM": "1", "HOME": "/tmp"} # Sandbox git environment
            )
            return res.stdout
        except subprocess.CalledProcessError as e:
            # Mask internal details from the user but log them for diagnostics
            logger.error(f"Git execution failed (code {e.returncode}). Stderr: {e.stderr}")
            raise Exception("Internal version control system error")
        except Exception as e:
            logger.error(f"Unexpected execution error: {e}")
            raise Exception("Operation failed due to an internal system error")

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
            output = self._run_git(["log", "--pretty=format:%H|%an|%ai|%s", "--", filename])

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

            clean_message = shlex.quote(f"Strategy Update [{strategy_id}]: {message}")
            self._run_git(["commit", "-m", clean_message.strip("'")])

            # Get latest hash
            last_hash = self._run_git(["rev-parse", "HEAD"]).strip()

            return {
                "status": "success",
                "message": f"Strategy {strategy_id} versioned.",
                "hash": last_hash
            }
        except Exception as e:
            logger.error(f"Failed to commit strategy {strategy_id}: {e}")
            return {"status": "error", "message": "Internal service error"}

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
            return "Error fetching diff: Internal service error"

# Singleton
versioning_service = StrategyVersioningService()
