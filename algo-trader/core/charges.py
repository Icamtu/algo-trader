import logging
from typing import Dict

logger = logging.getLogger(__name__)

class ChargesCalculator:
    """
    Calculates realistic trade charges for the Indian Market (NSE).
    Based on standard MIS (Intraday) structures.
    """

    def __init__(
        self,
        brokerage_pct: float = 0.0003, # 0.03%
        stt_pct: float = 0.00025,      # 0.025% (On Sell side)
        exc_charge_pct: float = 0.0000345, # ~0.00345%
        sebi_pct: float = 0.000001,    # ~0.0001%
        stamp_pct: float = 0.00003,     # 0.003% (On Buy side)
        gst_pct: float = 0.18           # 18% on (Brokerage + Exchange)
    ):
        self.brokerage_pct = brokerage_pct
        self.stt_pct = stt_pct
        self.exc_charge_pct = exc_charge_pct
        self.sebi_pct = sebi_pct
        self.stamp_pct = stamp_pct
        self.gst_pct = gst_pct

    def calculate(self, action: str, quantity: int, price: float) -> Dict[str, float]:
        """
        Computes granular charges for a single trade leg.
        """
        turnover = quantity * price

        # 1. Brokerage (Simplified: % without cap for backtest)
        brokerage = turnover * self.brokerage_pct

        # 2. STT (Only on Sell side for Intraday)
        stt = turnover * self.stt_pct if action == "SELL" else 0

        # 3. Exchange Charges
        exc_charges = turnover * self.exc_charge_pct

        # 4. SEBI Charges
        sebi_charges = turnover * self.sebi_pct

        # 5. Stamp Duty (Only on Buy side for Intraday)
        stamp_duty = turnover * self.stamp_pct if action == "BUY" else 0

        # 6. GST (On Brokerage + Exchange Charges)
        gst = (brokerage + exc_charges) * self.gst_pct

        total = brokerage + stt + exc_charges + sebi_charges + stamp_duty + gst

        return {
            "brokerage": brokerage,
            "stt": stt,
            "exc_charges": exc_charges,
            "sebi_charges": sebi_charges,
            "stamp_duty": stamp_duty,
            "gst": gst,
            "total": total
        }

# Global instances for ease of use
nse_charger = ChargesCalculator()
