import os
import re
from pathlib import Path

def get_env_path():
    """Returns the absolute path to the .env file."""
    # Try looking in the workspace root first
    dotenv_path = Path("/home/ubuntu/trading-workspace/.env")
    if not dotenv_path.exists():
        # Fallback to current directory (in container)
        dotenv_path = Path(".env")
    return str(dotenv_path.absolute())

def read_env_file():
    """Reads the current .env file content."""
    path = get_env_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read(), None
    except Exception as e:
        return "", str(e)

def update_env_value(content, key, value):
    """Updates a specific key in the .env string or appends if missing."""
    pattern = re.compile(rf"^{key}=.*$", re.MULTILINE)
    new_line = f"{key}={value}"

    if pattern.search(content):
        return pattern.sub(new_line, content)
    else:
        # Append to end
        if content and not content.endswith("\n"):
            content += "\n"
        return content + new_line + "\n"

def get_env_value(key, default=None):
    """Fetches a value from the existing .env file string."""
    content, _ = read_env_file()
    pattern = re.compile(rf"^{key}=(.*)$", re.MULTILINE)
    match = pattern.search(content)
    if match:
        return match.group(1).strip()
    return default

def get_broker_from_redirect_url(url):
    """Heuristic to determine broker name from redirect URL."""
    if not url: return "shoonya"
    url = url.lower()
    if "shoonya" in url: return "shoonya"
    if "fyers" in url: return "fyers"
    if "angel" in url: return "angelone"
    return "shoonya"
