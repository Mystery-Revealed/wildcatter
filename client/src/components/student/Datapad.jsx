// Datapad.jsx — the student game. A small state machine over socket pushes:
// title → how to play → join → (approval) → briefing → match (6 eras) → result.
// Everyone is the SAME person, an independent Texas oil driller — there is no
// "pick" and no rival, so the class is one accuracy group. The server owns all
// truth; this component only renders what it's told.

import { useEffect, useReducer, useRef, useState } from 'react';
import { getSocket, emitAck, errorText } from '../../services/socket.js';
import { Art } from '../../services/assets.jsx';
import MatchView from './MatchView.jsx';
import ResultScreen from './ResultScreen.jsx';

// The one class-wide side. It matches the server's single variant key.
const SIDE = 'wildcatter';

const initialState = {
  screen: 'title', // title | how | join | waiting_approval | briefing | match | result | ended
  joinCode: '',
  name: '',
  studentId: null,
  error: '',
  endedMessage: '',
  match: null,
  matchEnd: null,
};

function freshMatch(begin) {
  return {
    begin,
    map: begin.map,
    meters: begin.meters,
    price: null,     // latest oil-price-ticker value (from chapter:event) — display only
    eventCard: null,
    turn: null,
    feedback: null,
  };
}

// Merge live payloads (chapter:event, turn:begin, turn:resolution) into the match.
function mergeLive(match, payload) {
  const next = { ...match };
  if (payload.map) next.map = payload.map;
  if (payload.meters) next.meters = payload.meters;
  if (payload.price) next.price = payload.price;   // oil-price ticker rides along
  return next;
}

function reducer(state, action) {
  switch (action.type) {
    case 'ui':
      return { ...state, ...action.patch };
    case 'joined':
      return {
        ...state,
        studentId: action.studentId,
        error: '',
        matchEnd: null,
        match: null,
        screen: action.approved ? 'briefing' : 'waiting_approval',
      };
    case 'approved':
      return { ...state, screen: state.screen === 'waiting_approval' ? 'briefing' : state.screen };
    case 'match:begin':
      return { ...state, screen: 'match', matchEnd: null, match: freshMatch(action.payload) };
    case 'chapter:event': {
      if (!state.match) return state;
      const match = mergeLive(state.match, action.payload);
      return { ...state, match: { ...match, eventCard: action.payload } };
    }
    case 'turn:begin': {
      if (!state.match) return state;
      const match = mergeLive(state.match, action.payload);
      return { ...state, match: { ...match, turn: action.payload } };
    }
    case 'turn:resolution': {
      if (!state.match) return state;
      const match = mergeLive(state.match, action.payload);
      return { ...state, match: { ...match, feedback: action.payload } };
    }
    case 'match:end': {
      // Hold the result until pending feedback is dismissed (chronological order).
      const showNow = !state.match?.feedback;
      return { ...state, matchEnd: action.payload, screen: showNow ? 'result' : state.screen };
    }
    case 'dismiss-feedback': {
      if (!state.match) return state;
      if (state.matchEnd) return { ...state, screen: 'result', match: { ...state.match, feedback: null } };
      return { ...state, match: { ...state.match, feedback: null } };
    }
    case 'dismiss-event':
      return state.match ? { ...state, match: { ...state.match, eventCard: null } } : state;
    case 'sync': {
      const s = action.sync;
      if (s.screen === 'waiting_approval') return { ...state, screen: 'waiting_approval' };
      if (s.screen === 'lobby') return { ...state, screen: 'briefing' };
      if (s.screen === 'result') return { ...state, screen: 'result', matchEnd: s.matchEnd };
      if (s.screen === 'match') {
        const base = mergeLive(freshMatch(s.matchBegin), s.chapterEvent || {});
        return {
          ...state,
          screen: 'match',
          matchEnd: null,
          match: { ...mergeLive(base, s.turn || {}), eventCard: s.chapterEvent, turn: s.turn },
        };
      }
      return state;
    }
    case 'removed':
      return { ...initialState, screen: 'join', joinCode: state.joinCode, name: '', error: 'Your teacher removed you from the session. You can join again.' };
    case 'ended':
      return { ...initialState, screen: 'ended', endedMessage: 'Your teacher ended this session. The rig is shut down — until next time.' };
    case 'replay':
      // Re-join for another run (a fresh match); the server issues a new record.
      return { ...state, matchEnd: null, match: null, error: '', screen: 'briefing' };
    default:
      return state;
  }
}

