// src/components/DoubleDownModal.jsx
import React from "react";
import "../styles/DoubleDownModal.css"; // style file you'll create

export default function DoubleDownModal({ visible, onAccept, onDecline }) {
  if (!visible) return null;

  return (
    <div className="dd-modal-backdrop">
      <div className="dd-modal">
        <h2>Double Down?</h2>
        <p>
          You can only use <strong>Double Down once per week</strong>.
          If you accept and guess the word within 3 tries, <strong>your troops will double</strong>!
          <br />
          If you fail to guess it in 3 tries, you’ll <strong>lose half the troops</strong> you would have earned.
        </p>
        <div className="dd-buttons">
          <button className="dd-btn accept" onClick={onAccept}>Double Down</button>
          <button className="dd-btn decline" onClick={onDecline}>No Thanks</button>
        </div>
      </div>
    </div>
  );
}
