import os
from pathlib import Path
from typing import List, Dict, Optional, Any

class FSService:
    """
    Institutional-grade File System Service for AetherDesk Prime.
    Handles secure directory traversal, file operations, and metadata.
    """

    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir).resolve()
        if not self.base_dir.exists():
            self.base_dir.mkdir(parents=True, exist_ok=True)

    def get_tree(self, relative_path: str = ".") -> List[Dict[str, Any]]:
        """
        Builds a recursive tree of the directory structure.
        """
        target_path = (self.base_dir / relative_path).resolve()

        # Security: Prevent directory traversal
        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        if os.path.commonpath([str(self.base_dir), str(target_path)]) != str(self.base_dir):
            raise PermissionError("Access denied: Outside sandbox")

        nodes = []
        try:
            for item in sorted(target_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if item.name.startswith('.') or item.name == '__pycache__':
                    continue

                node = {
                    "id": str(item.relative_to(self.base_dir)),
                    "name": item.name,
                    "type": "folder" if item.is_dir() else "file",
                    "path": str(item.relative_to(self.base_dir))
                }

                if item.is_dir():
                    # Optional: We can make this lazy-loading by not recursing here
                    # or keep it recursive for small strategy repos.
                    node["children"] = self.get_tree(str(item.relative_to(self.base_dir)))
                else:
                    node["size"] = item.stat().st_size
                    node["modified"] = item.stat().st_mtime
                    node["ext"] = item.suffix.lower()

                nodes.append(node)
        except Exception as e:
            # Handle permission errors or deleted files during scan
            pass

        return nodes

    def read_file(self, relative_path: str) -> str:
        """Reads file content safely."""
        target_path = (self.base_dir / relative_path).resolve()
        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        if os.path.commonpath([str(self.base_dir), str(target_path)]) != str(self.base_dir):
            raise PermissionError("Access denied")

        with open(target_path, 'r', encoding='utf-8') as f:
            return f.read()

    def write_file(self, relative_path: str, content: str):
        """Writes content to file safely."""
        target_path = (self.base_dir / relative_path).resolve()
        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        if os.path.commonpath([str(self.base_dir), str(target_path)]) != str(self.base_dir):
            raise PermissionError("Access denied")

        # Ensure parent directory exists
        target_path.parent.mkdir(parents=True, exist_ok=True)

        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def delete_item(self, relative_path: str):
        """Deletes a file or directory."""
        target_path = (self.base_dir / relative_path).resolve()
        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        if os.path.commonpath([str(self.base_dir), str(target_path)]) != str(self.base_dir):
            raise PermissionError("Access denied")

        if target_path.is_dir():
            import shutil
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
