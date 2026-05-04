import importlib
import json
import random
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import core.logger  # noqa: F401 - initialize logging once for the app
from core.config import settings
from core.strategy_registry import build_strategy_snapshots
from execution.health import check_openalgo
from execution.order_manager import OrderManager
from portfolio.portfolio_manager import PortfolioManager
from risk.risk_manager import RiskManager

try:
    from streamlit_autorefresh import st_autorefresh
except ImportError:  # pragma: no cover - optional UI helper
    st_autorefresh = None


STRATEGIES_DIR = PROJECT_ROOT / "strategies"
OPENALGO_URL = settings.get("openalgo", {}).get("base_url", "http://openalgo-web:5000")
TRADING_MODE = settings.get("trading", {}).get("mode", "paper").upper()
SIMULATION_ENABLED = settings.get("simulation", {}).get("enabled", True)


st.set_page_config(
    page_title="Algo Trader Command Center",
    page_icon="AI",
    layout="wide",
    initial_sidebar_state="expanded",
)


def inject_styles():
    st.markdown(
        """
        <style>
        .stApp {
            background:
                radial-gradient(circle at top left, rgba(255, 180, 120, 0.28), transparent 28%),
                radial-gradient(circle at top right, rgba(75, 115, 255, 0.25), transparent 24%),
                linear-gradient(180deg, #0b1220 0%, #111a2e 45%, #151f32 100%);
            color: #edf2ff;
        }
        .main .block-container {
            padding-top: 1.5rem;
            padding-bottom: 2rem;
            max-width: 1450px;
        }
        .hero-shell {
            padding: 1.35rem 1.5rem;
            border-radius: 26px;
            background: linear-gradient(135deg, rgba(13, 22, 40, 0.90), rgba(24, 37, 63, 0.80));
            border: 1px solid rgba(173, 196, 255, 0.18);
            box-shadow: 0 24px 60px rgba(2, 8, 23, 0.40);
            margin-bottom: 1rem;
        }
        .hero-title {
            font-size: 2.2rem;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            font-weight: 700;
            letter-spacing: 0.02em;
            margin-bottom: 0.2rem;
        }
        .hero-subtitle {
            color: #bac8e8;
            font-size: 0.98rem;
            line-height: 1.6;
        }
        .metric-tile {
            padding: 1rem 1.05rem;
            border-radius: 20px;
            background: linear-gradient(180deg, rgba(18, 27, 46, 0.92), rgba(16, 24, 40, 0.86));
            border: 1px solid rgba(173, 196, 255, 0.14);
            min-height: 124px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .metric-label {
            color: #9fb4da;
            font-size: 0.82rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 0.4rem;
        }
        .metric-value {
            color: #f8fbff;
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }
        .metric-meta {
            color: #c0cee8;
            font-size: 0.88rem;
        }
        .panel {
            padding: 1rem 1.1rem;
            border-radius: 20px;
            background: rgba(12, 19, 34, 0.88);
            border: 1px solid rgba(173, 196, 255, 0.14);
            box-shadow: 0 16px 40px rgba(2, 8, 23, 0.22);
        }
        .signal-buy {
            color: #73f0b3;
            font-weight: 700;
        }
        .signal-sell {
            color: #ff9a9a;
            font-weight: 700;
        }
        .signal-hold {
            color: #f4d35e;
            font-weight: 700;
        }
        div[data-testid="stMetricValue"] {
            font-family: "Avenir Next", "Segoe UI", sans-serif;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


@st.cache_data(show_spinner=False)
def discover_strategies() -> List[Dict[str, Any]]:
    """
    Discover strategy classes and instantiate them so the dashboard can show
    the same parameters your runtime uses.
    """
    client = OpenAlgoClient(
        base_url=settings.get("openalgo", {}).get("base_url"),
        api_key=settings.get("openalgo", {}).get("api_key"),
    )
    order_manager = OrderManager(client)
    return [
        {
            "config_key": snapshot.config_key,
            "module_name": snapshot.module_name,
            "class_name": snapshot.class_name,
            "strategy_name": snapshot.strategy_name,
            "symbols": snapshot.symbols,
            "params": snapshot.params,
            "enabled": snapshot.enabled,
        }
        for snapshot in build_strategy_snapshots(config=settings, order_manager=order_manager)
    ]


def generate_market_series(symbol: str, periods: int, base_price: float) -> pd.DataFrame:
    """
    Create a deterministic pseudo-market series for dashboard exploration.
    """
    rng = random.Random(f"{symbol}-{periods}-{base_price}")
    timestamps = pd.date_range(end=pd.Timestamp.now(), periods=periods, freq="min")
    drift = rng.uniform(-0.15, 0.18)
    price = base_price
    prices = []
    volumes = []

    for _ in range(periods):
        price = max(1.0, price + rng.uniform(-1.6, 1.6) + drift)
        prices.append(round(price, 2))
        volumes.append(int(rng.uniform(900, 4800)))

    return pd.DataFrame({"timestamp": timestamps, "price": prices, "volume": volumes})


def resolve_preview_signal(strategy: Dict[str, Any], market_df: pd.DataFrame, symbol: str) -> str:
    """
    Use each strategy module's signal function so the dashboard mirrors the
    current strategy logic.
    """
    latest_price = float(market_df["price"].iloc[-1])
    module = importlib.import_module(strategy["module_name"])

    if hasattr(module, "generate_signal"):
        if strategy["class_name"] == "IntradayStrategy":
            payload = {
                "symbol": symbol,
                "ltp": latest_price,
                "buy_above": strategy["params"].get("buy_above", 101.0),
                "sell_below": strategy["params"].get("sell_below", 99.0),
            }
            return module.generate_signal(payload)

        if strategy["class_name"] == "SwingStrategy":
            payload = {
                "symbol": symbol,
                "prices": market_df["price"].tolist(),
                "fast_period": strategy["params"].get("fast_period", 5),
                "slow_period": strategy["params"].get("slow_period", 12),
            }
            return module.generate_signal(payload)

        if strategy["class_name"] == "LongTermStrategy":
            payload = {
                "symbol": symbol,
                "prices": market_df["price"].tolist(),
                "trend_period": strategy["params"].get("trend_period", 20),
                "rsi_period": strategy["params"].get("rsi_period", 14),
                "buy_below_rsi": strategy["params"].get("buy_below_rsi", 45),
                "sell_above_rsi": strategy["params"].get("sell_above_rsi", 65),
            }
            return module.generate_signal(payload)

    buy_below = strategy["params"].get("buy_below_price", 95.0)
    sell_above = strategy["params"].get("sell_above_price", 105.0)
    if latest_price <= buy_below:
        return "BUY"
    if latest_price >= sell_above:
        return "SELL"
    return "HOLD"


def signal_badge(signal: str) -> str:
    normalized = signal.upper()
    css_class = {"BUY": "signal-buy", "SELL": "signal-sell"}.get(normalized, "signal-hold")
    return f"<span class='{css_class}'>{normalized}</span>"


def render_metric_card(label: str, value: str, meta: str):
    st.markdown(
        f"""
        <div class="metric-tile">
            <div class="metric-label">{label}</div>
            <div class="metric-value">{value}</div>
            <div class="metric-meta">{meta}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def build_price_chart(market_df: pd.DataFrame, strategy_label: str) -> go.Figure:
    figure = go.Figure()
    figure.add_trace(
        go.Scatter(
            x=market_df["timestamp"],
            y=market_df["price"],
            mode="lines",
            name="Price",
            line={"color": "#87f5c0", "width": 3},
            fill="tozeroy",
            fillcolor="rgba(135, 245, 192, 0.12)",
        )
    )
    figure.add_trace(
        go.Bar(
            x=market_df["timestamp"],
            y=market_df["volume"],
            name="Volume",
            yaxis="y2",
            marker={"color": "rgba(130, 160, 255, 0.18)"},
        )
    )
    figure.update_layout(
        title=f"{strategy_label} market pulse",
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(7, 12, 24, 0.45)",
        margin={"l": 10, "r": 10, "t": 50, "b": 10},
        legend={"orientation": "h", "y": 1.1},
        xaxis={"title": "", "showgrid": False},
        yaxis={"title": "Price", "gridcolor": "rgba(173, 196, 255, 0.08)"},
        yaxis2={
            "title": "Volume",
            "overlaying": "y",
            "side": "right",
            "showgrid": False,
        },
        height=430,
    )
    return figure


def build_signal_gauge(signal: str) -> go.Figure:
    score_map = {"SELL": 20, "HOLD": 50, "BUY": 85}
    color_map = {"SELL": "#ff7b7b", "HOLD": "#f2cf63", "BUY": "#67f1ab"}
    score = score_map.get(signal.upper(), 50)
    color = color_map.get(signal.upper(), "#f2cf63")

    figure = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=score,
            number={"suffix": "/100", "font": {"color": "#f5f7ff"}},
            title={"text": f"Signal strength: {signal.upper()}", "font": {"color": "#dce7ff"}},
            gauge={
                "axis": {"range": [0, 100], "tickcolor": "#cbd7f1"},
                "bar": {"color": color},
                "bgcolor": "rgba(255,255,255,0.02)",
                "steps": [
                    {"range": [0, 35], "color": "rgba(255, 123, 123, 0.22)"},
                    {"range": [35, 65], "color": "rgba(242, 207, 99, 0.22)"},
                    {"range": [65, 100], "color": "rgba(103, 241, 171, 0.22)"},
                ],
            },
        )
    )
    figure.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        margin={"l": 20, "r": 20, "t": 60, "b": 10},
        height=290,
    )
    return figure


