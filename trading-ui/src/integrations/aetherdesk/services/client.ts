import axios from 'axios'
import { CONFIG } from '@/lib/config'

const API_BASE_URL = CONFIG.API_BASE_URL

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

export const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  withCredentials: true,
})

export const webClient = axios.create({
  baseURL: `${API_BASE_URL}/`,
  withCredentials: true,
})

// Helper to fetch CSRF token
export async function fetchCSRFToken(): Promise<string> {
  try {
    // Correct institutional path: /api/v1/auth/csrf-token (proxied via /algo-api)
    const response = await fetch('/algo-api/api/v1/auth/csrf-token', {
      credentials: 'include',
    })
    if (!response.ok) return "aether-core-session-token-v1";
    const data = await response.json()
    return data.csrf_token || "aether-core-session-token-v1";
  } catch (err) {
    console.warn("CSRF_HANDSHAKE_FAULT", err);
    return "aether-core-session-token-v1";
  }
}

// Add JWT token to all requests
import { supabase } from '@/integrations/supabase/client'

apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

webClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }

  const method = config.method?.toLowerCase()
  if (method === 'post' || method === 'put' || method === 'delete') {
    try {
      const csrfToken = await fetchCSRFToken()
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken
      }
    } catch {}
  }
  return config
})
