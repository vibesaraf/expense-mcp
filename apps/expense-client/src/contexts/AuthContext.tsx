import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<User>('/users/me')
      .then(setUser)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    await fetch('/oidc/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
