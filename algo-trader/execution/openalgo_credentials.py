"""
Helpers for resolving the current OpenAlgo user API key from the shared DB.
"""

import base64
import logging
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


logger = logging.getLogger(__name__)

_DEFAULT_DB_PATH = Path("/app/storage/openalgo.db")
_OPENALGO_STATIC_SALT = b"openalgo_static_salt"
_PBKDF2_ITERATIONS = 100000


@dataclass(frozen=True)
class ResolvedOpenAlgoCredentials:
    api_key: str
    user_id: str
    has_active_auth: bool


def _build_cipher(pepper: str) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_OPENALGO_STATIC_SALT,
        iterations=_PBKDF2_ITERATIONS,
    )
    key = base64.urlsafe_b64encode(kdf.derive(pepper.encode()))
    return Fernet(key)


def _decrypt_api_key(encrypted_key: str, pepper: str) -> str | None:
    try:
        return _build_cipher(pepper).decrypt(encrypted_key.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        logger.exception("Failed to decrypt OpenAlgo API key from the shared database.")
        return None


def _select_candidate(
    rows: list[sqlite3.Row], preferred_user_id: str | None
) -> sqlite3.Row | None:
    if not rows:
        return None

    if preferred_user_id:
        return rows[0]

    if len(rows) == 1:
        return rows[0]

    active_rows = [row for row in rows if bool(row["has_active_auth"])]
    if len(active_rows) == 1:
        return active_rows[0]

    logger.warning(
        "Skipping automatic OpenAlgo API key discovery because %d candidate users were found. "
        "Set OPENALGO_USER_ID to select the correct account explicitly.",
        len(rows),
    )
    return None


def resolve_openalgo_credentials(
    preferred_user_id: str | None = None,
    db_path: str | os.PathLike[str] | None = None,
    pepper: str | None = None,
) -> ResolvedOpenAlgoCredentials | None:
    """
    Resolve the current OpenAlgo API key from the shared SQLite database.

    The selection stays conservative:
    - if `preferred_user_id` is set, use that user
    - if only one API key exists, use it
    - if multiple keys exist, auto-select only when exactly one has an active auth session
    """

    resolved_db_path = Path(db_path or os.getenv("OPENALGO_DB_PATH", _DEFAULT_DB_PATH))
    if not resolved_db_path.exists():
        return None

    pepper_value = pepper or os.getenv("API_KEY_PEPPER", "")
    if not pepper_value:
        logger.warning("API_KEY_PEPPER is not set; cannot resolve OpenAlgo API keys from the shared DB.")
        return None

    query = """
        SELECT
            ak.user_id,
            ak.api_key_encrypted,
            CASE
                WHEN a.id IS NOT NULL
                    AND COALESCE(a.is_revoked, 0) = 0
                    AND COALESCE(a.broker, '') <> ''
                THEN 1
                ELSE 0
            END AS has_active_auth
        FROM api_keys ak
        LEFT JOIN auth a ON a.name = ak.user_id
    """
    params: tuple[str, ...] = ()
    if preferred_user_id:
        query += " WHERE ak.user_id = ?"
        params = (preferred_user_id,)
    query += " ORDER BY has_active_auth DESC, ak.created_at DESC, ak.id DESC"

    try:
        with sqlite3.connect(resolved_db_path) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(query, params).fetchall()
    except sqlite3.Error:
        logger.exception("Failed to query OpenAlgo credentials from %s.", resolved_db_path)
        return None

    selected_row = _select_candidate(rows, preferred_user_id)
    if selected_row is None:
        return None

    api_key = _decrypt_api_key(selected_row["api_key_encrypted"], pepper_value)
    if not api_key:
        return None

    return ResolvedOpenAlgoCredentials(
        api_key=api_key,
        user_id=selected_row["user_id"],
        has_active_auth=bool(selected_row["has_active_auth"]),
    )
