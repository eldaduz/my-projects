export default function Modal({ isOpen, title, onClose, children, stackLevel = 'base' }) {
  if (!isOpen) {
    return null;
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className={`modal-backdrop modal-backdrop-${stackLevel}`}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="modal-header">
          <h2 className="modal-title" id="auth-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            aria-label="סגירת חלון"
          >
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
