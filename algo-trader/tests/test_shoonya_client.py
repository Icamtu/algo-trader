import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from execution.shoonya_client import ShoonyaClient


class ShoonyaClientTests(unittest.TestCase):
    def test_from_env_strips_wrapping_quotes(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "BROKER_API_KEY": "'CLIENT123'",
                "BROKER_API_SECRET": '"SECRET456"',
                "REDIRECT_URL": "'https://example.com/callback'",
            },
            clear=True,
        ):
            client = ShoonyaClient.from_env()

        self.assertEqual(client.api_key, "CLIENT123")
        self.assertEqual(client.secret_key, "SECRET456")
        self.assertEqual(client.redirect_url, "https://example.com/callback")

    def test_login_stores_tokens_and_authorization_header(self) -> None:
        fake_response = Mock()
        fake_response.json.return_value = {
            "stat": "Ok",
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "susertoken": "session-token",
            "uid": "kamaleswar",
            "actid": "kamaleswar",
            "expires_in": 3600,
        }
        fake_response.raise_for_status.return_value = None

        fake_session = Mock()
        fake_session.headers = {}
        fake_session.post.return_value = fake_response

        client = ShoonyaClient("CLIENT", "SECRET", session=fake_session)
        result = client.login("oauth-code")

        self.assertEqual(result["access_token"], "access-token")
        self.assertEqual(client.access_token, "access-token")
        self.assertEqual(client.uid, "kamaleswar")
        self.assertEqual(fake_session.headers["Authorization"], "Bearer access-token")

    def test_place_order_formats_jdata_and_url_encodes_symbol(self) -> None:
        fake_response = Mock()
        fake_response.json.return_value = {"stat": "Ok", "norenordno": "12345"}
        fake_response.raise_for_status.return_value = None

        fake_session = Mock()
        fake_session.headers = {}
        fake_session.post.return_value = fake_response

        client = ShoonyaClient("CLIENT", "SECRET", session=fake_session)
        client.set_session(access_token="token", uid="kamaleswar", actid="kamaleswar")

        client.place_order(
            exch="NFO",
            tsym="M&M-EQ",
            qty=1,
            prc=0,
            trantype="B",
            prctyp="MKT",
        )

        _, kwargs = fake_session.post.call_args
        payload = json.loads(kwargs["data"]["jData"])

        self.assertEqual(payload["uid"], "kamaleswar")
        self.assertEqual(payload["actid"], "kamaleswar")
        self.assertEqual(payload["tsym"], "M%26M-EQ")
        self.assertEqual(payload["qty"], "1")
        self.assertEqual(payload["prc"], "0")
        self.assertEqual(payload["prctyp"], "MKT")

    def test_get_positions_unwraps_list_payload(self) -> None:
        fake_response = Mock()
        fake_response.json.return_value = {
            "stat": "Ok",
            "positions": [{"tsym": "RELIANCE", "netqty": "1"}],
        }
        fake_response.raise_for_status.return_value = None

        fake_session = Mock()
        fake_session.headers = {}
        fake_session.post.return_value = fake_response

        client = ShoonyaClient("CLIENT", "SECRET", session=fake_session)
        client.set_session(access_token="token", uid="kamaleswar")

        positions = client.get_positions()

        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0]["tsym"], "RELIANCE")


if __name__ == "__main__":
    unittest.main()
