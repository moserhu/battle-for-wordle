import React from 'react';
import bounceLogo from '../../../assets/items/illusions/bounce_logo.png';

export const sigilOfTheWanderingGlyph = {
  key: 'sigil_of_the_wandering_glyph',
  name: 'Sigil of the Wandering Glyph',
  category: 'illusion',
  description: 'A bouncing rune ricochets around the screen.',
};

export const hasWanderingGlyph = (targetEffects) =>
  targetEffects.some((entry) => entry.item_key === 'sigil_of_the_wandering_glyph');

const GLYPH_SPEED_PX_PER_SEC = 180;
const DEFAULT_HITBOX = { left: 0, top: 0, right: 1, bottom: 1 };
const GLYPH_HITBOX_HORIZONTAL_INSET = 0.105;
const GLYPH_HITBOX_ALPHA_THRESHOLD = 40;
const NEON_PALETTE = [
  { hex: '#ff00a8', rgb: '255,0,168', hue: '0deg' },
  { hex: '#00f0ff', rgb: '0,240,255', hue: '58deg' },
  { hex: '#39ff14', rgb: '57,255,20', hue: '116deg' },
  { hex: '#fff200', rgb: '255,242,0', hue: '174deg' },
  { hex: '#ff5f1f', rgb: '255,95,31', hue: '236deg' },
  { hex: '#b300ff', rgb: '179,0,255', hue: '296deg' },
];
let hitboxPromise = null;

const clampUnit = (value) => Math.min(1, Math.max(0, value));
const tightenHorizontalHitbox = (hitbox, inset = GLYPH_HITBOX_HORIZONTAL_INSET) => {
  const left = clampUnit(hitbox.left + inset);
  const right = clampUnit(hitbox.right - inset);
  if (right - left < 0.08) {
    return hitbox;
  }
  return { ...hitbox, left, right };
};

const loadGlyphHitbox = () => {
  if (hitboxPromise) return hitboxPromise;
  hitboxPromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(DEFAULT_HITBOX);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_HITBOX);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, width, height).data;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha < GLYPH_HITBOX_ALPHA_THRESHOLD) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
        if (maxX < minX || maxY < minY) {
          resolve(DEFAULT_HITBOX);
          return;
        }
        resolve(tightenHorizontalHitbox({
          left: clampUnit(minX / width),
          top: clampUnit(minY / height),
          right: clampUnit((maxX + 1) / width),
          bottom: clampUnit((maxY + 1) / height),
        }));
      } catch {
        resolve(DEFAULT_HITBOX);
      }
    };
    img.onerror = () => resolve(DEFAULT_HITBOX);
    img.src = bounceLogo;
  });
  return hitboxPromise;
};

