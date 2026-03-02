import React from 'react';

export const danceOfTheJester = {
  key: 'earthquake',
  name: 'Earthquake',
  category: 'illusion',
  description: 'Shake and jostle all the tiles on the board.',
};

export const hasDanceOfTheJester = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === "earthquake");

const hashToken = (token, seed) => {
  const str = `${token}-${seed}`;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getJesterDanceStyle = (token, seed) => {
  const hash = hashToken(token, seed);
  const delay = (hash % 900) / 1000;
  const duration = 0.7 + ((hash >> 4) % 800) / 1000;
  return {
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  };
};

export const useJesterDance = (targetEffects, intervalMs = 1200) => {
  const [seed, setSeed] = React.useState(0);
  const active = hasDanceOfTheJester(targetEffects);

  React.useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setSeed((prev) => prev + 1);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [active, intervalMs]);

  React.useEffect(() => {
    if (!active) {
      setSeed(0);
    }
  }, [active]);

  return {
    active,
    seed,
    getStyle: getJesterDanceStyle,
  };
};
