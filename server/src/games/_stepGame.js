// _stepGame.js — a factory that turns linear lists of "steps" into a game
// adapter GameManager can drive. It powers single-role SOLO games where everyone
// plays the same role, and it supports VARIANTS: several parallel content tracks
// the student chooses between at the start (e.g. the three trails in "Trail Boss").
//
// A variant is a list of PHASES. Each phase has an event card (cinematic image +
// a few sentences) and exactly two graded STEPS — a map action and a decision,
// in either order. A step offers 3 choices (one right, one partial, one wrong).
//
// THE ANSWER KEY LIVES HERE, ON THE SERVER. currentPrompt() ships labels only;
// the client submits { kind, choiceIndex } and the server grades it.
//
// Variants ARE the sides. Because GameManager groups class accuracy by side, the
// teacher dashboard gets per-variant (per-trail) accuracy for free. These sides
// don't oppose each other — they're independent solo tracks — so the adapter
// declares `hasOpponent: false` and GameManager drives no AI rival.
//
// STRENGTH CHECK (optional): a game may declare `failCheck(meters) => boolean`
// plus a `failEnding`. After each graded choice resolves, if failCheck returns
// true the side FAILS EARLY: remaining steps are forfeited (they score 0 toward
// the same 12-action denominator) and report() serves failEnding. The check runs
// only on the player's own resolved choices — a phase event may drop a meter TO
// the brink (even to 0), and the very next right choice can still lift it back.
// "Found a Mission" uses this for Trust: no friendship, no mission.
//
// The adapter interface GameManager expects (all implemented below):
//   id, title, modes, sides, hasOpponent, totalActions, chapterCount, meta,
//   initMatch, chapterEvent, eventSnapshot, currentPrompt, resolve, aiMove,
//   isComplete, report   (owners is optional and omitted — no territory to own)

import { accuracyPercent } from '../scoring.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pointsFor = (verdict) => (verdict === 'right' ? 1 : verdict === 'partial' ? 0.5 : 0);

