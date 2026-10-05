import { ref } from 'vue'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8086/index.php/api').replace(/\/+$/, '')
const SESSION_KEY = 'ferriol.lab6.session'

function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    return saved?.access_token && saved?.refresh_token ? saved : null
  } catch {
    return null
  }
}

export const session = ref(readSession())
export const sessionNotice = ref('')
let refreshPromise = null

export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export function saveSession(data) {
  if (!data?.access_token || !data?.refresh_token) {
    throw new ApiError('The server did not return a valid login session.')
  }
  const saved = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
  }
  // Keep tokens within this browser tab; never put them in URLs or localStorage.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved))
  session.value = saved
  sessionNotice.value = ''
}

export function clearSession(message = '') {
  sessionStorage.removeItem(SESSION_KEY)
  session.value = null
  sessionNotice.value = message
}

async function send(path, { method = 'GET', body, authenticated = true } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (authenticated && session.value?.access_token) {
      headers.Authorization = `Bearer ${session.value.access_token}`
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    })
    let data
    try {
      data = await response.json()
    } catch {
      throw new ApiError('The server returned an unexpected response. Please try again later.', response.status)
    }
    if (!response.ok) {
      throw new ApiError(data.error || data.message || 'The request could not be completed.', response.status, data.errors || {})
    }
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Reload the product list before retrying a change.')
    }
    throw new ApiError('Could not reach the server. Check your connection; reload the product list before retrying a change.')
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshSession() {
  if (!refreshPromise) {
    const refreshToken = session.value?.refresh_token
    refreshPromise = (async () => {
      try {
        if (!refreshToken) throw new ApiError('Your session has expired.', 401)
        const data = await send('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: refreshToken },
          authenticated: false,
        })
        saveSession(data)
      } catch {
        clearSession('Your session could not be renewed. Please log in again.')
        throw new ApiError('Your session could not be renewed. Please log in again.', 401)
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

export async function api(path, options = {}) {
  try {
    return await send(path, options)
  } catch (error) {
    // Retry only after a rejected authorization, never after a network failure.
    if (error.status === 401 && options.authenticated !== false && options.refresh !== false) {
      await refreshSession()
      try {
        return await send(path, options)
      } catch (retryError) {
        if (retryError.status === 401) clearSession('Your session has expired. Please log in again.')
        throw retryError
      }
    }
    throw error
  }
}
