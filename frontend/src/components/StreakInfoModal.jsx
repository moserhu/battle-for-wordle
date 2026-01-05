// frontend/src/components/StreakInfoModal.jsx
import React from "react";
import { createPortal } from "react-dom";
import "../styles/DoubleDownModal.css";

export default function StreakInfoModal({ visible, onClose }) {
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
        <h2>Streaks</h2>
        <p>
          The <strong>higher</strong> your <strong>streak</strong>, the <strong>better</strong> the shop owner treats you.
          Keep it alive to <strong>unlock</strong> <strong>discounts</strong> and <strong>exclusive items</strong>.
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
