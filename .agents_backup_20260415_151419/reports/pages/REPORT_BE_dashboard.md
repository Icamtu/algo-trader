# Backend Scanner Report - Dashboard (Index.tsx)

## Endpoints Mapped
The frontend dashboard interfaces heavily with the custom `algo_engine` at Port `18788`. Key endpoints requested by this page logic:
- `/api/v1/positionbook` (GET)
- `/api/v1/pnl` (GET)
- `/api/v1/risk-metrics` (GET)
- `/api/v1/margins` (POST) 
- `/api/v1/placesmartorder` (POST)
- `/api/v1/placeorder` (POST)
- `/api/v1/exitposition` (POST)
- `/api/v1/closeposition` (POST)

## Structure
Routes are primarily defined directly on the `@app` context in `algo-trader/api.py`. A Flask blueprint refactoring may be required later, but functional mappings are mostly correct, routing through proxy-client pattern.

## Status
- Partially implemented. Core positions, PNL, routes exist. 
- Missing or malformed implementations on execution endpoints may emerge in Phase 3 testing.
