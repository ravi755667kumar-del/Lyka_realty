import React, { useState, useEffect, useCallback, useRef } from 'react';

// Crisp, beautiful SVG rose flowers & petals
const FLOWER_SVGS = [
  // 1. Classic Red Velvet Blooming Rose
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><defs><radialGradient id="r1" cx="45%" cy="40%" r="55%"><stop offset="0%" stop-color="%23fb7185"/><stop offset="45%" stop-color="%23e11d48"/><stop offset="85%" stop-color="%239f1239"/><stop offset="100%" stop-color="%234c0519"/></radialGradient><linearGradient id="leaf" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234ade80"/><stop offset="100%" stop-color="%2315803d"/></linearGradient></defs><path d="M12 28 C8 32 4 30 6 24 C10 24 12 26 12 28 Z" fill="url(%23leaf)" opacity="0.85"/><path d="M24 28 C28 32 32 30 30 24 C26 24 24 26 24 28 Z" fill="url(%23leaf)" opacity="0.85"/><path d="M18 4 C11 4 6 9 6 16 C6 24 13 31 18 32 C23 31 30 24 30 16 C30 9 25 4 18 4 Z" fill="url(%23r1)"/><path d="M18 7 C14 7 10 10 10 15 C10 21 15 26 18 27 C21 26 26 21 26 15 C26 10 22 7 18 7 Z" fill="%23f43f5e" opacity="0.8"/><path d="M18 10 C15 10 13 12 13 15 C13 19 16 22 18 23 C20 22 23 19 23 15 C23 12 21 10 18 10 Z" fill="%23e11d48"/><path d="M18 12 C16 12 15 13.5 15 15.5 C15 17.5 17 19.5 18 20 C19 19.5 21 17.5 21 15.5 C21 13.5 20 12 18 12 Z" fill="%23be123c"/><circle cx="18" cy="15" r="2" fill="%23ffe4e6"/></svg>`,

  // 2. Soft Pink / Blush Rose Blossom
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36"><defs><radialGradient id="r2" cx="50%" cy="45%" r="50%"><stop offset="0%" stop-color="%23ffe4e6"/><stop offset="50%" stop-color="%23f43f5e"/><stop offset="100%" stop-color="%23be123c"/></radialGradient></defs><circle cx="18" cy="18" r="14" fill="url(%23r2)"/><path d="M18 8 C13 8 10 12 10 16 C10 22 15 26 18 27 C21 26 26 22 26 16 C26 12 23 8 18 8 Z" fill="%23fda4af" opacity="0.9"/><path d="M18 11 C15 11 13 13 13 16 C13 20 16 23 18 24 C20 23 23 20 23 16 C23 13 21 11 18 11 Z" fill="%23fb7185"/><circle cx="18" cy="16" r="2.5" fill="%23ffffff"/></svg>`,

  // 3. Ruby Curved Rose Petal
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30"><defs><linearGradient id="p1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fb7185"/><stop offset="50%" stop-color="%23e11d48"/><stop offset="100%" stop-color="%23881337"/></linearGradient></defs><path d="M15 3 C22 3 27 10 25 18 C23 25 16 27 15 27 C14 27 7 25 5 18 C3 10 8 3 15 3 Z" fill="url(%23p1)" opacity="0.95"/><path d="M15 6 C19 6 22 11 21 16 C20 21 16 23 15 23 C14 23 10 21 9 16 C8 11 11 6 15 6 Z" fill="%23f43f5e" opacity="0.45"/></svg>`,

  // 4. Velvet Rose Petal with Highlight
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30"><defs><linearGradient id="p2" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="%23fda4af"/><stop offset="40%" stop-color="%23e11d48"/><stop offset="100%" stop-color="%239f1239"/></linearGradient></defs><path d="M15 4 C24 6 27 15 23 22 C19 28 11 26 7 21 C3 15 6 6 15 4 Z" fill="url(%23p2)"/><path d="M14 8 C19 9 21 15 19 19 C17 23 12 21 9 18 C7 14 9 9 14 8 Z" fill="%23fecdd3" opacity="0.4"/></svg>`,

  // 5. Golden Amber Shimmer Petal
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30"><defs><linearGradient id="p3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fef08a"/><stop offset="50%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23e11d48"/></linearGradient></defs><path d="M15 2 C22 2 26 8 25 16 C24 23 17 26 15 28 C13 26 6 23 5 16 C4 8 8 2 15 2 Z" fill="url(%23p3)"/><circle cx="15" cy="14" r="2.5" fill="%23ffffff" opacity="0.8"/></svg>`
];

