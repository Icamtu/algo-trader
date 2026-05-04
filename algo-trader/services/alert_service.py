import os
import asyncio
import logging
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)

class AlertService:
    """
    Handles dispatching of system and strategy alerts via Telegram and Email.
    Monitors the 'alerts' table for active triggers.
    """

    def __init__(self):
        self.db_logger = get_trade_logger()
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.is_monitoring = False

    async def send_telegram(self, message: str) -> bool:
        """
        Sends a message via Telegram Bot API.
        """
        if not self.telegram_token or not self.telegram_chat_id:
            logger.warning("Telegram credentials missing. Cannot send alert.")
            return False

        url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
        payload = {
            "chat_id": self.telegram_chat_id,
            "text": f"🔔 *AetherDesk Alert*\n\n{message}",
            "parse_mode": "Markdown"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10.0)
                if response.status_code == 200:
                    return True
                else:
                    logger.error(f"Telegram API Error: {response.status_code} - {response.text}")
                    return False
        except Exception:
            logger.error("Failed to send Telegram message", exc_info=True)
            return False

    async def dispatch_alert(self, alert_data: Dict[str, Any]) -> bool:
        """
        Dispatches an alert through configured channels.
        """
        message = (
            f"Type: {alert_data.get('type', 'GENERAL')}\n"
            f"Symbol: {alert_data.get('symbol', 'N/A')}\n"
            f"Condition: {alert_data.get('condition', 'Triggered')}\n"
            f"Value: {alert_data.get('value', 0)}\n"
            f"Message: {alert_data.get('message', 'No detail provided')}"
        )

        channel = alert_data.get("channel", "telegram").lower()

        success = False
        if "telegram" in channel:
            success = await self.send_telegram(message)

        # Email dispatch placeholder
        if "email" in channel:
            logger.info("Email alerting is currently in simulation mode.")
            # Implementation for SMTP goes here

        return success

    def _get_price(self, symbol: str) -> Optional[float]:
        """Retrieve last known tick price from app_context."""
        try:
            from core.context import app_context
            ticks = app_context.get("last_known_ticks", {})
            tick = ticks.get(symbol) or ticks.get(symbol.upper())
            if tick:
                return float(tick.get("ltp") or tick.get("price") or 0) or None
        except Exception:
            pass
        return None

    def _evaluate(self, alert: Dict[str, Any], price: float) -> bool:
        """Return True if alert trigger condition is met."""
        condition = alert.get("condition", "").lower()
        value = float(alert.get("value", 0))
        if condition == "price_above":
            return price > value
        if condition == "price_below":
            return price < value
        if condition == "price_change_pct":
            prev = alert.get("_prev_price")
            if prev:
                return abs((price - prev) / prev * 100) >= abs(value)
        return False

    async def start_monitoring(self, interval: int = 60):
        """
        Background loop that evaluates active alert conditions against live tick prices.
        Dispatches via configured channel when a condition is triggered.
        """
        if self.is_monitoring:
            return

        self.is_monitoring = True
        logger.info("Alert Monitoring Service Started.")
        _prev_prices: Dict[str, float] = {}

        while self.is_monitoring:
            try:
                alerts = self.db_logger.get_alerts(limit=200)
                active = [a for a in alerts if not a.get("acknowledged") and not a.get("triggered")]

                for alert in active:
                    symbol = alert.get("symbol", "")
                    price = self._get_price(symbol)
                    if price is None:
                        continue

                    alert["_prev_price"] = _prev_prices.get(symbol)
                    _prev_prices[symbol] = price

                    if self._evaluate(alert, price):
                        logger.info("Alert triggered: %s %s %s @ %s", alert.get('id'), symbol, alert.get('condition'), price)
                        await self.dispatch_alert({**alert, "value": price})
                        self.db_logger.acknowledge_alert(int(alert["id"]))

            except Exception:
                logger.error("Alert monitoring loop error", exc_info=True)

            await asyncio.sleep(interval)

# Singleton
alert_service = AlertService()
