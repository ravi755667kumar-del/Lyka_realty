import React, { useRef, useEffect, useState } from 'react';
import { 
  Orbit, 
  RotateCcw, 
  Play, 
  Pause, 
  Zap, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  Sparkles,
  Layers,
  Globe,
  Radio,
  ShieldAlert,
  Award
} from 'lucide-react';

/**
 * High-performance 3D Projected Cosmic Universe Interaction
 * Supports:
 * 1. "Single World Focus" (DEFAULT): High-detail 3D planet with atmosphere, surface textures,
 *    orbiting topic satellites (moons), and live reactions to the chatbot's answers.
 * 2. "Galaxy Overview": Multi-orbit solar system showing all levels revolving around the AI core.
 */
export default function UniverseInteraction({ 
  roadmap, 
  selectedLevel, 
  selectedTopic,
  onSelectLevel,
  onSelectTopic,
  cosmicReaction = 'idle', // 'idle' | 'speaking' | 'quiz' | 'passed' | 'analyzing'
  className = '' 
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // View mode: 'single' (focused on current chatbot subject) or 'galaxy'
  const [viewMode, setViewMode] = useState('single');
  const [isOrbiting, setIsOrbiting] = useState(true);
  const [warpSpeed, setWarpSpeed] = useState(false);
  const [hoveredObject, setHoveredObject] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Camera & Interaction refs
  const cameraRef = useRef({
    yaw: 0.35,
    pitch: 0.25,
    distance: 330,
    targetDistance: 330,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    velocityYaw: 0,
    velocityPitch: 0,
  });

  const animFrameRef = useRef(null);
  const timeRef = useRef(0);
  const particlesRef = useRef([]);

  // Generate persistent starfield
  const starsRef = useRef([]);
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 220; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 1400,
        y: (Math.random() - 0.5) * 1400,
        z: (Math.random() - 0.5) * 1400,
        size: Math.random() * 1.8 + 0.6,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        color: ['#FFFFFF', '#C7D2FE', '#BAE6FD', '#FDE68A', '#FBCFE8'][Math.floor(Math.random() * 5)]
      });
    }
    starsRef.current = stars;
  }, []);

  // Trigger celebration explosion when cosmicReaction is 'passed'
  useEffect(() => {
    if (cosmicReaction === 'passed') {
      const bursts = [];
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        bursts.push({
          x: 0,
          y: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          size: Math.random() * 3 + 1,
          color: ['#34D399', '#6EE7B7', '#FDE047', '#60A5FA', '#FFFFFF'][Math.floor(Math.random() * 5)]
        });
      }
      particlesRef.current = bursts;
    }
  }, [cosmicReaction]);

  // Visual presets for celestial levels
  const levelPresets = {
    'level-1': {
      title: 'Python Foundations',
      baseColor: '#0EA5E9', // Ocean blue
      glowColor: 'rgba(14, 165, 233, 0.7)',
      atmosphere: 'rgba(56, 189, 248, 0.35)',
      ring: false,
      style: 'ocean',
      order: 1
    },
    'level-2': {
      title: 'Data Science & Pandas',
      baseColor: '#10B981', // Jade green
      glowColor: 'rgba(16, 185, 129, 0.7)',
      atmosphere: 'rgba(52, 211, 153, 0.35)',
      ring: true,
      ringColor: 'rgba(52, 211, 153, 0.5)',
      style: 'crystalline',
      order: 2
    },
    'level-3': {
      title: 'Math & Statistics',
      baseColor: '#F59E0B', // Amber gold
      glowColor: 'rgba(245, 158, 11, 0.7)',
      atmosphere: 'rgba(251, 191, 36, 0.35)',
      ring: false,
      style: 'grid',
      order: 3
    },
    'level-4': {
      title: 'Machine Learning',
      baseColor: '#6366F1', // Indigo / Sapphire (Active Mission)
      glowColor: 'rgba(99, 102, 241, 0.85)',
      atmosphere: 'rgba(129, 140, 248, 0.45)',
      ring: true,
      ringColor: 'rgba(129, 140, 248, 0.65)',
      style: 'gas_giant',
      order: 4
    },
    'level-5': {
      title: 'Deep Learning',
      baseColor: '#EF4444', // Ruby crimson
      glowColor: 'rgba(239, 68, 68, 0.75)',
      atmosphere: 'rgba(248, 113, 113, 0.35)',
      ring: false,
      style: 'neural',
      order: 5
    },
    'level-6': {
      title: 'Generative AI & LLMs',
      baseColor: '#A855F7', // Violet purple
      glowColor: 'rgba(168, 85, 247, 0.85)',
      atmosphere: 'rgba(192, 132, 252, 0.45)',
      ring: true,
      ringColor: 'rgba(192, 132, 252, 0.5)',
      style: 'pulsar',
      order: 6
    },
    'level-7': {
      title: 'Production MLOps',
      baseColor: '#E2E8F0', // Starlight pearl
      glowColor: 'rgba(226, 232, 240, 0.6)',
      atmosphere: 'rgba(255, 255, 255, 0.3)',
      ring: false,
      style: 'starlight',
      order: 7
    }
  };

  // Find active level data
  const currentLvl = selectedLevel || 
    roadmap?.levels?.find((l) => l.status === 'In Progress') || 
    roadmap?.levels?.[3] || 
    roadmap?.levels?.[0];

  const currentPreset = levelPresets[currentLvl?.id] || levelPresets['level-4'];
  const topics = currentLvl?.topics || [];
  const activeTopic = selectedTopic || 
    topics.find((t) => t.status === 'In Progress') || 
    topics.find((t) => t.status !== 'Completed') || 
    topics[0];

  const clickablesRef = useRef([]);

  // Main 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Advance cosmic time
      const speedMultiplier = warpSpeed ? 3.0 : 1.0;
      if (isOrbiting) {
        timeRef.current += 0.8 * speedMultiplier;
      }

      // Camera easing & rotation
      const cam = cameraRef.current;
      if (!cam.isDragging) {
        cam.yaw += cam.velocityYaw;
        cam.pitch += cam.velocityPitch;
        cam.velocityYaw *= 0.93;
        cam.velocityPitch *= 0.93;

        if (isOrbiting && Math.abs(cam.velocityYaw) < 0.0005) {
          cam.yaw += 0.003 * speedMultiplier;
        }
      }

      cam.distance += (cam.targetDistance - cam.distance) * 0.12;
      cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch));

      const cx = width / 2;
      const cy = height / 2;
      const D = 500;
      const scale = 500 / cam.distance;

      // 3D Point Projection Helper
      const project = (x, y, z) => {
        const cosY = Math.cos(cam.yaw);
        const sinY = Math.sin(cam.yaw);
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        const cosP = Math.cos(cam.pitch);
        const sinP = Math.sin(cam.pitch);
        const y2 = y * cosP - z1 * sinP;
        const z2 = y * sinP + z1 * cosP;

        const f = D / (D + z2);
        return {
          x: cx + x1 * f * scale,
          y: cy + y2 * f * scale,
          z: z2,
          f: f * scale,
          visible: (D + z2) > 20
        };
      };

      // 1. Draw Space Background & Starfield
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, width, height);

      // Dynamic cosmic nebulae
      const nebula1 = ctx.createRadialGradient(cx - 70, cy - 60, 10, cx - 70, cy - 60, 220);
      nebula1.addColorStop(0, currentPreset.glowColor.replace('0.85', '0.18').replace('0.7', '0.15'));
      nebula1.addColorStop(0.7, 'rgba(15, 23, 42, 0.05)');
      nebula1.addColorStop(1, 'rgba(5, 8, 20, 0)');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      // Stars
      starsRef.current.forEach((s) => {
        const p = project(s.x, s.y, s.z);
        if (p.visible && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height) {
          const twinkle = Math.sin(timeRef.current * s.twinkleSpeed + s.twinklePhase);
          const alpha = Math.max(0.15, Math.min(1.0, s.alpha + twinkle * 0.35));
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.6, s.size * p.f), 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = alpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      const clickables = [];

      // =========================================================
      // MODE 1: SINGLE PLANETARY FOCUS (ACCORDING TO CHATBOT)
      // =========================================================
      if (viewMode === 'single') {
        const planetRadius = 42; // Compact single world size
        const pCenter = project(0, 0, 0);

        // A. Draw Orbit Rings of Topic Moons (Back half)
        const topicRadius = 94;
        const totalTopics = Math.max(topics.length, 1);

        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const theta = (i / 64) * Math.PI * 2;
          const ox = Math.cos(theta) * topicRadius;
          const oz = Math.sin(theta) * topicRadius;
          const oy = Math.sin(theta) * 14; // slight orbital inclination
          const p = project(ox, oy, oz);
          if (p.visible) {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // B. Planetary Rings (Back part, behind planet)
        if (currentPreset.ring) {
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i <= 64; i++) {
            const theta = (i / 64) * Math.PI * 2;
            const rx = Math.cos(theta) * (planetRadius * 1.8);
            const rz = Math.sin(theta) * (planetRadius * 1.8);
            const ry = Math.sin(theta) * 12;
            const p = project(rx, ry, rz);
            if (p.visible && p.z < 0) { // back side
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            }
          }
          ctx.strokeStyle = currentPreset.ringColor || 'rgba(129, 140, 248, 0.4)';
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.restore();
        }

        // C. Chatbot Live Reaction Effects around Single World
        // 1. "speaking" -> Holographic data transmission ripples
        if (cosmicReaction === 'speaking') {
          const rippleCount = 3;
          for (let r = 0; r < rippleCount; r++) {
            const phase = ((timeRef.current * 0.04 + (r * 0.33)) % 1);
            const rad = planetRadius + phase * 40;
            const alpha = Math.max(0, 1 - phase);
            ctx.beginPath();
            ctx.arc(pCenter.x, pCenter.y, rad * pCenter.f, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.8})`;
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }
        }

        // 2. "quiz" -> Amber Holographic Assessment Shield
        if (cosmicReaction === 'quiz') {
          const shieldPulse = Math.sin(timeRef.current * 0.1) * 3;
          const sRad = (planetRadius + 12 + shieldPulse) * pCenter.f;
          ctx.beginPath();
          ctx.arc(pCenter.x, pCenter.y, sRad, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          ctx.fill();
        }

        // 3. "analyzing" -> Scanning Laser Grid
        if (cosmicReaction === 'analyzing') {
          const scanY = pCenter.y - (planetRadius * pCenter.f) + 
            (((timeRef.current * 2) % (planetRadius * 2 * pCenter.f)));
          ctx.beginPath();
          ctx.moveTo(pCenter.x - planetRadius * pCenter.f, scanY);
          ctx.lineTo(pCenter.x + planetRadius * pCenter.f, scanY);
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#06B6D4';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // D. Render Single Planet Body with 3D Shading
        const pr = planetRadius * pCenter.f;

        // Outer Atmosphere Glow
        const atmoGlow = ctx.createRadialGradient(pCenter.x, pCenter.y, pr * 0.8, pCenter.x, pCenter.y, pr * 1.55);
        atmoGlow.addColorStop(0, currentPreset.glowColor);
        atmoGlow.addColorStop(0.6, currentPreset.atmosphere);
        atmoGlow.addColorStop(1, 'rgba(5, 8, 20, 0)');
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, pr * 1.55, 0, Math.PI * 2);
        ctx.fillStyle = atmoGlow;
        ctx.fill();

        // 3D Sphere Shading (Simulating light from top-left)
        const sphereGrad = ctx.createRadialGradient(
          pCenter.x - pr * 0.35, pCenter.y - pr * 0.35, pr * 0.1,
          pCenter.x, pCenter.y, pr
        );
        sphereGrad.addColorStop(0, '#FFFFFF');
        sphereGrad.addColorStop(0.2, currentPreset.baseColor);
        sphereGrad.addColorStop(0.75, currentPreset.baseColor);
        sphereGrad.addColorStop(1, '#060B18');

        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.shadowColor = currentPreset.glowColor;
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rotating Latitude / Surface Texture Bands
        ctx.save();
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, pr, 0, Math.PI * 2);
        ctx.clip();

        // Surface texture lines that rotate with camera yaw
        for (let lat = -2; lat <= 2; lat++) {
          const latY = pCenter.y + (lat * (pr * 0.32));
          const bandWidth = Math.sqrt(Math.max(0, pr * pr - Math.pow(lat * (pr * 0.32), 2))) * 2;
          ctx.beginPath();
          ctx.ellipse(pCenter.x, latY, bandWidth / 2, pr * 0.12, cam.pitch * 0.3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Neural network surface lattice for Deep Learning (Level 5)
        if (currentPreset.style === 'neural') {
          for (let n = 0; n < 8; n++) {
            const nAngle = timeRef.current * 0.02 + n;
            const nx = pCenter.x + Math.cos(nAngle) * (pr * 0.7);
            const ny = pCenter.y + Math.sin(nAngle) * (pr * 0.7);
            ctx.beginPath();
            ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#FCA5A5';
            ctx.fill();
            if (n > 0) {
              const prevAngle = timeRef.current * 0.02 + (n - 1);
              ctx.beginPath();
              ctx.moveTo(nx, ny);
              ctx.lineTo(pCenter.x + Math.cos(prevAngle) * (pr * 0.7), pCenter.y + Math.sin(prevAngle) * (pr * 0.7));
              ctx.strokeStyle = 'rgba(252, 165, 165, 0.3)';
              ctx.stroke();
            }
          }
        }

        ctx.restore();

        // E. Planetary Rings (Front part, in front of planet)
        if (currentPreset.ring) {
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i <= 64; i++) {
            const theta = (i / 64) * Math.PI * 2;
            const rx = Math.cos(theta) * (planetRadius * 1.8);
            const rz = Math.sin(theta) * (planetRadius * 1.8);
            const ry = Math.sin(theta) * 18;
            const p = project(rx, ry, rz);
            if (p.visible && p.z >= 0) { // front side
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            }
          }
          ctx.strokeStyle = currentPreset.ringColor || 'rgba(129, 140, 248, 0.8)';
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.restore();
        }

        // Center Planet Label & Progress Arc
        const pct = currentLvl?.completionPercentage ?? 60;
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, pr + 6, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * (Math.PI * 2));
        ctx.strokeStyle = pct === 100 ? '#10B981' : '#6366F1';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        clickables.push({
          type: 'planet',
          data: currentLvl,
          x: pCenter.x,
          y: pCenter.y,
          radius: pr + 8
        });

        // F. Topic Moons (Satellites Orbiting Single Planet)
        topics.forEach((topic, idx) => {
          const moonAngle = (timeRef.current * 0.007) + (idx * (Math.PI * 2 / totalTopics));
          const mx = Math.cos(moonAngle) * topicRadius;
          const mz = Math.sin(moonAngle) * topicRadius;
          const my = Math.sin(moonAngle) * 14;

          const proj = project(mx, my, mz);
          if (!proj.visible) return;

          const isCurrentActive = activeTopic?.id === topic.id;
          const isDone = topic.status === 'Completed';
          const moonR = Math.max(5, (isCurrentActive ? 8.5 : 6) * proj.f);

          // Connecting beacon laser line if this is the active topic
          if (isCurrentActive) {
            ctx.beginPath();
            ctx.moveTo(pCenter.x, pCenter.y);
            ctx.lineTo(proj.x, proj.y);
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Pulsing target reticle
            const ringR = moonR + ((timeRef.current * 0.25) % 6);
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          // Moon body
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, moonR, 0, Math.PI * 2);
          ctx.fillStyle = isDone ? '#34D399' : isCurrentActive ? '#FBBF24' : '#64748B';
          ctx.shadowColor = isDone ? '#10B981' : isCurrentActive ? '#F59E0B' : '#475569';
          ctx.shadowBlur = isCurrentActive ? 10 : isDone ? 6 : 2;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Topic label for active topic
          if (isCurrentActive || isDone) {
            ctx.font = 'bold 8px Inter, system-ui';
            ctx.fillStyle = isCurrentActive ? '#FDE047' : '#A7F3D0';
            ctx.textAlign = 'center';
            ctx.fillText(
              isCurrentActive ? `▶ ${topic.title.split(' ')[0]}` : `✓ ${topic.title.split(' ')[0]}`,
              proj.x,
              proj.y + moonR + 8
            );
          }

          clickables.push({
            type: 'topic_moon',
            data: topic,
            level: currentLvl,
            x: proj.x,
            y: proj.y,
            radius: moonR + 4
          });
        });

      } else {
        // =========================================================
        // MODE 2: GALAXY OVERVIEW (MULTI-ORBIT SOLAR SYSTEM)
        // =========================================================
        const sunProj = project(0, 0, 0);
        const sunR = Math.max(10, 14 * sunProj.f);

        ctx.beginPath();
        ctx.arc(sunProj.x, sunProj.y, sunR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253, 224, 71, 0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sunProj.x, sunProj.y, sunR, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        (roadmap?.levels || []).forEach((lvl, idx) => {
          const cfg = levelPresets[lvl.id] || levelPresets['level-4'];
          const baseRadius = 38 + idx * 22;

          ctx.beginPath();
          for (let i = 0; i <= 64; i++) {
            const theta = (i / 64) * Math.PI * 2;
            const ox = Math.cos(theta) * baseRadius;
            const oz = Math.sin(theta) * baseRadius;
            const p = project(ox, 0, oz);
            if (p.visible) {
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            }
          }
          ctx.strokeStyle = lvl.id === currentLvl?.id ? 'rgba(99, 102, 241, 0.5)' : 'rgba(75, 85, 99, 0.2)';
          ctx.stroke();

          const angle = timeRef.current * (0.015 / (idx + 1)) + (idx * (Math.PI * 2 / 7));
          const px = Math.cos(angle) * baseRadius;
          const pz = Math.sin(angle) * baseRadius;
          const proj = project(px, 0, pz);

          if (proj.visible) {
            const pR = Math.max(4.5, 7.5 * proj.f);
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, pR, 0, Math.PI * 2);
            ctx.fillStyle = cfg.baseColor;
            ctx.fill();

            clickables.push({
              type: 'planet_galaxy',
              data: lvl,
              x: proj.x,
              y: proj.y,
              radius: pR + 4
            });
          }
        });
      }

      // Render Explosive Celebration Particles (Supernova when quiz is passed)
      if (particlesRef.current.length > 0) {
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha *= 0.94;

          ctx.beginPath();
          ctx.arc(cx + p.x, cy + p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });
        particlesRef.current = particlesRef.current.filter((p) => p.alpha > 0.05);
      }

      clickablesRef.current = clickables;

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [viewMode, isOrbiting, warpSpeed, currentLvl, activeTopic, cosmicReaction, roadmap]);

  // Drag handlers
  const handleMouseDown = (e) => {
    cameraRef.current.isDragging = true;
    cameraRef.current.lastMouseX = e.clientX;
    cameraRef.current.lastMouseY = e.clientY;
    cameraRef.current.velocityYaw = 0;
    cameraRef.current.velocityPitch = 0;
  };

  const handleMouseMove = (e) => {
    const cam = cameraRef.current;
    if (cam.isDragging) {
      const deltaX = e.clientX - cam.lastMouseX;
      const deltaY = e.clientY - cam.lastMouseY;
      cam.lastMouseX = e.clientX;
      cam.lastMouseY = e.clientY;

      cam.yaw += deltaX * 0.007;
      cam.pitch += deltaY * 0.007;
      cam.velocityYaw = deltaX * 0.004;
      cam.velocityPitch = deltaY * 0.004;
    } else {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let found = null;
      for (const item of clickablesRef.current) {
        const dist = Math.hypot(mouseX - item.x, mouseY - item.y);
        if (dist <= item.radius) {
          found = item;
          break;
        }
      }

      if (found) {
        setHoveredObject(found);
        setTooltipPos({ x: mouseX, y: mouseY });
        canvas.style.cursor = 'pointer';
      } else {
        setHoveredObject(null);
        canvas.style.cursor = 'grab';
      }
    }
  };

  const handleMouseUp = () => {
    cameraRef.current.isDragging = false;
  };

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const item of clickablesRef.current) {
      const dist = Math.hypot(mouseX - item.x, mouseY - item.y);
      if (dist <= item.radius) {
        if (item.type === 'topic_moon' && onSelectTopic) {
          onSelectTopic(item.data);
        } else if ((item.type === 'planet' || item.type === 'planet_galaxy') && onSelectLevel) {
          onSelectLevel(item.data);
          if (viewMode === 'galaxy') {
            setViewMode('single'); // zoom into single view
          }
        }
        break;
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const cam = cameraRef.current;
    cam.targetDistance = Math.max(180, Math.min(600, cam.targetDistance + e.deltaY * 0.5));
  };

  const handleReset = () => {
    cameraRef.current.targetDistance = 330;
    cameraRef.current.distance = 330;
    cameraRef.current.yaw = 0.35;
    cameraRef.current.pitch = 0.25;
    cameraRef.current.velocityYaw = 0;
    cameraRef.current.velocityPitch = 0;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full aspect-square max-w-[265px] mx-auto rounded-2xl overflow-hidden border border-indigo-500/30 bg-[#050814] shadow-xl shadow-indigo-950/50 select-none flex flex-col ${className}`}
    >
      {/* Sci-Fi HUD Corners */}
      <div className="absolute top-1.5 left-1.5 pointer-events-none z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-900/85 backdrop-blur-md border border-gray-800 text-[9px] font-mono text-cyan-400">
        <span className={`w-1.5 h-1.5 rounded-full ${
          cosmicReaction === 'speaking' ? 'bg-cyan-400 animate-ping' :
          cosmicReaction === 'quiz' ? 'bg-amber-400 animate-pulse' :
          cosmicReaction === 'passed' ? 'bg-emerald-400 animate-bounce' : 'bg-indigo-400'
        }`} />
        <span className="font-semibold tracking-wider uppercase text-[8px]">
          {viewMode === 'single' ? 'SINGLE PLANET' : 'GALAXY'}
        </span>
      </div>

      <div className="absolute top-1.5 right-1.5 pointer-events-none z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-900/85 backdrop-blur-md border border-gray-800 text-[9px] font-mono text-indigo-300">
        <span className="text-gray-400">FOCUS:</span>
        <strong className="text-white truncate max-w-[75px]">{currentLvl?.title?.split(':')[1] || 'ML'}</strong>
      </div>

      {/* Interactive 3D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip */}
      {hoveredObject && (
        <div 
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 px-2.5 py-1.5 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-indigo-500/40 shadow-xl shadow-black/80 text-left min-w-[140px] max-w-[200px] transition-all duration-150"
          style={{ 
            left: `${Math.min(Math.max(tooltipPos.x, 75), 190)}px`, 
            top: `${Math.max(tooltipPos.y - 10, 36)}px` 
          }}
        >
          <div className="flex items-center justify-between gap-1.5 border-b border-gray-800 pb-0.5 mb-1">
            <span className="text-[11px] font-bold text-white tracking-tight truncate">
              {hoveredObject.type === 'topic_moon' 
                ? hoveredObject.data.title 
                : hoveredObject.data.title || currentPreset.title}
            </span>
            <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 flex-shrink-0">
              {hoveredObject.type === 'topic_moon' 
                ? hoveredObject.data.status 
                : `${hoveredObject.data.completionPercentage ?? 0}%`}
            </span>
          </div>

          <div className="text-[10px] text-gray-300 space-y-0.5">
            {hoveredObject.type === 'topic_moon' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Assessment:</span>
                  <span className="font-medium text-emerald-400">
                    {hoveredObject.data.assessmentScore !== null ? `${hoveredObject.data.assessmentScore}%` : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Exercise:</span>
                  <span className="font-medium text-gray-200">
                    {hoveredObject.data.exerciseSubmitted ? 'Done' : 'Pending'}
                  </span>
                </div>
                <div className="mt-0.5 text-[9px] text-cyan-300 font-semibold">
                  Click to explore in Chatbot 💬
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed:</span>
                  <span className="font-medium text-gray-200">
                    {hoveredObject.data.completedTopicsCount ?? 0} / {hoveredObject.data.totalTopics ?? 10}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Remaining:</span>
                  <span className="font-medium text-amber-400">
                    {hoveredObject.data.remainingTopicsCount ?? 0}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Square Lower HUD Controls */}
      <div className="absolute bottom-1.5 inset-x-1.5 z-20 flex items-center justify-between px-2 py-1 rounded-xl bg-gray-900/90 backdrop-blur-md border border-gray-800/80 text-[10px] text-gray-300">
        {/* Toggle Single World vs Galaxy Overview */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode(viewMode === 'single' ? 'galaxy' : 'single')}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-all flex items-center gap-1 ${
              viewMode === 'single'
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-300'
            }`}
            title="Toggle between Single Planet View and Solar System Overview"
          >
            {viewMode === 'single' ? <Globe className="w-3 h-3" /> : <Orbit className="w-3 h-3" />}
            <span>{viewMode === 'single' ? 'Planet' : 'Galaxy'}</span>
          </button>

          <button
            onClick={() => setIsOrbiting(!isOrbiting)}
            className="p-1 rounded bg-gray-800/60 border border-gray-700 text-gray-400 hover:text-white transition-all"
            title={isOrbiting ? 'Pause Rotation' : 'Resume Rotation'}
          >
            {isOrbiting ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>

        {/* Zoom & Reset */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const cam = cameraRef.current;
              cam.targetDistance = Math.max(180, cam.targetDistance - 50);
            }}
            className="p-1 rounded bg-gray-800/60 border border-gray-700 text-gray-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              const cam = cameraRef.current;
              cam.targetDistance = Math.min(600, cam.targetDistance + 50);
            }}
            className="p-1 rounded bg-gray-800/60 border border-gray-700 text-gray-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 rounded bg-gray-800/60 border border-gray-700 text-gray-300 hover:text-white"
            title="Reset Perspective"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