export default function Datapad() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const socket = getSocket();
    const on = (event, type) => {
      const fn = (payload) => dispatch({ type, payload });
      socket.on(event, fn);
      return [event, fn];
    };
    const subs = [
      on('match:begin', 'match:begin'),
      on('chapter:event', 'chapter:event'),
      on('turn:begin', 'turn:begin'),
      on('turn:resolution', 'turn:resolution'),
      on('match:end', 'match:end'),
    ];
    const approved = () => dispatch({ type: 'approved' });
    const removed = () => dispatch({ type: 'removed' });
    const ended = () => dispatch({ type: 'ended' });
    socket.on('join:approved', approved);
    socket.on('student:removed', removed);
    socket.on('session:ended', ended);

    // School wifi blip: the socket reconnects → re-attach and re-sync the screen.
    const onReconnect = async () => {
      const s = stateRef.current;
      if (!s.studentId || !s.joinCode) return;
      const res = await emitAck('student:rejoin', { joinCode: s.joinCode, studentId: s.studentId });
      if (res.ok) dispatch({ type: 'sync', sync: res.sync });
    };
    socket.io.on('reconnect', onReconnect);

    return () => {
      for (const [event, fn] of subs) socket.off(event, fn);
      socket.off('join:approved', approved);
      socket.off('student:removed', removed);
      socket.off('session:ended', ended);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  // The one join call — mode solo, the single class-wide side. Join and replay.
  async function doJoin(joinCode, name) {
    const res = await emitAck('student:join', {
      joinCode: (joinCode || '').trim(), nickname: (name || '').trim(), mode: 'solo', nation: SIDE,
    });
    if (!res.ok) {
      dispatch({ type: 'ui', patch: { error: errorText(res.error), screen: 'join' } });
      return false;
    }
    dispatch({ type: 'joined', studentId: res.studentId, approved: res.approved });
    return true;
  }

  function playAgain() {
    const s = stateRef.current;
    dispatch({ type: 'replay' });
    doJoin(s.joinCode, s.name);
  }

  const { screen } = state;
  return (
    <div className="app student-app">
      {screen === 'title' && <TitleScreen onStart={() => dispatch({ type: 'ui', patch: { screen: 'join' } })} onHow={() => dispatch({ type: 'ui', patch: { screen: 'how' } })} />}
      {screen === 'how' && <HowToPlay onBack={() => dispatch({ type: 'ui', patch: { screen: 'title' } })} />}
      {screen === 'join' && <JoinForm state={state} dispatch={dispatch} onJoin={doJoin} />}
      {screen === 'waiting_approval' && (
        <WaitCard title="Hold tight!" text="Your teacher is checking names. Your thirty years in the oil patch begin in a moment." />
      )}
      {screen === 'briefing' && (
        <WaitCard title="Spindletop just blew in." text="A hundred feet of oil in the sky, and every fool with a dollar is running to Beaumont. Your first big call is being drawn up. Ready your nerve." />
      )}
      {screen === 'match' && state.match && <MatchView state={state} dispatch={dispatch} />}
      {screen === 'result' && state.matchEnd && <ResultScreen state={state} onPlayAgain={playAgain} />}
      {screen === 'ended' && (
        <WaitCard title="Session ended" text={state.endedMessage}>
          <button className="btn" onClick={() => dispatch({ type: 'ui', patch: { ...initialState, screen: 'title' } })}>
            Back to the title screen
          </button>
        </WaitCard>
      )}
      <footer className="app-footer">Made for 7th Grade Texas History · TEKS 7.7A, 7.7B, 7.1B, 7.12B</footer>
    </div>
  );
}

/* ---------------- small screens ---------------- */

function TitleScreen({ onStart, onHow }) {
  return (
    <div className="card title-screen">
      <Art name="event_gusher.jpg" alt="The Lucas Gusher: a black fountain of oil towering over a wooden derrick on a bare hill near Beaumont, tiny figures running, dawn light, 1901" className="hero-art" />
      <h1 className="game-title">Wildcatter</h1>
      <p className="tagline">Strike oil, survive the busts, and become a driller people trust.</p>
      <p className="title-blurb">
        January 10, 1901: a hill near Beaumont erupts a hundred feet of oil into
        the sky, and nothing in Texas is ever the same. You are a <b>wildcatter</b>
        {' '}— an independent oil driller with a little money and a lot of nerve. Over
        thirty years and six eras, you'll drill, sell, and deal while an <b>oil-price
        ticker</b> spikes and crashes across the top of your screen. You can't stop
        the boom and bust. But you can read the rocks, respect the price, and keep a
        good name — and that's the whole game.
      </p>
      <div className="btn-col">
        <button className="btn big" onClick={onStart}>Join your class</button>
        <button className="btn secondary" onClick={onHow}>How to play</button>
      </div>
    </div>
  );
}

