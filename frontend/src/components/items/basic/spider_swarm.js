import React from 'react';

export const spiderSwarm = {
  key: 'spider_swarm',
  name: 'Spider Swarm',
  category: 'basic',
  description: 'A skittering omen crosses the board.',
};

export const hasSpiderSwarm = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === "spider_swarm");

const createSpider = (id) => {
  const size = 14 + Math.floor(Math.random() * 14);
  const duration = 4 + Math.random() * 5;
  const edge = Math.floor(Math.random() * 4);
  let startX = -8;
  let startY = 10 + Math.random() * 80;
  let endX = 108;
  let endY = 10 + Math.random() * 80;

  if (edge === 1) {
    startX = 108;
    endX = -8;
  } else if (edge === 2) {
    startX = 10 + Math.random() * 80;
    startY = -8;
    endX = 10 + Math.random() * 80;
    endY = 108;
  } else if (edge === 3) {
    startX = 10 + Math.random() * 80;
    startY = 108;
    endX = 10 + Math.random() * 80;
    endY = -8;
  }

  const midX = (startX + endX) / 2 + (Math.random() * 24 - 12);
  const midY = (startY + endY) / 2 + (Math.random() * 24 - 12);
  return {
    id,
    size,
    startX,
    startY,
    endX,
    endY,
    midX,
    midY,
    duration,
    delay: Math.random() * 0.6,
    rotation: Math.random() > 0.5 ? 360 : -360,
  };
};

export const useSpiderSwarm = (targetEffects, options = {}) => {
  const maxSpiders = options.maxSpiders ?? 6;
  const spawnChance = options.spawnChance ?? 0.65;
  const tickMs = options.tickMs ?? 1200;

  const [spiders, setSpiders] = React.useState([]);
  const active = hasSpiderSwarm(targetEffects);

  React.useEffect(() => {
    if (!active) {
      setSpiders([]);
      return;
    }

    let idCounter = 0;
    const interval = setInterval(() => {
      setSpiders((prev) => {
        if (prev.length >= maxSpiders || Math.random() > spawnChance) {
          return prev;
        }
        const nextId = Date.now() + idCounter;
        idCounter += 1;
        return [...prev, createSpider(nextId)];
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [active, maxSpiders, spawnChance, tickMs]);

  React.useEffect(() => {
    if (!active) return;
    if (spiders.length === 0) return;

    const timeouts = spiders.map((spider) => {
      const ttl = (spider.duration + spider.delay) * 1000 + 250;
      return setTimeout(() => {
        setSpiders((prev) => prev.filter((entry) => entry.id !== spider.id));
      }, ttl);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [spiders, active]);

  return { active, spiders };
};

export const getSpiderMotionProps = (spider) => ({
  style: {
    width: `${spider.size}px`,
    height: `${spider.size}px`,
  },
  initial: {
    x: `${spider.startX}vw`,
    y: `${spider.startY}vh`,
    rotate: 0,
    opacity: 0,
  },
  animate: {
    x: [`${spider.startX}vw`, `${spider.midX}vw`, `${spider.endX}vw`],
    y: [`${spider.startY}vh`, `${spider.midY}vh`, `${spider.endY}vh`],
    rotate: [0, spider.rotation * 0.5, spider.rotation],
    opacity: [0, 0.85, 0.85, 0],
  },
  transition: {
    duration: spider.duration,
    delay: spider.delay,
    ease: 'easeInOut',
  },
});
