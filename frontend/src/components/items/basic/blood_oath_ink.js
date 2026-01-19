export const bloodOathInk = {
  key: 'blood_oath_ink',
  name: 'Blood Oath Ink',
  category: 'basic',
  description: 'Victory stains the tiles with a darker vow.',
};

export const hasBloodOathInk = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === "blood_oath_ink");
