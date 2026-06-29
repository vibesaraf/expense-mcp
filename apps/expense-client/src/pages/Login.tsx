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

function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64urlEncode(bytes)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64urlEncode(new Uint8Array(digest))
}

function generateState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64urlEncode(bytes)
}

export function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  const handleLogin = async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    const state = generateState()

    sessionStorage.setItem('pkce_code_verifier', verifier)
    sessionStorage.setItem('pkce_state', state)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      resource: RESOURCE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    })
    window.location.href = `${AUTHORIZE_URL}?${params.toString()}`
  }

  return (
    <div className="login-page">
      <div className="login-topbar">
        <span className="brand">Expenses</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleLogin}>
          Sign In
        </button>
      </div>

      <div className="login-hero">
        <h1>Track your expenses</h1>
        <p>Submit, review, and manage team expenses — all in one place.</p>
        <button type="button" className="btn btn-primary" onClick={handleLogin}>
          Sign in to get started
        </button>
      </div>
    </div>
  )
}
