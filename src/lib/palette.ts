import { useEffect, useState } from 'react';

// Categorical palette shared by every figure. Mirrors the --c* tokens in
// global.css so SVG (via CSS vars) and canvas (via this hook) agree.
const TOKENS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'] as const;

export interface Palette {
  cats: string[];
  ink: string;
  muted: string;
  grid: string;
  bg: string;
  dark: boolean;
}

function read(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    cats: TOKENS.map(v),
    ink: v('--ink'),
    muted: v('--muted'),
    grid: v('--grid'),
    bg: v('--bg'),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  };
}

// Canvas/WebGL can't use CSS variables directly; this re-reads them when the
// color scheme flips.
export function usePalette(): Palette | null {
  const [p, setP] = useState<Palette | null>(null);
  useEffect(() => {
    setP(read());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setP(read());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return p;
}
