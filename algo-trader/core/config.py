import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict

try:
    import yaml
except ImportError:  # pragma: no cover - depends on installed extras
    yaml = None


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "settings.yaml"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "system": {
        "log_level": "INFO",
        "heartbeat_interval_seconds": 30,
        "reconciliation_interval_seconds": 60,
        "session_check_interval_seconds": 300,
        "shutdown_grace_seconds": 10,
    },
    "trading": {
        "mode": "paper",
    },
    "openalgo": {
        "base_url": "http://openalgo-web:5000",
        "ws_url": "",
        "api_key": "",
    },
    "simulation": {
        "enabled": False,
        "tick_interval_seconds": 1.0,
        "base_price": 100.0,
        "price_step": 1.5,
    },
    "strategies": {
        "intraday": True,
        "swing": True,
        "long_term": True,
        "sample": False,
    },
    "database": {
        "timescale": {
            "host": os.getenv("TS_DB_HOST", "timescaledb"),
            "port": int(os.getenv("TS_DB_PORT", "5432")),
            "user": os.getenv("TS_DB_USER", "postgres"),
            "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
            "database": os.getenv("TS_DB_NAME", "postgres"),
        }
    }
}


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Merge nested dictionaries while keeping sensible defaults."""
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _load_yaml_settings() -> Dict[str, Any]:
    """Load YAML settings when the local config file exists."""
    if not CONFIG_PATH.exists():
        return {}

    if yaml is None:
        return {}

    with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
        loaded = yaml.safe_load(config_file) or {}

    if not isinstance(loaded, dict):
        raise ValueError("config/settings.yaml must contain a top-level mapping")

    return loaded


def _load_env_overrides() -> Dict[str, Any]:
    """Allow basic runtime overrides from environment variables."""
    overrides: Dict[str, Any] = {}

    if os.getenv("OPENALGO_BASE_URL") or os.getenv("OPENALGO_WS_URL") or os.getenv("OPENALGO_API_KEY"):
        overrides["openalgo"] = {}
        if os.getenv("OPENALGO_BASE_URL"):
            overrides["openalgo"]["base_url"] = os.getenv("OPENALGO_BASE_URL")
        if os.getenv("OPENALGO_WS_URL"):
            overrides["openalgo"]["ws_url"] = os.getenv("OPENALGO_WS_URL")
        if os.getenv("OPENALGO_API_KEY"):
            overrides["openalgo"]["api_key"] = os.getenv("OPENALGO_API_KEY")

    if os.getenv("TRADING_MODE"):
        overrides["trading"] = {"mode": os.getenv("TRADING_MODE")}

    if os.getenv("SIMULATION_ENABLED"):
        overrides["simulation"] = {
            "enabled": os.getenv("SIMULATION_ENABLED", "").lower() in {"1", "true", "yes", "on"}
        }

    enabled_strategies = _parse_strategy_override_list(os.getenv("ENABLED_STRATEGIES"))
    disabled_strategies = _parse_strategy_override_list(os.getenv("DISABLED_STRATEGIES"))
    if enabled_strategies or disabled_strategies:
        overrides["strategies"] = {}
        for strategy_name in enabled_strategies:
            overrides["strategies"][strategy_name] = True
        for strategy_name in disabled_strategies:
            overrides["strategies"][strategy_name] = False

    return overrides


def _parse_strategy_override_list(raw_value: str | None) -> list[str]:
    """Parse comma-separated strategy names into normalized config keys."""
    if not raw_value:
        return []
    return [
        item.strip().lower().replace("-", "_").replace(" ", "_")
        for item in raw_value.split(",")
        if item.strip()
    ]


def load_config() -> Dict[str, Any]:
    """
    Load application settings from defaults, local YAML, and environment vars.

    The app remains bootable even when `config/settings.yaml` is not present.
    """
    settings = _deep_merge(DEFAULT_SETTINGS, _load_yaml_settings())
    settings = _deep_merge(settings, _load_env_overrides())
    return settings


settings = load_config()
