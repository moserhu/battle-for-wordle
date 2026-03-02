export const bloodOathInk = {
  key: 'phantoms_mirage',
  name: "Phantom's Mirage",
  category: 'illusion',
  description: 'Confirmed green letters appear red instead.',
};

export const hasBloodOathInk = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === "phantoms_mirage");