export const WanderingGlyphOverlay = ({ targetEffects, containerRef }) => {
  void containerRef;
  const overlayRef = React.useRef(null);
  const glyphRef = React.useRef(null);
  const hitboxRef = React.useRef(DEFAULT_HITBOX);
  const segmentStartRef = React.useRef(0);
  const fromCornerRef = React.useRef(0);
  const toCornerRef = React.useRef(2);
  const colorIdxRef = React.useRef(0);
  const rafRef = React.useRef(null);
  const active = hasWanderingGlyph(targetEffects);

  React.useEffect(() => {
    if (!active || !glyphRef.current || !overlayRef.current) return undefined;
    let isCancelled = false;

    const corners = () => {
      if (!glyphRef.current) {
        return [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ];
      }
      const glyphBounds = glyphRef.current.getBoundingClientRect();
      const glyphWidth = Math.max(1, glyphBounds.width || 1);
      const glyphHeight = Math.max(1, glyphBounds.height || 1);
      const hitbox = hitboxRef.current;
      const navBottom = (() => {
        const nav = document.querySelector('.nav-bar');
        if (!nav) return 0;
        const rect = nav.getBoundingClientRect();
        return Math.max(0, rect.bottom || 0);
      })();
      // Keep the glyph fully inside the viewport bounds.
      const minX = -(glyphWidth * hitbox.left);
      const maxX = Math.max(window.innerWidth - (glyphWidth * hitbox.right), minX);
      const minY = navBottom - (glyphHeight * hitbox.top);
      const maxY = Math.max(window.innerHeight - (glyphHeight * hitbox.bottom), minY);
      return [
        { x: minX, y: minY }, // top-left
        { x: maxX, y: minY }, // top-right
        { x: maxX, y: maxY }, // bottom-right
        { x: minX, y: maxY }, // bottom-left
      ];
    };

    const nextCornerIndex = (idx) => {
      if (idx === 0) return 2;
      if (idx === 2) return 1;
      if (idx === 1) return 3;
      return 0;
    };

    const applyPalette = (paletteIndex) => {
      const swatch = NEON_PALETTE[paletteIndex % NEON_PALETTE.length];
      overlayRef.current.style.setProperty('--glyph-neon-rgb', swatch.rgb);
      overlayRef.current.style.setProperty('--glyph-hue', swatch.hue);
    };
    const applyHitboxVars = () => {
      const hitbox = hitboxRef.current;
      overlayRef.current.style.setProperty('--glyph-hitbox-left', String(hitbox.left));
      overlayRef.current.style.setProperty('--glyph-hitbox-top', String(hitbox.top));
      overlayRef.current.style.setProperty('--glyph-hitbox-right', String(hitbox.right));
      overlayRef.current.style.setProperty('--glyph-hitbox-bottom', String(hitbox.bottom));
    };

    const flashStrobe = () => {
      if (!glyphRef.current) return;
      glyphRef.current.classList.remove('is-strobing');
      void glyphRef.current.offsetWidth;
      glyphRef.current.classList.add('is-strobing');
    };

    const step = (now) => {
      if (isCancelled || !glyphRef.current) return;
      const cornerPoints = corners();
      const fromPoint = cornerPoints[fromCornerRef.current];
      const toPoint = cornerPoints[toCornerRef.current];
      const dist = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
      const segmentDurationMs = Math.max(250, (dist / GLYPH_SPEED_PX_PER_SEC) * 1000);
      const elapsedMs = now - segmentStartRef.current;
      const progress = Math.min(elapsedMs / segmentDurationMs, 1);

      const nextX = fromPoint.x + (toPoint.x - fromPoint.x) * progress;
      const nextY = fromPoint.y + (toPoint.y - fromPoint.y) * progress;

      glyphRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      if (progress >= 1) {
        fromCornerRef.current = toCornerRef.current;
        toCornerRef.current = nextCornerIndex(fromCornerRef.current);
        segmentStartRef.current = now;
        colorIdxRef.current = (colorIdxRef.current + 1) % NEON_PALETTE.length;
        applyPalette(colorIdxRef.current);
        flashStrobe();
      }
      rafRef.current = window.requestAnimationFrame(step);
    };

    const start = async () => {
      const measuredHitbox = await loadGlyphHitbox();
      if (isCancelled || !glyphRef.current || !overlayRef.current) return;
      hitboxRef.current = measuredHitbox;
      applyHitboxVars();
      fromCornerRef.current = 0;
      toCornerRef.current = 2;
      colorIdxRef.current = 0;
      applyPalette(colorIdxRef.current);
      const cornerPoints = corners();
      glyphRef.current.style.transform = `translate3d(${cornerPoints[0].x}px, ${cornerPoints[0].y}px, 0)`;
      segmentStartRef.current = performance.now();
      rafRef.current = window.requestAnimationFrame(step);
    };
    start();

    return () => {
      isCancelled = true;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, containerRef]);

  if (!active) return null;

  return (
    <div className="wandering-glyph-overlay" ref={overlayRef} aria-hidden="true">
      <div className="wandering-glyph-token" ref={glyphRef} data-testid="wandering-glyph">
        <img
          src={bounceLogo}
          alt=""
          className="wandering-glyph-icon"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
};
