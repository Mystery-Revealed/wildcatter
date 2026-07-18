// PriceTicker.jsx — the oil-price ticker that runs across the top of the game the
// whole way through (spec §1). It is DISPLAY ONLY: the server never scores it and
// choices never move it. History drives it. Each era ships a `price` object
// { startCents, endCents, note, settleCents?, settleNote? }; the ticker counts
// from the last shown value to this era's endCents when a new era arrives, so the
// price visibly swings — spiking near $1.85 before the gusher and crashing to 3¢
// in the glut. On the RESULT screen, `settled` climbs it back to about a dollar
// (1931 prorationing) after a short beat — the recovery, not a zeroing-out.
//
// Values are CENTS PER BARREL (integers). Display: under 100 shows as "3¢"/"45¢";
// 100+ shows as dollars, e.g. "$1.85" / "$1.00".

import { useEffect, useRef, useState } from 'react';

const PRICE_CEILING = 200; // ~$2.00/barrel — the bar's full width (pre-gusher high)

// Count the displayed number from a → b over `ms`, easing out. Browser rAF; this
// is client code, so performance.now() is fine here. Works up OR down (the price
// both spikes and crashes), so easeOutCubic covers a rise and a fall alike.
function useCountTo(target, initialFrom, ms = 1300) {
  // Seed the very first render from the era's own startCents (e.g. the ~$1.85
  // pre-gusher price) instead of jumping straight to endCents, so the player
  // actually SEES the price the note text describes before it moves. Later era
  // changes ignore initialFrom (lazy useState/useRef only run once) and chain
  // naturally from whatever the ticker last settled on.
  const [shown, setShown] = useState(initialFrom ?? target);
  const fromRef = useRef(initialFrom ?? target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) { setShown(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);

  // Keep the "from" anchored to the latest settled value if target jumps again.
  useEffect(() => { fromRef.current = shown; }, [shown]);

  return shown;
}

// Cents → a barrel price string. Under a dollar reads in cents; a dollar or more
// reads in dollars-and-cents.
export function priceLabel(cents) {
  const c = Math.max(0, Math.round(cents));
  if (c >= 100) return '$' + (c / 100).toFixed(2);
  return c + '¢';
}

export default function PriceTicker({ price, settled = false }) {
  // The running price: during an era, swing to this era's end; on the result
  // screen when `settled`, climb to the settle value (prorationing recovery).
  const target = settled
    ? (price?.settleCents ?? price?.endCents ?? 0)
    : (price?.endCents ?? price?.startCents ?? 0);
  const shown = useCountTo(target, price?.startCents);
  if (!price) return null;

  const pct = Math.min(100, Math.max(1.5, (shown / PRICE_CEILING) * 100));
  const note = settled ? (price?.settleNote || '') : (price?.note || '');
  const low = !settled && shown <= 20; // a crashing/near-bottom price reads red

  return (
    <div className={`price-ticker ${settled ? 'settled' : ''} ${low ? 'low' : ''}`} role="group" aria-label="Oil price per barrel">
      <div className="price-row">
        <span className="price-label">
          <span aria-hidden="true">🛢️</span> Oil Price · per barrel
        </span>
        <span className="price-amount" aria-live="polite">{priceLabel(shown)}</span>
        {settled && <span className="price-settle-year">1931</span>}
      </div>
      <div className="price-track" aria-hidden="true">
        <div className="price-fill" style={{ width: `${pct}%` }} />
      </div>
      {note && <div className="price-note">{note}</div>}
    </div>
  );
}
