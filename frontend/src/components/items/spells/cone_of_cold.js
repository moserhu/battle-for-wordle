export const coneOfCold = {
  key: 'cone_of_cold',
  name: 'Cone of Cold',
  category: 'spells',
  description: 'A chill creeps in, dimming sight for a time.',
};

export const hasConeOfCold = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === "cone_of_cold");

export const getConeTurns = (targetEffects, defaultTurns = 2) =>
  hasConeOfCold(targetEffects) ? defaultTurns : 0;

export const decrementConeTurns = (turnsLeft) => Math.max(turnsLeft - 1, 0);

export const getConeOpacity = (currentRow, maxRows) => {
  const progress = Math.min(Math.max(currentRow, 0), maxRows);
  const remaining = Math.max(maxRows - progress, 0);
  return remaining / maxRows;
};

export const shouldShowConeOverlay = (turnsLeft, gameOver) => turnsLeft > 0 && !gameOver;
