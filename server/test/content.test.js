// content.test.js — sanity + historical-balance checks on the Wildcatter content
// bank (spec §1–§6). One class-wide role (an independent Texas oil driller), six
// eras, choice-based, with NO early-fail: you cannot stop the boom and bust, only
// drill well through it. The OIL-PRICE TICKER is scripted, display-only, and
// unstoppable; UNLIKE the sibling debt game, there are NO scripted eventEffects —
// every meter change comes from the player's own 12 decisions.
import test from 'node:test';
import assert from 'node:assert/strict';
import game, { PHASES, wildcatterScore, endingFor, ENDINGS, PRICE_TICKER } from '../src/games/wildcatter.js';

const SIDE = 'wildcatter';

const allText = () =>
  PHASES.flatMap((p) => [p.event, ...p.steps.flatMap((s) => [s.prompt, ...s.choices.map((c) => `${c.label} ${c.feedback}`)])]).join(' ');

test('one class-wide role is the single side, with no rival', () => {
  assert.deepEqual(game.sides, [SIDE]);
  assert.equal(game.hasOpponent, false, 'everyone is the same wildcatter — a single class-wide accuracy group');
  assert.equal(game.totalActions, 12);
  assert.equal(game.chapterCount, 6);
  assert.ok(game.meta.variants[SIDE], 'the Wildcat Driller ships as the one variant');
  assert.deepEqual(game.meta.variants[SIDE].waypoints, [], 'no map: the rig panel + price ticker replace it');
});

test('six eras, each with an event and two graded decisions (right/partial/wrong)', () => {
  assert.equal(PHASES.length, 6, 'era count');
  for (const [i, ph] of PHASES.entries()) {
    assert.ok(ph.title && ph.date && ph.event && ph.image, `era ${i} metadata`);
    assert.equal(ph.steps.length, 2, `era ${i} has 2 steps`);
    for (const [j, step] of ph.steps.entries()) {
      assert.equal(step.kind, 'decision', `era ${i} step ${j} is a decision (no map)`);
      assert.ok(step.prompt?.length > 5, `era ${i} step ${j} prompt`);
      const verdicts = step.choices.map((c) => c.verdict).sort();
      assert.deepEqual(verdicts, ['partial', 'right', 'wrong'], `era ${i} step ${j} verdicts`);
      for (const c of step.choices) {
        assert.ok(c.label?.length > 5 && c.feedback?.length > 10, `era ${i} step ${j} choice text`);
      }
    }
  }
  const steps = PHASES.flatMap((p) => p.steps);
  assert.equal(steps.length, 12, '12 graded actions');
});

test('meters start at 50/50/50 — cash, wells, reputation', () => {
  const state = game.initMatch({ soloSide: SIDE });
  assert.deepEqual(state.sides[SIDE].meters, { cash: 50, wells: 50, reputation: 50 });
});

test('the content teaches the spec’s content bank (TEKS 7.7A, 7.7B, 7.1B, 7.12B)', () => {
  const text = allText();
  assert.match(text, /Spindletop/i, 'Spindletop, 1901');
  assert.match(text, /Lucas Gusher/i, 'the Lucas Gusher');
  assert.match(text, /Patillo Higgins/i, 'Patillo Higgins, the believer');
  assert.match(text, /rotary rig/i, 'the rotary rig');
  assert.match(text, /drilling mud|\bmud\b/i, 'drilling mud');
  assert.match(text, /glut/i, 'the glut');
  assert.match(text, /three cents|three-cent/i, 'oil at three cents a barrel');
  assert.match(text, /supply and demand/i, 'TEKS 7.12B — supply and demand named');
  assert.match(text, /Sour Lake/i, 'the field moves to Sour Lake');
  assert.match(text, /Humble/i, 'and Humble');
  assert.match(text, /Texaco/i, 'companies born of the boom — Texaco');
  assert.match(text, /Gulf/i, 'and Gulf');
  assert.match(text, /East Texas/i, 'the East Texas field of 1930');
  assert.match(text, /prorationing/i, 'prorationing — the era’s real solution');
  assert.match(text, /Railroad Commission/i, 'the Railroad Commission sets the limits');
  assert.match(text, /royalty/i, 'a fair royalty for the landowner');
  const debrief = game.report(game.initMatch({ soloSide: SIDE })).perSide[SIDE].debrief;
  assert.match(debrief, /Spindletop/i, 'debrief opens on Spindletop, 1901');
  assert.match(debrief, /supply and demand/i, 'debrief names the supply-and-demand lesson');
  assert.match(debrief, /prorationing/i, 'debrief closes on 1930 East Texas + prorationing');
  assert.match(debrief, /universities/i, 'debrief names how oil money built Texas (7.7A)');
});

