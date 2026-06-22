import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export function Callback() {
  const navigate = useNavigate()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      navigate('/login', { replace: true })
      return
    }

    fetch('/oidc/callback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Callback failed')
        navigate('/', { replace: true })
      })
      .catch(() => navigate('/login', { replace: true }))
  }, [navigate])

  return <div>Signing in…</div>
}
