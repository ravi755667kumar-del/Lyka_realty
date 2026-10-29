'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Mic, Volume2, Play, Pause, Sparkles } from 'lucide-react';

interface VoiceSphere3DProps {
  isSpeaking: boolean;
  isListening: boolean;
  audioLevel?: number; // 0 - 100
  callState: string;
  duration?: number;
  onSphereClick?: () => void;
  interactive?: boolean;
}

export const VoiceSphere3D: React.FC<VoiceSphere3DProps> = ({
  isSpeaking,
  isListening,
  audioLevel = 0,
  callState,
  duration = 0,
  onSphereClick,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Mouse tilt tracking for 3D parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // Smoothed audio amplitude
    let smoothedAmp = 0;

    const render = () => {
      time += 0.035;

      // Target amplitude based on state
      let targetAmp = 0.05;
      if (isSpeaking) {
        // AI Speaking: rhythmic energetic fluid pulses
        targetAmp = 0.16 + Math.sin(time * 3.5) * 0.06 + Math.sin(time * 7) * 0.03;
      } else if (isListening) {
        // User Speaking: responsive to microphone volume
        targetAmp = 0.06 + Math.min(0.24, (audioLevel / 100) * 0.28);
      } else {
        // Idle breathing
        targetAmp = 0.04 + Math.sin(time * 1.5) * 0.02;
      }

      smoothedAmp += (targetAmp - smoothedAmp) * 0.12;

      // Canvas dimensions & Retina DPI
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.38;

      ctx.clearRect(0, 0, width, height);

      // ─── 1. Outer Ethereal Glow / Corona ──────────────────────────────
      const glowRadius = baseRadius * (1.18 + smoothedAmp * 0.8);
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.7,
        centerX,
        centerY,
        glowRadius
      );
      if (isSpeaking) {
        glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        glowGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.25)');
        glowGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      } else if (isListening) {
        glowGrad.addColorStop(0, 'rgba(52, 211, 153, 0.45)');
        glowGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.25)');
        glowGrad.addColorStop(1, 'rgba(5, 150, 105, 0)');
      } else {
        glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        glowGrad.addColorStop(0.6, 'rgba(14, 165, 233, 0.12)');
        glowGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      }

      ctx.save();
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ─── 2. Multi-Wave 3D Fluid Sphere Surface ────────────────────────
      const numPoints = 120;
      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;

        // 3 harmonic wave components for organic 3D fluid undulation
        const wave1 = Math.sin(theta * 3 + time * 2.2) * smoothedAmp;
        const wave2 = Math.cos(theta * 5 - time * 3.1) * (smoothedAmp * 0.6);
        const wave3 = Math.sin(theta * 2 + time * 1.5) * (smoothedAmp * 0.4);

        const r = baseRadius * (1 + wave1 + wave2 + wave3);
        const x = centerX + Math.cos(theta) * r;
        const y = centerY + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Parallax-shifted light source position
      const lightX = centerX - baseRadius * 0.35 + tilt.x * 20;
      const lightY = centerY - baseRadius * 0.35 + tilt.y * 20;

      // 3D Spherical Volume Gradient (matching image azure/cyan colors)
      const sphereGrad = ctx.createRadialGradient(
        lightX,
        lightY,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius * 1.05
      );

      if (isSpeaking) {
        sphereGrad.addColorStop(0, '#e0f2fe'); // brilliant bright white-cyan highlight
        sphereGrad.addColorStop(0.2, '#7dd3fc'); // vivid sky blue
        sphereGrad.addColorStop(0.55, '#0ea5e9'); // electric azure core
        sphereGrad.addColorStop(0.85, '#0284c7'); // deep sapphire
        sphereGrad.addColorStop(1, '#0369a1'); // ambient shadow border
      } else if (isListening) {
        sphereGrad.addColorStop(0, '#d1fae5'); // brilliant mint-emerald highlight
        sphereGrad.addColorStop(0.2, '#6ee7b7'); // vivid seafoam
        sphereGrad.addColorStop(0.55, '#10b981'); // emerald core
        sphereGrad.addColorStop(0.85, '#059669'); // deep forest
        sphereGrad.addColorStop(1, '#047857'); // ambient shadow border
      } else {
        sphereGrad.addColorStop(0, '#f0f9ff'); // soft white-blue highlight
        sphereGrad.addColorStop(0.25, '#93c5fd'); // serene sky
        sphereGrad.addColorStop(0.6, '#38bdf8'); // cyan
        sphereGrad.addColorStop(0.9, '#0284c7'); // rich blue
        sphereGrad.addColorStop(1, '#075985'); // edge depth
      }

      ctx.fillStyle = sphereGrad;
      ctx.shadowColor = isSpeaking ? 'rgba(56, 189, 248, 0.6)' : 'rgba(14, 165, 233, 0.35)';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.restore();

      // ─── 3. Internal Caustic Waves (Living Water Flow) ─────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.95, 0, Math.PI * 2);
      ctx.clip();

      // Soft internal light ribbon
      const ribbonGrad = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY + Math.sin(time) * 20,
        centerX + baseRadius,
        centerY - Math.sin(time * 0.8) * 20
      );
      ribbonGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      ribbonGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.28)');
      ribbonGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.15)');
      ribbonGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = ribbonGrad;
      ctx.beginPath();
      ctx.ellipse(
        centerX + Math.cos(time * 0.7) * 15,
        centerY + Math.sin(time * 0.9) * 18,
        baseRadius * 0.85,
        baseRadius * 0.45,
        Math.PI / 4 + Math.sin(time * 0.5) * 0.2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Specular 3D Gloss Sheen (Top-left glassy reflection from screenshot)
      const glossGrad = ctx.createRadialGradient(
        lightX,
        lightY,
        2,
        lightX,
        lightY,
        baseRadius * 0.55
      );
      glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      glossGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.35)');
      glossGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
      glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = glossGrad;
      ctx.beginPath();
      ctx.arc(lightX, lightY, baseRadius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSpeaking, isListening, audioLevel, tilt]);

  // Formatted duration
  const mins = Math.floor(duration / 60);
  const secs = (duration % 60).toString().padStart(2, '0');

  // Surrounding dotted arc dots
  const totalDots = 32;
  const activeDotCount = isSpeaking
    ? Math.floor((Math.sin(Date.now() / 250) + 1) * (totalDots / 2))
    : isListening
    ? Math.floor((audioLevel / 100) * totalDots)
    : Math.min(totalDots, Math.floor(duration % totalDots));

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      className="relative flex items-center justify-center select-none py-3 px-2 w-full max-w-md mx-auto"
    >
      {/* ─── Surrounding Dotted Orbital Arc (from user's reference image) ─── */}
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none"
        viewBox="0 0 240 240"
      >
        {Array.from({ length: totalDots }).map((_, i) => {
          // Arc spanning top from 150deg to 390deg (240 deg arc)
          const angle = Math.PI * 0.75 + (i / (totalDots - 1)) * (Math.PI * 1.5);
          const r = 108;
          const cx = 120 + Math.cos(angle) * r;
          const cy = 120 + Math.sin(angle) * r;
          const isActive = i <= activeDotCount;

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={isActive ? 3.2 : 2.2}
              className={`transition-all duration-150 ${
                isActive
                  ? isSpeaking
                    ? 'fill-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]'
                    : 'fill-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                  : 'fill-slate-600/50'
              }`}
            />
          );
        })}
      </svg>

      {/* ─── Left Flanking Stat: Duration Timer (from user's image) ─── */}
      <div className="absolute left-2 sm:left-4 bottom-5 text-left pointer-events-none">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
          Call Timer
        </span>
        <span className="text-sm font-extrabold text-white font-mono flex items-center space-x-1">
          <span>{mins}m {secs}s</span>
        </span>
      </div>

      {/* ─── Right Flanking Stat: AI Voice Quality (from user's image) ─── */}
      <div className="absolute right-2 sm:right-4 bottom-5 text-right pointer-events-none">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
          AI Status
        </span>
        <span className="text-sm font-extrabold text-emerald-400 font-semibold flex items-center justify-end space-x-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Ready'}</span>
        </span>
      </div>

      {/* ─── Interactive 3D Sphere Container ─── */}
      <div
        onClick={onSphereClick}
        style={{
          transform: `perspective(600px) rotateX(${-tilt.y * 12}deg) rotateY(${tilt.x * 12}deg) scale(${
            isHovered ? 1.03 : 1
          })`,
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.3s ease-out',
        }}
        className={`relative w-48 h-48 sm:w-52 sm:h-52 rounded-full cursor-pointer flex items-center justify-center transition-all ${
          interactive ? 'active:scale-95' : ''
        }`}
        title="Interactive 3D Voice Sphere (Priya AI)"
      >
        {/* HTML5 Canvas Rendering 3D Fluid Sphere */}
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full rounded-full"
        />

        {/* ─── Central Concentric Ring & Button (Exactly matching user's image) ─── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
          {/* Outer Ring */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white/95 backdrop-blur-sm border-2 border-slate-900 shadow-[0_6px_20px_rgba(0,0,0,0.35)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 group">
            {/* Inner Concentric Circle Ring */}
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full border border-sky-400/40 flex items-center justify-center">
              {isSpeaking ? (
                // Animated Equalizer Bars when AI is speaking
                <div className="flex items-center justify-center space-x-1">
                  <span className="w-1 bg-slate-950 rounded-full animate-bounce [animation-delay:-0.3s] h-4" />
                  <span className="w-1 bg-slate-950 rounded-full animate-bounce [animation-delay:-0.15s] h-6" />
                  <span className="w-1 bg-slate-950 rounded-full animate-bounce [animation-delay:-0.4s] h-3" />
                  <span className="w-1 bg-slate-950 rounded-full animate-bounce h-5" />
                </div>
              ) : isListening ? (
                // Pulsing Mic when Customer is speaking
                <Mic className="w-5 h-5 text-slate-950 animate-pulse fill-slate-950" />
              ) : (
                // Play Icon (matching user's uploaded screenshot)
                <Play className="w-5 h-5 text-slate-950 fill-slate-950 ml-0.5 group-hover:scale-110 transition-transform" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