test('sensitivity: swindler-era fraud is graded WRONG via Reputation, and named as wrong (Common Standards §3)', () => {
  const text = allText();
  // The founding "Swindletop" example — Era 1, Decision 1's WRONG choice — must
  // drop Reputation and the feedback must name it as fraud, not cleverness.
  const era1d1wrong = PHASES[0].steps[0].choices.find((c) => c.verdict === 'wrong');
  assert.ok((era1d1wrong.effects.reputation ?? 0) < 0, 'the fake-shares scam costs Reputation');
  assert.match(era1d1wrong.label, /guaranteed|shares/i, 'it is the fake "guaranteed shares" choice');
  assert.match(era1d1wrong.feedback, /swindletop/i, 'the feedback names the "Swindletop" fraud by name');
  assert.match(era1d1wrong.feedback, /enemies|not who you are/i, 'and marks it wrong, not clever');

  // Every instance of player-committed fraud across the eras costs Reputation and
  // is named as wrong: fake shares (E1), hidden fine print (E4), hot-oil smuggling
  // (E6), and one last stock scheme (E6).
  const fraudCases = [
    { p: 0, s: 0, re: /swindletop/i },
    { p: 3, s: 1, re: /swindler/i },
    { p: 5, s: 0, re: /hot oil/i },
    { p: 5, s: 1, re: /swindletop|scheme|fake-share/i },
  ];
  for (const f of fraudCases) {
    const wrong = PHASES[f.p].steps[f.s].choices.find((c) => c.verdict === 'wrong');
    assert.ok((wrong.effects.reputation ?? 0) < 0, `era ${f.p + 1} step ${f.s + 1}: fraud costs Reputation`);
    assert.match(wrong.feedback, f.re, `era ${f.p + 1} step ${f.s + 1}: the fraud is named in feedback`);
  }

  // No gore in the well-accident language: danger is fire and lost men, not spectacle.
  assert.doesNotMatch(text, /gore|blood|mangled|dismember/i, 'no gore in accident language');
});

test('the design is honest: NO early-fail, and NO scripted eventEffects (spec §3)', () => {
  // No failCheck / failEnding wired: even all-wrong completes all 12 actions.
  const state = game.initMatch({ soloSide: SIDE });
  const rep = game.report(state);
  assert.equal(rep.perSide[SIDE].failed, false, 'there is no early game-over');
  // Every meter change comes from the player's own decisions — nothing scripted
  // touches Cash / Wells / Reputation. Only the price ticker is scripted.
  for (const [i, p] of PHASES.entries()) {
    assert.equal(p.eventEffects, undefined, `era ${i + 1} carries no scripted meter toll`);
  }
});

test('the oil-price ticker is scripted, display-only (never scored), and stored in cents', () => {
  assert.equal(PRICE_TICKER.length, 6);
  // The dramatic arc: ~$1.85 before the gusher → 3¢ in the glut → back over a
  // dollar by the 1920s → the East Texas crash → the 1931 settle back to ~$1.00.
  assert.equal(PRICE_TICKER[0].startCents, 185, 'Era 1 opens near $1.85');
  assert.equal(PRICE_TICKER[0].endCents, 150, 'Era 1 slides toward the flood');
  assert.equal(PRICE_TICKER[2].endCents, 3, 'Era 3 (The Glut) bottoms at three cents');
  assert.equal(PRICE_TICKER[4].endCents, 165, 'Era 5 climbs back over a dollar by the 1920s');
  assert.equal(PRICE_TICKER[5].endCents, 10, 'Era 6 crashes with the East Texas field');
  assert.equal(PRICE_TICKER[5].settleCents, 100, 'Era 6 settles back to ~$1.00 (1931 prorationing)');
  assert.ok(PRICE_TICKER[5].settleNote?.length > 10, 'the settle carries its own note');
  // All values are integer cents.
  for (const p of PRICE_TICKER) {
    assert.ok(Number.isInteger(p.startCents) && Number.isInteger(p.endCents), `era ${p.era} cents are integers`);
    // Each era phase links its ticker entry.
    assert.equal(PHASES[p.era - 1].price, p, `era ${p.era} phase carries its ticker value`);
  }
  // The chapter event ships the ticker to the client (display-only field).
  const state = game.initMatch({ soloSide: SIDE });
  const ev = game.chapterEvent(state, SIDE);
  assert.equal(ev.price.era, 1, 'the chapter event carries the Era-1 ticker');
  assert.equal(ev.price.startCents, 185, 'and its opening price');
  // The ticker is NOT a meter: it does not appear in the scored meters.
  assert.deepEqual(Object.keys(state.sides[SIDE].meters).sort(), ['cash', 'reputation', 'wells']);
});

