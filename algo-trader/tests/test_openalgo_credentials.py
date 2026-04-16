import base64
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from execution.openalgo_credentials import resolve_openalgo_credentials


def encrypt_openalgo_api_key(api_key: str, pepper: str) -> str:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"openalgo_static_salt",
        iterations=100000,
    )
    cipher = Fernet(base64.urlsafe_b64encode(kdf.derive(pepper.encode())))
    return cipher.encrypt(api_key.encode()).decode()


def create_test_db(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                api_key_hash TEXT NOT NULL,
                api_key_encrypted TEXT NOT NULL,
                created_at TEXT,
                order_mode TEXT
            );

            CREATE TABLE auth (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                auth TEXT NOT NULL,
                feed_token TEXT,
                broker TEXT,
                user_id TEXT,
                is_revoked BOOLEAN DEFAULT 0
            );
            """
        )


class OpenAlgoCredentialResolutionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "openalgo.db"
        self.pepper = "a" * 64
        create_test_db(self.db_path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def insert_api_key(self, user_id: str, api_key: str, created_at: str) -> None:
        encrypted = encrypt_openalgo_api_key(api_key, self.pepper)
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO api_keys (user_id, api_key_hash, api_key_encrypted, created_at, order_mode)
                VALUES (?, 'hash', ?, ?, 'auto')
                """,
                (user_id, encrypted, created_at),
            )

    def insert_auth(self, user_id: str, broker: str = "shoonya", is_revoked: int = 0) -> None:
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO auth (name, auth, broker, user_id, is_revoked)
                VALUES (?, 'token', ?, ?, ?)
                """,
                (user_id, broker, user_id, is_revoked),
            )

    def test_resolves_single_user_without_auth(self) -> None:
        self.insert_api_key("kamaleswar", "single-user-key", "2026-04-04 02:09:39")

        resolved = resolve_openalgo_credentials(
            db_path=self.db_path,
            pepper=self.pepper,
        )

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.user_id, "kamaleswar")
        self.assertEqual(resolved.api_key, "single-user-key")
        self.assertFalse(resolved.has_active_auth)

    def test_prefers_user_with_active_auth_when_multiple_keys_exist(self) -> None:
        self.insert_api_key("first-user", "first-key", "2026-04-04 02:09:39")
        self.insert_api_key("second-user", "second-key", "2026-04-04 02:10:39")
        self.insert_auth("second-user")

        resolved = resolve_openalgo_credentials(
            db_path=self.db_path,
            pepper=self.pepper,
        )

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.user_id, "second-user")
        self.assertEqual(resolved.api_key, "second-key")
        self.assertTrue(resolved.has_active_auth)

    def test_returns_none_for_ambiguous_multi_user_db_without_hint(self) -> None:
        self.insert_api_key("first-user", "first-key", "2026-04-04 02:09:39")
        self.insert_api_key("second-user", "second-key", "2026-04-04 02:10:39")

        resolved = resolve_openalgo_credentials(
            db_path=self.db_path,
            pepper=self.pepper,
        )

        self.assertIsNone(resolved)

    def test_respects_explicit_user_hint(self) -> None:
        self.insert_api_key("first-user", "first-key", "2026-04-04 02:09:39")
        self.insert_api_key("second-user", "second-key", "2026-04-04 02:10:39")

        resolved = resolve_openalgo_credentials(
            preferred_user_id="first-user",
            db_path=self.db_path,
            pepper=self.pepper,
        )

        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.user_id, "first-user")
        self.assertEqual(resolved.api_key, "first-key")


if __name__ == "__main__":
    unittest.main()
