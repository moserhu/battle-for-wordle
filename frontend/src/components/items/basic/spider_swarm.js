import React from 'react';
import spiderSprite from '../../../assets/items/spider_sprite.png';

export const spiderSwarm = {
  key: 'spider_swarm',
  name: 'Spider Swarm',
  category: 'basic',
  description: 'A skittering omen crosses the board.',
};

export const hasSpiderSwarm = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === "spider_swarm");

const SPIDER_CONFIG = {
  mobile: {
    minX: 6,
    maxX: 94,
    minY: 4,
    maxY: 32,
    minHeight: 110,
    maxHeight: 150,
    maxSpiders: 6,
    tickMs: 700,
  },
  desktop: {
    minX: 6,
    maxX: 94,
    minY: 4,
    maxY: 36,
    minHeight: 140,
    maxHeight: 200,
    maxSpiders: 8,
    tickMs: 600,
  },
};

const mirrorX = (value) => 100 - value;

const createSpider = (id, config, overrides = {}) => {
  const height =
    config.minHeight + Math.floor(Math.random() * (config.maxHeight - config.minHeight));
  const width = Math.round(height * 0.9);
  const duration = 8 + Math.random() * 4;
  const { minX, maxX, minY, maxY } = config;
  const randomX = () => minX + Math.random() * (maxX - minX);
  const randomY = () => minY + Math.random() * (maxY - minY);
  const edges = ['left', 'right', 'top', 'bottom'];
  const startEdge = overrides.startEdge || edges[Math.floor(Math.random() * edges.length)];
  let endEdge = overrides.endEdge || edges[Math.floor(Math.random() * edges.length)];
  if (endEdge === startEdge) {
    endEdge = edges[(edges.indexOf(startEdge) + 2) % edges.length];
  }

  const startX = startEdge === 'left' ? -8 : startEdge === 'right' ? 108 : randomX();
  const startY = startEdge === 'top' ? -8 : startEdge === 'bottom' ? maxY + 6 : randomY();
  const endX = endEdge === 'left' ? -8 : endEdge === 'right' ? 108 : randomX();
  const endY = endEdge === 'top' ? -8 : endEdge === 'bottom' ? maxY + 6 : randomY();

  const midX = (startX + endX) / 2 + (Math.random() * 32 - 16);
  const midY = (startY + endY) / 2 + (Math.random() * 28 - 14);
  return {
    id,
    width,
    height,
    pairId: overrides.pairId,
    startX,
    startY,
    endX,
    endY,
    midX,
    midY,
    duration,
    delay: Math.random() * 0.4,
    rotation: 0,
  };
};

const createSpiderPair = (pairId, config) => {
  const base = createSpider(`${pairId}-a`, config, { pairId });
  const mirrored = {
    ...base,
    id: `${pairId}-b`,
    startX: mirrorX(base.startX),
    endX: mirrorX(base.endX),
    midX: mirrorX(base.midX),
  };
  return [base, mirrored];
};

export const useSpiderSwarm = (targetEffects, options = {}) => {
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth
  );
  const config = React.useMemo(
    () => (viewportWidth <= 480 ? SPIDER_CONFIG.mobile : SPIDER_CONFIG.desktop),
    [viewportWidth]
  );
  const maxSpiders = options.maxSpiders ?? (config.maxSpiders * 2);
  const minSpiders = options.minSpiders ?? Math.max(6, config.maxSpiders);
  const [desiredCount, setDesiredCount] = React.useState(minSpiders);

  const [spiders, setSpiders] = React.useState([]);
  const active = hasSpiderSwarm(targetEffects);

  React.useEffect(() => {
    if (!active) {
      setSpiders([]);
      return;
    }

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [active]);

  React.useEffect(() => {
    if (!active) return;

    const nextDesired = maxSpiders;
    setDesiredCount(nextDesired);

    setSpiders(() =>
      Array.from({ length: nextDesired }, (_, index) =>
        createSpiderPair(`${Date.now()}-${index}`, config)
      ).flat()
    );
  }, [active, maxSpiders, config]);

  React.useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setSpiders((prev) => {
        const pairIds = new Set(prev.map((entry) => entry.pairId));
        if (pairIds.size >= desiredCount) {
          return prev;
        }
        return [...prev, ...createSpiderPair(`${Date.now()}-${Math.random()}`, config)];
      });
    }, config.tickMs);

    return () => clearInterval(interval);
  }, [active, config, desiredCount]);

  return { active, spiders };
};

export const getSpiderMotionProps = (spider) => ({
  style: {
    width: `${spider.width}px`,
    height: `${spider.height}px`,
    backgroundImage: `url(${spiderSprite})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    backgroundPosition: 'center',
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
    rotate: 0,
    opacity: [0, 0.9, 0.9, 0],
  },
  transition: {
    duration: spider.duration,
    delay: spider.delay,
    ease: 'easeInOut',
    repeat: Infinity,
    repeatType: 'loop',
    repeatDelay: 0.2,
  },
});
