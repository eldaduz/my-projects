import { useState } from 'react';
import { loginUser } from '../../api/authApi.js';
import { mapAuthErrorMessage } from '../../utils/errorMessages.js';
import Modal from './Modal.jsx';

export default function LoginModal({
  isOpen,
  onClose,
  onAuthSuccess,
  onSwitchToRegister,
  promptMessage = '',
}) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await loginUser({
        email: formData.email.trim(),
        password: formData.password,
      });

      setFormData({
        email: '',
        password: '',
      });

      onAuthSuccess(response.data.user, response.data.token);
    } catch (error) {
      setErrorMessage(mapAuthErrorMessage(error.message));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} title="התחברות" onClose={onClose} stackLevel="priority">
      {promptMessage ? <p className="auth-modal-note">{promptMessage}</p> : null}

      <form className="auth-modal-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field-label">אימייל</span>
          <input
            className="auth-input"
            type="email"
            name="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={handleChange}
          />
        </label>

        <label className="auth-field">
          <span className="auth-field-label">סיסמה</span>
          <input
            className="auth-input"
            type="password"
            name="password"
            placeholder="הקלידו סיסמה"
            value={formData.password}
            onChange={handleChange}
          />
        </label>

        {errorMessage ? <p className="auth-error-message">{errorMessage}</p> : null}

        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? 'מתחבר...' : 'התחברות'}
        </button>
      </form>

      <div className="auth-switch-row">
        <span className="auth-switch-text">עדיין אין לך חשבון?</span>
        <button
          type="button"
          className="auth-switch-button"
          disabled={isSubmitting}
          onClick={onSwitchToRegister}
        >
          להרשמה
        </button>
      </div>
    </Modal>
  );
}
