// frontend/src/components/DayReplayInfoModal.jsx
import React from "react";
import { createPortal } from "react-dom";
import "../styles/DoubleDownModal.css";

export default function DayReplayInfoModal({ visible, onClose }) {
  if (!visible) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  };

  const modal = (
    <div className="dd-modal-backdrop" onClick={handleBackdropClick}>
      <div className="dd-modal">
        <button
          className="dd-modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          −
        </button>
        <h2>Previous Days</h2>
        <p>
          You can play missed days, but they <strong>won't increase your streak</strong>.
          <br />
          Double Down <strong>cannot</strong> be used on <strong>previous days</strong>.
          <br />
          You will gain <strong>troops</strong> and <strong>coins</strong> like normal.
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
