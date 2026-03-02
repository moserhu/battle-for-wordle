export const executionersCut = {
  key: 'reapers_scythe',
  name: "Reaper's Scythe",
  category: 'curse',
  description: 'Removes the bottom guess row for the day.',
};

export const hasExecutionersCut = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === 'reapers_scythe');
