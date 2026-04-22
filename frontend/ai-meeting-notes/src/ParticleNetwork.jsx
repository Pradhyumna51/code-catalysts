import { useEffect, useRef, useCallback } from 'react';

const PARTICLE_COUNT = 80;
const CONNECTION_DISTANCE = 160;
const MOUSE_RADIUS = 200;
const BASE_SPEED = 0.4;
const MIN_SPEED = 0.15; // prevents particles from stopping dead

function createParticle(width, height) {
  const angle = Math.random() * Math.PI * 2;
  const speed = BASE_SPEED * (0.5 + Math.random());
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    baseVx: Math.cos(angle) * speed,
    baseVy: Math.sin(angle) * speed,
    radius: 1.5 + Math.random() * 1.5,
    baseAlpha: 0.2 + Math.random() * 0.4,
  };
}

export default function ParticleNetwork() {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(null);
  const runningRef = useRef(true);

  const handleMouseMove = useCallback((e) => {
    // Use page coords — canvas covers the full parent, so offset is negligible
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouse.current = { x: -9999, y: -9999 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    runningRef.current = true;

    const setSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      // Only resize when dimensions actually change to avoid killing the draw loop
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    setSize();

    // Initialise particles once
    particles.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas.width, canvas.height)
    );

    const ro = new ResizeObserver(setSize);
    ro.observe(canvas.parentElement);

    // Page-visibility API: pause when hidden, resume when visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && runningRef.current) {
        // Restart loop if it was paused by the browser
        cancelAnimationFrame(animRef.current);
        animRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    function draw() {
      if (!runningRef.current) return;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const pts = particles.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (const p of pts) {
        // Mouse attraction
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 1) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.012;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Soft dampen — but enforce minimum speed so particles never die
        p.vx *= 0.995;
        p.vy *= 0.995;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed < MIN_SPEED) {
          // Nudge back toward original direction
          const boost = (MIN_SPEED - speed) / MIN_SPEED * 0.005;
          p.vx += p.baseVx * boost;
          p.vy += p.baseVy * boost;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        if (p.y > height + 5) p.y = -5;
      }

      // Connections between particles
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.25;
            const d1 = Math.hypot(pts[i].x - mx, pts[i].y - my);
            const d2 = Math.hypot(pts[j].x - mx, pts[j].y - my);
            const nearMouse = d1 < MOUSE_RADIUS || d2 < MOUSE_RADIUS;

            ctx.strokeStyle = nearMouse
              ? `rgba(0,163,255,${alpha * 2.5})`
              : `rgba(0,163,255,${alpha})`;
            ctx.lineWidth = nearMouse ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // Cursor → nearby particle lines
      if (mx > -999) {
        for (const p of pts) {
          const dist = Math.hypot(p.x - mx, p.y - my);
          if (dist < MOUSE_RADIUS) {
            const alpha = (1 - dist / MOUSE_RADIUS) * 0.5;
            ctx.strokeStyle = `rgba(0,163,255,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
      }

      // Nodes
      for (const p of pts) {
        const dist = Math.hypot(p.x - mx, p.y - my);
        const nearMouse = dist < MOUSE_RADIUS;
        const boost = nearMouse ? (1 - dist / MOUSE_RADIUS) * 0.6 : 0;
        const glowAlpha = p.baseAlpha + boost;
        const r = nearMouse ? p.radius * 1.6 : p.radius;

        if (nearMouse) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,163,255,${glowAlpha * 0.15})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,163,255,${glowAlpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