function HowToPlay({ onBack }) {
  return (
    <div className="card how-screen">
      <h2>How to play</h2>
      <ol className="how-list">
        <li><b>Join with your class code</b> and take up your drilling outfit.</li>
        <li><b>Work through 6 eras</b>, from 1901 to 1931. In each one you make <b>two calls</b> — pick 1 of 3 answers to a hard money question.</li>
      </ol>
      <div className="how-grid">
        <div className="how-card"><span className="how-icon">🛢️</span><b>The price swings on its own</b><p>An oil-price ticker runs across the top. It spikes and crashes with history no matter what you do — from almost $2 a barrel down to just 3 cents. You can't stop it. The smart move is to respect it.</p></div>
        <div className="how-card"><span className="how-icon">💵</span><b>Drill smart anyway</b><p>Good choices grow your three meters and build up your lease — even when the price crashes. That is the real game.</p></div>
      </div>
      <h3>Your three meters</h3>
      <ul className="how-list">
        <li>💵 <b>Cash</b> — money on hand to lease land, pay crews, and buy your next rig.</li>
        <li>🛢️ <b>Wells</b> — your producing capacity: how many wells are down and pumping.</li>
        <li>🤝 <b>Reputation</b> — trust with crews, landowners, and buyers. The good name a swindler never keeps.</li>
      </ul>
      <div className="note">
        <b>Drill smart, and learn the history.</b> Your <b>Wildcatter Score</b> is your
        three meters added up. But the score your teacher sees is your <b>accuracy</b> —
        how well your calls match the smart driller's move. Spoiler from history: nobody
        could stop oil's booms and busts. The winners were the drillers who read the
        rocks, slowed down in the glut, and kept their word.
      </div>
      <h3>Words to know</h3>
      <ul className="how-list">
        <li><b>Wildcatter</b> — an independent oil driller who takes big risks looking for new oil.</li>
        <li><b>Gusher</b> — a well where oil blows up out of the ground under its own pressure.</li>
        <li><b>Glut</b> — far more oil for sale than anyone wants to buy, which crashes the price.</li>
        <li><b>Supply and demand</b> — when there's far more of something than people want, its price falls.</li>
        <li><b>Royalty</b> — the landowner's share of the money from oil found on their land.</li>
        <li><b>Prorationing</b> — limits, set in 1931, on how much oil each well could pump, to steady the price.</li>
      </ul>
      <button className="btn" onClick={onBack}>Back</button>
    </div>
  );
}

function JoinForm({ state, dispatch, onJoin }) {
  const [busy, setBusy] = useState(false);
  const set = (patch) => dispatch({ type: 'ui', patch });
  const ready = state.joinCode.length === 6 && state.name.trim().length >= 2;

  async function join() {
    if (!ready || busy) return;
    setBusy(true);
    const ok = await onJoin(state.joinCode, state.name);
    if (!ok) setBusy(false);
  }

  return (
    <div className="card join-screen">
      <h2>Join your class</h2>
      <label htmlFor="join-code">Class code</label>
      <input
        id="join-code" inputMode="numeric" autoComplete="off" maxLength={6}
        placeholder="6-digit code" value={state.joinCode}
        onChange={(e) => set({ joinCode: e.target.value.replace(/\D/g, '') })}
      />
      <label htmlFor="join-name">Your first name</label>
      <input
        id="join-name" maxLength={20} placeholder="e.g. Ana R." value={state.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <p className="muted">Everyone works the oil boom. Drill smart.</p>

      <p className="err" role="alert">{state.error}</p>
      <div className="btn-col">
        <button className="btn big" disabled={!ready || busy} onClick={join}>
          {busy ? 'Heading to Beaumont…' : 'Head to Beaumont →'}
        </button>
        <button className="btn ghost" onClick={() => set({ screen: 'title', error: '' })}>Back</button>
      </div>
    </div>
  );
}

function WaitCard({ title, text, children }) {
  return (
    <div className="card wait-card">
      <div className="pulse-dot" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
