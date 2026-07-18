// ResultScreen.jsx — the end of the thirty years. In order: (1) the oil-price
// ticker does one last thing — after the East Texas crash, it climbs back toward a
// dollar (1931 prorationing steadies the price), (2) how your outfit fared
// (Wildcatter Score + ending tier), (3) the score that matters to your teacher —
// accuracy — then the debrief: how oil industrialized Texas and taught it the hard
// rhythm of boom and bust (TEKS 7.7A / 7.7B / 7.12B).

import { useEffect, useState } from 'react';
import { Art } from '../../services/assets.jsx';
import PriceTicker from '../shared/PriceTicker.jsx';

const TIER_CLASS = { top: 'win', mid: 'mid', low: 'low' };

// Fallback mirrors Era 6's price object (used only if the live value is missing).
const FALLBACK_PRICE = {
  era: 6, startCents: 100, endCents: 10,
  note: 'East Texas crashes the price toward another bust.',
  settleCents: 100,
  settleNote: 'In 1931, the Railroad Commission orders prorationing -- limits on how much each well may pump. Slowly, the price climbs back to about a dollar a barrel. The bust that finally taught Texas to manage the boom.',
};

export default function ResultScreen({ state, onPlayAgain }) {
  const end = state.matchEnd;
  const meta = end.meta || state.match?.begin?.meta;
  const you = end.you;
  const ending = you.ending;
  const score = you.score ?? 0;

  // The price ticker's final act: hold on the East Texas crash for a beat, then
  // climb back toward a dollar as 1931 prorationing steadies the field.
  const finalPrice = state.match?.price || FALLBACK_PRICE;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="card result-screen">
      <div className="event-kicker">The Texas Oil Boom · 1901–1931</div>
      <h1 className={`result-headline ${TIER_CLASS[ending.key] || 'mid'}`}>{ending.title}</h1>

      <div className="result-price">
        <PriceTicker price={finalPrice} settled={settled} />
        <p className="result-price-cap">
          For thirty years the price spiked and crashed. In 1931, at last, Texas
          found a way to steady it — and manage the boom.
        </p>
      </div>

      <Art name="event_ending.jpg" alt="An older oilman on a refinery catwalk at dusk, pipelines running to Gulf ships on the horizon" className="result-art" />

      <p className="fall-note">
        This game measured how well you drilled a boom you <b>could not control</b>.
        The oil price spiked and crashed on history's schedule, no matter what — because
        that is exactly what happened. The real skill was respecting the ticker: reading
        the rocks, capping your wells, slowing your pumps in the glut, and keeping a name
        people trusted through every bust.
      </p>

      <div className="ending-block mission">
        <p>{ending.text}</p>
      </div>

      <div className="score-block" aria-label="Wildcatter Score">
        <div className="score-head">
          <span className="score-title">🛢️ Wildcatter Score</span>
          <span className="score-num">{score}<span className="muted"> / 300</span></span>
        </div>
        <span className="score-bar-track">
          <span className={`score-bar ${TIER_CLASS[ending.key] || 'mid'}`} style={{ width: `${Math.min(100, (score / 300) * 100)}%` }} />
        </span>
        <div className="meter-final-row">
          {Object.entries(you.meters || {}).map(([k, v]) => (
            <span key={k} className="meter-final">{meta?.meters?.[k]?.name || k}: <b>{v}</b></span>
          ))}
        </div>
      </div>

      <div className="accuracy-block">
        <div className="accuracy-number">{you.accuracy}%</div>
        <div>
          <b>Your accuracy — the score your teacher sees.</b>
          <p>
            How well your calls matched the smart driller's move: reading the rocks,
            capping your wells, slowing your pumps in the glut, dealing fair, and
            knowing that boom and bust were never yours to stop.
          </p>
        </div>
      </div>

      <div className="debrief">
        <h3>What really happened</h3>
        <p>{you.debrief}</p>
      </div>

      <div className="btn-col">
        <button className="btn big" onClick={onPlayAgain}>Drill the thirty years again</button>
        <p className="replay-nudge muted">Try new choices — how high can you keep your outfit while the price swings?</p>
      </div>
    </div>
  );
}
