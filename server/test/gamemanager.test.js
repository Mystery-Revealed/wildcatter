// gamemanager.test.js — drives the manager exactly the way socketHandlers does
// and inspects the emit instructions it returns. No sockets involved. Wildcatter
// is solo with ONE class-wide role (a single side, no rival), so these focus on
// the solo lifecycle, one class-wide accuracy group, and — because this game has
// NO early-fail — that every run plays all 12 actions through to match:end. The
// default-gameId lifecycle test is exactly what catches the hardcoded-gameId
// gotcha if the fork forgot to update GameManager.createSession().
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../src/GameManager.js';
import game, { PHASES } from '../src/games/wildcatter.js';

const PIN = '4242';
const SIDE = 'wildcatter';

function makeSession(manager, { requireApproval = false } = {}) {
  const res = manager.createSession({ pin: PIN, requireApproval });
  assert.ok(res.joinCode, 'session created');
  return res.joinCode;
}

function join(manager, joinCode, nickname) {
  const res = manager.joinStudent({ joinCode, nickname, mode: 'solo', nation: SIDE });
  assert.ok(!res.error, `join failed: ${res.error}`);
  return res;
}

const eventsOf = (emits, name) => emits.filter((e) => e.event === name);
const studentEvents = (emits, studentId, name) =>
  emits.filter((e) => e.to.type === 'student' && e.to.studentId === studentId && (!name || e.event === name));

function matchOf(manager, joinCode, studentId) {
  const session = manager.registry.get(joinCode);
  const student = session.students.get(studentId);
  return session.matches.get(student.matchId);
}

// Play the student's current step with the historically right move.
function playRight(manager, joinCode, studentId) {
  const match = matchOf(manager, joinCode, studentId);
  const move = game.aiMove(match.gameState, match.side);
  return manager.submitMove({ joinCode, studentId, move });
}

// Play the current step with the wrong (worst) choice.
function playWrong(manager, joinCode, studentId) {
  const match = matchOf(manager, joinCode, studentId);
  const ss = match.gameState.sides[SIDE];
  const steps = PHASES.flatMap((p) => p.steps);
  const step = steps[ss.cursor];
  const wrongReal = step.choices.findIndex((c) => c.verdict === 'wrong');
  const move = { kind: step.kind, choiceIndex: ss.shuffles[ss.cursor].indexOf(wrongReal) };
  return manager.submitMove({ joinCode, studentId, move });
}

function playToEnd(manager, joinCode, studentId, playFn = playRight) {
  let last;
  for (let i = 0; i < 12; i++) {
    last = playFn(manager, joinCode, studentId);
    assert.ok(!last.error, `step ${i}: ${last.error}`);
  }
  return last;
}

test('createSession rejects a bad PIN', () => {
  const manager = new GameManager();
  assert.equal(manager.createSession({ pin: 'abc' }).error, 'bad_pin');
  assert.equal(manager.createSession({ pin: '12345' }).error, 'bad_pin');
});

test('the default game is Wildcatter', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.registry.get(joinCode).gameId, 'wildcatter');
});

test('teacher ops require the right PIN', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.endSession({ joinCode, pin: '9999' }).error, 'bad_pin');
  assert.equal(manager.setApproval({ joinCode, pin: '0000', requireApproval: false }).error, 'bad_pin');
});

test('solo student drills the boom and completes with 100% → Oil Finds Character', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');

  const begin = studentEvents(res.emits, res.studentId, 'match:begin');
  assert.equal(begin.length, 1, 'solo match begins on join');
  assert.equal(begin[0].payload.side, SIDE, 'the one side is the wildcatter');
  assert.equal(begin[0].payload.mode, 'solo');
  assert.equal(begin[0].payload.chapterCount, 6, 'six eras');
  assert.equal(begin[0].payload.rivalMeters, null, 'no rival');
  assert.deepEqual(begin[0].payload.meters, { cash: 50, wells: 50, reputation: 50 });
  const firstEvent = studentEvents(res.emits, res.studentId, 'chapter:event');
  assert.equal(firstEvent.length, 1);
  assert.equal(firstEvent[0].payload.price.era, 1, 'the oil-price ticker rides along from Era 1');
  assert.equal(firstEvent[0].payload.price.startCents, 185, 'and opens near $1.85');
  assert.equal(studentEvents(res.emits, res.studentId, 'turn:begin').length, 1);

  const last = playToEnd(manager, joinCode, res.studentId);
  const end = studentEvents(last.emits, res.studentId, 'match:end');
  assert.equal(end.length, 1, 'match ends after 12 actions');
  assert.equal(end[0].payload.you.accuracy, 100);
  assert.equal(end[0].payload.yourSide, SIDE);
  assert.equal(end[0].payload.you.ending.key, 'top', 'a perfect run is Oil Finds Character');
  assert.equal(end[0].payload.you.ending.title, 'Oil Finds Character');
  assert.equal(end[0].payload.you.failed, false);
  assert.equal(end[0].payload.you.score, 270);
  assert.equal(end[0].payload.rival, null, 'no rival card');

  assert.equal(eventsOf(last.emits, 'student:end').length, 1);
  const roster = manager.roster(manager.registry.get(joinCode));
  assert.equal(roster.students[0].status, 'completed');
  assert.equal(roster.students[0].accuracy, 100);
  assert.equal(roster.students[0].nation, SIDE, 'roster records the class-wide group');
});

