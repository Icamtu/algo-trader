import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || 'http://localhost:5001';

export const GET: RequestHandler = async ({ url }) => {
  const limit = url.searchParams.get('limit') || '100';
  const symbol = url.searchParams.get('symbol');
  const strategy = url.searchParams.get('strategy');

  let endpoint = `${ALGO_TRADER_URL}/api/orders?limit=${limit}`;
  if (symbol) endpoint += `&symbol=${symbol}`;
  if (strategy) endpoint += `&strategy=${strategy}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return json({ error: `Backend error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return json({ error: 'Failed to fetch trades from algo-trader' }, { status: 503 });
  }
};
