import React from 'react';

export default function WordGrid({ guesses, results, currentRow, currentCol, maxVisibleRows = 6 }) {
  return (
    <div className="word-grid">
      {guesses.map((row, rowIndex) => {
        const isGrayedOut = rowIndex >= maxVisibleRows;

        return (
          <div
            key={rowIndex}
            className="word-row"
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '6px',
              opacity: isGrayedOut ? 0.3 : 1,
              pointerEvents: isGrayedOut ? 'none' : 'auto',
            }}
          >
            {row.map((letter, colIndex) => {
              const result = results[rowIndex]?.[colIndex];
              const isActive =
                rowIndex === currentRow &&
                colIndex === currentCol &&
                letter === "";

              let bg = "#1e1e1e";
              if (result === "correct") bg = "#538d4e";
              else if (result === "present") bg = "#b59f3b";
              else if (result === "absent") bg = "#3a3a3c";

              return (
                <div
                  key={colIndex}
                  className="letter-box"
                  style={{
                    width: '50px',
                    height: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    backgroundColor: bg,
                    border: '1px solid #444',
                    boxShadow: isActive ? '0 0 8px 3px rgba(255, 255, 255, 0.2)' : 'none',
                    transition: 'box-shadow 0.2s ease',
                    borderRadius: '4px',
                    filter: isGrayedOut ? 'grayscale(100%)' : 'none',
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
