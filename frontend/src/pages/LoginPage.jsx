import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { Shield, Eye, EyeOff, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/chat')
    } catch (err) {
  if (err.response) {
    if (err.response.status === 401) {
      setError('Invalid username or password. Please try again.')
    } else {
      setError(`Server Error (${err.response.status}): ${err.response.data?.detail || 'Please try again later.'}`)
    }
  } else if (err.request) {
    setError('Network Error: Unable to connect to the backend server. Please verify if the server is running.')
  } else {
    setError(err.message || 'An unexpected error occurred.')
  }
} finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding: '24px',
    }}>
      {/* Main card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {/* Navy header band */}
        <div style={{
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
          padding: '32px 32px 28px',
          textAlign: 'center',
          position: 'relative',
        }}>
          {/* Subtle Karnataka emblem pattern */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 50%)',
            pointerEvents: 'none',
          }} />

          {/* Logo */}
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '12px',
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            <img
              src="/logo.png"
              alt="Karnataka State Police"
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'contain',
              }}
            />
          </div>

          <h1 style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#fff',
            margin: '0 0 4px',
            letterSpacing: '0.5px',
          }}>Karnataka State Police</h1>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
            margin: 0,
            fontWeight: 500,
            letterSpacing: '0.3px',
          }}>Crime Intelligence & Analytics Portal</p>
        </div>

        {/* Form body */}
        <div style={{ padding: '32px' }}>
          <p style={{
            fontSize: '14px',
            color: '#37474f',
            marginBottom: '24px',
            fontWeight: 500,
          }}>Sign in to continue</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Username */}
            <div>
              <label htmlFor="login-username" style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#546e7a',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>Username / Badge ID</label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #cfd8dc',
                borderRadius: '6px',
                transition: 'border-color 0.2s',
                background: '#fafafa',
              }}>
                <User size={16} style={{ color: '#90a4ae', marginLeft: '12px', flexShrink: 0 }} />
                <input
                  id="login-username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#263238',
                    fontSize: '14px',
                    padding: '12px 12px',
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#546e7a',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>Password</label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '1.5px solid #cfd8dc',
                borderRadius: '6px',
                transition: 'border-color 0.2s',
                background: '#fafafa',
                position: 'relative',
              }}>
                <Lock size={16} style={{ color: '#90a4ae', marginLeft: '12px', flexShrink: 0 }} />
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#263238',
                    fontSize: '14px',
                    padding: '12px 12px 12px 12px',
                    paddingRight: '40px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#90a4ae',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                fontSize: '13px',
                color: '#c62828',
                background: '#ffebee',
                border: '1px solid #ef9a9a',
                borderRadius: '6px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Shield size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-btn"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? '#5c6bc0' : '#1a237e',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'background 0.2s',
                marginTop: '4px',
                letterSpacing: '0.3px',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = '#283593' }}
              onMouseLeave={e => { if (!loading) e.target.style.background = '#1a237e' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 32px',
          borderTop: '1px solid #eceff1',
          background: '#fafafa',
          fontSize: '10px',
          color: '#90a4ae',
          textAlign: 'center',
          lineHeight: '1.5',
          letterSpacing: '0.3px',
        }}>
          Authorised personnel only. Unauthorised access is an offence under the Information Technology Act, 2000.
        </div>
      </div>

      {/* Below-card branding */}
      <p style={{
        marginTop: '20px',
        fontSize: '11px',
        color: '#90a4ae',
        textAlign: 'center',
      }}>
        KSP CrimeIntel v1.0 — Karnataka State Police
      </p>
    </div>
  )
}
