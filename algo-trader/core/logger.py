import logging
import logging.handlers
import os
from pathlib import Path

from core.config import settings

def setup_logging():
    """
    Configures the logging for the entire application.

    - Reads log level from the central configuration.
    - Sets up a console handler for real-time output.
    - Sets up a rotating file handler to save logs to a file.
    - Creates a standard format for all log messages.
    """
    try:
        log_level_str = settings.get('system', {}).get('log_level', 'INFO').upper()
        log_level = getattr(logging, log_level_str, logging.INFO)
    except Exception:
        log_level = logging.INFO

    # Define the log format
    log_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Get the root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # --- Console Handler ---
    # Clear existing handlers to avoid duplicate logs
    if root_logger.hasHandlers():
        root_logger.handlers.clear()

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_format)
    root_logger.addHandler(console_handler)

    # --- Rotating File Handler ---
    # Create logs directory if it doesn't exist
    project_root = Path(__file__).parent.parent
    log_dir = project_root / 'logs'
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / 'algo-trader.log'

    # 5 MB per file, keep last 5 files
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=5*1024*1024, backupCount=5
    )
    file_handler.setFormatter(log_format)
    root_logger.addHandler(file_handler)

    # Silence noisy loggers from dependencies
    logging.getLogger('websockets').setLevel(logging.WARNING)
    logging.getLogger('werkzeug').setLevel(logging.WARNING)

    logging.info(f"Logging configured with level {log_level_str}")

# Setup logging immediately when this module is imported
setup_logging()