export function createStepGame({
  id,
  title,
  meters,                 // shared meter display info { key: { name, icon, blurb } }
  markers,                // shared marker glyph names { key: { name } }
  startMeters,            // () => ({ meterKey: number })
  scoreMeters,            // (meters) => number   (e.g. Drive Score = sum of meters)
  endingFor,              // (score, accuracy, meters) => { key, title, text }
  debrief,                // shared debrief shown on every ending (variant may override)
  variants,               // { key: { name, sub?, phases, waypoints, debrief? } }
  failCheck,              // optional: (meters) => boolean — early fail after a resolved choice
  failEnding,             // optional: { key, title, text } served when failCheck trips
}) {
  const SIDES = Object.keys(variants);

  // Precompute the flattened step list + board metadata for each variant.
  const CONTENT = {};
  for (const side of SIDES) {
    const v = variants[side];
    const STEPS = v.phases.flatMap((p) => p.steps);
    const waypoints = v.waypoints || [];
    CONTENT[side] = {
      phases: v.phases,
      steps: STEPS,
      total: STEPS.length,
      chapterCount: v.phases.length,
      waypoints,
      positionKeys: waypoints.map((w) => w.id),
      debrief: v.debrief || debrief,
    };
  }

  const TOTAL = CONTENT[SIDES[0]].total;             // every variant is the same shape (12)
  const CHAPTER_COUNT = CONTENT[SIDES[0]].chapterCount;

  // The single occupant of a solo match. `side` is the chosen variant/trail.
  const sideOf = (state) => state.variant || Object.keys(state.sides)[0];
  const chapterOf = (cursor) => Math.floor(cursor / 2);

  const chapterMeta = (side, idx) => {
    const p = CONTENT[side].phases[idx];
    return { index: idx, count: CONTENT[side].chapterCount, title: p.title, date: p.date, image: p.image, variant: side };
  };

  function makeSideState(side, isAI = false) {
    const { steps } = CONTENT[side];
    return {
      key: side,
      isAI,
      cursor: 0,                 // 0..TOTAL-1
      meters: { ...startMeters() },
      actions: [],               // [{ stepIndex, kind, verdict, points }]
      eventApplied: -1,          // last phase whose eventEffects were applied
      failed: false,             // strength check tripped — side ended early
      failedAtStep: null,        // cursor (0-based) of the choice that sealed it
      // Per-match shuffle of each step's choices, so "the first answer" is never a tell.
      shuffles: steps.map((step) => shuffle([...step.choices.keys()])),
    };
  }

  function applyEffects(ss, effects = {}) {
    for (const [k, v] of Object.entries(effects)) {
      ss.meters[k] = clamp((ss.meters[k] ?? 0) + v, 0, 100);
    }
  }

  // Per-variant board metadata shipped to clients (display info only). The client
  // reads meta.variants[side] to draw the chosen trail's map and waypoints.
  const metaVariants = Object.fromEntries(
    SIDES.map((side) => {
      const v = variants[side];
      const waypoints = CONTENT[side].waypoints;
      return [side, {
        name: v.name,
        sub: v.sub || null,
        waypoints,                          // ordered — the herd walks these in order
        positions: Object.fromEntries(      // id -> info, for label/marker lookups
          waypoints.map((w) => [w.id, { name: w.name, sub: w.sub || null, hazard: !!w.hazard }])
        ),
      }];
    })
  );

  return {
    id,
    title,
    modes: ['solo'],
    sides: SIDES,
    hasOpponent: false,        // variants are parallel solo tracks, never rivals
    totalActions: TOTAL,
    chapterCount: CHAPTER_COUNT,
    meta: { meters, markers, variants: metaVariants },

    // Solo only. soloSide is the chosen variant (trail). One human side, no AI.
    initMatch({ soloSide } = {}) {
      const side = SIDES.includes(soloSide) ? soloSide : SIDES[0];
      const { positionKeys } = CONTENT[side];
      return {
        mode: 'solo',
        variant: side,
        map: { positions: Object.fromEntries(positionKeys.map((k) => [k, { markers: [] }])) },
        sides: { [side]: makeSideState(side) },
        whoseTurn: side,
        chapterIndex: 0,
        status: 'active',
        winner: null,
      };
    },

    // The phase event card, applying its one-time meter toll. Null if already shown.
    chapterEvent(state, side = sideOf(state)) {
      const ss = state.sides[side];
      const { chapterCount } = CONTENT[side];
      const idx = chapterOf(ss.cursor);
      if (idx >= chapterCount || ss.eventApplied >= idx) return null;
      const p = CONTENT[side].phases[idx];
      ss.eventApplied = idx;
      if (p.eventEffects) applyEffects(ss, p.eventEffects);
      return {
        chapter: chapterMeta(side, idx),
        text: p.event,
        eventEffects: p.eventEffects || null,
        // Display-only scripted data (never scored): the price ticker value for
        // this era (the oil-price swing). Null in games that don't use it (the
        // client simply skips it).
        price: p.price || null,
        meters: { ...ss.meters },
      };
    },

    // Non-mutating version, for re-pushing state after a reconnect.
    eventSnapshot(state, side = sideOf(state)) {
      const ss = state.sides[side];
      const { chapterCount } = CONTENT[side];
      const idx = Math.min(chapterOf(ss.cursor), chapterCount - 1);
      const p = CONTENT[side].phases[idx];
      return {
        chapter: chapterMeta(side, idx),
        text: p.event,
        eventEffects: p.eventEffects || null,
        price: p.price || null,
        meters: { ...ss.meters },
      };
    },

    // What the player sees now. NO verdicts/effects/feedback leak out. For map
    // steps, each choice carries its waypoint position + marker so the client can
    // highlight spots — that's information the player needs, not the answer key.
    currentPrompt(state, side = sideOf(state)) {
      const ss = state.sides[side];
      const { steps, total } = CONTENT[side];
      if (ss.cursor >= total) return null;
      const idx = chapterOf(ss.cursor);
      const step = steps[ss.cursor];
      const order = ss.shuffles[ss.cursor];
      const base = {
        stepIndex: ss.cursor,
        kind: step.kind,
        chapter: chapterMeta(side, idx),
        meters: { ...ss.meters },
        prompt: step.prompt,
        hint: step.hint || null,
      };
      if (step.kind === 'map') {
        return {
          ...base,
          choices: order.map((i) => ({
            label: step.choices[i].label,
            position: step.choices[i].position || null,
            marker: step.choices[i].marker || null,
          })),
        };
      }
      return { ...base, choices: order.map((i) => step.choices[i].label) };
    },

    // Apply a submitted move. move = { kind, choiceIndex } (choiceIndex is the
    // presented, shuffled index — mapped back to the real choice here).
    resolve(state, side = sideOf(state), move) {
      const ss = state.sides[side];
      const { steps, total } = CONTENT[side];
      if (ss.cursor >= total) return { error: 'side_done' };
      const step = steps[ss.cursor];
      if (!move || move.kind !== step.kind) return { error: 'wrong_step_kind' };
      const order = ss.shuffles[ss.cursor];
      const realIndex = order[move.choiceIndex];
      const choice = step.choices[realIndex];
      if (!choice) return { error: 'bad_choice' };

      const effects = choice.effects || {};
      let placed = null;
      if (step.kind === 'map' && choice.position) {
        const marker = choice.marker || 'herd';
        state.map.positions[choice.position]?.markers.push({ side, marker });
        placed = { position: choice.position, marker };
      }
      applyEffects(ss, effects);
      ss.actions.push({ stepIndex: ss.cursor, kind: step.kind, verdict: choice.verdict, points: pointsFor(choice.verdict) });
      ss.cursor += 1;

      // Strength check: the side fails early. Remaining steps are forfeited (they
      // stay out of `actions`, scoring 0 toward the same fixed denominator).
      if (failCheck && !ss.failed && ss.cursor < total && failCheck(ss.meters)) {
        ss.failed = true;
        ss.failedAtStep = ss.cursor - 1;
        ss.cursor = total;
      }

      return {
        side,
        kind: step.kind,
        verdict: choice.verdict,
        feedback: choice.feedback,
        effects,
        placed,
        stepIndex: ss.failed ? ss.failedAtStep : ss.cursor - 1,
        meters: { ...ss.meters },
        failed: ss.failed,
        chapterDone: ss.cursor % 2 === 0,
        sideDone: ss.cursor >= total,
      };
    },

    // The historically right move right now (used by content/balance tests; not
    // an in-game AI opponent, since these variants are single-role solo).
    aiMove(state, side = sideOf(state)) {
      const ss = state.sides[side];
      const step = CONTENT[side].steps[ss.cursor];
      const rightIdx = step.choices.findIndex((c) => c.verdict === 'right');
      const shuffledIdx = ss.shuffles[ss.cursor].indexOf(rightIdx);
      return { kind: step.kind, choiceIndex: shuffledIdx };
    },

    isComplete(state) {
      return Object.entries(state.sides).every(([side, ss]) => ss.cursor >= CONTENT[side].total);
    },

    // Final report. No winner/rival — the value is the Mission Score + accuracy.
    report(state) {
      const side = sideOf(state);
      const ss = state.sides[side];
      const { total, debrief: variantDebrief } = CONTENT[side];
      const score = scoreMeters(ss.meters);
      const accuracy = accuracyPercent(ss.actions, total);
      const ending = ss.failed && failEnding ? failEnding : endingFor(Math.round(score), accuracy, ss.meters);
      return {
        winner: null,
        owners: null,
        perSide: {
          [side]: {
            isAI: !!ss.isAI,
            variant: side,
            score: Math.round(score),
            meters: { ...ss.meters },
            accuracy,
            failed: !!ss.failed,
            ending,
            debrief: variantDebrief,
          },
        },
      };
    },
  };
}
