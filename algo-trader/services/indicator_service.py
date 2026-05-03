import os
import subprocess
import json
import sys
import tempfile
import io
import importlib.util
import ast
import pandas as pd
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class IndicatorService:
    """
    Manages custom technical indicators.
    Allows dynamic loading and execution of Python-based indicator logic.
    """

    ALLOWED_IMPORTS = {"pandas", "numpy", "ta", "math", "statistics"}

    BLOCKED_IMPORTS = {
        "os", "subprocess", "sys", "socket", "requests", "httpx",
        "importlib", "ctypes", "builtins", "__import__",
    }

    # Runner script: reads payload JSON from stdin, executes indicator, prints result JSON.
    # No user data is interpolated into source — all IPC is through stdin/stdout.
    _RUNNER_SCRIPT = """\
import json, sys, io
import pandas as pd
import importlib.util

payload = json.loads(sys.stdin.read())
df = pd.read_json(io.StringIO(payload["df"]), orient="split")
params = payload["params"]
file_path = payload["file_path"]

spec = importlib.util.spec_from_file_location("indicator", file_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

result = mod.calculate(df, **params)
print(result.to_json())
"""

    def __init__(self, indicators_dir: str = "indicators"):
        self.indicators_dir = indicators_dir
        os.makedirs(self.indicators_dir, exist_ok=True)
        # Ensure __init__.py exists for imports
        with open(os.path.join(self.indicators_dir, "__init__.py"), "a") as f:
            pass

    def _get_safe_path(self, name: str) -> str:
        """
        Normalizes and validates the path to prevent traversal attacks.
        """
        # 1. Sanitize the name: strictly take only the basename and validate regex
        clean_name = os.path.basename(name)
        if not clean_name or clean_name.startswith('.'):
             raise PermissionError("Access denied: Invalid indicator name.")
             
        # Regex validation for name: alphanumeric, underscores, dashes, and .py extension
        if not re.match(r"^[a-z0-9_-]+(?:\.py)?$", clean_name.lower()):
            raise PermissionError("Access denied: Indicator name contains illegal characters.")

        safe_name = clean_name.lower()
        if not safe_name.endswith(".py"):
            safe_name += ".py"
        
        # 2. Join with the indicators directory and get canonical paths
        base_dir = os.path.realpath(self.indicators_dir)
        target_path = os.path.join(base_dir, safe_name)
        target_real = os.path.realpath(target_path)
        
        # 3. Final containment check: target_real must be inside base_dir
        # codeql [py/path-injection] - Containment is verified using os.path.commonpath and realpath
        if os.path.commonpath([base_dir, target_real]) != base_dir:
            raise PermissionError("Access denied: Path traversal detected.")
            
        return target_real

    def save_indicator(self, name: str, code: str) -> str:
        """Saves a new custom indicator code to disk."""
        file_path = self._get_safe_path(name)

        # Security: validate imports before saving
        self._validate_imports(code)

        with open(file_path, "w") as f:
            f.write(code)

        logger.info("Custom indicator %s saved to %s", name, file_path)
        return file_path

    def get_indicators(self) -> List[str]:
        """Lists all available custom indicators."""
        files = [f[:-3] for f in os.listdir(self.indicators_dir) if f.endswith(".py") and f != "__init__.py"]
        return files

    def _validate_imports(self, source: str) -> None:
        """
        Rejects indicators that import blocked modules.

        Parses the AST and walks all Import / ImportFrom nodes.
        Note: this is a belt-and-suspenders check; subprocess isolation is the
        primary security boundary.
        """
        try:
            tree = ast.parse(source)
        except SyntaxError as e:
            raise ValueError(f"Indicator has syntax error: {e}")

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module.split(".")[0]] if node.module else []
            else:
                continue

            for mod_name in names:
                if mod_name in self.BLOCKED_IMPORTS:
                    raise PermissionError(
                        f"Indicator imports blocked module: '{mod_name}'"
                    )

    def calculate(self, name: str, df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
        """
        Executes indicator via isolated subprocess with 5s timeout.

        Data is passed to the subprocess via stdin as JSON — no user data is
        interpolated into Python source, preventing code-injection through
        DataFrame contents or parameter values.
        """
        file_path = self._get_safe_path(name)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Indicator {name} not found at {file_path}")

        # Validate imports before execution (AST-level check)
        with open(file_path) as f:
            source = f.read()
        self._validate_imports(source)

        # Serialize DataFrame and params for IPC via stdin
        payload = json.dumps({
            "df": df.to_json(orient="split"),
            "params": params,
            "file_path": file_path,
        })

        # Write runner to a temp file (avoids shell=True and -c length limits)
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".py", delete=False
            ) as tmp:
                tmp.write(self._RUNNER_SCRIPT)
                tmp_path = tmp.name

            proc = subprocess.run(
                [sys.executable, tmp_path],
                input=payload,
                capture_output=True,
                text=True,
                timeout=5,
            )

            if proc.returncode != 0:
                raise RuntimeError(
                    f"Indicator execution failed: {proc.stderr[:500]}"
                )

            return pd.read_json(io.StringIO(proc.stdout), typ="series")

        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Indicator '{name}' timed out after 5 seconds")
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

# Singleton
indicator_service = IndicatorService()
