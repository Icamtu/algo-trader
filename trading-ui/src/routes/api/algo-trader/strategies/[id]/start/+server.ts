import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || 'http://localhost:5001';

export const POST: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/strategies/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return json({ error: `Failed to start strategy: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error(`Error starting strategy ${id}:`, error);
    return json(
      { error: `Failed to start strategy ${id}` },
      { status: 503 }
    );
  }
};
