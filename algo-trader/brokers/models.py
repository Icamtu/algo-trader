from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class OrderStatus(str, Enum):
    PENDING = "PENDING"
    OPEN = "OPEN"
    COMPLETE = "COMPLETE"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    ERROR = "ERROR"

class OrderAction(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL_MARKET = "SL-M"
    SL_LIMIT = "SL-L"

class ProductType(str, Enum):
    MIS = "MIS"      # Intraday
    NRML = "NRML"    # Positional
    CNC = "CNC"      # Delivery

class NormalizedOrder(BaseModel):
    order_id: str
    broker_order_id: Optional[str] = None
    symbol: str
    action: OrderAction
    quantity: int
    order_type: OrderType
    price: float = 0.0
    trigger_price: float = 0.0
    product: ProductType
    status: OrderStatus
    message: str = ""
    timestamp: datetime = Field(default_factory=datetime.now)
    strategy: str = "General"
    raw_response: Optional[Dict[str, Any]] = None

class NormalizedPosition(BaseModel):
    symbol: str
    quantity: int
    buy_quantity: int
    sell_quantity: int
    avg_price: float
    pnl: float = 0.0
    product: ProductType
    exchange: str = "NSE"

class TickData(BaseModel):
    symbol: str
    last_price: float
    volume: int
    timestamp: datetime = Field(default_factory=datetime.now)
    bid: float = 0.0
    ask: float = 0.0
    exchange: str = "NSE"
