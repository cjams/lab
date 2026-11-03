import { useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

// Explorable: drag temperature, watch the next-character distribution
// sharpen or flatten, and draw samples from it.

interface Props {
  prompt?: string;
  // Next-token candidates and their logits. Defaults are illustrative.
  candidates?: { token: string; logit: number }[];
}

const DEFAULT = [
  { token: 'o', logit: 3.1 },
  { token: 'a', logit: 2.2 },
  { token: 'e', logit: 1.9 },
  { token: 'i', logit: 1.2 },
  { token: 'r', logit: 0.8 },
  { token: 'l', logit: 0.4 },
  { token: 'u', logit: 0.1 },
  { token: '␣', logit: -0.4 },
  { token: 'x', logit: -1.2 },
  { token: 'q', logit: -2.0 },
];

const tScale = d3.scaleLog().domain([0.1, 5]).range([0, 1000]);
const fmtP = d3.format('.1%');

export default function TemperatureSoftmax({ prompt = 'the quick brown f', candidates = DEFAULT }: Props) {
  const [slider, setSlider] = useState(tScale(1));
  const [samples, setSamples] = useState<string[]>([]);
  const T = tScale.invert(slider);
  const rng = useRef(d3.randomLcg(7));

  const probs = useMemo(() => {
    const z = candidates.map((c) => c.logit / T);
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = d3.sum(e);
    return e.map((v) => v / s);
  }, [candidates, T]);

  const entropy = -d3.sum(probs, (p) => (p > 0 ? p * Math.log2(p) : 0));

  const sample = () => {
    const draws = Array.from({ length: 24 }, () => {
      let u = rng.current();
      for (let i = 0; i < probs.length; i++) if ((u -= probs[i]) <= 0) return candidates[i].token;
      return candidates[candidates.length - 1].token;
    });
    setSamples(draws);
  };

  return (
    <div className="temp-softmax">
      <div className="viz-controls">
        <label htmlFor="temp">Temperature</label>
        <input
          id="temp"
          type="range"
          min={0}
          max={1000}
          value={slider}
          onChange={(e) => setSlider(+e.target.value)}
        />
        <span className="readout">T = {T.toFixed(2)}</span>
        <span className="readout">H = {entropy.toFixed(2)} bits</span>
        <button className="chip" onClick={sample}>
          Sample ×24
        </button>
      </div>

      <div style={{ font: '500 1rem var(--mono)', marginBottom: '0.75rem' }}>
        <span style={{ color: 'var(--muted)' }}>{prompt}</span>
        <span style={{ color: 'var(--accent)' }}>▍</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${candidates.length}, 1fr)`, gap: 6, height: 220, alignItems: 'end' }}>
        {candidates.map((c, i) => (
          <div key={c.token} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ font: '0.7rem var(--mono)', color: 'var(--muted)', marginBottom: 4 }}>{fmtP(probs[i])}</span>
            <div
              style={{
                width: '100%',
                height: `${probs[i] * 100}%`,
                minHeight: 2,
                borderRadius: '4px 4px 0 0',
                background: i === 0 ? 'var(--c1)' : 'var(--c2)',
                opacity: 0.35 + 0.65 * Math.sqrt(probs[i] / Math.max(...probs)),
                transition: 'height 220ms cubic-bezier(.2,.7,.3,1), opacity 220ms',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${candidates.length}, 1fr)`, gap: 6, borderTop: '1px solid var(--grid)', paddingTop: 6 }}>
        {candidates.map((c) => (
          <span key={c.token} style={{ textAlign: 'center', font: '600 0.95rem var(--mono)' }}>
            {c.token}
          </span>
        ))}
      </div>

      <div style={{ font: '0.95rem var(--mono)', minHeight: '1.6em', marginTop: '0.75rem', letterSpacing: '0.15em', color: 'var(--ink)' }}>
        {samples.length ? samples.join('') : <span style={{ color: 'var(--muted)', letterSpacing: 0 }}>samples appear here</span>}
      </div>
    </div>
  );
}
