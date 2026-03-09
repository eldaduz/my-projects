import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { db } from './firebase'

export default function ApiKeySetup({ embedded = false, onClose }) {
  const { user, profile, refreshProfile } = useAuth()
  const [mode, setMode] = useState(profile?.hasApiKey ? 'saved' : 'editing')
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(profile?.hasApiKey ? 'saved' : 'missing')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showValue, setShowValue] = useState(false)

  const saveKey = async () => {
    if (!user || !value.trim()) {
      setError('Enter a Gemini API key before saving.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await setDoc(doc(db, 'codeDojo_users', user.uid, 'secrets', 'apiKey'), {
        key: value.trim(),
        updatedAt: serverTimestamp(),
      })
      await setDoc(
        doc(db, 'codeDojo_users', user.uid),
        { hasApiKey: true, keyUpdatedAt: serverTimestamp() },
        { merge: true },
      )
      await refreshProfile()
      setMode('saved')
      setStatus('saved')
      setValue('')
    } catch (saveError) {
      setError(saveError.message || 'Failed to save API key.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={`api-key-setup panel ${embedded ? 'embedded' : ''}`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Secure Setup</span>
          <h2>Connect your Gemini API key</h2>
        </div>
        {embedded && onClose ? (
          <button id="api-key-close" type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <div className="setup-stepper" aria-label="API key setup steps">
        <div className="setup-step current">
          <span>1</span>
          <strong>Visit AI Studio</strong>
        </div>
        <div className="setup-step-line" />
        <div className="setup-step current">
          <span>2</span>
          <strong>Create API Key</strong>
        </div>
        <div className="setup-step-line" />
        <div className={`setup-step ${mode === 'saved' ? 'done' : 'current'}`}>
          <span>{mode === 'saved' ? '✓' : '3'}</span>
          <strong>Paste Below</strong>
        </div>
      </div>

      <ol className="setup-steps">
        <li>
          Visit{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          .
        </li>
        <li>Click “Create API Key” and select a project.</li>
        <li>Copy the key and paste it here. The browser never reads it back once saved.</li>
      </ol>

      <p className={`message ${status === 'saved' ? 'success' : 'warning'}`}>
        {status === 'saved' ? 'API key saved.' : 'No API key yet.'}
      </p>

      {mode === 'saved' ? (
        <div className="inline-actions">
          <button
            id="api-key-update"
            type="button"
            className="btn-secondary"
            onClick={() => setMode('editing')}
          >
            Update Key
          </button>
        </div>
      ) : (
        <div className="stack-md">
          <label className="field">
            <span>Gemini API key</span>
            <div className="password-field">
              <input
                id="api-key-input"
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Paste API key"
              />
              <button
                type="button"
                className="btn-ghost password-toggle"
                onClick={() => setShowValue((currentValue) => !currentValue)}
              >
                {showValue ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          {error && <p className="message error">{error}</p>}
          <div className="inline-actions">
            <button
              id="api-key-save"
              type="button"
              className="btn-primary"
              onClick={saveKey}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Key'}
            </button>
            {profile?.hasApiKey && (
              <button
                id="api-key-cancel"
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setMode('saved')
                  setValue('')
                  setError('')
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
