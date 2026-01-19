// frontend/src/components/CoinsInfoModal.jsx
import React from "react";
import { createPortal } from "react-dom";
import "../styles/DoubleDownModal.css";
import "../styles/CoinsInfoModal.css";

export default function CoinsInfoModal({ visible, onClose }) {
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
        <h2>Coins</h2>
        <p>
          Coins are used in the Store to purchase items, buffs, and debuffs.
          Earn coins by completing the daily word.
        </p>
        <table className="coins-table">
          <thead>
            <tr>
              <th>Result</th>
              <th>Coins</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Complete the word</td><td>4</td></tr>
            <tr><td>Fail the word</td><td>8</td></tr>
          </tbody>
        </table>
        <p className="coins-failure-note">
          Failures pay more than success. Spend wisely.
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
