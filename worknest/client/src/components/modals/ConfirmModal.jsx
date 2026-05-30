import Modal from './Modal.jsx';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isSubmitting,
  onClose,
  onConfirm,
}) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose}>
      <div className="section-stack compact-stack">
        <p className="placeholder-copy">{message}</p>

        <div className="card-actions">
          <button
            type="button"
            className="button-link-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button type="button" className="button-link" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'מבטל...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
