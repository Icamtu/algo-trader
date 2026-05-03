from flask import Blueprint, request, jsonify, send_file
import os
import json
import logging
import asyncpg
from datetime import datetime
from typing import List, Dict, Any, Optional
from core.config import settings

vault_bp = Blueprint('vault', __name__)
logger = logging.getLogger(__name__)

# Connection helper for TimescaleDB
async def get_db_conn():
    db_config = settings.get('database', {}).get('timescale', {})
    conn = await asyncpg.connect(
        user=db_config.get('user', 'postgres'),
        password=db_config.get('password', 'postgres'),
        database=db_config.get('database', 'postgres'),
        host=db_config.get('host', 'timescaledb'),
        port=db_config.get('port', 5432)
    )
    return conn

@vault_bp.route('/list', methods=['GET'])
async def list_assets():
    asset_type = request.args.get('type')
    tags = request.args.getlist('tags')

    conn = await get_db_conn()
    try:
        query = "SELECT * FROM assets"
        params = []
        where_clauses = []

        if asset_type:
            where_clauses.append(f"asset_type = ${len(params)+1}")
            params.append(asset_type)

        if tags:
            where_clauses.append(f"tags && ${len(params)+1}")
            params.append(tags)

        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)

        query += " ORDER BY created_at DESC"

        rows = await conn.fetch(query, *params)
        assets = [dict(row) for row in rows]
        return jsonify({"assets": assets})
    finally:
        await conn.close()

@vault_bp.route('/register', methods=['POST'])
async def register_asset():
    data = request.json
    name = data.get('name')
    asset_type = data.get('asset_type')
    description = data.get('description', '')
    tags = data.get('tags', [])
    version = data.get('version', '1.0.0')
    content = data.get('content', '') # Base64 or string content
    metadata = data.get('metadata', {})

    # 1. Sanitize and Validate
    allowed_types = ["strategy", "dataset", "result", "model"]
    if asset_type not in allowed_types:
        return jsonify({"error": f"Invalid asset type. Must be one of {allowed_types}"}), 400

    safe_name = os.path.basename(name).lower().replace(' ', '_')
    safe_version = os.path.basename(version).replace(' ', '_')

    # 2. Save to storage
    base_storage = settings.get('storage_path', '/app/storage')
    storage_dir = os.path.join(base_storage, 'vault', asset_type)
    os.makedirs(storage_dir, exist_ok=True)

    filename = f"{safe_name}_{safe_version}.dat"
    file_path = os.path.join(storage_dir, filename)

    # Final validation that we haven't escaped the storage base
    if not os.path.abspath(file_path).startswith(os.path.abspath(base_storage)):
        return jsonify({"error": "Access denied: Invalid path construction"}), 403

    with open(file_path, 'w') as f:
        f.write(content)

    conn = await get_db_conn()
    try:
        await conn.execute(
            """INSERT INTO assets (name, asset_type, description, tags, version, file_path, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            name, asset_type, description, tags, version, file_path, json.dumps(metadata)
        )
        return jsonify({"status": "success", "file_path": file_path})
    finally:
        await conn.close()

@vault_bp.route('/details/<int:asset_id>', methods=['GET'])
async def get_details(asset_id):
    conn = await get_db_conn()
    try:
        row = await conn.fetchrow("SELECT * FROM assets WHERE id = $1", asset_id)
        if not row:
            return jsonify({"error": "Asset not found"}), 404
        return jsonify(dict(row))
    finally:
        await conn.close()

@vault_bp.route('/content/<int:asset_id>', methods=['GET'])
async def get_content(asset_id):
    conn = await get_db_conn()
    try:
        row = await conn.fetchrow("SELECT file_path FROM assets WHERE id = $1", asset_id)
        if not row:
            return jsonify({"error": "Asset not found"}), 404

        file_path = row['file_path']
        base_storage = settings.get('storage_path', '/app/storage')
        abs_path = os.path.abspath(file_path)
        
        if not abs_path.startswith(os.path.abspath(base_storage)):
             return jsonify({"error": "Access denied: Forbidden path"}), 403

        if not os.path.exists(abs_path):
            return jsonify({"error": "File missing on storage board"}), 404

        return send_file(abs_path)
    finally:
        await conn.close()

@vault_bp.route('/search', methods=['POST'])
async def search_assets():
    term = request.json.get('term', '')
    conn = await get_db_conn()
    try:
        query = """SELECT * FROM assets
                   WHERE name ILIKE $1 OR description ILIKE $1 OR $2 = ANY(tags)
                   ORDER BY created_at DESC"""
        rows = await conn.fetch(query, f"%{term}%", term)
        return jsonify({"assets": [dict(row) for row in rows]})
    finally:
        await conn.close()
