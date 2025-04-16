import React from 'react';

export default function WordGrid({ guesses, results }) {
  return (
    <div className="word-grid">
      {guesses.map((row, rowIndex) => (
        <div key={rowIndex} className="word-row">
          {row.map((letter, colIndex) => {
            const result = results[rowIndex]?.[colIndex];
            let bg = "#1e1e1e"; // default

            if (result === "correct") bg = "#538d4e";     // green
            else if (result === "present") bg = "#b59f3b"; // yellow
            else if (result === "absent") bg = "#3a3a3c";  // gray

            return (
              <div
                key={colIndex}
                className="letter-box"
                style={{ backgroundColor: bg, borderColor: "#444" }}
              >
                {letter}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

