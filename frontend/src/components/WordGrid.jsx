import React from 'react';

export default function WordGrid({
  guesses,
  results,
  currentRow,
  currentCol,
  maxVisibleRows = 6,
  correctColor,
  className = '',
  jesterDance = false,
  jesterSeed = 0,
  getJesterDanceStyle = null,
  edictRow = null,
  executionerRow = null,
  edictSender = null,
}) {
  return (
    <div className={`word-grid ${className}`}>
      {guesses.map((row, rowIndex) => {
        const isGrayedOut = rowIndex >= maxVisibleRows;
        const isEdictRow = edictRow === rowIndex;
        const isExecutionerRow = executionerRow === rowIndex;

        return (
          <div
            key={rowIndex}
            className={`word-row${isEdictRow ? " edict-row" : ""}${isExecutionerRow ? " executioner-row" : ""}`}
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '6px',
              opacity: isGrayedOut ? 0.3 : 1,
              pointerEvents: isGrayedOut ? 'none' : 'auto',
              '--cell-size': '50px',
              '--cell-gap': '8px',
            }}
          >
            {isEdictRow && edictSender && (
              <div className="edict-label">
                <span className="edict-crown">👑</span>
                <span className="edict-name">{edictSender}</span>
              </div>
            )}
            {row.map((letter, colIndex) => {
              const result = results[rowIndex]?.[colIndex];
              const isActive =
                rowIndex === currentRow &&
                colIndex === currentCol &&
                letter === "";

              let bg = "#1e1e1e";
              if (result === "correct") bg = correctColor || "#538d4e";
              else if (result === "present") bg = "#b59f3b";
              else if (result === "absent") bg = "#3a3a3c";

              const danceStyle = jesterDance && getJesterDanceStyle
                ? getJesterDanceStyle(`${rowIndex}-${colIndex}`, jesterSeed)
                : null;

              return (
                <div
                  key={colIndex}
                  className={`letter-box ${result || ""} ${jesterDance ? "jester-dance" : ""}${isEdictRow ? " edict-cell" : ""}`}
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
                    ...(danceStyle || {}),
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
