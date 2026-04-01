import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type OpenAlgoJson = {
  status?: string;
  message?: string;
  api_key?: string;
  websocket_url?: string;
};

const DEFAULT_API_URL = 'http://100.87.27.92:5000';
const DEFAULT_WS_URL = 'ws://100.87.27.92:8765';

export const GET: RequestHandler = async ({ request }) => {
  const cookie = request.headers.get('cookie');
  if (!cookie) {
    return withNoStore(
      json(
        {
          status: 'error',
          message: 'OpenAlgo session cookie not found. Log in to OpenAlgo on the same host first.'
        },
        { status: 401 }
      )
    );
  }

  const apiBaseUrl = resolveApiBaseUrl();

  try {
    const [configResult, apiKeyResult] = await Promise.all([
      fetchOpenAlgoJson(`${apiBaseUrl}/api/websocket/config`, cookie),
      fetchOpenAlgoJson(`${apiBaseUrl}/api/websocket/apikey`, cookie)
    ]);

    if (!configResult.response.ok || configResult.data.status !== 'success' || !configResult.data.websocket_url) {
      return withNoStore(
        json(
          {
            status: 'error',
            message:
              configResult.data.message ||
              'OpenAlgo did not return a websocket configuration for this session.'
          },
          { status: configResult.response.status || 502 }
        )
      );
    }

    if (!apiKeyResult.response.ok || apiKeyResult.data.status !== 'success' || !apiKeyResult.data.api_key) {
      return withNoStore(
        json(
          {
            status: 'error',
            message:
              apiKeyResult.data.message ||
              'OpenAlgo did not return an API key for websocket authentication.'
          },
          { status: apiKeyResult.response.status || 502 }
        )
      );
    }

    const websocketUrl = env.PUBLIC_WS_URL || configResult.data.websocket_url || DEFAULT_WS_URL;

    return withNoStore(
      json({
        status: 'success',
        apiBaseUrl,
        apiKey: apiKeyResult.data.api_key,
        websocketUrl,
        rawWebsocketUrl: configResult.data.websocket_url
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    return withNoStore(
      json(
        {
          status: 'error',
          message: `Unable to reach OpenAlgo websocket session endpoints: ${message}`
        },
        { status: 502 }
      )
    );
  }
};

async function fetchOpenAlgoJson(url: string, cookie: string): Promise<{
  response: Response;
  data: OpenAlgoJson;
}> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      cookie
    }
  });

  let data: OpenAlgoJson = {};
  try {
    data = (await response.json()) as OpenAlgoJson;
  } catch {
    data = {
      status: 'error',
      message: `OpenAlgo returned a non-JSON response for ${url}.`
    };
  }

  return { response, data };
}

function resolveApiBaseUrl(): string {
  return (env.INTERNAL_API_URL || env.PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}

function withNoStore(response: Response): Response {
  response.headers.set('cache-control', 'no-store');
  return response;
}
