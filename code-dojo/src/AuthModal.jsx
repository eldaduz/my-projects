import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function AuthModal() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'signup') {
        await signup(email.trim(), password, displayName.trim())
      } else {
        await login(email.trim(), password)
      }
    } catch (submitError) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen-center">
      <section className="auth-modal panel">
        <div className="auth-header">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true">
              🏯
            </span>
            <span className="eyebrow">Code Dojo</span>
          </div>
          <h1>Train like a ranked solver.</h1>
          <p>Sign in to track XP, save your API key securely, and unlock the full dojo.</p>
        </div>

        <div className="tab-row" role="tablist" aria-label="Authentication tabs">
          <button
            id="auth-tab-signin"
            type="button"
            className={`tab-button ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => setMode('signin')}
          >
            Sign In
          </button>
          <button
            id="auth-tab-signup"
            type="button"
            className={`tab-button ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        <form className="stack-md auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="field">
              <span>Display name</span>
              <input
                id="auth-display-name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Sensei Ada"
                required
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </label>

          {error && (
            <p className="message error" role="alert" aria-live="assertive">
              {error}
            </p>
          )}

          <button id="auth-submit" type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Loading...' : mode === 'signup' ? 'Create Account' : 'Enter Dojo'}
          </button>
        </form>
      </section>
    </div>
  )
}
