export const cartographersInsight = {
  key: 'cartographers_insight',
  name: "Cartographer's Insight",
  category: 'blessing',
  description: 'The map rejects a pair of paths; two letters are cast aside.',
};

export const getCartographersLetters = (statusEffects) => {
  const effect = statusEffects.find((entry) => entry.effect_key === "cartographers_insight");
  const letters = effect?.payload?.unused_letters;
  return Array.isArray(letters) ? letters : [];
};

export const applyAbsentLetters = (letterStatus, letters) => {
  const next = { ...letterStatus };
  letters.forEach((letter) => {
    const key = String(letter).toLowerCase();
    const current = next[key];
    if (current !== "correct" && current !== "present") {
      next[key] = "absent";
    }
  });
  return next;
};
