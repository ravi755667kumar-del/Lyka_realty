import React, { useState, useEffect, useRef } from 'react';

interface RollingTextProps {
  /** The text string to animate */
  text: string;
  /** Additional CSS class names */
  className?: string;
  /** Stagger delay in milliseconds per step from center to edge (default: 35ms) */
  stepDelay?: number;
  /** Duration in milliseconds of each character roll (default: 500ms) */
  duration?: number;
  /** Minimum scroll distance in pixels to trigger a roll (default: 24px) */
  scrollThreshold?: number;
  /** Minimum interval in milliseconds between scroll-triggered rolls (default: 550ms) */
  scrollCooldown?: number;
  /** Trigger on hover as well (default: true) */
  hoverTrigger?: boolean;
}

export const RollingText: React.FC<RollingTextProps> = ({
  text,
  className = '',
  stepDelay = 35,
  duration = 520,
  scrollThreshold = 24,
  scrollCooldown = 550,
  hoverTrigger = true,
}) => {
  const [rollKey, setRollKey] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const lastScrollYRef = useRef(0);
  const lastTriggerTimeRef = useRef(0);

  // Trigger the rolling animation
  const triggerRoll = () => {
    setIsRolling(true);
    setRollKey((k) => k + 1);
  };

  // Scroll listener that captures scroll updates from anywhere on the page
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | Document;
      let currentScroll = 0;

      if (target === document || target === document.documentElement || !target) {
        currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
      } else if (target instanceof HTMLElement) {
        currentScroll = target.scrollTop || 0;
      }

      const diff = Math.abs(currentScroll - lastScrollYRef.current);
      const now = Date.now();

      // Trigger if user scrolled more than threshold and cooldown has elapsed
      if (diff >= scrollThreshold && now - lastTriggerTimeRef.current >= scrollCooldown) {
        lastScrollYRef.current = currentScroll;
        lastTriggerTimeRef.current = now;
        triggerRoll();
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [scrollThreshold, scrollCooldown]);

  // Center-to-edges calculation
  const chars = text.split('');
  const center = (chars.length - 1) / 2;

  return (
    <>
      {/* Dynamic Keyframes for the 3D Center-to-Edges Roll */}
      <style>{`
        @keyframes rollCenterToEdges {
          0% {
            transform: translateY(0%) rotateX(0deg);
            opacity: 1;
          }
          38% {
            transform: translateY(-115%) rotateX(75deg);
            opacity: 0;
          }
          42% {
            transform: translateY(115%) rotateX(-75deg);
            opacity: 0;
          }
          100% {
            transform: translateY(0%) rotateX(0deg);
            opacity: 1;
          }
        }
      `}</style>

      <span
        className={`inline-flex items-center select-none ${className}`}
        onMouseEnter={hoverTrigger ? triggerRoll : undefined}
      >
        {chars.map((char, index) => {
          if (char === ' ') {
            return (
              <span key={`space-${index}`} className="inline-block whitespace-pre">
                {' '}
              </span>
            );
          }

          // Distance from center: 0 for center characters, increasing towards left & right edges
          const distanceFromCenter = Math.abs(index - center);
          const delayMs = Math.round(distanceFromCenter * stepDelay);

          return (
            <span
              key={`${char}-${index}-${rollKey}`}
              className="inline-block overflow-hidden relative align-baseline"
              style={{
                perspective: '600px',
              }}
            >
              <span
                className="inline-block will-change-transform"
                style={{
                  animation: isRolling
                    ? `rollCenterToEdges ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`
                    : 'none',
                }}
              >
                {char}
              </span>
            </span>
          );
        })}
      </span>
    </>
  );
};

export default RollingText;
