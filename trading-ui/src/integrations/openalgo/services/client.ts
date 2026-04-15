import axios from 'axios'
import { CONFIG } from '@/lib/config'

const API_BASE_URL = CONFIG.API_BASE_URL

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
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
  baseURL: API_BASE_URL,
  withCredentials: true,
})

// Helper to fetch CSRF token
export async function fetchCSRFToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
    credentials: 'include',
  })
  const data = await response.json()
  return data.csrf_token
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
