import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  roles?: string[]
}

export function ProtectedRoute({ roles }: Props) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.some(r => user.roles.includes(r))) return <Navigate to="/" replace />
  return <Outlet />
}
