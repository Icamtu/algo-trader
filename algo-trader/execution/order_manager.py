"""
execution/order_manager.py
Centralised order routing with risk checks and position tracking.

Flow for every order:
  1. RiskManager.validate_order() — reject immediately if any limit is breached
  2. Call broker (OpenAlgoClient) via asyncio.to_thread
  3. Log trade to SQLite via TradeLogger
  4. Update in-memory PositionManager
  5. Record the fill in RiskManager (daily counters)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Optional, Dict

from core.config import settings
from database.trade_logger import get_trade_logger
from risk.risk_manager import RiskManager
from execution.position_manager import PositionManager
from utils.throttling import AsyncTokenBucket
from data.timescale_logger import ts_logger
from services.charges_service import get_charges_service
from utils.latency_tracker import latency_tracker

logger = logging.getLogger(__name__)


class OrderManager:
    """
    Handles order execution, risk gating, position tracking, and trade logging.
    """

    @property
    def openalgo_client(self):
        """Compatibility property for API layer."""
        return self.client

    def __init__(
        self,
        client: Any,
        mode: str = "live",
        risk_manager: Optional[RiskManager] = None,
        position_manager: Optional[PositionManager] = None,
        telemetry_callback: Optional[Any] = None,
        action_manager: Optional[Any] = None,
    ):
        self.client = client
        self.mode = mode.lower()
        self.trade_logger = get_trade_logger()
        self.risk_manager = risk_manager or RiskManager()
        self.telemetry_callback = telemetry_callback
        self.action_manager = action_manager

        # Position Management Delegates (Phase 16: Separate state tracks)
        self.live_position_manager = position_manager if self.mode == "live" else PositionManager()
        self.sandbox_position_manager = position_manager if self.mode != "live" else PositionManager()

        # Rate Limiting (Phase 16: Institutional Throttling)
        self.limiter = AsyncTokenBucket(5, 5)

        self.risk_dispatcher = None

        logger.info("OrderManager initialised in %s mode.", self.mode.upper())

    def set_risk_dispatcher(self, dispatcher):
        """Sets the risk dispatcher for broadcasting updates."""
        self.risk_dispatcher = dispatcher

    def get_position_manager(self, mode: Optional[str] = None) -> PositionManager:
        """Get the specific position manager for a mode."""
        effective_mode = (mode or self.mode).lower()
        if effective_mode == "live":
            return self.live_position_manager
        return self.sandbox_position_manager

    @property
    def position_manager(self) -> PositionManager:
        """Get the active position manager based on the default system mode."""
        return self.get_position_manager()

    def set_mode(self, mode: str):
        """Switch the system mode between 'live' and 'sandbox'."""
        self.mode = mode.lower()
        logger.info("OrderManager mode switched to %s.", self.mode.upper())

    # ------------------------------------------------------------------
    # Core order placement
    # ------------------------------------------------------------------

    async def place_order(
        self,
        strategy_name: str,
        symbol: str,
        action: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
        mode: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Place an order with full risk check, broker call, position update,
        latency tracking, and trade logging.
        """
        async with await latency_tracker.measure_async(f"OrderExecution:{symbol}", threshold_ms=10.0):
            action = action.upper()
            effective_mode = (mode or self.mode).lower()
            pm = self.get_position_manager(effective_mode)

            # 1. Risk check
            current_pos = pm.get_quantity(symbol)
            risk_result = self.risk_manager.validate_order(
                symbol=symbol,
                action=action,
                quantity=quantity,
                price=price,
                current_position=current_pos,
                strategy_id=strategy_name,
                product=product,
            )
            if not risk_result.allowed:
                logger.warning(
                    "[%s] ORDER BLOCKED by risk: %s", strategy_name, risk_result.reason
                )
                asyncio.create_task(self.trade_logger.log_trade(
                    strategy=strategy_name,
                    symbol=symbol,
                    side=action,
                    quantity=quantity,
                    price=price,
                    status="blocked",
                    ai_reasoning=ai_reasoning,
                    conviction=conviction,
                ))
                if self.telemetry_callback:
                    asyncio.create_task(self.telemetry_callback("order_rejected", {
                        "strategy": strategy_name, "symbol": symbol, "action": action, "reason": risk_result.reason
                    }))
                return {"status": "blocked", "reason": risk_result.reason}

            logger.info(
                "[%s] >> %s %d %s @ %s [%s/%s]",
                strategy_name, action, quantity, symbol, order_type, product, exchange,
            )

            # 1.5 Semi-Auto Gateway Diversion
            am = self.action_manager
            if not am:
                from execution.action_manager import get_action_manager
                am = get_action_manager()

            if getattr(self, 'force_semi_auto', False) or kwargs.get('human_approval') == True:
                logger.info("[%s] Diverting order to Action Center for approval: %s", strategy_name, symbol)
                am.queue_for_approval({
                    "strategy": strategy_name,
                    "symbol": symbol,
                    "action": action,
                    "quantity": quantity,
                    "price": price,
                    "price_type": order_type,
                    "product": product,
                    "exchange": exchange,
                    "api_type": "Diverted",
                    "ai_reasoning": ai_reasoning,
                    "conviction": conviction,
                })
                return {"status": "success", "message": "Order queued for human approval", "location": "action_center"}

            # 2. Call broker (WITH RATE LIMITING)
            start_broker = time.perf_counter()
            try:
                # Wait for token before calling broker for Live orders
                if effective_mode == "live":
                    await self.limiter.wait()

                response = await asyncio.to_thread(
                    self.client.place_order,
                    symbol=symbol,
                    action=action,
                    quantity=quantity,
                    product=product,
                    order_type=order_type,
                    price=price,
                    exchange=exchange,
                    strategy=strategy_name,
                )
                broker_latency = (time.perf_counter() - start_broker) * 1000
                logger.info(f"[AUDIT] Broker Latency for {symbol} {action}: {broker_latency:.2f}ms")
            except Exception as e:
                logger.error("[%s] Broker call failed for %s: %s", strategy_name, symbol, e, exc_info=True)
                asyncio.create_task(self.trade_logger.log_trade(
                    strategy=strategy_name,
                    symbol=symbol,
                    side=action,
                    quantity=quantity,
                    price=price,
                    status="rejected",
                    mode=effective_mode,
                    ai_reasoning=ai_reasoning,
                    conviction=conviction,
                ))
                return {"status": "error", "message": str(e)}

            logger.info("[%s] << Response: %s", strategy_name, response)

            # Determine execution outcome
            resp_status = (response or {}).get("status", "filled") if response else "rejected"
            execution_price = price
            if response and isinstance(response, dict):
                execution_price = float(response.get("price", price) or price)
            order_id = (response or {}).get("order_id") if response else None

            is_filled = resp_status not in {"error", "rejected", "blocked"}

            # Phase 16: Ensure Pricing Integrity
            if is_filled and execution_price == 0.0:
                try:
                    quote = await self.get_quote(symbol, exchange)
                    if quote and isinstance(quote, dict):
                        broker_ltp = float(quote.get("last_price") or quote.get("lp") or 0.0)
                        if broker_ltp > 0:
                            execution_price = broker_ltp
                            logger.info("[%s] Fallback pricing triggered for %s: %s", strategy_name, symbol, execution_price)
                except Exception as pe:
                     logger.warning(f"PLACE_ORDER_PRICING_FALLBACK_FAULT: {pe}")

            # Calculate charges
            est_charges = 0.0
            if is_filled:
                try:
                    asset_type = "OPTIONS" if any(idx in symbol for idx in ["NIFTY", "BANKNIFTY", "FINNIFTY"]) and any(c.isdigit() for c in symbol) else "EQUITY"
                    charges_service = get_charges_service()
                    charge_data = charges_service.calculate(
                        symbol=symbol,
                        side=action,
                        quantity=quantity,
                        price=execution_price,
                        product=product,
                        asset_type=asset_type
                    )
                    est_charges = charge_data["total"]
                except Exception as ce:
                    logger.warning(f"CHARGE_CALC_FAULT: {ce}")

            # 3. Log to database
            asyncio.create_task(self.trade_logger.log_trade(
                strategy=strategy_name,
                symbol=symbol,
                side=action,
                quantity=quantity,
                price=execution_price,
                status=resp_status if is_filled else "rejected",
                order_id=str(order_id) if order_id else None,
                charges=est_charges,
                mode=effective_mode,
                ai_reasoning=ai_reasoning,
                conviction=conviction,
            ))

            # 4. Update in-memory position
            if is_filled:
                pm.update(symbol, action, quantity, execution_price)
                open_positions = sum(1 for p in pm.all_positions().values() if p.quantity != 0)
                self.risk_manager.update_open_positions(open_positions)
                self.risk_manager.record_trade(pnl=0.0, charges=est_charges)

                if self.telemetry_callback:
                    telemetry_payload = {
                        "type": "ORDER_UPDATE",
                        "status": "filled",
                        "strategy": strategy_name,
                        "symbol": symbol,
                        "action": action,
                        "quantity": quantity,
                        "price": execution_price,
                        "order_id": order_id,
                        "timestamp": datetime.now().isoformat(),
                        "meta": {"broker_latency_ms": round(broker_latency, 2)}
                    }
                    asyncio.create_task(self.telemetry_callback("trade_filled", telemetry_payload))
                    asyncio.create_task(self.telemetry_callback("risk_update", self.risk_manager.get_status()))

                    if self.risk_dispatcher:
                        self.risk_dispatcher.broadcast_risk(self.risk_manager.get_status())

            return response

    # ------------------------------------------------------------------
    # Smart order (position-aware, delegates net qty to OpenAlgo)
    # ------------------------------------------------------------------

    async def place_smart_order(
        self,
        strategy_name: str,
        symbol: str,
        action: str,
        quantity: int,
        position_size: int = 0,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
    ):
        """Smart order — OpenAlgo calculates net quantity to reach target position."""
        action = action.upper()
        logger.info(
            "[%s] SmartOrder >> %s %s qty=%d pos_size=%d",
            strategy_name, action, symbol, quantity, position_size,
        )
        try:
            response = await asyncio.to_thread(
                self.client.place_smart_order,
                symbol=symbol,
                action=action,
                quantity=quantity,
                position_size=position_size,
                product=product,
                price=price,
                order_type=order_type,
                exchange=exchange,
                strategy=strategy_name,
            )
            logger.info("[%s] SmartOrder << %s", strategy_name, response)
            return response
        except Exception as e:
            logger.error("[%s] SmartOrder failed: %s", strategy_name, e, exc_info=True)
            return None

    # ------------------------------------------------------------------
    # Basket order
    # ------------------------------------------------------------------

    async def place_basket_order(self, strategy_name: str, orders: list):
        """Send multiple orders in one API call."""
        logger.info("[%s] BasketOrder >> %d orders", strategy_name, len(orders))
        try:
            response = await asyncio.to_thread(
                self.client.place_basket_order, orders, strategy_name
            )
            logger.info("[%s] BasketOrder << %s", strategy_name, response)
            return response
        except Exception as e:
            logger.error("[%s] BasketOrder failed: %s", strategy_name, e, exc_info=True)
            return None

    # ------------------------------------------------------------------
    # Order management
    # ------------------------------------------------------------------

    async def modify_order(
        self,
        order_id: str,
        symbol: str,
        action: str,
        quantity: int,
        price: float,
        order_type: str = "LIMIT",
        product: str = "MIS",
        exchange: str = "NSE",
    ):
        logger.info("ModifyOrder %s \u2192 qty=%d price=%s", order_id, quantity, price)
        try:
            await self.limiter.wait() # Always limit destructive/modifying actions
            return await asyncio.to_thread(
                self.client.modify_order,
                order_id=order_id,
                symbol=symbol,
                action=action,
                quantity=quantity,
                price=price,
                order_type=order_type,
                product=product,
                exchange=exchange,
            )
        except Exception as e:
            logger.error("ModifyOrder failed: %s", e, exc_info=True)
            return None

    async def cancel_order(self, order_id: str):
        logger.info("CancelOrder \u2192 %s", order_id)
        try:
            await self.limiter.wait()
            return await asyncio.to_thread(self.client.cancel_order, order_id)
        except Exception as e:
            logger.error("CancelOrder failed: %s", e, exc_info=True)
            return None

    async def cancel_all_orders(self):
        logger.info("CancelAllOrders")
        try:
            return await asyncio.to_thread(self.client.cancel_all_orders)
        except Exception as e:
            logger.error("CancelAllOrders failed: %s", e, exc_info=True)
            return None

    async def square_off_all(self):
        """
        Emergency Kill-Switch:
        1. Globally halt all strategies in RiskManager.
        2. Cancel all pending orders.
        3. Close all open positions with market orders.
        """
        logger.warning("!!! EMERGENCY SQUARE-OFF ALL INITIATED [%s] !!!", self.mode.upper())
        try:
            # 1. Global Halt
            self.risk_manager.global_halt = True

            # 2. Cancel orders
            await self.cancel_all_orders()

            # 2. Get active positions
            positions = self.position_manager.all_positions()
            active_symbols = [s for s, p in positions.items() if p.quantity != 0]

            if not active_symbols:
                logger.info("No active positions to square off.")
                return {"status": "success", "message": "No positions to square off."}

            tasks = []
            for symbol in active_symbols:
                pos = positions[symbol]
                action = "SELL" if pos.quantity > 0 else "BUY"
                qty = abs(pos.quantity)

                logger.info("Squaring off %s: %s %d", symbol, action, qty)
                tasks.append(self.place_order(
                    strategy_name="EMERGENCY_PANIC",
                    symbol=symbol,
                    action=action,
                    quantity=qty,
                    order_type="MARKET"
                ))

            results = await asyncio.gather(*tasks)
            return {"status": "success", "results": results}

        except Exception as e:
            logger.error("Panic square-off failed: %s", e, exc_info=True)
            return {"status": "error", "message": str(e)}

    async def liquidate_strategy(self, strategy_id: str):
        """
        Targeted Kill-Switch for a specific strategy node.
        1. Halt the strategy in RiskManager to block new orders.
        2. Identify and square off all positions with this strategy metadata.
        """
        logger.warning(f"!!! TARGETED LIQUIDATION INITIATED: {strategy_id} !!!")
        try:
            # 1. Block further orders
            self.risk_manager.halt_strategy(strategy_id)

            # 2. Get active positions for THIS strategy
            positions = self.position_manager.all_positions()

            squared_count = 0
            tasks = []
            for symbol, pos in positions.items():
                if pos.quantity != 0:
                    # Check if this position belongs to the target strategy
                    if getattr(pos, 'metadata', {}).get('strategy_id') == strategy_id or \
                       getattr(pos, 'metadata', {}).get('strategy') == strategy_id:

                        action = "SELL" if pos.quantity > 0 else "BUY"
                        qty = abs(pos.quantity)
                        logger.warning(f"Liquidating {strategy_id} -> {symbol} {action} {qty}")
                        tasks.append(self.place_order(
                            strategy_name=f"KILL_{strategy_id}",
                            symbol=symbol,
                            action=action,
                            quantity=qty,
                            order_type="MARKET"
                        ))
                        squared_count += 1

            if tasks:
                results = await asyncio.gather(*tasks)
                return {"status": "success", "liquidated_count": squared_count, "details": results}

            return {"status": "success", "message": "No positions found for this strategy."}

        except Exception as e:
            logger.error(f"Targeted liquidation for {strategy_id} failed: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def get_order_status(self, order_id: str):
        return await asyncio.to_thread(self.client.get_order_status, order_id)

    # ------------------------------------------------------------------
    # Data queries (delegate to broker client)
    # ------------------------------------------------------------------

    async def get_positions(self):
        return await asyncio.to_thread(self.client.get_positions)

    async def get_open_positions_dict(self) -> Dict[str, int]:
        """
        Fetch broker positions and return as a flat symbol-to-quantity map.
        Useful for drift detection and dashboard summaries.
        """
        resp = await self.get_positions()
        pos_dict = {}

        # OpenAlgo response format handling
        data = resp.get("data", []) if isinstance(resp, dict) else resp
        if not isinstance(data, list):
            data = []

        for pos in data:
            symbol = pos.get("symbol")
            # OpenAlgo uses 'netqty' or 'quantity'
            qty_str = pos.get("netqty") or pos.get("quantity") or "0"
            try:
                qty = int(float(qty_str))
            except (ValueError, TypeError):
                qty = 0

            if symbol:
                pos_dict[symbol] = pos_dict.get(symbol, 0) + qty

        return pos_dict

    async def get_holdings(self):
        return await asyncio.to_thread(self.client.get_holdings)

    async def get_orders(self):
        return await asyncio.to_thread(self.client.get_orders)

    async def get_trades(self):
        return await asyncio.to_thread(self.client.get_trades)

    async def get_funds(self):
        return await asyncio.to_thread(self.client.get_funds)

    async def get_history(
        self,
        symbol: str,
        exchange: str = "NSE",
        interval: str = "1",
        start_date: str = "",
        end_date: str = "",
    ):
        # Normalize date format for OpenAlgo/Shoonya (expects DD-MM-YYYY)
        def _normalize_date(d: str) -> str:
            if not d: return ""
            try:
                from datetime import datetime
                if "T" in d:
                    dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
                elif "-" in d and len(d.split("-")[0]) == 4:
                    dt = datetime.strptime(d, "%Y-%m-%d")
                else:
                    return d
                return dt.strftime("%Y-%m-%d")
            except:
                return d

        n_start = _normalize_date(start_date)
        n_end = _normalize_date(end_date)

        return await self.client.get_history_async(
            symbol=symbol,
            exchange=exchange,
            interval=interval,
            start_date=n_start,
            end_date=n_end,
        )

    async def toggle_analyzer(self, state: bool):
        """Toggle the OpenAlgo analyzer mode."""
        return await asyncio.to_thread(self.client.toggle_analyzer, state)

    async def get_analyzer_status(self):
        """Get the current status of the OpenAlgo analyzer."""
        return await asyncio.to_thread(self.client.get_analyzer_status)

    async def get_quote(self, symbol: str, exchange: str = "NSE"):
        return await asyncio.to_thread(self.client.get_quote, symbol, exchange)

    async def get_multi_quotes(self, symbols: list):
        return await asyncio.to_thread(self.client.get_multi_quotes, symbols)

    # ------------------------------------------------------------------
    # Synchronization & Reconciliation
    # ------------------------------------------------------------------

    async def sync_with_broker(self):
        """
        Force-synchronize the local PositionManager with the actual broker state.
        This handles cases where the local state might drift (e.g. restarts).
        """
        logger.info("Starting broker reconciliation loop...")
        try:
            # Phase 8: Session Health Check
            from services.session_service import get_session_service
            ss = get_session_service(self)

            is_healthy = await ss.check_health()
            if not is_healthy:
                logger.warning("Broker session unhealthy. Attempting auto-recovery...")
                success = await ss.run_reauth_flow()
                if not success:
                    logger.error("Auto-recovery failed. Skipping reconciliation.")
                    return

            broker_positions = await self.get_positions()
            if not isinstance(broker_positions, list):
                # Handle dictionary response from OpenAlgo
                broker_positions = broker_positions.get("data", []) if isinstance(broker_positions, dict) else []

            # 1. Track symbols seen in broker
            broker_symbols = set()
            pm = self.position_manager

            # Full snapshot for audit log
            local_snapshot = pm.all_positions()
            snapshot_data = {
                "local": {s: p.quantity for s, p in local_snapshot.items()},
                "broker": {}
            }

            for pos in broker_positions:
                symbol = pos.get("symbol")
                if not symbol: continue

                net_qty = int(float(pos.get("quantity") or pos.get("netqty") or 0))
                avg_price = float(pos.get("avg_price") or pos.get("lp") or 0.0)

                broker_symbols.add(symbol)
                snapshot_data["broker"][symbol] = net_qty

                local_qty = pm.get_quantity(symbol)
                if local_qty != net_qty:
                    drift_type = "MISMATCH"
                    action = "AUTO_ALIGN_LOCAL"

                    logger.warning(
                        "Reconciliation Drift detected for %s! Local: %d | Broker: %d. Aligning...",
                        symbol, local_qty, net_qty
                    )

                    # Persistent Audit Log
                    asyncio.create_task(self.trade_logger.log_drift_event(
                        symbol=symbol,
                        local_qty=local_qty,
                        broker_qty=net_qty,
                        drift_type=drift_type,
                        action=action,
                        snapshot=snapshot_data
                    ))

                    if self.telemetry_callback:
                        asyncio.create_task(self.telemetry_callback("drift_detected", {
                            "symbol": symbol,
                            "local_qty": local_qty,
                            "broker_qty": net_qty,
                            "action": action
                        }))
                    pm.set_position(symbol, net_qty, avg_price)

            # 2. Check for Orphaned Local Positions (in local but not in broker)
            for symbol, pos in local_snapshot.items():
                if pos.quantity != 0 and symbol not in broker_symbols:
                    logger.warning(f"Orphaned local position detected for {symbol} (Qty: {pos.quantity})! Broker reports 0. Purging local state...")

                    snapshot_data["broker"][symbol] = 0

                    asyncio.create_task(self.trade_logger.log_drift_event(
                        symbol=symbol,
                        local_qty=pos.quantity,
                        broker_qty=0,
                        drift_type="ORPHAN",
                        action="PURGE_LOCAL",
                        snapshot=snapshot_data
                    ))

                    if self.telemetry_callback:
                        asyncio.create_task(self.telemetry_callback("drift_detected", {
                            "symbol": symbol,
                            "local_qty": pos.quantity,
                            "broker_qty": 0,
                            "action": "PURGE_LOCAL"
                        }))
                    pm.set_position(symbol, 0, 0.0)

            logger.info("Broker reconciliation complete.")
        except Exception as e:
            logger.error("Error during broker reconciliation: %s", e, exc_info=True)
