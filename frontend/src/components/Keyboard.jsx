import React from 'react';
import '../styles/Keyboard.css';
import hexRuneIcon from '../assets/ui/hex_rune.png';

export default function Keyboard({
  onKeyPress,
  letterStatus,
  className = '',
  jesterDance = false,
  jesterSeed = 0,
  getJesterDanceStyle = null,
  sealedLetter = null,
  voidLetters = [],
  cartographerLetters = [],
  cursedLetters = [],
  obscuredSightSide = null,
  obscuredSightActive = false,
}) {
  const keys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];

  const sealedKey = sealedLetter ? String(sealedLetter).toLowerCase() : null;
  const voidKeys = new Set(voidLetters.map((letter) => String(letter).toLowerCase()));
  const cursedKeys = new Set(cursedLetters.map((letter) => String(letter).toLowerCase()));

  const cartographerSet = new Set(cartographerLetters.map((letter) => String(letter).toLowerCase()));

  const getKeyClass = (key) => {
    const status = letterStatus?.[key.toLowerCase()];
    if (status === 'correct') return 'correct';
    if (status === 'present') return 'present';
    if (status === 'absent') return 'absent';
    return '';
  };  

  const isVeilBlockedKey = (row, colIndex, key) => {
    if (!obscuredSightActive || (obscuredSightSide !== 'left' && obscuredSightSide !== 'right')) {
      return false;
    }
    if (obscuredSightSide === 'left' && key === 'Enter') {
      return false;
    }
    if (obscuredSightSide === 'right' && key === '⌫') {
      return false;
    }
    const midpoint = (row.length - 1) / 2;
    if (obscuredSightSide === 'left') {
      return colIndex < midpoint;
    }
    return colIndex > midpoint;
  };

  return (
    <div className={`keyboard-container ${className}`}>
      {keys.map((row, i) => (
        <div key={i} className="keyboard-row">
          {row.map((key, colIndex) => {
            const lowerKey = key.toLowerCase();
            const isLetter = /^[a-z]$/i.test(key);
            const isSealed = isLetter && sealedKey && sealedKey === lowerKey;
            const isVoid = isLetter && voidKeys.has(lowerKey);
            const isCursed = isLetter && cursedKeys.has(lowerKey);
            const isVeilBlocked = isVeilBlockedKey(row, colIndex, key);
            const isBlocked = isSealed || isVoid;
            const voidStyle = isVoid
              ? {
                  backgroundColor: "#0b0b0f",
                  color: "#a98bff",
                  textShadow: "0 0 6px rgba(140, 90, 255, 0.5)",
                }
              : null;
            const danceStyle = jesterDance && getJesterDanceStyle
              ? getJesterDanceStyle(key, jesterSeed)
              : null;
            return (
              <button
                key={key}
                className={`keyboard-key ${key === 'Enter' ? 'enter-key' : ''} ${key === '⌫' ? 'delete-key' : ''} ${getKeyClass(key)} ${isSealed ? 'sealed-letter' : ''} ${isVoid ? 'void-letter' : ''} ${isCursed ? 'cursed-letter' : ''} ${isVeilBlocked ? 'veil-obscured-key' : ''} ${jesterDance ? 'jester-dance' : ''} ${cartographerSet.has(lowerKey) ? 'cartographer-letter' : ''}`}
                onClick={() => onKeyPress(key)}
                style={
                  voidStyle || danceStyle
                    ? { ...(voidStyle || {}), ...(danceStyle || {}) }
                    : undefined
                }
                disabled={isBlocked}
              >
                {isCursed && <span className="cursed-rune" style={{ backgroundImage: `url(${hexRuneIcon})` }} aria-hidden="true" />}
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