def render_strategy_cards(strategies: List[Dict[str, Any]], market_data_map: Dict[str, pd.DataFrame]):
    for strategy in strategies:
        symbol = strategy["symbols"][0] if strategy["symbols"] else "UNKNOWN"
        market_df = market_data_map[symbol]
        latest_price = float(market_df["price"].iloc[-1])
        signal = resolve_preview_signal(strategy, market_df, symbol)

        portfolio_manager = PortfolioManager(account_capital=100000.0, max_capital_per_trade_pct=10.0)
        quantity_plan = portfolio_manager.calculate_quantity(symbol=symbol, price=latest_price)
        risk_manager = RiskManager()
        risk_result = risk_manager.validate_order(
            symbol=symbol,
            action="BUY",
            quantity=min(quantity_plan.quantity, strategy["params"].get("trade_quantity", 1)),
            price=latest_price,
            current_position=0,
        )

        with st.container(border=False):
            st.markdown("<div class='panel'>", unsafe_allow_html=True)
            top_left, top_right = st.columns([2.1, 1.1])
            with top_left:
                st.subheader(strategy["strategy_name"])
                st.caption(f"{strategy['class_name']}  |  Symbols: {', '.join(strategy['symbols'])}")
                st.markdown(f"Preview signal: {signal_badge(signal)}", unsafe_allow_html=True)
            with top_right:
                st.metric("Latest Price", f"{latest_price:.2f}")
                st.metric("Suggested Qty", quantity_plan.quantity)

            params_df = pd.DataFrame(
                [{"Parameter": key, "Value": value} for key, value in strategy["params"].items()]
            )
            lower_left, lower_right = st.columns([1.2, 1])
            with lower_left:
                if not params_df.empty:
                    st.dataframe(params_df, use_container_width=True, hide_index=True)
                else:
                    st.info("No user parameters found for this strategy.")
            with lower_right:
                st.metric("Risk Check", "PASS" if risk_result.allowed else "BLOCK")
                st.caption(risk_result.reason)
                st.metric("Budget / Trade", f"{quantity_plan.capital_to_use:,.0f}")
            st.markdown("</div>", unsafe_allow_html=True)
            st.write("")


