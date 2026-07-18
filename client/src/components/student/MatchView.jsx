// MatchView.jsx — one era beat at a time: event card → your call → feedback.
// Solo, so it's always your turn. The OIL-PRICE TICKER runs across the top the
// whole game (spec §1); alongside the choices, the Rig Panel shows the wildcat
// lease building up and the thirty years passing — the status view that replaces
// a map (spec §1, §3).

import { useEffect, useState } from 'react';
import { emitAck, errorText } from '../../services/socket.js';
import { Art } from '../../services/assets.jsx';
import RigPanel from '../shared/RigPanel.jsx';
import PriceTicker from '../shared/PriceTicker.jsx';
import MetersBar from '../shared/MetersBar.jsx';

const wildcatterScore = (m) => (m ? (m.cash || 0) + (m.wells || 0) + (m.reputation || 0) : 0);

export default function MatchView({ state, dispatch }) {
  const { match } = state;
  const { eventCard, turn, feedback } = match;
  const meta = match.begin.meta;

  const phase = eventCard?.chapter || turn?.chapter;
  const chapterIndex = phase?.index ?? 0;

  // Any meter running dangerously low (color is never the only signal).
  const lowMeter = Object.entries(match.meters || {}).find(([, v]) => v <= 15);

  return (
    <div className="match">
      <header className="match-header">
        <div className="nation-chip wildcatter">🛢️ <b>Wildcatter</b></div>
        <div className="trail-chip" title="Everyone plays the same independent oil driller">Texas oil boom</div>
        <div className="hold-chip" title="Your three meters added up (max 300)">
          Wildcatter Score <b>{wildcatterScore(match.meters)}</b><span className="muted"> / 300</span>
        </div>
        {phase && (
          <div className="chapter-chip">
            Era {phase.index + 1} of {phase.count} · {phase.date}
          </div>
        )}
      </header>

      <PriceTicker price={match.price} />

      <div className="meters-row solo">
        <MetersBar meters={match.meters} meta={meta} title="Your outfit" />
      </div>

      {lowMeter && !feedback && (
        <div className="banner danger" role="alert">
          ⚠️ Your {meta.meters[lowMeter[0]]?.name || lowMeter[0]} is running very low. Tend to it —
          the boom is quick to forget a driller who runs out of it.
        </div>
      )}

      <div className="match-body">
        <section className="action-panel" aria-live="polite">
          {feedback ? (
            <FeedbackPanel
              feedback={feedback}
              meta={meta}
              matchEnded={!!state.matchEnd}
              onContinue={() => dispatch({ type: 'dismiss-feedback' })}
            />
          ) : eventCard ? (
            <EventCard eventCard={eventCard} meta={meta} onContinue={() => dispatch({ type: 'dismiss-event' })} />
          ) : turn?.yourTurn ? (
            <DecisionPanel turn={turn} />
          ) : (
            <div className="waiting-panel"><div className="pulse-dot" aria-hidden="true" /><p>Out on the lease…</p></div>
          )}
        </section>

        <section className="map-panel">
          <RigPanel meters={match.meters} chapterIndex={chapterIndex} />
        </section>
      </div>
    </div>
  );
}

/* -------- panels -------- */

function EventCard({ eventCard, meta, onContinue }) {
  const ch = eventCard.chapter;
  return (
    <div className="event-card">
      <div className="event-kicker">Era {ch.index + 1} of {ch.count} · {ch.date}</div>
      <h2>{ch.title}</h2>
      <Art name={ch.image} alt={ch.title} className="event-art" />
      <p className="event-text">{eventCard.text}</p>
      {eventCard.eventEffects && (
        <div className="effects-row">
          {Object.entries(eventCard.eventEffects).map(([k, v]) => (
            <span key={k} className={`effect-chip ${v > 0 ? 'up' : 'down'}`}>
              {meta.meters[k]?.name} {v > 0 ? `+${v}` : v}
            </span>
          ))}
        </div>
      )}
      <button className="btn big" onClick={onContinue}>Get to work</button>
    </div>
  );
}

function DecisionPanel({ turn }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setBusy(false); setErr(''); }, [turn?.stepIndex]);

  async function choose(choiceIndex) {
    if (busy) return;
    setBusy(true);
    const res = await emitAck('student:submit_move', { move: { kind: 'decision', choiceIndex } });
    if (!res.ok) { setErr(errorText(res.error)); setBusy(false); }
    // On success the server pushes turn:resolution and this panel unmounts.
  }

  return (
    <div className="move-panel">
      <h2>🖋 Your call, wildcatter</h2>
      <p className="prompt">{turn.prompt}</p>
      {turn.hint && <p className="hint">💡 {turn.hint}</p>}
      <div className="choice-list">
        {(turn.choices || []).map((label, i) => (
          <button key={i} className="choice-btn" disabled={busy} onClick={() => choose(i)}>
            {label}
          </button>
        ))}
      </div>
      <p className="err" role="alert">{err}</p>
    </div>
  );
}

const VERDICT_UI = {
  right: { label: 'Struck it right', className: 'right', icon: '✓' },
  partial: { label: 'A hard lesson', className: 'partial', icon: '≈' },
  wrong: { label: 'A costly call', className: 'wrong', icon: '✗' },
};

function FeedbackPanel({ feedback, meta, matchEnded, onContinue }) {
  const v = VERDICT_UI[feedback.verdict] || VERDICT_UI.partial;
  return (
    <div className="feedback-panel">
      <div className={`verdict-badge ${v.className}`}>
        <span aria-hidden="true">{v.icon}</span> {v.label}
      </div>
      <p className="feedback-text">{feedback.feedback}</p>
      <div className="effects-row">
        {Object.entries(feedback.effects || {}).map(([k, val]) => (
          <span key={k} className={`effect-chip ${val > 0 ? 'up' : 'down'}`}>
            {meta.meters[k]?.name} {val > 0 ? `+${val}` : val}
          </span>
        ))}
      </div>
      <button className="btn big" onClick={onContinue}>
        {matchEnded ? 'See how it ends' : 'Continue'}
      </button>
    </div>
  );
}