interface FlowerParticle {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  image: string;
  size: number;
  rotation: number;
  spin: number;
  createdAt: number;
  duration: number;
}

export interface ClickFlowerBurstProps {
  /** Number of flowers/petals to burst per click (default: 8) */
  countPerClick?: number;
  /** Max spread distance in pixels (default: 65px) */
  spreadRadius?: number;
  /** Animation duration in milliseconds (default: 750ms) */
  duration?: number;
  /** Whether the effect is active (default: true) */
  enabled?: boolean;
}

export const ClickFlowerBurst: React.FC<ClickFlowerBurstProps> = ({
  countPerClick = 9,
  spreadRadius = 75,
  duration = 750,
  enabled = true,
}) => {
  const [particles, setParticles] = useState<FlowerParticle[]>([]);
  const nextIdRef = useRef(0);

  const spawnBurst = useCallback(
    (clickX: number, clickY: number) => {
      const newParticles: FlowerParticle[] = [];
      const now = Date.now();

      for (let i = 0; i < countPerClick; i++) {
        // Distribute angles in a full circle with random jitter
        const baseAngle = (i / countPerClick) * 2 * Math.PI;
        const angleJitter = (Math.random() - 0.5) * 0.45;
        const angle = baseAngle + angleJitter;

        // Spread distance from center
        const dist = spreadRadius * (0.45 + Math.random() * 0.75);
        // Add gentle gravity drift downward
        const gravity = 25 + Math.random() * 35;

        const targetX = clickX + Math.cos(angle) * dist;
        const targetY = clickY + Math.sin(angle) * dist + gravity;

        // Size variance (18px to 32px)
        const size = 18 + Math.random() * 14;

        // Select flower or petal
        const image = FLOWER_SVGS[Math.floor(Math.random() * FLOWER_SVGS.length)];

        // Random rotation and spin speed
        const rotation = Math.random() * 360;
        const spin = (Math.random() - 0.5) * 180;

        newParticles.push({
          id: nextIdRef.current++,
          startX: clickX,
          startY: clickY,
          targetX,
          targetY,
          image,
          size,
          rotation,
          spin,
          createdAt: now,
          duration: duration + Math.floor(Math.random() * 200) - 100,
        });
      }

      setParticles((prev) => {
        // Keep max 50 particles in flight for top performance
        const combined = [...prev, ...newParticles];
        return combined.length > 50 ? combined.slice(combined.length - 50) : combined;
      });
    },
    [countPerClick, spreadRadius, duration]
  );

  useEffect(() => {
    if (!enabled) return;

    // Listen to all pointer/click/touch taps across the entire document
    const handleClick = (e: MouseEvent) => {
      spawnBurst(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        spawnBurst(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('click', handleClick, { capture: true, passive: true });
    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
    };
  }, [enabled, spawnBurst]);

  // Clean up expired flower particles
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setParticles((prev) => prev.filter((p) => now - p.createdAt < p.duration));
    }, 50);

    return () => clearInterval(interval);
  }, [particles.length]);

  if (!enabled || particles.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
    >
      {particles.map((p) => {
        const elapsed = Date.now() - p.createdAt;
        const progress = Math.min(1, Math.max(0, elapsed / p.duration));

        // Smooth cubic ease-out motion
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const currentX = p.startX + (p.targetX - p.startX) * easeProgress;
        const currentY = p.startY + (p.targetY - p.startY) * easeProgress;

        // Bloom up quickly then fade out softly
        const scale = progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) * 0.45;
        const opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
        const currentRotation = p.rotation + p.spin * easeProgress;

        return (
          <div
            key={p.id}
            className="absolute will-change-transform"
            style={{
              left: `${currentX}px`,
              top: `${currentY}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              marginLeft: `-${p.size / 2}px`,
              marginTop: `-${p.size / 2}px`,
              transform: `translate3d(0, 0, 0) rotate(${currentRotation}deg) scale(${scale})`,
              opacity: Math.max(0, opacity),
              filter: 'drop-shadow(0 2px 5px rgba(225, 29, 72, 0.4))',
              transition: 'transform 0.04s linear, opacity 0.04s linear',
            }}
          >
            <img
              src={p.image}
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

export default ClickFlowerBurst;
