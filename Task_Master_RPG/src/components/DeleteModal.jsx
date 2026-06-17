// ──────────────────────────────────────────────
// DeleteModal.jsx — Confirmation Dialog
//
// A modal overlay that asks the user to confirm
// before permanently deleting a quest.
// Clicking the dark backdrop also cancels.
// ──────────────────────────────────────────────

import { X } from 'lucide-react';

export default function DeleteModal({ isOpen, taskTitle, onConfirm, onCancel }) {
  // If the modal is closed, render nothing at all.
  if (!isOpen) return null;

  return (
    // Dark backdrop — clicking it cancels the deletion.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      {/* Modal card — stopPropagation prevents backdrop click from firing */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-surface-2 border border-border-stroke rounded-[16px] p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        <h2 className="text-[20px] font-semibold text-text-primary mb-2">Delete Quest?</h2>
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 hover:bg-surface-1 rounded transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
        <p className="text-[14px] text-text-secondary mb-6">
          Are you sure you want to delete "
          <span className="text-text-primary font-medium">{taskTitle}</span>"? This action cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 px-4 rounded-sm bg-surface-1 border border-border-stroke text-text-primary text-[14px] font-medium hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 px-4 rounded-sm bg-priority-high text-text-primary text-[14px] font-medium hover:bg-priority-high/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
