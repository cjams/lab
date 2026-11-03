import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import * as d3 from 'd3';
import { scrollySteps } from '../lib/store';
import { usePalette, type Palette } from '../lib/palette';

// A few thousand points in 3D, rendered on canvas, that morph between
// layouts as the reader scrolls. Drag to rotate.
//
//   step 0  isotropic noise
//   step 1  points pull into clusters
//   step 2  clusters take their colors
//   step 3  clusters line up along a helix
//
// Swap `build` for real data (e.g. PCA/UMAP of hidden states exported from a
// notebook as JSON) and keep the rendering loop.

interface Props {
  scrollyId?: string;
  step?: number;
  n?: number;
}

const K = 6;

function build(n: number) {
  const rnd = d3.randomLcg(42);
  const normal = d3.randomNormal.source(rnd)(0, 1);
  const label = new Uint8Array(n);
  const noise = new Float32Array(n * 3);
  const cluster = new Float32Array(n * 3);
  const helix = new Float32Array(n * 3);
  const delay = new Float32Array(n);
  const speed = new Float32Array(n);

  // cluster centers spread on a sphere (Fibonacci lattice)
  const centers = d3.range(K).map((k) => {
    const y = 1 - (2 * (k + 0.5)) / K;
    const r = Math.sqrt(1 - y * y);
    const th = k * Math.PI * (3 - Math.sqrt(5));
    return [1.5 * r * Math.cos(th), 1.5 * y, 1.5 * r * Math.sin(th)];
  });

  for (let i = 0; i < n; i++) {
    const k = i % K;
    label[i] = k;
    for (let d = 0; d < 3; d++) {
      noise[i * 3 + d] = normal() * 0.85;
      cluster[i * 3 + d] = centers[k][d] + normal() * 0.26;
    }
    const t = (k + rnd()) / K;
    const a = t * Math.PI * 4;
    helix[i * 3] = 1.25 * Math.cos(a) + normal() * 0.06;
    helix[i * 3 + 1] = (t - 0.5) * 3.2 + (rnd() - 0.5) * 0.4;
    helix[i * 3 + 2] = 1.25 * Math.sin(a) + normal() * 0.06;
    delay[i] = rnd() * 700;
    speed[i] = 0.03 + rnd() * 0.05;
  }
  return { label, noise, cluster, helix, delay, speed };
}

export default function EmbeddingCloud({ scrollyId, step: stepProp = 0, n = 4000 }: Props) {
  const steps = useStore(scrollySteps);
  const step = scrollyId ? steps[scrollyId] ?? 0 : stepProp;
  const palette = usePalette();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepRef = useRef({ step, at: 0 });
  const paletteRef = useRef<Palette | null>(null);
  paletteRef.current = palette;

  useEffect(() => {
    stepRef.current = { step, at: performance.now() };
  }, [step]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const data = build(n);
    const cur = data.noise.slice();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, dpr = 1;
    const ro = new ResizeObserver(([e]) => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = e.contentRect.width;
      h = e.contentRect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    });
    ro.observe(canvas);

    // rotation state, with drag + inertia
    let yaw = 0.6, pitch = 0.25, vel = 0;
    let dragging = false, lastX = 0, lastY = 0;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      vel = (e.clientX - lastX) * 0.006;
      yaw += vel;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    // only animate while on screen
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);

    // per-batch path buffers: K colored + 1 gray
    const paths: Path2D[] = [];
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const pal = paletteRef.current;
      if (!visible || !pal || !w) return;

      const { step: s, at } = stepRef.current;
      const target = s <= 0 ? data.noise : s >= 3 ? data.helix : data.cluster;
      const elapsed = now - at;

      for (let i = 0; i < n; i++) {
        if (!reduced && elapsed < data.delay[i] * 0.6) continue;
        const k = reduced ? 1 : data.speed[i];
        for (let d = 0; d < 3; d++) {
          const j = i * 3 + d;
          cur[j] += (target[j] - cur[j]) * k;
        }
      }

      if (!dragging) {
        vel *= 0.95;
        yaw += vel + (reduced ? 0 : 0.0018);
      }
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const scale = Math.min(w, h) * 0.2;
      const focal = 4.5;

      for (let b = 0; b <= K; b++) paths[b] = new Path2D();
      for (let i = 0; i < n; i++) {
        const x = cur[i * 3], y = cur[i * 3 + 1], z = cur[i * 3 + 2];
        const x1 = cy * x + sy * z;
        const z1 = -sy * x + cy * z;
        const y1 = cp * y - sp * z1;
        const z2 = sp * y + cp * z1;
        const persp = focal / (focal + z2);
        const px = w / 2 + x1 * scale * persp;
        const py = h / 2 - y1 * scale * persp;
        const r = 1.6 * persp;
        const colored = s >= 2 && (reduced || elapsed > data.delay[i]);
        const p = paths[colored ? data.label[i] : K];
        p.moveTo(px + r, py);
        p.arc(px, py, r, 0, Math.PI * 2);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = pal.dark ? 'lighter' : 'source-over';
      ctx.globalAlpha = pal.dark ? 0.75 : 0.8;
      for (let b = 0; b <= K; b++) {
        ctx.fillStyle = b === K ? pal.muted : pal.cats[b];
        ctx.fill(paths[b]);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [n]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="3D point cloud of embeddings; drag to rotate"
      style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', maxHeight: '90svh', cursor: 'grab', touchAction: 'pan-y' }}
    />
  );
}