// --- Playthrough helpers (drive the adapter directly, no GameManager) --------

function playRun(pick) {
  const state = game.initMatch({ soloSide: SIDE });
  for (let step = 0; step < game.totalActions; step++) {
    game.chapterEvent(state, SIDE);            // idempotent per era; safe each step
    const res = game.resolve(state, SIDE, pick(state));
    assert.ok(!res.error, `step ${step} failed: ${res.error}`);
  }
  return game.report(state);
}

const rightMove = (state) => game.aiMove(state, SIDE);

const moveWithVerdict = (verdict) => (state) => {
  const ss = state.sides[SIDE];
  const steps = PHASES.flatMap((p) => p.steps);
  const step = steps[ss.cursor];
  const realIdx = step.choices.findIndex((c) => c.verdict === verdict);
  return { kind: step.kind, choiceIndex: ss.shuffles[ss.cursor].indexOf(realIdx) };
};

const wrongMove = moveWithVerdict('wrong');
const partialMove = moveWithVerdict('partial');

test('all-right run: 100% accuracy, score 270, "Oil Finds Character"', () => {
  const you = playRun(rightMove).perSide[SIDE];
  assert.equal(you.accuracy, 100);
  assert.equal(you.failed, false);
  assert.equal(you.score, 270, 'cash 70 + wells 100 (clamped) + reputation 100 (clamped)');
  assert.deepEqual(you.meters, { cash: 70, wells: 100, reputation: 100 });
  assert.equal(you.ending.key, 'top');
  assert.equal(you.ending.title, ENDINGS.top.title);
  assert.equal(you.ending.title, 'Oil Finds Character');
});

test('all-wrong run: 0% accuracy, score 55, "Busted Flat in Beaumont" (no early-fail)', () => {
  const you = playRun(wrongMove).perSide[SIDE];
  assert.equal(you.accuracy, 0, 'every wrong answer scores 0 across the full 12-action denominator');
  assert.equal(you.failed, false, 'the game never ends early — the meters just fall');
  assert.equal(you.score, 55, 'cash 35 + wells 20 + reputation 0 (clamped)');
  assert.deepEqual(you.meters, { cash: 35, wells: 20, reputation: 0 });
  assert.equal(you.ending.key, 'low');
  assert.equal(you.ending.title, 'Busted Flat in Beaumont');
});

test('all-partial run: 50% accuracy, score 170, mid ending "Still Drilling"', () => {
  const you = playRun(partialMove).perSide[SIDE];
  assert.equal(you.accuracy, 50, '12 halves = 50%');
  assert.equal(you.score, 170, 'cash 55 + wells 70 + reputation 45');
  assert.deepEqual(you.meters, { cash: 55, wells: 70, reputation: 45 });
  assert.equal(you.ending.key, 'mid');
  assert.equal(you.ending.title, 'Still Drilling');
});

test('currentPrompt never leaks the answer key', () => {
  const state = game.initMatch({ soloSide: SIDE });
  game.chapterEvent(state, SIDE);
  const prompt = game.currentPrompt(state, SIDE);
  assert.equal(prompt.choices.length, 3);
  for (const c of prompt.choices) {
    if (typeof c === 'object') {
      assert.ok(!('verdict' in c) && !('feedback' in c) && !('effects' in c), 'no answer key on a choice');
    }
  }
});

test('wildcatter-score tiers: Oil Finds Character ≥ 200, Still Drilling 120–199, Busted Flat < 120', () => {
  assert.equal(endingFor(300).key, 'top');
  assert.equal(endingFor(270).key, 'top');
  assert.equal(endingFor(200).key, 'top');
  assert.equal(endingFor(199).key, 'mid');
  assert.equal(endingFor(170).key, 'mid');
  assert.equal(endingFor(120).key, 'mid');
  assert.equal(endingFor(119).key, 'low');
  assert.equal(endingFor(55).key, 'low');
  assert.equal(wildcatterScore({ cash: 50, wells: 50, reputation: 50 }), 150);
});
