import { useMemo, useState } from 'react';

// Linked views: the arc diagram and the heatmap show the same attention
// weights. Hover a row (or a token) to pick the query.

interface Head {
  name: string;
  // Unnormalized score for query i attending to key j (j <= i).
  score: (i: number, j: number, tokens: string[]) => number;
}

const HEADS: Head[] = [
  { name: 'Previous token', score: (i, j) => (j === i - 1 ? 4 : i === 0 && j === 0 ? 4 : 0) },
  { name: 'Attention sink', score: (i, j) => (j === 0 ? 3 : j === i ? 1.2 : 0) },
  {
    name: 'Coreference',
    score: (i, j, t) => {
      if (t[i] === 'it') return t[j] === 'cat' ? 3.4 : t[j] === 'mat' ? 2.6 : 0;
      return j === i ? 2.5 : 0;
    },
  },
  { name: 'Local window', score: (i, j) => -0.9 * (i - j) },
];

// Causal softmax over each row.
function weights(head: Head, tokens: string[]): number[][] {
  return tokens.map((_, i) => {
    const s = tokens.map((_, j) => (j <= i ? head.score(i, j, tokens) : -Infinity));
    const m = Math.max(...s);
    const e = s.map((v) => (v === -Infinity ? 0 : Math.exp(v - m)));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / z);
  });
}

interface Props {
  tokens?: string[];
}

export default function AttentionMatrix({ tokens = 'The cat sat on the mat because it was warm'.split(' ') }: Props) {
  const [head, setHead] = useState(2);
  const [q, setQ] = useState(Math.max(0, tokens.indexOf('it')));
  const W = useMemo(() => weights(HEADS[head], tokens), [head, tokens]);

  const n = tokens.length;
  const width = 720;
  const left = 78;
  const right = 12;
  const cell = (width - left - right) / n;
  const arcTop = 12;
  const tokenY = 150;
  const gridTop = tokenY + 26;
  const height = gridTop + n * cell + 8;
  const cx = (j: number) => left + (j + 0.5) * cell;

  return (
    <div>
      <div className="viz-controls" role="group" aria-label="Attention head">
        {HEADS.map((h, i) => (
          <button key={h.name} className="chip" aria-pressed={i === head} onClick={() => setHead(i)}>
            {h.name}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* arcs from the query to every key it can see */}
        {W[q].map((w, j) => {
          if (w < 0.005) return null;
          const x0 = cx(q);
          const x1 = cx(j);
          const y = tokenY - 18;
          if (j === q) {
            return (
              <circle key={j} cx={x0} cy={y - 14} r={12} fill="none" stroke="var(--c1)"
                strokeWidth={1 + w * 12} strokeOpacity={0.25 + 0.75 * w} />
            );
          }
          const h = Math.min(tokenY - arcTop - 24, Math.abs(x1 - x0) * 0.55);
          return (
            <path key={j} d={`M${x0},${y} Q${(x0 + x1) / 2},${y - h * 2} ${x1},${y}`} fill="none"
              stroke="var(--c1)" strokeLinecap="round" strokeWidth={1 + w * 14}
              strokeOpacity={0.2 + 0.8 * w} style={{ transition: 'stroke-width 200ms, stroke-opacity 200ms' }} />
          );
        })}

        {/* token row */}
        {tokens.map((t, j) => (
          <text key={j} x={cx(j)} y={tokenY} textAnchor="middle" onMouseEnter={() => setQ(j)}
            style={{ font: `${j === q ? 700 : 500} 13px var(--mono)`, cursor: 'pointer' }}
            fill={j === q ? 'var(--c1)' : j <= q ? 'var(--ink)' : 'var(--muted)'}>
            {t}
          </text>
        ))}

        {/* heatmap: row = query, column = key */}
        {W.map((row, i) => (
          <g key={i} onMouseEnter={() => setQ(i)} style={{ cursor: 'pointer' }}>
            <text x={left - 10} y={gridTop + (i + 0.5) * cell} textAnchor="end" dominantBaseline="middle"
              fill={i === q ? 'var(--c1)' : 'var(--muted)'} style={{ font: `${i === q ? 700 : 400} 12px var(--mono)` }}>
              {tokens[i]}
            </text>
            {row.map((w, j) => (
              <rect key={j} x={left + j * cell + 1} y={gridTop + i * cell + 1} width={cell - 2} height={cell - 2} rx={3}
                fill={j > i ? 'var(--surface)' : 'var(--c1)'}
                fillOpacity={j > i ? 1 : 0.06 + 0.94 * Math.pow(w, 0.7)}
                style={{ transition: 'fill-opacity 200ms' }} />
            ))}
            {i === q && (
              <rect x={left - 1} y={gridTop + i * cell} width={n * cell + 2} height={cell} rx={4}
                fill="none" stroke="var(--ink)" strokeWidth={1.5} />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
