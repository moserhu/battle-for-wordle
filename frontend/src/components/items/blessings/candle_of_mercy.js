export const candleOfMercy = {
  key: 'candle_of_mercy',
  name: 'Candle of Mercy',
  category: 'blessing',
  description: 'Redeem after a failed day for +10 troops, or use in place of blessing troop sacrifice.',
};

export const hasCandleOfMercy = (statusEffects) =>
  statusEffects.some((entry) => entry.effect_key === "candle_of_mercy");