inject_styles()


strategies = discover_strategies()
strategy_names = [strategy["strategy_name"] for strategy in strategies]
all_symbols = sorted({symbol for strategy in strategies for symbol in strategy["symbols"]})

if "selected_strategies" not in st.session_state:
    st.session_state.selected_strategies = strategy_names
if "selected_symbol" not in st.session_state:
    st.session_state.selected_symbol = all_symbols[0] if all_symbols else "RELIANCE"

with st.sidebar:
    st.markdown("## Watch Tower")
    selected_strategies = st.multiselect(
        "Strategies to watch",
        options=strategy_names,
        default=st.session_state.selected_strategies,
    )
    st.session_state.selected_strategies = selected_strategies or strategy_names

    selected_symbol = st.selectbox(
        "Focus symbol",
        options=all_symbols or ["RELIANCE"],
        index=(all_symbols or ["RELIANCE"]).index(st.session_state.selected_symbol)
        if st.session_state.selected_symbol in (all_symbols or ["RELIANCE"])
        else 0,
    )
    st.session_state.selected_symbol = selected_symbol

    chart_depth = st.slider("Chart depth", min_value=30, max_value=240, value=90, step=15)
    synthetic_base = st.number_input("Base price", min_value=1.0, value=100.0, step=5.0)
    auto_refresh = st.toggle("Auto refresh", value=False)
    if auto_refresh and st_autorefresh is not None:
        st_autorefresh(interval=4000, key="dashboard-refresh")
    elif auto_refresh:
        st.caption("Install `streamlit-autorefresh` to enable timed refresh.")

    st.markdown("---")
    st.caption("Runtime")
    st.write(f"Mode: `{TRADING_MODE}`")
    st.write(f"Simulation: `{SIMULATION_ENABLED}`")
    st.write(f"OpenAlgo URL: `{OPENALGO_URL}`")


