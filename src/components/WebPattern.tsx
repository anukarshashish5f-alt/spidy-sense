import { useEffect, useRef } from 'react';

export default function WebPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Multiple web centers
      const centers = [
        { x: w * 0.15, y: h * 0.2, radius: Math.min(w, h) * 0.6 },
        { x: w * 0.85, y: h * 0.7, radius: Math.min(w, h) * 0.5 },
      ];

      centers.forEach((c, idx) => {
        const pulse = 0.05 + Math.sin(t * 0.001 + idx) * 0.02;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.lineWidth = 0.5;

        const spokes = 16;
        const rings = 8;

        // Radial spokes
        for (let i = 0; i < spokes; i++) {
          const angle = (i / spokes) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(
            c.x + Math.cos(angle) * c.radius,
            c.y + Math.sin(angle) * c.radius
          );
          ctx.stroke();
        }

        // Web rings with irregular segments
        for (let r = 1; r <= rings; r++) {
          const ringRadius = (r / rings) * c.radius;
          ctx.beginPath();
          for (let i = 0; i <= spokes; i++) {
            const angle = (i / spokes) * Math.PI * 2;
            const wobble = Math.sin(t * 0.002 + r + i) * 4;
            const px = c.x + Math.cos(angle) * (ringRadius + wobble);
            const py = c.y + Math.sin(angle) * (ringRadius + wobble);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      });

      t += 16;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.5 }}
    />
  );
}
