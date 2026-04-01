import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALGO_TRADER_URL = process.env.ALGO_TRADER_API_URL || 'http://localhost:5001';

export const GET: RequestHandler = async () => {
  try {
    const response = await fetch(`${ALGO_TRADER_URL}/api/pnl`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return json({ error: `Backend error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return json(data);
  } catch (error) {
    console.error('Error fetching P&L:', error);
    return json({ error: 'Failed to fetch P&L from algo-trader' }, { status: 503 });
  }
};
