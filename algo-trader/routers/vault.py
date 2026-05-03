from fastapi import APIRouter, Request, HTTPException, Depends, Query
import logging
import os
from typing import List, Optional, Dict, Any
from services.asset_vault import get_vault
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vault", tags=["Vault"])

class VaultRegisterRequest(BaseModel):
    name: str
    content: str
    asset_type: Optional[str] = "strategy"
    description: Optional[str] = ""
    tags: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = {}
    version: Optional[str] = "1.0.0"

class VaultSearchRequest(BaseModel):
    term: str

@router.get("/list")
@router.get("/assets")
async def vault_list(type: Optional[str] = None, tags: Optional[List[str]] = Query(None)):
    """FastAPI port of /api/v1/vault/list."""
    try:
        assets = get_vault().list_assets(type, tags)
        return {"status": "success", "assets": assets}
    except Exception as e:
        logger.error(f"Vault list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register")
async def vault_register(request: VaultRegisterRequest):
    """FastAPI port of /api/v1/vault/register."""
    try:
        asset_id = get_vault().register_asset(
            name=request.name,
            asset_type=request.asset_type,
            file_content=request.content,
            description=request.description,
            tags=request.tags,
            metadata=request.metadata,
            version=request.version
        )
        return {"status": "success", "asset_id": asset_id}
    except Exception as e:
        logger.error(f"Vault register error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/details/{asset_id}")
async def vault_details(asset_id: int):
    """FastAPI port of /api/v1/vault/details/{asset_id}."""
    try:
        details = get_vault().get_asset_details(asset_id)
        if not details:
            raise HTTPException(status_code=404, detail="Asset not found")
        return {"status": "success", "asset": details}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Vault details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def vault_search(request: VaultSearchRequest):
    """FastAPI port of /api/v1/vault/search."""
    try:
        results = get_vault().search_assets(request.term)
        return {"status": "success", "assets": results}
    except Exception as e:
        logger.error(f"Vault search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/content/{asset_id}")
async def vault_content(asset_id: int):
    """FastAPI port of /api/v1/vault/content/{asset_id}."""
    try:
        details = get_vault().get_asset_details(asset_id)
        if not details:
            raise HTTPException(status_code=404, detail="Asset not found")

        storage_path = os.getenv("VAULT_STORAGE_PATH", "/app/storage/vault")
        abs_path = os.path.join(storage_path, details["file_path"])
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="File missing on disk")

        with open(abs_path, "r") as f:
            content = f.read()
        return {"status": "success", "content": content}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Vault content error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
