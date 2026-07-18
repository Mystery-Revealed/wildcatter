// socketHandlers.js — the THIN Socket.IO transport layer. It maps socket events
// to GameManager methods and dispatches the emit instructions GameManager
// returns. All game logic lives in GameManager; this file only moves messages
// (and owns the disconnect grace timers, which are a transport concern).
//
// Every teacher operation carries { joinCode, pin } and is authenticated inside
// GameManager — so the Command Center survives refreshes, and no student socket
// can run teacher ops.

import { config } from '../config.js';

export function attachSockets(io, manager) {
  const studentSocket = new Map();    // studentId -> socket.id
  const teacherOfSession = new Map(); // joinCode  -> socket.id
  const graceTimers = new Map();      // studentId -> timeout handle

  function dispatch(emits = []) {
    for (const { to, event, payload } of emits) {
      if (to.type === 'student') {
        const sid = studentSocket.get(to.studentId);
        if (sid) io.to(sid).emit(event, payload);
      } else if (to.type === 'teacher') {
        const sid = teacherOfSession.get(to.joinCode);
        if (sid) io.to(sid).emit(event, payload);
      }
    }
  }

  io.on('connection', (socket) => {
    // ---- Teacher ----------------------------------------------------------

    socket.on('teacher:create_session', (args, ack) => {
      const res = manager.createSession(args || {});
      if (res.error) return ack?.({ ok: false, error: res.error });
      teacherOfSession.set(res.joinCode, socket.id);
      socket.data.role = 'teacher';
      socket.data.joinCode = res.joinCode;
      ack?.({ ok: true, joinCode: res.joinCode, roster: res.roster });
      dispatch(res.emits);
    });

    socket.on('teacher:resume', (args, ack) => {
      const res = manager.teacherAuth(args || {});
      if (res.error) return ack?.({ ok: false, error: res.error });
      teacherOfSession.set(res.session.joinCode, socket.id);
      socket.data.role = 'teacher';
      socket.data.joinCode = res.session.joinCode;
      ack?.({ ok: true, joinCode: res.session.joinCode, roster: manager.roster(res.session) });
    });

    const teacherOps = {
      'teacher:set_approval': (a) => manager.setApproval(a),
      'teacher:approve_name': (a) => manager.approveStudent(a),
      'teacher:rename': (a) => manager.renameStudent(a),
      'teacher:kick': (a) => manager.kickStudent(a),
      'teacher:pair_and_start': (a) => manager.pairAndStart(a),
      'teacher:convert_to_solo': (a) => manager.convertToSolo(a),
      'teacher:end_session': (a) => manager.endSession(a),
    };
    for (const [event, fn] of Object.entries(teacherOps)) {
      socket.on(event, (args, ack) => {
        const res = fn(args || {});
        if (res.error) return ack?.({ ok: false, error: res.error });
        ack?.({ ok: true });
        dispatch(res.emits);
      });
    }

    socket.on('teacher:session_report', (args, ack) => {
      const res = manager.sessionReport(args || {});
      if (res.error) return ack?.({ ok: false, error: res.error });
      ack?.({ ok: true, report: res.report });
    });

    // ---- Student ----------------------------------------------------------

    socket.on('student:join', (args, ack) => {
      const res = manager.joinStudent(args || {});
      if (res.error) return ack?.({ ok: false, error: res.error });
      studentSocket.set(res.studentId, socket.id);
      socket.data.role = 'student';
      socket.data.joinCode = args.joinCode;
      socket.data.studentId = res.studentId;
      ack?.({ ok: true, studentId: res.studentId, approved: res.approved });
      dispatch(res.emits);
    });

    // School wifi drops: the client reconnects with a new socket and re-attaches
    // to its record; the ack carries a full state snapshot to render from scratch.
    socket.on('student:rejoin', (args, ack) => {
      const res = manager.rejoinStudent(args || {});
      if (res.error) return ack?.({ ok: false, error: res.error });
      const studentId = res.student.id;
      const stale = graceTimers.get(studentId);
      if (stale) { clearTimeout(stale); graceTimers.delete(studentId); }
      studentSocket.set(studentId, socket.id);
      socket.data.role = 'student';
      socket.data.joinCode = args.joinCode;
      socket.data.studentId = studentId;
      ack?.({ ok: true, studentId, sync: res.sync });
      dispatch(res.emits);
    });

    socket.on('student:submit_move', (args, ack) => {
      const { joinCode, studentId } = socket.data;
      if (socket.data.role !== 'student') return ack?.({ ok: false, error: 'not_a_student' });
      const res = manager.submitMove({ joinCode, studentId, move: args?.move });
      if (res.error) return ack?.({ ok: false, error: res.error });
      ack?.({ ok: true });
      dispatch(res.emits);
    });

    socket.on('student:finish_vs_ai', (_args, ack) => {
      const { joinCode, studentId } = socket.data;
      if (socket.data.role !== 'student') return ack?.({ ok: false, error: 'not_a_student' });
      const res = manager.finishVsAI({ joinCode, studentId });
      if (res.error) return ack?.({ ok: false, error: res.error });
      ack?.({ ok: true });
      dispatch(res.emits);
    });

    // ---- Disconnect -------------------------------------------------------

    socket.on('disconnect', () => {
      const { role, joinCode, studentId } = socket.data || {};
      if (role === 'student' && studentId) {
        if (studentSocket.get(studentId) === socket.id) studentSocket.delete(studentId);
        const res = manager.markDisconnected({ joinCode, studentId });
        dispatch(res.emits);
        // If they were mid-match against a human, give them a grace period to
        // rejoin — then offer their partner "Finish vs the computer".
        if (res.hadActiveVersusMatch) {
          const t = setTimeout(() => {
            graceTimers.delete(studentId);
            dispatch(manager.offerFinishVsAI({ joinCode, studentId }).emits);
          }, config.disconnectGraceMs);
          graceTimers.set(studentId, t);
        }
      }
      if (role === 'teacher' && joinCode) {
        if (teacherOfSession.get(joinCode) === socket.id) teacherOfSession.delete(joinCode);
        // The session keeps running in memory until ended or idle-swept.
      }
    });
  });
}
