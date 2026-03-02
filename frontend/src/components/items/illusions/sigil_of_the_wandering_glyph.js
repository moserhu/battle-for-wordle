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
const NEON_PALETTE = [
  { hex: '#ff2bd6', rgb: '255,43,214', hue: '0deg' },
  { hex: '#00f7ff', rgb: '0,247,255', hue: '72deg' },
  { hex: '#ffe600', rgb: '255,230,0', hue: '128deg' },
  { hex: '#39ff14', rgb: '57,255,20', hue: '172deg' },
  { hex: '#ff6b00', rgb: '255,107,0', hue: '236deg' },
  { hex: '#9d4dff', rgb: '157,77,255', hue: '294deg' },
];

export const WanderingGlyphOverlay = ({ targetEffects, containerRef }) => {
  void containerRef;
  const overlayRef = React.useRef(null);
  const glyphRef = React.useRef(null);
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
      // Keep the glyph fully inside the viewport bounds.
      const minX = 0;
      const maxX = Math.max(window.innerWidth - glyphWidth, 0);
      const minY = 0;
      const maxY = Math.max(window.innerHeight - glyphHeight, 0);
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

    fromCornerRef.current = 0;
    toCornerRef.current = 2;
    colorIdxRef.current = 0;
    applyPalette(colorIdxRef.current);
    glyphRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    segmentStartRef.current = performance.now();
    rafRef.current = window.requestAnimationFrame(step);

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
