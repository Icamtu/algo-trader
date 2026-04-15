#!/usr/bin/env python3
"""Insert a placeholder auth row for paper trading mode."""
import sqlite3, base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

pepper = 'a25d94718479b170c16278e321ea6c989358bf499a658fd20c90033cef8ce772'
kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b'openalgo_static_salt', iterations=100000)
key = base64.urlsafe_b64encode(kdf.derive(pepper.encode()))
f = Fernet(key)
encrypted_token = f.encrypt(b'ANALYZER_PLACEHOLDER').decode()

conn = sqlite3.connect('openalgo/db/openalgo.db', timeout=30)
cur = conn.cursor()
existing = cur.execute("SELECT id FROM auth WHERE name='kamaleswar'").fetchone()
if existing:
    cur.execute("UPDATE auth SET auth=?, broker='shoonya', user_id='FA257063', is_revoked=0 WHERE name='kamaleswar'", (encrypted_token,))
    print(f'Updated auth row id={existing[0]}')
else:
    cur.execute("INSERT INTO auth (name, auth, broker, user_id, is_revoked) VALUES ('kamaleswar', ?, 'shoonya', 'FA257063', 0)", (encrypted_token,))
    print(f'Inserted auth row id={cur.lastrowid}')
conn.commit()
row = cur.execute("SELECT id, name, broker, user_id, is_revoked FROM auth WHERE name='kamaleswar'").fetchone()
print(f'Verified: id={row[0]}, name={row[1]}, broker={row[2]}, user_id={row[3]}, revoked={row[4]}')
conn.close()
