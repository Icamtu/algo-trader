import math
from typing import Dict, Any

class ZerodhaCalculator:
    """
    Standard Zerodha Charges Calculator as of April 2026.
    Reference: https://zerodha.com/brokerage-calculator/
    """

    @staticmethod
    def calculate_charges(
        buy_price: float,
        sell_price: float,
        quantity: int,
        asset_type: str = "equity_intraday",
        exchange: str = "NSE"
    ) -> Dict[str, Any]:
        """
        Main calculation entry point.
        asset_type: equity_intraday, equity_delivery, fno_futures, fno_options
        """
        turnover = (buy_price + sell_price) * quantity
        buy_value = buy_price * quantity
        sell_value = sell_price * quantity

        # 1. Brokerage
        brokerage = 0.0
        if asset_type == "equity_intraday" or asset_type == "fno_futures":
            # 0.03% or Rs. 20 whichever is lower per order (Buy + Sell)
            b_buy = min(buy_value * 0.0003, 20.0)
            b_sell = min(sell_value * 0.0003, 20.0)
            brokerage = b_buy + b_sell
        elif asset_type == "equity_delivery":
            brokerage = 0.0
        elif asset_type == "fno_options":
            brokerage = 40.0 # Rs. 20 Buy + Rs. 20 Sell

        # 2. STT/CTT
        stt = 0.0
        if asset_type == "equity_intraday":
            stt = math.ceil(sell_value * 0.00025)
        elif asset_type == "equity_delivery":
            stt = math.ceil(turnover * 0.001)
        elif asset_type == "fno_futures":
            # STT on Futures increased to 0.05% on sell side (revised April 2026)
            stt = math.ceil(sell_value * 0.0005)
        elif asset_type == "fno_options":
            # STT on Options increased to 0.15% on sell side (premium) (revised April 2026)
            stt = math.ceil(sell_value * 0.0015)

        # 3. Transaction Charges (NSE standard)
        txn_rate = 0.0000325 if exchange == "NSE" else 0.0000375
        if asset_type == "fno_options":
            # 0.05% on Premium for Options Transaction Charges (approx)
            txn_charges = turnover * 0.0005
        else:
            txn_charges = turnover * txn_rate

        # 4. SEBI Charges (Rs. 5 per crore - revised 2026)
        sebi_charges = turnover * 0.00000005

        # 5. GST (18% on Brokerage + Transaction charges + SEBI)
        gst = (brokerage + txn_charges + sebi_charges) * 0.18

        # 6. Stamp Duty (Buy side only)
        stamp_duty = 0.0
        if asset_type == "equity_intraday":
            stamp_duty = math.ceil(buy_value * 0.00003)
        elif asset_type == "equity_delivery":
            stamp_duty = math.ceil(buy_value * 0.00015)
        elif asset_type == "fno_futures":
            stamp_duty = math.ceil(buy_value * 0.00002)
        elif asset_type == "fno_options":
            stamp_duty = math.ceil(buy_value * 0.00003)

        total_charges = brokerage + stt + txn_charges + sebi_charges + gst + stamp_duty

        return {
            "turnover": round(turnover, 2),
            "brokerage": round(brokerage, 2),
            "stt": round(stt, 2),
            "transaction_charges": round(txn_charges, 2),
            "sebi_charges": round(sebi_charges, 2),
            "gst": round(gst, 2),
            "stamp_duty": round(stamp_duty, 2),
            "total_charges": round(total_charges, 2),
            "break_even": round(total_charges / quantity, 2) if quantity > 0 else 0.0
        }

    @staticmethod
    def infer_asset_type(symbol: str, strategy: str = "intraday") -> str:
        """Helper to guess asset type from symbol/strategy."""
        sym_upper = symbol.upper()
        if any(x in sym_upper for x in ["-CE", "-PE", " OPT", " CALL", " PUT"]):
            return "fno_options"
        if any(x in sym_upper for x in ["FUT", " FUTURES"]):
            return "fno_futures"

        if strategy.lower() in ["intraday", "scalper", "aetherscalper"]:
            return "equity_intraday"
        if strategy.lower() in ["swing", "long_term", "aetherswing"]:
            return "equity_delivery"

        return "equity_intraday"

# Wrapper functions for easy import
def calculate_charges(
    buy_price: float,
    sell_price: float,
    quantity: int,
    asset_type: str = "equity_intraday",
    exchange: str = "NSE"
) -> Dict[str, Any]:
    return ZerodhaCalculator.calculate_charges(buy_price, sell_price, quantity, asset_type, exchange)

class InstrumentType:
    EQUITY_INTRADAY = "equity_intraday"
    EQUITY_DELIVERY = "equity_delivery"
    FNO_FUTURES = "fno_futures"
    FNO_OPTIONS = "fno_options"
