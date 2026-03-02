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
  obscuredSightSide = null,
  obscuredSightActive = false,
  timeStopRevealRow = null,
  timeStopRevealedCount = 5,
  timeStopRevealActive = false,
}) {
  const resultClassFor = (result) => {
    if (result === 'correct' || result === 'present' || result === 'absent') {
      return result;
    }
    return '';
  };

  const isObscuredColumn = (colIndex) => {
    if (obscuredSightSide === "left") return colIndex <= 2;
    if (obscuredSightSide === "right") return colIndex >= 2;
    return false;
  };

  return (
    <div className={`word-grid ${className}`}>
      {guesses.map((row, rowIndex) => {
        const isGrayedOut = rowIndex >= maxVisibleRows;
        const isEdictRow = edictRow === rowIndex;
        const isExecutionerRow = executionerRow === rowIndex;
        const safeRow = Array.from({ length: 5 }, (_, idx) => (Array.isArray(row) ? (row[idx] || "") : ""));
        const safeResultRow = Array.from(
          { length: 5 },
          (_, idx) => (Array.isArray(results?.[rowIndex]) ? (results[rowIndex][idx] || null) : null),
        );

        return (
          <div
            key={rowIndex}
            className={`word-row${isEdictRow ? " edict-row" : ""}${isExecutionerRow ? " executioner-row" : ""}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 50px)',
              gap: '8px',
              marginBottom: '6px',
              opacity: isGrayedOut ? 0.3 : 1,
              pointerEvents: isGrayedOut ? 'none' : 'auto',
              '--cell-size': '50px',
              '--cell-gap': '8px',
            }}
          >
            {safeRow.map((letter, colIndex) => {
              const result = safeResultRow[colIndex];
              const isObscuredCell = obscuredSightActive && rowIndex < 2 && isObscuredColumn(colIndex);
              const isTimeStopHidden =
                timeStopRevealActive &&
                timeStopRevealRow === rowIndex &&
                colIndex >= timeStopRevealedCount;
              const isActive =
                rowIndex === currentRow &&
                colIndex === currentCol &&
                letter === "";

              let bg = "#1e1e1e";
              if (result === "correct") bg = correctColor || "#538d4e";
              else if (result === "present") bg = "#b59f3b";
              else if (result === "absent") bg = "#3a3a3c";
              const tileBackground = isObscuredCell ? "#000" : (isTimeStopHidden ? "#1e1e1e" : bg);

              const tileBorder = isObscuredCell ? "1px solid #6a6a6a" : "1px solid #444";
              const tileBoxShadow = isActive
                ? '0 0 8px 3px rgba(255, 255, 255, 0.2)'
                : isObscuredCell
                  ? 'inset 0 0 0 1px #111, 0 0 0 1px rgba(255, 255, 255, 0.08)'
                  : 'none';

              const danceStyle = jesterDance && getJesterDanceStyle
                ? getJesterDanceStyle(`${rowIndex}-${colIndex}`, jesterSeed)
                : null;

              return (
                <div
                  key={colIndex}
                  className={`letter-box ${resultClassFor(result)} ${jesterDance ? "jester-dance" : ""}${isObscuredCell ? ` obscured-cell obscured-${obscuredSightSide}` : ""}`}
                  style={{
                    width: '50px',
                    height: '50px',
                    minWidth: '50px',
                    minHeight: '50px',
                    flex: '0 0 50px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    backgroundColor: tileBackground,
                    border: tileBorder,
                    boxShadow: tileBoxShadow,
                    transition: 'background-color 0.36s ease, color 0.36s ease, border-color 0.36s ease, box-shadow 0.2s ease',
                    borderRadius: '4px',
                    filter: isGrayedOut ? 'grayscale(100%)' : 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    color: (isObscuredCell || isTimeStopHidden) ? 'transparent' : undefined,
                    textShadow: (isObscuredCell || isTimeStopHidden) ? 'none' : undefined,
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
