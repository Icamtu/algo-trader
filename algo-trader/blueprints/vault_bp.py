from flask import Blueprint, jsonify, request
import logging
import os
from core.context import app_context
from utils.auth import require_auth
from services.asset_vault import get_vault

logger = logging.getLogger(__name__)
vault_bp = Blueprint('vault_bp', __name__)

@vault_bp.route("/api/v1/vault/list", methods=["GET"])
@require_auth
def vault_list():
    try:
        asset_type = request.args.get("type")
        tags = request.args.getlist("tags")
        assets = get_vault().list_assets(asset_type, tags if tags else None)
        return jsonify({"status": "success", "assets": assets}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@vault_bp.route("/api/v1/vault/register", methods=["POST"])
@require_auth
def vault_register():
    try:
        data = request.json
        if not data or "name" not in data or "content" not in data:
            return jsonify({"error": "Missing name or content"}), 400

        asset_id = get_vault().register_asset(
            name=data["name"],
            asset_type=data.get("asset_type", "strategy"),
            file_content=data["content"],
            description=data.get("description", ""),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            version=data.get("version", "1.0.0")
        )
        return jsonify({"status": "success", "asset_id": asset_id}), 201
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@vault_bp.route("/api/v1/vault/details/<int:asset_id>", methods=["GET"])
@require_auth
def vault_details(asset_id):
    try:
        details = get_vault().get_asset_details(asset_id)
        if not details:
            return jsonify({"error": "Asset not found"}), 404
        return jsonify({"status": "success", "asset": details}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@vault_bp.route("/api/v1/vault/search", methods=["POST"])
@require_auth
def vault_search():
    try:
        data = request.json
        term = data.get("term", "")
        results = get_vault().search_assets(term)
        return jsonify({"status": "success", "assets": results}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@vault_bp.route("/api/v1/vault/content/<int:asset_id>", methods=["GET"])
@require_auth
def vault_content(asset_id):
    try:
        details = get_vault().get_asset_details(asset_id)
        if not details:
            return jsonify({"error": "Asset not found"}), 404

        vault_base = os.path.abspath(os.getenv("VAULT_STORAGE_PATH", "/app/storage/vault"))
        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        abs_path = os.path.abspath(os.path.normpath(os.path.join(vault_base, details["file_path"])))

        # Defense-in-depth: Ensure path is within vault
        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        if os.path.commonpath([vault_base, abs_path]) != vault_base:
            return jsonify({"error": "Forbidden path"}), 403

        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        if not os.path.exists(abs_path):
            return jsonify({"error": "File missing on disk"}), 404

        # codeql[py/path-injection]
        # lgtm[py/path-injection]
        with open(abs_path, "r") as f:
            content = f.read()
        return jsonify({"status": "success", "content": content}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500
