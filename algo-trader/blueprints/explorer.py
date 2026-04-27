import os
import logging
from flask import Blueprint, jsonify, request
from services.fs_service import FSService
from utils.auth import require_auth

logger = logging.getLogger(__name__)

explorer_bp = Blueprint('explorer', __name__)

# Initialize FS Service pointing to strategies directory
STRAT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
fs = FSService(STRAT_DIR)

@explorer_bp.route("/api/v1/explorer/tree", methods=["GET"])
@require_auth
def get_explorer_tree():
    """Returns a recursive tree of the strategies directory."""
    try:
        path = request.args.get("path", ".")
        tree = fs.get_tree(path)
        return jsonify({"tree": tree}), 200
    except PermissionError:
        return jsonify({"error": "Access denied"}), 403
    except Exception as e:
        logger.error(f"Explorer tree error: {e}")
        return jsonify({"error": str(e)}), 500

@explorer_bp.route("/api/v1/explorer/file", methods=["GET"])
@require_auth
def get_explorer_file():
    """Returns the content of a specific file."""
    try:
        path = request.args.get("path")
        if not path:
            return jsonify({"error": "Path required"}), 400
        content = fs.read_file(path)
        return jsonify({"content": content, "path": path}), 200
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@explorer_bp.route("/api/v1/explorer/save", methods=["POST"])
@require_auth
def save_explorer_file():
    """Saves content to a specific file."""
    try:
        data = request.json
        path = data.get("path")
        content = data.get("content")
        if not path or content is None:
            return jsonify({"error": "Path and content required"}), 400
        fs.write_file(path, content)
        return jsonify({"status": "success", "path": path}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@explorer_bp.route("/api/v1/explorer/delete", methods=["DELETE"])
@require_auth
def delete_explorer_item():
    """Deletes a file or folder."""
    try:
        path = request.args.get("path")
        if not path:
            return jsonify({"error": "Path required"}), 400
        fs.delete_item(path)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
