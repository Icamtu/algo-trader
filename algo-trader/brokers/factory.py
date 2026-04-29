import logging
import os
from typing import Dict, Any, Type
from .base_broker import BaseBroker

logger = logging.getLogger(__name__)

class BrokerFactory:
    """
    Factory for creating native broker adapters.
    Dynamically loads implementations based on configuration.
    """
    _registry: Dict[str, Type[BaseBroker]] = {}

    @classmethod
    def register(cls, broker_name: str, adapter_class: Type[BaseBroker]):
        cls._registry[broker_name.lower()] = adapter_class
        logger.info(f"Registered broker adapter: {broker_name}")

    @classmethod
    def get_broker(cls, broker_name: str, config: Dict[str, Any]) -> BaseBroker:
        broker_name = broker_name.lower()
        if broker_name not in cls._registry:
            # Attempt dynamic import for native adapters
            try:
                if broker_name == "shoonya":
                    from .shoonya_broker import ShoonyaBroker
                    cls.register("shoonya", ShoonyaBroker)
                elif broker_name == "zerodha":
                    from .zerodha_broker import ZerodhaBroker
                    cls.register("zerodha", ZerodhaBroker)
                elif broker_name == "angel":
                    from .angel_one_broker import AngelOneBroker
                    cls.register("angel", AngelOneBroker)
                elif broker_name == "paper":
                    from .paper_broker import PaperBroker
                    cls.register("paper", PaperBroker)
            except ImportError as e:
                logger.error(f"Could not import adapter for {broker_name}: {e}")
                raise ValueError(f"Broker adapter '{broker_name}' not found or dependencies missing.")

        adapter_class = cls._registry.get(broker_name)
        if not adapter_class:
            raise ValueError(f"Unsupported broker: {broker_name}")

        return adapter_class(broker_name, config)

# Global helper for quick instantiation from environment
def get_active_broker() -> BaseBroker:
    broker_name = os.getenv("AETHERBRIDGE_ACTIVE_BROKER", "shoonya").lower()

    shadow_mode = os.getenv("AETHERBRIDGE_SHADOW_MODE", "false").lower() == "true"

    # Configuration pulled from environment
    if broker_name == "zerodha":
        config = {
            "user_id": os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_USER_ID"),
            "api_key": os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_API_KEY"),
            "api_secret": os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_API_SECRET"),
            "access_token": os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_ACCESS_TOKEN"),
            "dry_run": shadow_mode
        }
    elif broker_name == "angel":
        config = {
            "user_id": os.getenv("AETHERBRIDGE_BROKERS_ANGEL_USER_ID"),
            "password": os.getenv("AETHERBRIDGE_BROKERS_ANGEL_PASSWORD"),
            "totp_secret": os.getenv("AETHERBRIDGE_BROKERS_ANGEL_TOTP_SECRET"),
            "api_key": os.getenv("AETHERBRIDGE_BROKERS_ANGEL_API_KEY"),
            "dry_run": shadow_mode
        }
    elif broker_name == "paper":
        config = {
            "initial_funds": float(os.getenv("PAPER_BROKER_FUNDS", "1000000")),
            "dry_run": True
        }
    else:
        # Default to Shoonya
        config = {
            "user_id": os.getenv("AETHERBRIDGE_BROKERS_SHOONYA_USER_ID"),
            "password": os.getenv("AETHERBRIDGE_BROKERS_SHOONYA_PASSWORD"),
            "totp_secret": os.getenv("AETHERBRIDGE_BROKERS_SHOONYA_TOTP_SECRET"),
            "api_key": os.getenv("AETHERBRIDGE_BROKERS_SHOONYA_API_KEY"),
            "vendor_code": os.getenv("AETHERBRIDGE_BROKERS_SHOONYA_VENDOR_CODE"),
            "imei": os.getenv("AETHERBRIDGE_BROKERS_SHOONYA_IMEI", "MAC_ADDRESS"),
            "dry_run": shadow_mode
        }

    return BrokerFactory.get_broker(broker_name, config)
