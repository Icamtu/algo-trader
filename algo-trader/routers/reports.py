from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
import io
import csv
import logging
import os
import jwt
from typing import Optional
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Reports"])

_JWT_SECRET = os.environ.get("JWT_SECRET", "")


def _require_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    internal = request.headers.get("X-Internal-Key")
    if internal and internal == _JWT_SECRET:
        return
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Token")
    token = auth.removeprefix("Bearer ").strip()
    try:
        jwt.decode(token, _JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Auth failure: {e}")


@router.get("/trades.csv")
async def export_trades_csv(
    request: Request,
    strategy: Optional[str] = Query(None),
    limit: int = Query(10000, le=50000),
):
    """Export trade log as a CSV file download."""
    _require_auth(request)
    try:
        db = get_trade_logger()
        trades = db.get_trades(limit=limit)
        if strategy:
            trades = [t for t in trades if t.get("strategy") == strategy]

        output = io.StringIO()
        if trades:
            writer = csv.DictWriter(output, fieldnames=trades[0].keys())
            writer.writeheader()
            writer.writerows(trades)
        else:
            output.write("No trades found\n")

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=trades.csv"},
        )
    except Exception as e:
        logger.error(f"CSV export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades.xlsx")
async def export_trades_xlsx(
    request: Request,
    strategy: Optional[str] = Query(None),
    limit: int = Query(10000, le=50000),
):
    """Export trade log as an Excel file download."""
    _require_auth(request)
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=501, detail="pandas not installed")

    try:
        db = get_trade_logger()
        trades = db.get_trades(limit=limit)
        if strategy:
            trades = [t for t in trades if t.get("strategy") == strategy]

        df = pd.DataFrame(trades) if trades else pd.DataFrame()
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Trades")
        output.seek(0)

        return StreamingResponse(
            iter([output.read()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=trades.xlsx"},
        )
    except ImportError:
        raise HTTPException(status_code=501, detail="openpyxl not installed — install it to enable Excel export")
    except Exception as e:
        logger.error(f"XLSX export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
