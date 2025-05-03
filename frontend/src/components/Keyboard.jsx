import React from 'react';
import '../styles/Keyboard.css';

export default function Keyboard({ onKeyPress, letterStatus }) {
  const keys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];

  const getKeyClass = (key) => {
    const status = letterStatus?.[key.toLowerCase()];
    if (status === 'correct') return 'keyboard-key correct';
    if (status === 'present') return 'keyboard-key present';
    if (status === 'absent') return 'keyboard-key absent';
    return 'keyboard-key';
  };

  return (
    <div className="keyboard-container">
      {keys.map((row, i) => (
        <div key={i} className="keyboard-row">
          {row.map((key) => (
            <button
            key={key}
            className={`keyboard-key ${key === 'Enter' ? 'enter-key' : ''} ${key === '⌫' ? 'delete-key' : ''} ${getKeyClass(key)}`}
            onClick={() => onKeyPress(key)}
          >
            {key}
          </button>          
          ))}
        </div>
      ))}
    </div>
  );
}
