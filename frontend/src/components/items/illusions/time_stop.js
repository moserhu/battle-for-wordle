export const timeStop = {
  key: 'time_stop',
  name: 'Time Stop',
  category: 'illusion',
  description: 'Time slows, delaying result reveals.',
};

export const hasTimeStop = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === 'time_stop');

export const TIME_STOP_REVEAL_DELAY_MS = 1200;
