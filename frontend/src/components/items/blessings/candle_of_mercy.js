export const candleOfMercy = {
  key: 'candle_of_mercy',
  name: 'Candle of Mercy',
  category: 'blessing',
  description: 'In loss, a small ember still answers your name.',
};

export const hasCandleOfMercy = (statusEffects) =>
  statusEffects.some((entry) => entry.effect_key === "candle_of_mercy");
