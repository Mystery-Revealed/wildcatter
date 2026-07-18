// GameManager.js — transport-agnostic, server-authoritative game state machine.
// It NEVER imports socket.io. Every method returns a list of "emit instructions"
// that socketHandlers.js dispatches, which keeps all game logic pure and testable.
//
// Emit instruction shape:
//   { to: { type: 'teacher', joinCode } | { type: 'student', studentId },
//     event: 'turn:begin', payload: {...} }

import { SessionRegistry } from './lobby/SessionRegistry.js';
import { checkNickname } from './lobby/profanity.js';
import { getGame } from './games/index.js';
import { averageAccuracy } from './scoring.js';
import { config } from './config.js';

let _id = 0;
const uid = (p) => `${p}_${(++_id).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

const toStudent = (studentId, event, payload) => ({ to: { type: 'student', studentId }, event, payload });
const toTeacher = (joinCode, event, payload) => ({ to: { type: 'teacher', joinCode }, event, payload });

export class GameManager {
  constructor() {
    this.registry = new SessionRegistry();
  }

  // ---- Teacher: create / resume a session -----------------------------------

  createSession({ gameId = 'wildcatter', pin, requireApproval = config.requireApprovalDefault }) {
    const game = getGame(gameId);
    if (!game) return { error: 'unknown_game' };
    if (!config.pinPattern.test(String(pin ?? ''))) return { error: 'bad_pin' };
    const session = this.registry.create({
      gameId,
      pin: String(pin),
      requireApproval: !!requireApproval,
      open: true,
      students: new Map(),   // studentId -> student
      matches: new Map(),    // matchId -> match
    });
    return { joinCode: session.joinCode, roster: this.roster(session), emits: [] };
  }

  // Every teacher operation authenticates with joinCode + PIN, so the Command
  // Center survives a refresh or a device swap.
  teacherAuth({ joinCode, pin }) {
    const session = this.registry.get(joinCode);
    if (!session) return { error: 'no_session' };
    if (session.pin !== String(pin ?? '')) return { error: 'bad_pin' };
    return { session };
  }

  setApproval({ joinCode, pin, requireApproval }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    session.requireApproval = !!requireApproval;
    this.registry.touch(joinCode);
    return { roster: this.roster(session), emits: [toTeacher(joinCode, 'lobby:update', this.roster(session))] };
  }

  // ---- Student: join ---------------------------------------------------------

  // mode: 'versus' (wait to be paired) | 'solo' (play vs the computer).
  // nation: only for solo joiners — 'spain' | 'france'.
  joinStudent({ joinCode, nickname, mode = 'versus', nation = null }) {
    const session = this.registry.get(joinCode);
    if (!session || !session.open) return { error: 'no_session' };
    if (session.students.size >= config.maxStudentsPerSession) return { error: 'full' };

    const nick = checkNickname(nickname, config.maxNicknameLength);
    if (!nick.ok) return { error: `nickname_${nick.reason}` };

    const game = getGame(session.gameId);
    const studentId = uid('stu');
    const student = {
      id: studentId,
      displayName: nick.cleaned,
      approved: !session.requireApproval,
      mode: mode === 'solo' ? 'solo' : 'versus',
      nation: mode === 'solo' && game.sides.includes(nation) ? nation : null,
      matchId: null,
      status: 'not_started',
      accuracy: null,
      connected: true,
    };
    session.students.set(studentId, student);
    this.registry.touch(joinCode);

    const emits = [toTeacher(joinCode, 'lobby:update', this.roster(session))];
    // Solo players don't wait for pairing — they start as soon as they're approved.
    if (student.approved && student.mode === 'solo') {
      emits.push(...this._startSoloMatch(session, game, student));
    }
    return { studentId, approved: student.approved, emits };
  }

  // ---- Teacher: approve / rename / kick --------------------------------------

  approveStudent({ joinCode, pin, studentId }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    const student = session.students.get(studentId);
    if (!student) return { error: 'no_student' };
    const emits = [];
    if (!student.approved) {
      student.approved = true;
      emits.push(toStudent(studentId, 'join:approved', { approved: true }));
      if (student.mode === 'solo') {
        emits.push(...this._startSoloMatch(session, getGame(session.gameId), student));
      }
    }
    emits.push(toTeacher(joinCode, 'lobby:update', this.roster(session)));
    this.registry.touch(joinCode);
    return { emits };
  }

  renameStudent({ joinCode, pin, studentId, name }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    const student = session.students.get(studentId);
    if (!student) return { error: 'no_student' };
    const nick = checkNickname(name, config.maxNicknameLength);
    if (!nick.ok) return { error: 'bad_name' };
    student.displayName = nick.cleaned;
    this.registry.touch(joinCode);
    return {
      emits: [
        toStudent(studentId, 'student:renamed', { name: nick.cleaned }),
        toTeacher(joinCode, 'lobby:update', this.roster(session)),
      ],
    };
  }

  kickStudent({ joinCode, pin, studentId }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    const student = session.students.get(studentId);
    if (!student) return { error: 'no_student' };
    session.students.delete(studentId);
    const emits = [toStudent(studentId, 'student:removed', {})];
    // If they were mid-match against a human, the computer takes their place.
    if (student.matchId) {
      const match = session.matches.get(student.matchId);
      if (match && match.gameState.status === 'active' && !match.solo) {
        emits.push(...this._replaceWithAI(session, match, student.id));
      }
    }
    emits.push(toTeacher(joinCode, 'lobby:update', this.roster(session)));
    this.registry.touch(joinCode);
    return { emits };
  }

  // ---- Teacher: pair everyone and start ---------------------------------------

  pairAndStart({ joinCode, pin }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    const game = getGame(session.gameId);
    const emits = [];

    const ready = [...session.students.values()].filter((s) => s.approved && s.status === 'not_started');
    const wantVersus = shuffle(ready.filter((s) => s.mode === 'versus'));
    const startSolo = ready.filter((s) => s.mode === 'solo'); // e.g. approved while server was busy

    for (let i = 0; i + 1 < wantVersus.length; i += 2) {
      emits.push(...this._startVersusMatch(session, game, wantVersus[i], wantVersus[i + 1]));
    }
    // Odd student out plays solo vs the computer, nation randomized.
    if (wantVersus.length % 2 === 1) {
      const leftover = wantVersus[wantVersus.length - 1];
      leftover.mode = 'solo';
      startSolo.push(leftover);
    }
    for (const s of startSolo) emits.push(...this._startSoloMatch(session, game, s));

    emits.push(toTeacher(joinCode, 'lobby:update', this.roster(session)));
    this.registry.touch(joinCode);
    return { emits };
  }

  _startVersusMatch(session, game, a, b) {
    const matchId = uid('mat');
    const [sideA, sideB] = shuffle([...game.sides]); // randomize Spain/France
    a.nation = sideA;
    b.nation = sideB;
    const gameState = game.initMatch({ mode: 'versus' });
    const match = {
      matchId,
      solo: false,
      sideToStudent: { [sideA]: a.id, [sideB]: b.id },
      gameState,
    };
    session.matches.set(matchId, match);
    for (const stu of [a, b]) {
      stu.matchId = matchId;
      stu.status = 'in_progress';
    }

    const emits = [];
    for (const stu of [a, b]) {
      const rivalStu = stu === a ? b : a;
      emits.push(toStudent(stu.id, 'match:begin', this._matchBeginPayload(game, match, stu.nation, rivalStu.displayName)));
    }
    emits.push(...this._pushChapterEventsAndTurns(session, game, match));
    return emits;
  }

  _startSoloMatch(session, game, s) {
    if (s.status !== 'not_started') return [];
    const matchId = uid('mat');
    if (!s.nation) s.nation = shuffle([...game.sides])[0]; // odd-student-out: nation randomized
    const gameState = game.initMatch({ mode: 'solo', soloSide: s.nation });
    const match = { matchId, solo: true, side: s.nation, studentId: s.id, gameState };
    session.matches.set(matchId, match);
    s.matchId = matchId;
    s.status = 'in_progress';

    return [
      toStudent(s.id, 'match:begin', this._matchBeginPayload(game, match, s.nation, 'The Computer')),
      ...this._pushChapterEventsAndTurns(session, game, match),
    ];
  }

  _matchBeginPayload(game, match, side, opponentName) {
    const state = match.gameState;
    // Single-role and variant games (Hold the Line, Trail Boss) have no rival,
    // so rivalSideOf() is null — rivalMeters is null in that case.
    const rival = rivalSideOf(game, side);
    return {
      matchId: match.matchId,
      mode: state.mode,
      side,
      opponentName,
      meta: game.meta,
      chapterCount: game.chapterCount ?? 6,
      map: state.map,
      owners: gameOwners(game, state),
      meters: { ...state.sides[side].meters },
      rivalMeters: rival ? { ...state.sides[rival].meters } : null,
    };
  }

  // ---- Student: submit a move --------------------------------------------------

  // move = { kind: 'map', region, marker } | { kind: 'decision', choiceIndex }
  submitMove({ joinCode, studentId, move }) {
    const session = this.registry.get(joinCode);
    const student = session?.students.get(studentId);
    if (!student || !student.matchId) return { error: 'no_match' };
    const game = getGame(session.gameId);
    const match = session.matches.get(student.matchId);
    if (!match || match.gameState.status !== 'active') return { error: 'no_match' };

    const state = match.gameState;
    const side = match.solo ? match.side : sideOf(match, studentId);

    // Server-authoritative TURN LOCK: out-of-turn moves are rejected in versus.
    if (!match.solo && state.whoseTurn !== side) return { error: 'not_your_turn' };

    const res = game.resolve(state, side, move);
    if (res.error) return { error: res.error };

    const emits = [toStudent(studentId, 'turn:resolution', { ...res, owners: gameOwners(game, state), map: state.map })];

    // The human rival sees the board change (never the verdict or feedback).
    if (!match.solo) {
      const rivalSide = rivalSideOf(game, side);
      const oppId = rivalSide && match.sideToStudent[rivalSide];
      if (oppId && oppId !== 'AI') {
        emits.push(toStudent(oppId, 'rival:update', this._rivalUpdatePayload(game, state, side, res)));
      }
    }

    emits.push(...this._afterMove(session, game, match, side, res));
    this.registry.touch(joinCode);
    return { emits };
  }

  // Everything that happens between one move and the next prompt:
  // AI turns (solo), turn hand-off (versus), chapter events, and completion.
  _afterMove(session, game, match, side, res) {
    const state = match.gameState;
    const emits = [];

    // SOLO: once the student finishes a chapter, the computer plays its own
    // chapter using its nation's real (historically right) strategy. Single-role
    // solo games (Hold the Line) have no rival side, so there's nothing to drive.
    if (match.solo && res.chapterDone) {
      const aiSide = rivalSideOf(game, side);
      if (aiSide) emits.push(...this._driveAIChapter(game, match, aiSide));
    }

    // VERSUS: chapter-by-chapter alternation — a side plays its map move AND
    // decision, then the turn goes to whichever side is furthest behind.
    if (!match.solo) {
      const [a, b] = game.sides;
      const sa = state.sides[a], sb = state.sides[b];
      if (res.chapterDone) {
        state.whoseTurn = sb.cursor < sa.cursor ? b : a; // tie → Spain opens the chapter
      }
      state.chapterIndex = Math.min(Math.floor(sa.cursor / 2), Math.floor(sb.cursor / 2));
    } else {
      state.chapterIndex = Math.floor(state.sides[side].cursor / 2);
    }

    if (game.isComplete(state)) {
      emits.push(...this._completeMatch(session, game, match));
    } else {
      emits.push(...this._pushChapterEventsAndTurns(session, game, match));
    }
    return emits;
  }

  _driveAIChapter(game, match, aiSide) {
    const state = match.gameState;
    const ss = state.sides[aiSide];
    if (ss.cursor >= game.totalActions) return [];
    const emits = [];
    game.chapterEvent(state, aiSide); // apply the AI's chapter toll too
    const chapterEnd = (Math.floor(ss.cursor / 2) + 1) * 2;
    while (ss.cursor < Math.min(chapterEnd, game.totalActions)) {
      const res = game.resolve(state, aiSide, game.aiMove(state, aiSide));
      if (res.error) break; // defensive; AI moves are always valid
      emits.push(toStudent(match.studentId, 'rival:update', this._rivalUpdatePayload(game, state, aiSide, res)));
    }
    return emits;
  }

  _rivalUpdatePayload(game, state, side, res) {
    return {
      side,
      kind: res.kind,
      placed: res.placed || null,
      meters: { ...state.sides[side].meters },
      map: state.map,
      owners: gameOwners(game, state),
    };
  }

  // Push the chapter event card (once per side per chapter) and the turn prompt.
  _pushChapterEventsAndTurns(session, game, match) {
    const state = match.gameState;
    const emits = [];
    const humans = match.solo
      ? [[match.side, match.studentId]]
      : Object.entries(match.sideToStudent).filter(([, sid]) => sid !== 'AI');

    for (const [side, sid] of humans) {
      const ev = game.chapterEvent(state, side);
      if (ev) emits.push(toStudent(sid, 'chapter:event', ev));
    }
    for (const [side, sid] of humans) {
      const yourTurn = match.solo ? true : state.whoseTurn === side;
      const prompt = yourTurn ? game.currentPrompt(state, side) : null;
      if (match.solo && !prompt) continue; // side finished; completion handles the rest
      const rival = rivalSideOf(game, side);
      emits.push(toStudent(sid, 'turn:begin', {
        yourTurn,
        whoseTurn: match.solo ? side : state.whoseTurn,
        map: state.map,
        owners: gameOwners(game, state),
        rivalMeters: rival ? { ...state.sides[rival].meters } : null,
        ...(prompt || {}),
      }));
    }
    return emits;
  }

  _completeMatch(session, game, match) {
    const state = match.gameState;
    state.status = 'completed';
    const report = game.report(state);
    state.winner = report.winner;
    const emits = [];

    const players = match.solo
      ? [[match.side, match.studentId]]
      : Object.entries(match.sideToStudent);

    for (const [side, sid] of players) {
      if (sid === 'AI') continue;
      const student = session.students.get(sid);
      if (!student) continue;
      const mine = report.perSide[side];
      const rivalSide = rivalSideOf(game, side);
      const rival = rivalSide ? report.perSide[rivalSide] : null;
      student.status = 'completed';
      student.accuracy = mine.accuracy;
      emits.push(toStudent(sid, 'match:end', {
        winner: report.winner,
        yourSide: side,
        meta: game.meta,
        owners: report.owners,
        you: mine, // score, meters, accuracy, ending, debrief, ...
        // Single-role solo games have no rival.
        rival: rival ? {
          side: rivalSide,
          claimScore: rival.claimScore,
          regionsHeld: rival.regionsHeld,
          collapsed: rival.collapsed,
          isAI: rival.isAI,
        } : null,
      }));
      emits.push(toTeacher(session.joinCode, 'student:end', {
        studentId: sid,
        displayName: student.displayName,
        nation: side,
        accuracy: mine.accuracy,
        winner: report.winner,
      }));
    }
    emits.push(toTeacher(session.joinCode, 'lobby:update', this.roster(session)));
    return emits;
  }

  // ---- Disconnects, reconnects, and "finish vs the computer" -------------------

  markDisconnected({ joinCode, studentId }) {
    const session = this.registry.get(joinCode);
    const student = session?.students.get(studentId);
    if (!student) return { emits: [] };
    student.connected = false;
    const emits = [toTeacher(joinCode, 'lobby:update', this.roster(session))];
    const partner = this._partnerOf(session, student);
    if (partner) {
      emits.push(toStudent(partner.id, 'partner:disconnected', { name: student.displayName }));
    }
    return { emits, hadActiveVersusMatch: !!partner };
  }

  // Called by the transport layer after the grace period, if still disconnected.
  offerFinishVsAI({ joinCode, studentId }) {
    const session = this.registry.get(joinCode);
    const student = session?.students.get(studentId);
    if (!student || student.connected) return { emits: [] };
    const partner = this._partnerOf(session, student);
    if (!partner) return { emits: [] };
    return { emits: [toStudent(partner.id, 'partner:gone', { name: student.displayName })] };
  }

  rejoinStudent({ joinCode, studentId }) {
    const session = this.registry.get(joinCode);
    const student = session?.students.get(studentId);
    if (!session || !student) return { error: 'session_gone' };
    student.connected = true;
    this.registry.touch(joinCode);
    const emits = [toTeacher(joinCode, 'lobby:update', this.roster(session))];
    const partner = this._partnerOf(session, student);
    if (partner) emits.push(toStudent(partner.id, 'partner:reconnected', { name: student.displayName }));
    return { student, sync: this.syncFor(session, student), emits };
  }

  // The partner clicked "Finish vs the computer" (or the teacher converted the
  // match): the missing side becomes AI and, if it was mid-chapter, catches up.
  finishVsAI({ joinCode, studentId }) {
    const session = this.registry.get(joinCode);
    const student = session?.students.get(studentId);
    if (!student || !student.matchId) return { error: 'no_match' };
    const match = session.matches.get(student.matchId);
    if (!match || match.solo || match.gameState.status !== 'active') return { error: 'no_match' };
    const goneId = Object.values(match.sideToStudent).find((sid) => sid !== 'AI' && sid !== studentId);
    const gone = session.students.get(goneId);
    if (gone?.connected) return { error: 'partner_still_here' };
    const emits = this._replaceWithAI(session, match, goneId);
    emits.push(toTeacher(joinCode, 'lobby:update', this.roster(session)));
    this.registry.touch(joinCode);
    return { emits };
  }

  convertToSolo({ joinCode, pin, matchId }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    const match = session.matches.get(matchId);
    if (!match || match.solo || match.gameState.status !== 'active') return { error: 'no_match' };
    // Replace the disconnected player; if both are connected, there's nothing to fix.
    const goneEntry = Object.entries(match.sideToStudent)
      .find(([, sid]) => sid !== 'AI' && !session.students.get(sid)?.connected);
    if (!goneEntry) return { error: 'both_connected' };
    const emits = this._replaceWithAI(session, match, goneEntry[1]);
    emits.push(toTeacher(joinCode, 'lobby:update', this.roster(session)));
    return { emits };
  }

  _replaceWithAI(session, match, goneStudentId) {
    const game = getGame(session.gameId);
    const state = match.gameState;
    const goneSide = sideOf(match, goneStudentId);
    if (!goneSide) return [];
    match.sideToStudent[goneSide] = 'AI';
    state.sides[goneSide].isAI = true;

    const stayId = Object.values(match.sideToStudent).find((sid) => sid !== 'AI');
    const gone = session.students.get(goneStudentId);
    if (gone && gone.status === 'in_progress') gone.status = 'not_started'; // their match went on without them
    if (gone) { gone.matchId = null; gone.nation = null; gone.mode = 'solo'; }

    // Nobody left in the match at all (partner already gone): drop it quietly.
    if (!stayId) {
      match.gameState.status = 'abandoned';
      return [];
    }

    const emits = [toStudent(stayId, 'partner:replaced', { bySide: goneSide })];

    // Match becomes solo-shaped: the human side plays; AI fills in from here.
    match.side = sideOf(match, stayId);
    match.studentId = stayId;
    match.solo = true;

    // If the AI side is behind (it was that side's turn, or mid-chapter), let it
    // catch up to the human side's chapter so play resumes cleanly.
    const human = state.sides[match.side];
    const ai = state.sides[goneSide];
    while (ai.cursor < game.totalActions &&
           Math.floor(ai.cursor / 2) < Math.ceil(human.cursor / 2)) {
      game.chapterEvent(state, goneSide);
      const res = game.resolve(state, goneSide, game.aiMove(state, goneSide));
      if (res.error) break;
      emits.push(toStudent(stayId, 'rival:update', this._rivalUpdatePayload(game, state, goneSide, res)));
    }

    if (game.isComplete(state)) {
      emits.push(...this._completeMatch(session, game, match));
    } else {
      emits.push(...this._pushChapterEventsAndTurns(session, game, match));
    }
    return emits;
  }

  _partnerOf(session, student) {
    if (!student.matchId) return null;
    const match = session.matches.get(student.matchId);
    if (!match || match.solo || match.gameState.status !== 'active') return null;
    const partnerId = Object.values(match.sideToStudent).find((sid) => sid !== 'AI' && sid !== student.id);
    return session.students.get(partnerId) || null;
  }

  // Full state snapshot so a reconnecting client can render any screen from scratch.
  syncFor(session, student) {
    if (!student.approved) return { screen: 'waiting_approval' };
    if (!student.matchId) return { screen: 'lobby', mode: student.mode, nation: student.nation };
    const game = getGame(session.gameId);
    const match = session.matches.get(student.matchId);
    if (!match) return { screen: 'lobby', mode: student.mode, nation: student.nation };
    const state = match.gameState;
    const side = match.solo ? match.side : sideOf(match, student.id);

    if (state.status === 'completed') {
      const report = game.report(state);
      const rivalSide = rivalSideOf(game, side);
      const rival = rivalSide ? report.perSide[rivalSide] : null;
      return {
        screen: 'result',
        matchEnd: {
          winner: report.winner,
          yourSide: side,
          meta: game.meta,
          owners: report.owners,
          you: report.perSide[side],
          rival: rival ? {
            side: rivalSide,
            claimScore: rival.claimScore,
            regionsHeld: rival.regionsHeld,
            collapsed: rival.collapsed,
            isAI: rival.isAI,
          } : null,
        },
      };
    }

    const partner = this._partnerOf(session, student);
    const yourTurn = match.solo ? true : state.whoseTurn === side;
    const rival = rivalSideOf(game, side);
    return {
      screen: 'match',
      matchBegin: this._matchBeginPayload(game, match, side, match.solo ? 'The Computer' : (partner?.displayName ?? '—')),
      chapterEvent: game.eventSnapshot(state, side),
      turn: {
        yourTurn,
        whoseTurn: match.solo ? side : state.whoseTurn,
        map: state.map,
        owners: gameOwners(game, state),
        rivalMeters: rival ? { ...state.sides[rival].meters } : null,
        ...(yourTurn ? (game.currentPrompt(state, side) || {}) : {}),
      },
    };
  }

  // ---- Teacher: end session (delete everything from memory) --------------------

  endSession({ joinCode, pin }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    const emits = [toTeacher(joinCode, 'session:ended', {})];
    for (const sid of session.students.keys()) {
      emits.push(toStudent(sid, 'session:ended', {}));
    }
    this.registry.remove(joinCode); // data is gone; nothing was ever persisted
    return { emits };
  }

  // ---- Views --------------------------------------------------------------------

  roster(session) {
    const game = getGame(session.gameId);
    const students = [...session.students.values()].map((s) => ({
      id: s.id,
      name: s.displayName,
      approved: s.approved,
      mode: s.mode,
      nation: s.nation,
      status: s.status,
      accuracy: s.accuracy,
      matchId: s.matchId,
      connected: s.connected,
    }));

    const matches = [...session.matches.values()].map((m) => ({
      matchId: m.matchId,
      solo: m.solo,
      status: m.gameState.status,
      chapter: (m.gameState.chapterIndex ?? 0) + 1,
      players: m.solo
        ? [{ studentId: m.studentId, side: m.side }]
        : Object.entries(m.sideToStudent).map(([side, sid]) => ({ studentId: sid, side })),
    }));

    // Class accuracy grouped by nation (completed players only).
    const byNation = {};
    for (const s of students) {
      if (s.status !== 'completed' || !s.nation) continue;
      (byNation[s.nation] ||= []).push({ accuracy: s.accuracy });
    }
    const classAccuracy = Object.fromEntries(
      game.sides.map((n) => [n, {
        count: byNation[n]?.length || 0,
        average: averageAccuracy(byNation[n] || []),
      }])
    );

    return {
      joinCode: session.joinCode,
      gameId: session.gameId,
      requireApproval: session.requireApproval,
      students,
      matches,
      classAccuracy,
    };
  }

  sessionReport({ joinCode, pin }) {
    const { session, error } = this.teacherAuth({ joinCode, pin });
    if (error) return { error };
    return { report: this.roster(session) };
  }

  sweepIdle() {
    return this.registry.sweepIdle();
  }
}

// ---- helpers -------------------------------------------------------------------

function otherSide(game, side) {
  return game.sides.find((s) => s !== side);
}

// The side that actually OPPOSES `side`. Games whose sides are independent solo
// variants (e.g. the three trails in Trail Boss) declare `hasOpponent: false` —
// they have no rival at all, so no AI is driven and no rival meters/report card
// are shipped. Without this guard, otherSide() would wrongly return a *different
// trail* as a phantom rival.
function rivalSideOf(game, side) {
  return game.hasOpponent === false ? null : otherSide(game, side);
}

function sideOf(match, studentId) {
  if (match.sideToStudent) {
    const entry = Object.entries(match.sideToStudent).find(([, sid]) => sid === studentId);
    if (entry) return entry[0];
  }
  return match.studentId === studentId ? match.side : null;
}

function gameOwners(game, state) {
  return game.owners ? game.owners(state) : null;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
