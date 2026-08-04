import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  refresh: () => Promise<User | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Re-fetches the session identity. Callers must await this after any flow that
  // mutates the session cookie (login callback, logout) — the provider mounts once
  // for the app lifetime, so it will not otherwise observe a newly issued session.
  const refresh = useCallback(async (): Promise<User | null> => {
    setLoading(true)
    try {
      const me = await apiFetch<User>('/users/me')
      setUser(me)
      return me
    } catch (err: unknown) {
      // Only a 401 is a definitive "no session"; network/5xx errors must not be
      // silently downgraded to an anonymous state.
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
        return null
      }
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh().catch(() => setUser(null))
  }, [refresh])

  const logout = async () => {
    await fetch('/oidc/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
