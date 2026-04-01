import { json } from "@sveltejs/kit";
const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || "http://localhost:5001";
const GET = async () => {
  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/strategies`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      return json({ error: `Backend error: ${response.statusText}` }, { status: response.status });
    }
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error("Error fetching strategies:", error);
    return json({ error: "Failed to fetch strategies from algo-trader" }, { status: 503 });
  }
};
export {
  GET
};
