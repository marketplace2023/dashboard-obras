import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import HomePage from '@/App'
import { ConsumerDashboard } from '@/components/consumer-dashboard'
import { ProviderDashboard } from '@/components/provider-dashboard'
import { type AuthUser } from '@/lib/auth'
import { clearStoredSession, fetchCurrentUser, readStoredToken } from '@/lib/session'
import { PublicProductPage } from '@/pages/public-product-page'
import { PublicStorePage } from '@/pages/public-store-page'

function useSessionState() {
  const [authReady, setAuthReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true
    const storedToken = readStoredToken()

    if (!storedToken) {
      setAuthReady(true)
      return
    }

    const tokenValue = storedToken

    async function hydrate() {
      try {
        const currentUser = await fetchCurrentUser(tokenValue)
        if (!active) return
        setToken(tokenValue)
        setUser(currentUser)
      } catch {
        clearStoredSession()
      } finally {
        if (active) setAuthReady(true)
      }
    }

    void hydrate()

    return () => {
      active = false
    }
  }, [])

  function logout() {
    clearStoredSession()
    setToken(null)
    setUser(null)
  }

  return { authReady, token, user, logout }
}

function ProtectedProviderRoute({ ready, token, user, onLogout }: { ready: boolean; token: string | null; user: AuthUser | null; onLogout: () => void }) {
  if (!ready) return null
  if (!token || !user) return <Navigate to="/" replace />
  if (user.role !== 'store') return <Navigate to="/dashboard/consumer" replace />

  return <ProviderDashboard user={user} token={token} onLogout={onLogout} />
}

function ProtectedConsumerRoute({ ready, token, user, onLogout }: { ready: boolean; token: string | null; user: AuthUser | null; onLogout: () => void }) {
  if (!ready) return null
  if (!token || !user) return <Navigate to="/" replace />
  if (user.role === 'store') return <Navigate to="/dashboard/provider" replace />

  return <ConsumerDashboard user={user} token={token} onLogout={onLogout} />
}

function AppRoutes() {
  const session = useSessionState()

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/productos/:id" element={<PublicProductPage />} />
      <Route path="/proveedores/:id" element={<PublicStorePage />} />
      <Route
        path="/dashboard/provider"
        element={<ProtectedProviderRoute ready={session.authReady} token={session.token} user={session.user} onLogout={session.logout} />}
      />
      <Route
        path="/dashboard/consumer"
        element={<ProtectedConsumerRoute ready={session.authReady} token={session.token} user={session.user} onLogout={session.logout} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes
