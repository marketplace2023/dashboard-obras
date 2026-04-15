import { API_BASE_URL, AUTH_STORAGE_KEY, type AuthUser } from '@/lib/auth'

function readStoredToken() {
  return window.localStorage.getItem(AUTH_STORAGE_KEY)
}

async function fetchCurrentUser(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Sesion no valida')
  }

  return (await response.json()) as AuthUser
}

function clearStoredSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

function routeForUser(user: Pick<AuthUser, 'role'>) {
  return user.role === 'store' ? '/dashboard/provider' : '/dashboard/consumer'
}

export { readStoredToken, fetchCurrentUser, clearStoredSession, routeForUser }
