import { json } from "@sveltejs/kit";
const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || "http://localhost:5001";
const GET = async () => {
  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/trades/open-positions`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      return json({ error: `Backend error: ${response.statusText}` }, { status: response.status });
    }
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error("Error fetching open positions:", error);
    return json({ error: "Failed to fetch open positions from algo-trader" }, { status: 503 });
  }
};
export {
  GET
};
