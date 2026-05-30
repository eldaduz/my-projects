import { useState } from 'react';
import { registerUser } from '../../api/authApi.js';
import { mapAuthErrorMessage } from '../../utils/errorMessages.js';
import Modal from './Modal.jsx';

export default function RegisterModal({ isOpen, onClose, onAuthSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    fullName: '',
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
      const response = await registerUser({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      setFormData({
        fullName: '',
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
    <Modal isOpen={isOpen} title="הרשמה" onClose={onClose} stackLevel="priority">
      <form className="auth-modal-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field-label">שם מלא</span>
          <input
            className="auth-input"
            type="text"
            name="fullName"
            placeholder="הקלידו שם מלא"
            value={formData.fullName}
            onChange={handleChange}
          />
        </label>

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
            placeholder="לפחות 8 תווים"
            value={formData.password}
            onChange={handleChange}
          />
        </label>

        {errorMessage ? <p className="auth-error-message">{errorMessage}</p> : null}

        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? 'נרשם...' : 'הרשמה'}
        </button>
      </form>

      <div className="auth-switch-row">
        <span className="auth-switch-text">כבר יש לך חשבון?</span>
        <button
          type="button"
          className="auth-switch-button"
          disabled={isSubmitting}
          onClick={onSwitchToLogin}
        >
          להתחברות
        </button>
      </div>
    </Modal>
  );
}
