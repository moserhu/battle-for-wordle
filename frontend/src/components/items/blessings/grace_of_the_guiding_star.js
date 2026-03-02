export const cartographersInsight = {
  key: 'grace_of_the_guiding_star',
  name: 'Grace of the Guiding Star',
  category: 'blessing',
  description: 'Reveal four letters that are not in today\'s answer.',
};

export const getCartographersLetters = (statusEffects) => {
  const effect = statusEffects.find((entry) => entry.effect_key === "grace_of_the_guiding_star");
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
