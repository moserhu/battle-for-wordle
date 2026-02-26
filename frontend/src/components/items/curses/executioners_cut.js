export const executionersCut = {
  key: 'executioners_cut',
  name: "Executioner's Axe",
  category: 'curse',
  description: 'One chance is taken before the battle begins.',
};

export const hasExecutionersCut = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === 'executioners_cut');
