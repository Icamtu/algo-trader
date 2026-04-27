import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ChargesService:
    """
    Institutional-grade Tax & Charges Calculator.
    Follows Indian market standards (NSE/BSE) with configurable rates.
    """

    def __init__(self):
        # Load rates from env or use defaults (April 2026 standards)
        self.STT_EQUITY_DELIVERY = float(os.getenv("STT_EQUITY_DELIVERY", 0.001))      # 0.1%
        self.STT_EQUITY_INTRADAY = float(os.getenv("STT_EQUITY_INTRADAY", 0.00025))    # 0.025% (on Sell)
        self.STT_OPTIONS = float(os.getenv("STT_OPTIONS", 0.000625))                 # 0.0625% (on Sell premium)

        self.TRANS_CHARGE_NSE_EQUITY = float(os.getenv("TRANS_NSE_EQUITY", 0.0000325)) # 0.00325%
        self.TRANS_CHARGE_NSE_OPTIONS = float(os.getenv("TRANS_NSE_OPTIONS", 0.00053)) # 0.053% (on premium)

        self.SEBI_FEES_PER_CRORE = float(os.getenv("SEBI_FEES_CRORE", 10.0))          # ₹10 / Cr
        self.GST_RATE = float(os.getenv("GST_RATE", 0.18))                            # 18%

        # Stamp Duty (On Buy only)
        self.STAMP_EQUITY_DELIVERY = 0.00015  # 0.015%
        self.STAMP_EQUITY_INTRADAY = 0.00003  # 0.003%
        self.STAMP_OPTIONS = 0.00003         # 0.003%

    def calculate(self,
                  symbol: str,
                  side: str,
                  quantity: int,
                  price: float,
                  product: str = "MIS",
                  asset_type: str = "EQUITY") -> Dict[str, float]:
        """
        Calculate total charges for a single order leg.

        :param symbol: Trading symbol
        :param side: BUY or SELL
        :param quantity: Number of units
        :param price: Execution price
        :param product: MIS (Intraday), CNC (Delivery), NRML
        :param asset_type: EQUITY, OPTIONS, FUTURES
        """
        turnover = quantity * price
        side = side.upper()
        product = product.upper()
        asset_type = asset_type.upper()

        # Brokerage (AetherDesk default: ₹0 for delivery, ₹20 or 0.03% for intraday)
        # For simplicity, we assume an institutional model where brokerage is managed separately
        # or included in a flat fee. We'll use ₹20 cap for MIS/Options.
        brokerage = 0.0
        if product in ["MIS", "NRML"] or asset_type == "OPTIONS":
            brokerage = min(20.0, turnover * 0.0003)
        elif product == "CNC" and asset_type == "EQUITY":
            brokerage = 0.0 # Zero brokerage on delivery

        # 1. STT (Securities Transaction Tax)
        stt = 0.0
        if asset_type == "EQUITY":
            if product == "CNC":
                stt = turnover * self.STT_EQUITY_DELIVERY # Both sides
            elif product == "MIS" and side == "SELL":
                stt = turnover * self.STT_EQUITY_INTRADAY # Sell side only
            if product == "CNC": # Delivery
                stt = round(turnover * 0.001, 2) # 0.1% on both Buy & Sell
            elif side.upper() == "SELL": # Intraday SELL only
                stt = round(turnover * 0.00025, 2) # 0.025%
        elif asset_type == "OPTIONS" and side.upper() == "SELL":
            stt = round(turnover * 0.0005, 2) # 0.05% on Premium

        # 2. Transaction Charges (Exchange Fees - NSE)
        txn_charge = 0.0
        if asset_type == "EQUITY":
            txn_charge = round(turnover * 0.0000345, 2) # 0.00345%
        elif asset_type == "OPTIONS":
            txn_charge = round(turnover * 0.00053, 2) # 0.053%

        # 3. SEBI Charges
        sebi_charges = round(turnover * 0.0000001, 2) # ₹10 / Crore

        # 4. Stamp Duty (State dependent, using general avg/max)
        stamp_duty = 0.0
        if side.upper() == "BUY": # Mostly on Buy side in India
            if asset_type == "EQUITY":
                if product == "CNC":
                    stamp_duty = round(turnover * 0.00015, 2) # 0.015%
                else:
                    stamp_duty = round(turnover * 0.00003, 2) # 0.003%
            elif asset_type == "OPTIONS":
                stamp_duty = round(turnover * 0.00003, 2) # 0.003%

        # 5. GST (18% on Brokerage + Transaction Charges + SEBI)
        taxable_value = brokerage + txn_charge + sebi_charges
        gst = round(taxable_value * 0.18, 2)

        total = round(brokerage + stt + txn_charge + sebi_charges + stamp_duty + gst, 2)

        return {
            "brokerage": brokerage,
            "stt": stt,
            "transaction_charges": txn_charge,
            "sebi_charges": sebi_charges,
            "stamp_duty": stamp_duty,
            "gst": gst,
            "total": total,
            "turnover": turnover
        }

# Singleton instance
_instance = None

def get_charges_service():
    global _instance
    if _instance is None:
        _instance = ChargesService()
    return _instance
