import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const AUTHORIZE_URL = import.meta.env.VITE_LR_AUTHORIZE_URL as string
const CLIENT_ID = import.meta.env.VITE_LR_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_LR_REDIRECT_URI as string
const RESOURCE = (import.meta.env.VITE_REST_RESOURCE_URL ?? 'http://localhost:3001') as string

const SCOPES = [
  'openid',
  'profile',
  'email',
  'expense:submit',
  'expense:view:own',
  'expense:view:team',
  'expense:view:all',
  'expense:approve',
  'expense:report:generate',
].join(' ')

export function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  const handleLogin = () => {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      resource: RESOURCE,
    })
    window.location.href = `${AUTHORIZE_URL}?${params.toString()}`
  }

  return (
    <div>
      <h1>Expense Management</h1>
      <button type="button" onClick={handleLogin}>
        Sign in with LoginRadius
      </button>
    </div>
  )
}
