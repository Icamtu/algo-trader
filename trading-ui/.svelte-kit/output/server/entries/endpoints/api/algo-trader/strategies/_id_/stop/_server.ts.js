import { json } from "@sveltejs/kit";
const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || "http://localhost:5001";
const POST = async ({ params }) => {
  const { id } = params;
  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/strategies/${id}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      return json({ error: `Failed to stop strategy: ${response.statusText}` }, { status: response.status });
    }
    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error(`Error stopping strategy ${id}:`, error);
    return json(
      { error: `Failed to stop strategy ${id}` },
      { status: 503 }
    );
  }
};
export {
  POST
};
