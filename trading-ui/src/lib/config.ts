export const publicConfig = {
  publicApiUrl: import.meta.env.PUBLIC_API_URL || 'http://100.87.27.92:5000',
  publicWsUrl: import.meta.env.PUBLIC_WS_URL || 'ws://100.87.27.92:8765',
  internalApiUrl: import.meta.env.INTERNAL_API_URL || 'http://openalgo-web:5000'
};
