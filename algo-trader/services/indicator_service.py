import os
import importlib.util
import pandas as pd
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class IndicatorService:
    """
    Manages custom technical indicators.
    Allows dynamic loading and execution of Python-based indicator logic.
    """

    def __init__(self, indicators_dir: str = "indicators"):
        self.indicators_dir = indicators_dir
        os.makedirs(self.indicators_dir, exist_ok=True)
        # Ensure __init__.py exists for imports
        with open(os.path.join(self.indicators_dir, "__init__.py"), "a") as f:
            pass

    def save_indicator(self, name: str, code: str) -> str:
        """Saves a new custom indicator code to disk."""
        filename = f"{name.lower()}.py"
        file_path = os.path.join(self.indicators_dir, filename)

        with open(file_path, "w") as f:
            f.write(code)

        logger.info(f"Custom indicator {name} saved to {file_path}")
        return file_path

    def get_indicators(self) -> List[str]:
        """Lists all available custom indicators."""
        files = [f[:-3] for f in os.listdir(self.indicators_dir) if f.endswith(".py") and f != "__init__.py"]
        return files

    def calculate(self, name: str, df: pd.DataFrame, params: Dict[str, Any]) -> pd.Series:
        """
        Dynamically loads and executes an indicator's calculate function.
        Expected signature in file: def calculate(df, **params) -> pd.Series
        """
        file_path = os.path.join(self.indicators_dir, f"{name.lower()}.py")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Indicator {name} not found at {file_path}")

        try:
            spec = importlib.util.spec_from_file_location(name, file_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            if not hasattr(module, "calculate"):
                raise AttributeError(f"Indicator {name} must have a 'calculate' function.")

            result = module.calculate(df, **params)
            return result
        except Exception as e:
            logger.error(f"Error calculating indicator {name}: {e}")
            raise e

# Singleton
indicator_service = IndicatorService()
