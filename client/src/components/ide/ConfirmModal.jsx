import React from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Delete",
  confirmVariant = "danger", // "danger" | "primary"
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="ide-modal-backdrop" onClick={onCancel}>
      <div
        className="ide-confirm-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="ide-modal-header">
          <div className="ide-modal-title-wrap">
            {confirmVariant === "danger" ? (
              <AlertTriangle size={18} className="text-rose" />
            ) : null}
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="ide-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ide-modal-body">
          <p>{message}</p>
        </div>

        <div className="ide-modal-footer">
          <button
            type="button"
            className="ide-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={confirmVariant === "danger" ? "ide-btn-danger" : "ide-btn-primary"}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
