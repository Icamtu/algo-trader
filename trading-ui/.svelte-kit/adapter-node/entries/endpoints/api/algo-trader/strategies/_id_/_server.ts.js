import { json } from "@sveltejs/kit";
const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || "http://localhost:5001";
const GET = async ({ params }) => {
  const { id } = params;
  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/strategies/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      return json({ error: `Strategy not found or backend error` }, { status: response.status });
    }
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error(`Error fetching strategy ${id}:`, error);
    return json(
      { error: `Failed to fetch strategy ${id} from algo-trader` },
      { status: 503 }
    );
  }
};
export {
  GET
};
