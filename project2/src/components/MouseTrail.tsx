import React, { useState, useEffect, useRef, useCallback } from 'react';

// Crisp, luxury golden star SVG images matching Lyka Realty's premium aesthetic
const DEFAULT_STAR_SVGS = [
  // 1. Luxury 4-Point Radiant Sparkle Star
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fef08a"/><stop offset="50%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23b45309"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="1.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M20 2 Q20 16 34 20 Q20 20 20 38 Q20 24 6 20 Q20 20 20 2 Z" fill="url(%23g1)" filter="url(%23glow)"/><circle cx="20" cy="20" r="2.5" fill="%23ffffff"/></svg>`,
  
  // 2. 8-Point Celestial Star
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ffffff"/><stop offset="35%" stop-color="%23fbbf24"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><path d="M20 0 L23 15 L38 20 L23 25 L20 40 L17 25 L2 20 L17 15 Z" fill="url(%23g2)"/><path d="M20 8 L22 17 L30 20 L22 23 L20 32 L18 23 L10 20 L18 17 Z" fill="%23fef3c7" opacity="0.9"/><circle cx="20" cy="20" r="2" fill="%23ffffff"/></svg>`,
  
  // 3. Faceted Dubai Gold 5-Point Star
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fef9c3"/><stop offset="50%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%2392400e"/></linearGradient></defs><polygon points="20,2 25,14 38,14 28,23 32,36 20,28 8,36 12,23 2,14 15,14" fill="url(%23g3)" stroke="%23fef08a" stroke-width="0.8"/><polygon points="20,2 25,14 20,28 15,14" fill="%23fef08a" opacity="0.6"/><circle cx="20" cy="18" r="1.8" fill="%23ffffff"/></svg>`,

  // 4. Diamond Cluster Star
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fffbeb"/><stop offset="40%" stop-color="%23fbbf24"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><path d="M20 4 L23.5 16.5 L36 20 L23.5 23.5 L20 36 L16.5 23.5 L4 20 L16.5 16.5 Z" fill="url(%23g4)"/><circle cx="29" cy="10" r="1.8" fill="%23fde047"/><circle cx="11" cy="29" r="1.5" fill="%23fde047"/><circle cx="20" cy="20" r="2.2" fill="%23ffffff"/></svg>`,

  // 5. Shimmering Starlight Flare
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs><radialGradient id="g5" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23ffffff"/><stop offset="30%" stop-color="%23fde047"/><stop offset="70%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs><circle cx="20" cy="20" r="16" fill="url(%23g5)" opacity="0.3"/><path d="M20 5 L22 18 L35 20 L22 22 L20 35 L18 22 L5 20 L18 18 Z" fill="%23fef08a"/><circle cx="20" cy="20" r="2.2" fill="%23ffffff"/></svg>`
];

export interface TrailItem {
  id: number;
  x: number;
  y: number;
  image: string;
  rotation: number;
  scale: number;
  createdAt: number;
}

export interface MouseTrailProps {
  /** Optional custom images array. Defaults to luxury golden stars if omitted. */
  images?: string[];
  /** Maximum number of active trail images visible at once */
  maxItems?: number;
  /** Distance in pixels cursor must travel before triggering the next trail star */
  distanceThreshold?: number;
  /** Lifespan of each star in milliseconds before disappearing */
  fadeTime?: number;
  /** Size of each star in pixels */
  starSize?: number;
  /** Whether the trail is enabled */
  enabled?: boolean;
}

export const MouseTrail: React.FC<MouseTrailProps> = ({
  images = DEFAULT_STAR_SVGS,
  maxItems = 18,
  distanceThreshold = 22,
  fadeTime = 800,
  starSize = 30,
  enabled = true,
}) => {
  const [trail, setTrail] = useState<TrailItem[]>([]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const imageIndexRef = useRef(0);
  const nextIdRef = useRef(0);

  // Spawn a new star at the given cursor coordinate
  const spawnStar = useCallback((x: number, y: number) => {
    const starList = images.length > 0 ? images : DEFAULT_STAR_SVGS;
    const currentImg = starList[imageIndexRef.current % starList.length];
    imageIndexRef.current += 1;

    // Subtle random rotation (-30 to +30 deg) and scale variance (0.85 to 1.25)
    const randomRotation = Math.floor(Math.random() * 60) - 30;
    const randomScale = 0.85 + Math.random() * 0.4;

    const newItem: TrailItem = {
      id: nextIdRef.current++,
      x,
      y,
      image: currentImg,
      rotation: randomRotation,
      scale: randomScale,
      createdAt: Date.now(),
    };

    setTrail((prev) => {
      const next = [...prev, newItem];
      return next.length > maxItems ? next.slice(next.length - maxItems) : next;
    });
  }, [images, maxItems]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;

      if (!lastPosRef.current) {
        lastPosRef.current = { x, y };
        spawnStar(x, y);
        return;
      }

      const dx = x - lastPosRef.current.x;
      const dy = y - lastPosRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= distanceThreshold) {
        lastPosRef.current = { x, y };
        spawnStar(x, y);
      }
    };

    // Also support smooth touch move for touchscreens / tablets
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;

        if (!lastPosRef.current) {
          lastPosRef.current = { x, y };
          spawnStar(x, y);
          return;
        }

        const dx = x - lastPosRef.current.x;
        const dy = y - lastPosRef.current.y;
        const dist = Math.hypot(dx, dy);

        if (dist >= distanceThreshold) {
          lastPosRef.current = { x, y };
          spawnStar(x, y);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [enabled, distanceThreshold, spawnStar]);

  // Clean up expired stars that have exceeded their fadeTime
  useEffect(() => {
    if (trail.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTrail((prev) => prev.filter((item) => now - item.createdAt < fadeTime));
    }, 60);

    return () => clearInterval(interval);
  }, [trail.length, fadeTime]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
    >
      {trail.map((item) => {
        const age = Date.now() - item.createdAt;
        const progress = Math.min(1, Math.max(0, age / fadeTime));
        // Scale down and smoothly fade out as it reaches expiration
        const currentOpacity = 1 - Math.pow(progress, 1.8);
        const currentScale = item.scale * (1 + progress * 0.25);
        const currentRotation = item.rotation + progress * 40; // gentle spin

        return (
          <div
            key={item.id}
            className="absolute will-change-transform"
            style={{
              left: `${item.x}px`,
              top: `${item.y}px`,
              width: `${starSize}px`,
              height: `${starSize}px`,
              marginLeft: `-${starSize / 2}px`,
              marginTop: `-${starSize / 2}px`,
              transform: `translate3d(0, 0, 0) rotate(${currentRotation}deg) scale(${currentScale})`,
              opacity: currentOpacity,
              transition: 'opacity 0.08s linear, transform 0.08s ease-out',
              filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.65)) drop-shadow(0 0 12px rgba(245, 158, 11, 0.4))',
            }}
          >
            <img
              src={item.image}
              alt=""
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
};

export default MouseTrail;
