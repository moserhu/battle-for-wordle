export const oracleWhisper = {
  key: 'oracle_whisper',
  name: "Oracle's Whisper",
  category: 'blessing',
  description: 'A whisper of truth slips through, hinting at a single place it belongs.',
};

export const applyOracleCorrectLetter = (letterStatus, hintLetter) => ({
  ...letterStatus,
  [String(hintLetter).toLowerCase()]: "correct",
});

export const getOraclePlacement = (guesses, currentRow, hintScroll) => {
  if (!hintScroll?.letter) return null;
  const rowIndex = currentRow ?? 0;
  const colIndex = Math.max(0, Number(hintScroll.position) - 1);
  const row = guesses[rowIndex];
  if (!row || row[colIndex]) return null;
  return { rowIndex, colIndex, letter: hintScroll.letter };
};
