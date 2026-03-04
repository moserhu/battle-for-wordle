export const guidingLight = {
  key: 'guiding_light',
  name: 'Guiding Light',
  category: 'blessing',
  description: 'Reveal four letters that are not in today\'s answer.',
};

export const getGuidingLightLetters = (statusEffects) => {
  const effect = statusEffects.find((entry) => entry.effect_key === "guiding_light");
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

// Backward-compatible aliases for existing imports.
export const cartographersInsight = guidingLight;
export const getCartographersLetters = getGuidingLightLetters;
