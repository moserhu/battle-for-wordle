import React from 'react';

export default function Keyboard({ onKeyPress, letterStatus }) {
  const keys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];

  const getKeyStyle = (key) => {
    const status = letterStatus?.[key.toLowerCase()];
    if (status === 'correct') return { backgroundColor: '#538d4e', color: 'white' }; // green
    if (status === 'present') return { backgroundColor: '#b59f3b', color: 'white' }; // yellow
    if (status === 'absent') return { backgroundColor: '#3a3a3c', color: 'white' };  // dark gray
    return { backgroundColor: '#666', color: 'white' }; // default
  };

  return (
    <div>
      {keys.map((row, i) => (
        <div key={i} className="keyboard-row" style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
          {row.map((key) => (
            <button
              key={key}
              className="keyboard-key"
              style={{ ...getKeyStyle(key), padding: '12px', border: 'none', borderRadius: '4px' }}
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
