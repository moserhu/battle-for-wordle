export const candleOfMercy = {
  key: 'candle_of_mercy',
  name: 'Candle of Mercy',
  category: 'blessing',
  description: 'If you fail, redeem for a 10-troop mercy bonus.',
};

export const hasCandleOfMercy = (statusEffects) =>
  statusEffects.some((entry) => entry.effect_key === "candle_of_mercy");