test('all-wrong run plays all 12 actions to the end (no early-fail) → Busted Flat in Beaumont, 0%', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Leo');

  let end = [];
  let moves = 0;
  while (end.length === 0 && moves < 12) {
    const out = playWrong(manager, joinCode, res.studentId);
    assert.ok(!out.error, `move ${moves}: ${out.error}`);
    moves += 1;
    end = studentEvents(out.emits, res.studentId, 'match:end');
  }
  assert.equal(moves, 12, 'the run never ends early — all 12 actions are played');
  assert.equal(end.length, 1, 'match:end arrives only at the true end');
  assert.equal(end[0].payload.you.failed, false, 'there is no early game-over in this game');
  assert.equal(end[0].payload.you.ending.key, 'low');
  assert.equal(end[0].payload.you.ending.title, 'Busted Flat in Beaumont');
  assert.equal(end[0].payload.you.accuracy, 0);
  assert.equal(end[0].payload.you.score, 55);

  const roster = manager.roster(manager.registry.get(joinCode));
  assert.equal(roster.students[0].status, 'completed');
  assert.equal(roster.students[0].accuracy, 0);
});

test('class accuracy is one class-wide group (the wildcatter)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const a = join(manager, joinCode, 'Ana');
  const b = join(manager, joinCode, 'Leo');
  playToEnd(manager, joinCode, a.studentId);
  playToEnd(manager, joinCode, b.studentId);

  const { classAccuracy } = manager.roster(manager.registry.get(joinCode));
  assert.deepEqual(Object.keys(classAccuracy), [SIDE], 'exactly one accuracy group');
  assert.equal(classAccuracy[SIDE].count, 2);
  assert.equal(classAccuracy[SIDE].average, 100);
});

test('approval gate: solo student waits, then starts on approve', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager, { requireApproval: true });
  const res = join(manager, joinCode, 'Leo');
  assert.equal(res.approved, false);
  assert.equal(studentEvents(res.emits, res.studentId, 'match:begin').length, 0);

  const ok = manager.approveStudent({ joinCode, pin: PIN, studentId: res.studentId });
  assert.equal(studentEvents(ok.emits, res.studentId, 'join:approved').length, 1);
  assert.equal(studentEvents(ok.emits, res.studentId, 'match:begin').length, 1);
});

test('a wrong-kind move is rejected', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');
  // Era 1 step 1 is a decision; submit a map action instead.
  const bad = manager.submitMove({ joinCode, studentId: res.studentId, move: { kind: 'map', choiceIndex: 0 } });
  assert.equal(bad.error, 'wrong_step_kind');
});

test('rejoin returns a full snapshot of the live turn (with the price ticker)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');
  playRight(manager, joinCode, res.studentId); // Era 1 decision 1 done; decision 2 pending

  manager.markDisconnected({ joinCode, studentId: res.studentId });
  const back = manager.rejoinStudent({ joinCode, studentId: res.studentId });
  assert.ok(!back.error);
  assert.equal(back.sync.screen, 'match');
  assert.equal(back.sync.turn.kind, 'decision', 'the pending step is a decision');
  assert.equal(back.sync.turn.yourTurn, true);
  assert.equal(back.sync.matchBegin.rivalMeters, null, 'no rival meters in a single-role solo game');
  assert.equal(back.sync.chapterEvent.price.era, 1, 'the reconnect snapshot re-ships the price ticker');
  assert.ok(Array.isArray(back.sync.turn.choices) && back.sync.turn.choices.length === 3);
});

test('end_session wipes the session from memory', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  join(manager, joinCode, 'Ana');
  const res = manager.endSession({ joinCode, pin: PIN });
  assert.ok(eventsOf(res.emits, 'session:ended').length >= 2, 'teacher + student notified');
  assert.equal(manager.registry.get(joinCode), undefined);
});

test('students cannot reach teacher data: report requires the PIN', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.sessionReport({ joinCode, pin: '1111' }).error, 'bad_pin');
  assert.ok(manager.sessionReport({ joinCode, pin: PIN }).report);
});
