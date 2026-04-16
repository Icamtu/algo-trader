import importlib
import inspect
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

from core.strategy import BaseStrategy
from execution.order_manager import OrderManager


logger = logging.getLogger(__name__)

STRATEGIES_DIR = Path(__file__).resolve().parent.parent / "strategies"


def to_strategy_key(class_name: str) -> str:
    """Convert a strategy class name into the config key used in settings."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", class_name.replace("Strategy", "")).lower()


def resolve_strategy_key(module_stem: str, class_name: str) -> str:
    """Resolve the strategy config key while preserving existing project keys."""
    if module_stem == "sample_strategy":
        return "sample"
    return to_strategy_key(class_name)


@dataclass
class StrategyDefinition:
    config_key: str
    module_name: str
    class_name: str
    strategy_class: Type[BaseStrategy]


@dataclass
class StrategySnapshot:
    config_key: str
    module_name: str
    class_name: str
    strategy_name: str
    symbols: List[str]
    params: Dict[str, Any]
    enabled: bool


def discover_strategy_definitions() -> List[StrategyDefinition]:
    """Discover concrete strategy classes available in the strategies folder."""
    definitions: List[StrategyDefinition] = []

    for file in sorted(STRATEGIES_DIR.glob("*.py")):
        if file.name.startswith("__"):
            continue

        module_name = f"strategies.{file.stem}"
        try:
            module = importlib.import_module(module_name)
            for _, strategy_class in inspect.getmembers(module, inspect.isclass):
                if strategy_class.__module__ != module.__name__:
                    continue
                if not issubclass(strategy_class, BaseStrategy) or inspect.isabstract(strategy_class):
                    continue

                definitions.append(
                    StrategyDefinition(
                        config_key=resolve_strategy_key(file.stem, strategy_class.__name__),
                        module_name=module.__name__,
                        class_name=strategy_class.__name__,
                        strategy_class=strategy_class,
                    )
                )
        except Exception as exc:
            logger.error("Failed to inspect strategy module %s: %s", file.name, exc, exc_info=True)

    return definitions


def build_strategy_snapshots(
    config: Dict[str, Any],
    order_manager: Optional[OrderManager] = None,
    portfolio_manager: Any = None,
) -> List[StrategySnapshot]:
    """Instantiate each available strategy so callers can inspect runtime metadata."""
    strategy_settings = config.get("strategies", {})
    snapshots: List[StrategySnapshot] = []

    for definition in discover_strategy_definitions():
        try:
            instance = definition.strategy_class(order_manager=order_manager, portfolio_manager=portfolio_manager)
            snapshots.append(
                StrategySnapshot(
                    config_key=definition.config_key,
                    module_name=definition.module_name,
                    class_name=definition.class_name,
                    strategy_name=instance.name,
                    symbols=list(instance.symbols),
                    params=extract_strategy_params(instance),
                    enabled=bool(strategy_settings.get(definition.config_key, False)),
                )
            )
        except Exception as exc:
            logger.error(
                "Failed to instantiate strategy %s from %s: %s",
                definition.class_name,
                definition.module_name,
                exc,
                exc_info=True,
            )

    return snapshots


def extract_strategy_params(instance: BaseStrategy) -> Dict[str, Any]:
    """Pull user-facing strategy settings from a strategy instance."""
    ignored = {
        "name",
        "symbols",
        "order_manager",
        "is_active",
        "positions",
        "price_history",
    }
    params: Dict[str, Any] = {}
    for key, value in vars(instance).items():
        if key.startswith("_") or key in ignored:
            continue
        if isinstance(value, (str, int, float, bool)):
            params[key] = value
    return params
