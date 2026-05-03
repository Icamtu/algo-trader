# algo-trader/api.py
"""
Unified AetherDesk API Gateway.
Bootstraps the Flask application and registers specialized domain Blueprints.
"""

import logging
import os
import asyncio
from typing import Any, Dict
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

# Core Context & Dependency Injection
from core.context import app_context, _memory_log_handler, SYSTEM_START_TIME

# Blueprints
from blueprints.analytics import analytics_bp, init_analytics
from blueprints.action_center import action_center_bp
from blueprints.explorer import explorer_bp
from blueprints.autoresearch_bp import autoresearch_bp
from blueprints.strategies_bp import strategies_bp
from blueprints.auth_bp import auth_bp
from blueprints.vault_bp import vault_bp
from blueprints.risk_bp import risk_bp
from blueprints.system_bp import system_bp
from blueprints.orders_bp import orders_bp
from blueprints.portfolio_bp import portfolio_bp
from blueprints.scanner_bp import scanner_bp

# Services
from execution.action_manager import get_action_manager
from services.historify_service import historify_service
from services.ingestion_scheduler import ingestion_scheduler

logger = logging.getLogger(__name__)

def set_api_context(strategy_runner, order_manager, position_manager, portfolio_manager):
    """Called by main.py to inject core services into the API layer."""
    app_context.update({
        "strategy_runner": strategy_runner,
        "order_manager": order_manager,
        "position_manager": position_manager,
        "portfolio_manager": portfolio_manager
    })

    # Initialize Blueprint-specific service requirements
    init_analytics(order_manager)
    get_action_manager().set_order_manager(order_manager)
    historify_service.set_order_manager(order_manager)

    logger.info("API context and domain services initialized.")

def create_app():
    """Application Factory for AetherDesk Prime API."""
    app = Flask(__name__)

    # Configure CORS
    allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
    CORS(app,
         resources={r"/*": {"origins": allowed_origins}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "X-Trading-Mode", "apikey", "X-Heartbeat-Token", "x-csrftoken"])

    # Register Domain Blueprints
    app.register_blueprint(analytics_bp)
    app.register_blueprint(action_center_bp)
    app.register_blueprint(explorer_bp)
    app.register_blueprint(autoresearch_bp)
    app.register_blueprint(strategies_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(vault_bp)
    app.register_blueprint(risk_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(portfolio_bp)
    app.register_blueprint(scanner_bp)

    # Initialize Background Services
    historify_service.reconcile_jobs()
    ingestion_scheduler.start()

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"status": "error", "message": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Internal Server Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Internal server error"}), 500

    return app

# Placeholder for direct execution (app should ideally be run via WSGI server or main.py)
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=18788) # nosec B104
