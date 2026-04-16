import os
import sys
import logging

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.sync_symbols import run_sync

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    print("🚀 Triggering Master Contract Sync...")
    run_sync()
    print("✅ Sync complete.")
