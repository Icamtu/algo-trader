# Risk Scanner Report - Dashboard (Index.tsx)

## Execution Validations
- Both client-side inputs and pre-execution guards are placed around the `<NewOrderModal />`. Checks ensure positive integer volume, and acceptable pricing thresholds for limit orders.
- It provides rapid kill switches (`handleKillAll` and `handleKill`) straight to the algo engine for instant liquidation.

## Execution Friction / Risk Authority
- **BLOCKER**: The `handleSubmit` method explicitly calls `await algoApi.getMargins(orderPayload)` to perform an upstream validation step before submitting the actual order via `algoApi.placeOrder`. There is *no implemented /api/v1/margins* route in the engine (`api.py`), meaning any attempt to place an order via the UI will immediately trigger a 404/500 margin block failure and abort the transaction.

## Status
- Hard blocker preventing trade order relay. Needs backend fallback or margin-calculation route inclusion.
