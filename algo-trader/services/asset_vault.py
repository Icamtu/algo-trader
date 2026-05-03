import os
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# TimescaleDB connection params
TS_DB_HOST = os.getenv("TS_DB_HOST", "timescaledb")
TS_DB_NAME = os.getenv("TS_DB_NAME", "postgres")
TS_DB_USER = os.getenv("TS_DB_USER", "postgres")
TS_DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
TS_DB_PORT = os.getenv("TS_DB_PORT", "5432")

# Vault storage path
VAULT_STORAGE_PATH = os.getenv("VAULT_STORAGE_PATH", "/app/storage/vault")

class AssetVault:
    """
    Central repository for strategies, datasets, results, and models.
    Supports tagging, filtering, and versioning via TimescaleDB/Postgres.
    """

    def __init__(self):
        self.conn_params = {
            "host": TS_DB_HOST,
            "database": TS_DB_NAME,
            "user": TS_DB_USER,
            "password": TS_DB_PASS,
            "port": TS_DB_PORT
        }
        os.makedirs(VAULT_STORAGE_PATH, exist_ok=True)
        # Type directories
        for t in ["strategy", "dataset", "result", "model"]:
            os.makedirs(os.path.join(VAULT_STORAGE_PATH, t), exist_ok=True)

    def _get_connection(self):
        return psycopg2.connect(**self.conn_params)

    def register_asset(self, name: str, asset_type: str, file_content: str, description: str = "", tags: List[str] = [], metadata: Dict[str, Any] = {}, version: str = "1.0.0") -> int:
        """
        Registers a new asset or a new version of an asset.
        """
        try:
            # 1. Sanitize and Validate
            allowed_types = ["strategy", "dataset", "result", "model"]
            if asset_type not in allowed_types:
                raise ValueError(f"Invalid asset type. Must be one of {allowed_types}")

            # Enforce strict name and version normalization to prevent path traversal
            safe_name = os.path.basename(name).replace(" ", "_")
            safe_version = os.path.basename(version).replace(" ", "_")

            # 2. Save file to storage
            filename = f"{safe_name}_{safe_version}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            if asset_type == "strategy":
                filename += ".py"
            elif asset_type == "dataset":
                filename += ".csv"
            else:
                filename += ".blob"

            rel_path = os.path.join(asset_type, filename)
            abs_path = os.path.join(VAULT_STORAGE_PATH, rel_path)

            # Ensure the final path is still within VAULT_STORAGE_PATH
            if not os.path.abspath(abs_path).startswith(os.path.abspath(VAULT_STORAGE_PATH)):
                raise PermissionError("Access denied: Invalid path construction.")

            with open(abs_path, "w") as f:
                f.write(file_content)

            # 2. Update DB metadata
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO assets (name, asset_type, description, tags, version, file_path, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (name, asset_type, description, tags, version, rel_path, json.dumps(metadata))
                    )
                    asset_id = cur.fetchone()[0]
                    conn.commit()

            logger.info(f"Asset '{name}' [ID: {asset_id}] registered successfully in the vault.")
            return asset_id
        except Exception as e:
            logger.error(f"Failed to register asset: {e}")
            raise

    def list_assets(self, asset_type: Optional[str] = None, tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Lists assets with optional filtering.
        """
        try:
            query = "SELECT * FROM assets WHERE 1=1"
            params = []

            if asset_type:
                query += " AND asset_type = %s"
                params.append(asset_type)

            if tags:
                query += " AND tags @> %s"
                params.append(tags)

            query += " ORDER BY created_at DESC"

            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, params)
                    return cur.fetchall()
        except Exception as e:
            logger.error(f"Failed to list assets: {e}")
            return []

    def get_asset_details(self, asset_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieves full details of a specific asset.
        """
        try:
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
                    return cur.fetchone()
        except Exception as e:
            logger.error(f"Failed to get asset details: {e}")
            return None

    def search_assets(self, search_term: str) -> List[Dict[str, Any]]:
        """
        Full text search on name, description, and tags.
        """
        try:
            query = """
                SELECT * FROM assets
                WHERE name ILIKE %s OR description ILIKE %s OR %s = ANY(tags)
                ORDER BY created_at DESC
            """
            term = f"%{search_term}%"
            with self._get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, (term, term, search_term))
                    return cur.fetchall()
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []

# Singleton instance
_vault = None

def get_vault() -> AssetVault:
    global _vault
    if _vault is None:
        _vault = AssetVault()
    return _vault
