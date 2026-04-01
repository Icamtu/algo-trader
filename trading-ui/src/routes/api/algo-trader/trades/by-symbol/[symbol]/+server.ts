import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || 'http://localhost:5001';

export const GET: RequestHandler = async ({ params, url }) => {
  const { symbol } = params;
  const limit = url.searchParams.get('limit') || '50';

  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/trades/by-symbol/${symbol}?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return json({ error: `Failed to fetch trades: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error(`Error fetching trades for ${symbol}:`, error);
    return json({ error: `Failed to fetch trades for ${symbol}` }, { status: 503 });
  }
};
