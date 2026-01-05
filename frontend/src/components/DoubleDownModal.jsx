// src/components/DoubleDownModal.jsx
import React from "react";
import { createPortal } from "react-dom";
import "../styles/DoubleDownModal.css"; // style file you'll create

export default function DoubleDownModal({ visible, onAccept, onDecline, showActions = true }) {
  if (!visible) return null;

  const handleBackdropClick = (event) => {
    if (!showActions && event.target === event.currentTarget && onDecline) {
      onDecline();
    }
  };

  const modal = (
    <div className="dd-modal-backdrop" onClick={handleBackdropClick}>
      <div className="dd-modal">
        <button
          className="dd-modal-close"
          type="button"
          aria-label="Close"
          onClick={onDecline}
        >
          −
        </button>
        <h2>Double Down?</h2>
        <p>
          You can only use <strong>Double Down once per week</strong>.
          If you accept and guess the word within 3 tries, <strong>your troops will double</strong>.
          <br />
          If you miss, you’ll get <strong>no troops</strong> for the day.
        </p>
        {showActions && (
          <div className="dd-buttons">
            <button className="dd-btn accept" onClick={onAccept}>Double Down</button>
            <button className="dd-btn decline" onClick={onDecline}>No Thanks</button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
