// frontend/src/components/RulerTitleModal.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/RulerTitleModal.css";

export default function RulerTitleModal({
  visible,
  initialTitle,
  onSave,
  onClose,
}) {
  const [title, setTitle] = useState(initialTitle || "");

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle || "");
    }
  }, [visible, initialTitle]);

  if (!visible) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    onSave(nextTitle);
  };

  const modal = (
    <div className="ruler-modal-backdrop" onClick={handleBackdropClick}>
      <div className="ruler-modal">
        <button
          className="ruler-modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          −
        </button>
        <h2>Set Your Title</h2>
        <p>Choose the name the realm will remember you by.</p>
        <form className="ruler-modal-form" onSubmit={handleSubmit}>
          <input
            className="ruler-modal-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={30}
            placeholder="Current Ruler"
          />
          {title.length >= 30 && (
            <div className="ruler-modal-hint">Max 30 characters.</div>
          )}
          <div className="ruler-modal-actions">
            <button className="ruler-modal-btn primary" type="submit">
              Save
            </button>
            <button className="ruler-modal-btn" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