openalgo_is_up = check_openalgo(OPENALGO_URL)
selected_snapshots = [item for item in strategies if item["strategy_name"] in st.session_state.selected_strategies]
market_data_map = {
    symbol: generate_market_series(symbol=symbol, periods=chart_depth, base_price=synthetic_base)
    for symbol in (all_symbols or [st.session_state.selected_symbol])
}
focused_market_df = market_data_map[st.session_state.selected_symbol]
focused_signals = {
    item["strategy_name"]: resolve_preview_signal(item, market_data_map[item["symbols"][0]], item["symbols"][0])
    for item in selected_snapshots
}

hero_left, hero_right = st.columns([2.5, 1.1])
with hero_left:
    st.markdown(
        """
        <div class="hero-shell">
            <div class="hero-title">Algo Trader Command Center</div>
            <div class="hero-subtitle">
                Monitor your intraday, swing, long-term, and custom strategy stack from one screen.
                This dashboard mirrors your current strategy logic, previews likely signals, and helps
                you watch market pulse, risk posture, and system readiness in one place.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with hero_right:
    st.markdown(
        f"""
        <div class="hero-shell">
            <div class="metric-label">Broker Status</div>
            <div class="metric-value">{"ONLINE" if openalgo_is_up else "OFFLINE"}</div>
            <div class="metric-meta">OpenAlgo endpoint: {OPENALGO_URL}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


metric_cols = st.columns(4)
with metric_cols[0]:
    render_metric_card("Strategies Armed", str(len(selected_snapshots)), "Loaded from your strategies folder")
with metric_cols[1]:
    render_metric_card("Watch Symbols", str(len(all_symbols)), "Symbols actively tracked by strategy configs")
with metric_cols[2]:
    buy_count = list(focused_signals.values()).count("BUY")
    render_metric_card("Buy Signals", str(buy_count), "Preview signals from current synthetic snapshot")
with metric_cols[3]:
    render_metric_card("Execution Mode", TRADING_MODE, "Paper or live mode from app config")


overview_tab, strategy_tab, signal_tab, system_tab = st.tabs(
    ["Market Overview", "Strategy Watch", "Signal Lab", "System Watch"]
)

with overview_tab:
    chart_col, radar_col = st.columns([2.2, 1])
    with chart_col:
        st.plotly_chart(
            build_price_chart(focused_market_df, st.session_state.selected_symbol),
            use_container_width=True,
        )
    with radar_col:
        dominant_signal = "HOLD"
        if focused_signals:
            votes = {"BUY": 0, "SELL": 0, "HOLD": 0}
            for value in focused_signals.values():
                votes[value] = votes.get(value, 0) + 1
            dominant_signal = max(votes, key=votes.get)
        st.plotly_chart(build_signal_gauge(dominant_signal), use_container_width=True)
        st.caption("Dominant preview signal across the selected strategies.")

    pulse_left, pulse_right = st.columns([1.2, 1])
    with pulse_left:
        signal_rows = []
        for strategy in selected_snapshots:
            symbol = strategy["symbols"][0]
            signal_rows.append(
                {
                    "Strategy": strategy["strategy_name"],
                    "Symbol": symbol,
                    "Latest Price": round(float(market_data_map[symbol]["price"].iloc[-1]), 2),
                    "Signal": resolve_preview_signal(strategy, market_data_map[symbol], symbol),
                }
            )
        st.dataframe(pd.DataFrame(signal_rows), use_container_width=True, hide_index=True)
    with pulse_right:
        volume_df = focused_market_df.tail(12).copy()
        volume_df["time"] = volume_df["timestamp"].dt.strftime("%H:%M")
        st.bar_chart(volume_df.set_index("time")["volume"], use_container_width=True)

with strategy_tab:
    render_strategy_cards(selected_snapshots, market_data_map)

with signal_tab:
    left_col, right_col = st.columns([1.05, 1.15])
    with left_col:
        preview_strategy_name = st.selectbox(
            "Strategy preview",
            options=[strategy["strategy_name"] for strategy in selected_snapshots] or strategy_names,
        )
        preview_strategy = next(
            item for item in strategies if item["strategy_name"] == preview_strategy_name
        )
        preview_symbol = preview_strategy["symbols"][0]
        preview_market_df = market_data_map[preview_symbol]
        latest_price = float(preview_market_df["price"].iloc[-1])

        custom_price = st.number_input(
            "Manual test price",
            min_value=1.0,
            value=round(latest_price, 2),
            step=0.5,
        )
        custom_df = preview_market_df.copy()
        custom_df.loc[custom_df.index[-1], "price"] = custom_price

        preview_signal = resolve_preview_signal(preview_strategy, custom_df, preview_symbol)
        st.metric("Preview Signal", preview_signal)
        st.metric("Last Price", f"{latest_price:.2f}")
        st.metric("Manual Test Price", f"{custom_price:.2f}")

        risk_manager = RiskManager()
        proposed_qty = int(preview_strategy["params"].get("trade_quantity", 1))
        risk_result = risk_manager.validate_order(
            symbol=preview_symbol,
            action="BUY",
            quantity=proposed_qty,
            price=custom_price,
            current_position=0,
        )
        st.metric("Risk Decision", "PASS" if risk_result.allowed else "BLOCK")
        st.caption(risk_result.reason)

    with right_col:
        st.plotly_chart(build_signal_gauge(preview_signal), use_container_width=True)
        strategy_params_json = json.dumps(preview_strategy["params"], indent=2)
        st.code(strategy_params_json, language="json")

with system_tab:
    status_left, status_right = st.columns([1, 1.2])
    with status_left:
        st.subheader("System Health")
        st.metric("OpenAlgo", "Connected" if openalgo_is_up else "Disconnected")
        st.metric("Simulation Feed", "Enabled" if SIMULATION_ENABLED else "Disabled")
        st.metric("Active Strategy Count", len(selected_snapshots))
        st.metric("Dashboard Timestamp", datetime.now().strftime("%H:%M:%S"))

        st.subheader("Runtime Config")
        st.json(settings)

    with status_right:
        st.subheader("Strategy-to-Symbol Map")
        mapping_rows = []
        for strategy in strategies:
            for symbol in strategy["symbols"]:
                mapping_rows.append(
                    {
                        "Strategy": strategy["strategy_name"],
                        "Class": strategy["class_name"],
                        "Symbol": symbol,
                        "Module": strategy["module_name"],
                    }
                )
        st.dataframe(pd.DataFrame(mapping_rows), use_container_width=True, hide_index=True)

        st.subheader("Operator Notes")
        st.info(
            "This dashboard is a monitoring and preview surface. If OpenAlgo is offline, your strategies can still "
            "be watched here with synthetic market data, but live order execution will not succeed until the broker "
            "endpoint is running."
        )
