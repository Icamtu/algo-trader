import logging
import asyncio
import httpx
import os
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

class TelegramService:
    """
    Service to send critical trading alerts and telemetry to a Telegram bot.
    """

    def __init__(self, bot_token: str = None, chat_id: str = None):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID")
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        self.is_active = bool(self.bot_token and self.chat_id)

        if not self.is_active:
            logger.warning("TelegramService initialized without BOT_TOKEN or CHAT_ID. Alerts disabled.")
        else:
            logger.info("TelegramService initialized and armed.")

    async def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """
        Send a text message to the configured chat.
        """
        if not self.is_active:
            return False

        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.base_url, json=payload)
                if response.status_code == 200:
                    return True
                else:
                    logger.error("Telegram API Error: %s", response.status_code)
        except Exception:
            logger.error("Failed to send Telegram message", exc_info=True)

        return False

    async def send_alert(self, title: str, message: str, level: str = "INFO"):
        """
        Format and send a structured alert message.
        """
        icons = {
            "INFO": "ℹ️",
            "WARNING": "⚠️",
            "CRITICAL": "🚨",
            "SUCCESS": "✅"
        }
        icon = icons.get(level, "🔔")

        formatted_text = (
            f"<b>{icon} {title}</b>\n"
            f"<code>[{datetime.now().strftime('%H:%M:%S')}]</code> {level}\n\n"
            f"{message}"
        )

        return await self.send_message(formatted_text)

# Singleton instance
_telegram_service: Optional[TelegramService] = None

def get_telegram_service() -> TelegramService:
    global _telegram_service
    if _telegram_service is None:
        _telegram_service = TelegramService()
    return _telegram_service
