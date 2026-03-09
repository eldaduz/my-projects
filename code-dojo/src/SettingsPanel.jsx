import { useState } from 'react'
import ApiKeySetup from './ApiKeySetup'
import ModalShell from './ModalShell'

export default function SettingsPanel({ profile, theme, onSaveTheme, onSaveDisplayName, onClose }) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [savingTheme, setSavingTheme] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [showApiEditor, setShowApiEditor] = useState(false)

  const changeTheme = async (nextTheme) => {
    if (nextTheme === theme) return
    setSavingTheme(true)
    try {
      await onSaveTheme(nextTheme)
    } finally {
      setSavingTheme(false)
    }
  }

  const saveDisplayName = async () => {
    setSavingName(true)
    try {
      await onSaveDisplayName(displayName)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <ModalShell className="settings-panel panel" size="md" onClose={onClose}>
      <div className="modal-header">
        <div className="modal-heading">
          <span className="eyebrow">Settings</span>
          <h2>Preferences</h2>
        </div>
        <button
          id="settings-close"
          type="button"
          className="btn-ghost modal-close-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="modal-section settings-grid">
        <section className="panel subtle settings-card">
          <h3>Appearance</h3>
          <p className="message">Choose how Code Dojo looks for this account.</p>
          <div className="theme-choice-row" role="radiogroup" aria-label="Theme selection">
            <button
              id="settings-theme-light"
              type="button"
              className={`theme-choice ${theme === 'light' ? 'active' : ''}`}
              onClick={() => changeTheme('light')}
              disabled={savingTheme}
            >
              <strong>Light</strong>
              <span>Soft paper workspace</span>
            </button>
            <button
              id="settings-theme-dark"
              type="button"
              className={`theme-choice ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => changeTheme('dark')}
              disabled={savingTheme}
            >
              <strong>Dark</strong>
              <span>Night dojo workspace</span>
            </button>
          </div>
        </section>

        <section className="panel subtle settings-card">
          <h3>Profile</h3>
          <label className="field">
            <span>Display name</span>
            <input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button
              id="settings-save-display-name"
              type="button"
              className="btn-primary"
              onClick={saveDisplayName}
              disabled={savingName}
            >
              {savingName ? 'Saving...' : 'Save Name'}
            </button>
          </div>
        </section>
      </div>

      <section className="panel subtle settings-card modal-section">
        <div className="modal-subheader">
          <div className="modal-heading">
            <h3>Gemini API Key</h3>
            <p className={`message ${profile?.hasApiKey ? 'success' : 'warning'}`}>
              {profile?.hasApiKey ? 'API key saved for this account.' : 'No API key saved yet.'}
            </p>
          </div>
          <button
            id="settings-toggle-api"
            type="button"
            className="btn-secondary"
            onClick={() => setShowApiEditor((currentValue) => !currentValue)}
          >
            {showApiEditor ? 'Hide Editor' : profile?.hasApiKey ? 'Replace Key' : 'Add Key'}
          </button>
        </div>

        {showApiEditor ? (
          <ApiKeySetup embedded />
        ) : (
          <p className="message">
            Your key is stored in Firebase and only used server-side for submissions.
          </p>
        )}
      </section>
    </ModalShell>
  )
}
