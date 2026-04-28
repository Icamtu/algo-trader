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
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")
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

    async def start_monitoring(self, interval: int = 60):
        """
        Starts a background loop to check for alert triggers in the database.
        (Note: In a high-frequency system, this should be event-driven or more frequent).
        """
        if self.is_monitoring:
            return

        self.is_monitoring = True
        logger.info("Alert Monitoring Service Started.")

        while self.is_monitoring:
            try:
                # 1. Fetch active alerts from database
                # (For now, we'll implement a simple mock check or a real DB query if table exists)
                # This logic should be expanded based on specific trigger conditions (Price, RSI, etc.)
                pass

                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"Alert monitoring loop error: {e}")
                await asyncio.sleep(interval)

# Singleton
alert_service = AlertService()
