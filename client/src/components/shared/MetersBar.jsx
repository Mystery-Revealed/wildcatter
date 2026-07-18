// MetersBar.jsx — the three 0–100 meters. Icons + labels + numbers, never
// color alone. Flashes a +/- chip when a meter changes.

import { useEffect, useRef, useState } from 'react';

const ICONS = { cash: '💵', wells: '🛢️', reputation: '🤝' };

export default function MetersBar({ meters, meta, compact = false, title }) {
  const prev = useRef(meters);
  const [deltas, setDeltas] = useState({});

  useEffect(() => {
    const d = {};
    for (const k of Object.keys(meters || {})) {
      const change = (meters[k] ?? 0) - (prev.current?.[k] ?? meters[k]);
      if (change !== 0) d[k] = change;
    }
    prev.current = meters;
    if (Object.keys(d).length) {
      setDeltas(d);
      const t = setTimeout(() => setDeltas({}), 2400);
      return () => clearTimeout(t);
    }
  }, [meters]);

  if (!meters) return null;

  return (
    <div className={`meters ${compact ? 'compact' : ''}`}>
      {title && <div className="meters-title">{title}</div>}
      {Object.entries(meters).map(([key, value]) => {
        const info = meta?.meters?.[key] || { name: key };
        const low = value <= 15; // any meter running dangerously low
        return (
          <div key={key} className="meter" title={info.blurb}>
            <span className="meter-icon" aria-hidden="true">{ICONS[key] || '•'}</span>
            <span className="meter-name">{info.name}</span>
            <div className={`meter-track ${low ? 'danger' : ''}`} role="meter"
                 aria-valuenow={value} aria-valuemin="0" aria-valuemax="100"
                 aria-label={`${info.name}: ${value} of 100`}>
              <div className={`meter-fill m-${key}`} style={{ width: `${value}%` }} />
            </div>
            <span className="meter-value">{value}</span>
            {deltas[key] != null && (
              <span className={`meter-delta ${deltas[key] > 0 ? 'up' : 'down'}`}>
                {deltas[key] > 0 ? `+${deltas[key]}` : deltas[key]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
