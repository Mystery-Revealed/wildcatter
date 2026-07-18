// CommandCenter.jsx — the teacher dashboard. Create a session → share the code
// → approve names → watch live status and ONE class-wide accuracy number → download
// the PDF → End Session (deletes everything from memory). Wildcatter is solo:
// everyone plays the same independent oil driller and starts as soon as they're
// approved — no pairing, and one class-wide accuracy group (spec §1, §6).

import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSocket, emitAck, errorText } from '../../services/socket.js';

const STATUS_LABEL = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed' };
const SIDE = 'wildcatter';

export default function CommandCenter() {
  const [phase, setPhase] = useState('gate'); // gate | dash
  const [pin, setPin] = useState('');
  const [resumeCode, setResumeCode] = useState('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [roster, setRoster] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const credentials = useRef(null); // { joinCode, pin } — memory only, by design

  useEffect(() => {
    const socket = getSocket();
    const onRoster = (payload) => setRoster(payload);
    const onEnded = () => {
      credentials.current = null;
      setRoster(null);
      setPhase('gate');
      setNotice('Session ended. All session data has been deleted.');
    };
    const onReconnect = async () => {
      if (!credentials.current) return;
      const res = await emitAck('teacher:resume', credentials.current);
      if (res.ok) setRoster(res.roster);
    };
    socket.on('lobby:update', onRoster);
    socket.on('session:ended', onEnded);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('lobby:update', onRoster);
      socket.off('session:ended', onEnded);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  async function createSession() {
    setError('');
    const res = await emitAck('teacher:create_session', { pin, requireApproval });
    if (!res.ok) return setError(res.error === 'bad_pin' ? 'PIN must be exactly 4 digits.' : errorText(res.error));
    credentials.current = { joinCode: res.joinCode, pin };
    setRoster(res.roster);
    setPhase('dash');
    setNotice('');
  }

  async function resumeSession() {
    setError('');
    const res = await emitAck('teacher:resume', { joinCode: resumeCode.trim(), pin });
    if (!res.ok) return setError(errorText(res.error));
    credentials.current = { joinCode: res.joinCode, pin };
    setRoster(res.roster);
    setPhase('dash');
    setNotice('');
  }

  async function op(event, extra = {}, okNotice = '') {
    setError('');
    const res = await emitAck(event, { ...credentials.current, ...extra });
    if (!res.ok) setError(errorText(res.error));
    else if (okNotice) setNotice(okNotice);
    return res;
  }

  if (phase === 'gate') {
    return (
      <div className="app teacher-app">
        <h1>Teacher Command Center</h1>
        <p className="muted">Wildcatter · everyone drills the Texas oil boom · TEKS 7.7A, 7.7B, 7.1B, 7.12B</p>
        {notice && <div className="note">{notice}</div>}
        <div className="gate-grid">
          <div className="card">
            <h2>Start a new session</h2>
            <label htmlFor="pin">Choose a 4-digit PIN</label>
            <input id="pin" type="password" inputMode="numeric" maxLength={4} value={pin}
                   onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 4321" />
            <label className="switch">
              <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
              Students wait for my approval before playing
            </label>
            <button className="btn big" disabled={pin.length !== 4} onClick={createSession}>Create session</button>
          </div>
          <div className="card">
            <h2>Resume a session</h2>
            <p className="muted">Got disconnected? Enter the same code and PIN.</p>
            <label htmlFor="rcode">Class code</label>
            <input id="rcode" inputMode="numeric" maxLength={6} value={resumeCode}
                   onChange={(e) => setResumeCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" />
            <label htmlFor="rpin">PIN</label>
            <input id="rpin" type="password" inputMode="numeric" maxLength={4} value={pin}
                   onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <button className="btn" disabled={resumeCode.length !== 6 || pin.length !== 4} onClick={resumeSession}>Resume</button>
          </div>
        </div>
        <p className="err" role="alert">{error}</p>
        <div className="note">
          <b>Session-only data:</b> everything lives in server memory. Ending the
          session (or ~2 hours of inactivity) deletes it all. The PDF you download
          is the only lasting record.
        </div>
      </div>
    );
  }

  const students = roster?.students || [];
  const pending = students.filter((s) => !s.approved);
  const cls = (roster?.classAccuracy || {})[SIDE] || { count: 0, average: 0 };
  const completed = students.filter((s) => s.status === 'completed').length;
  const inProgress = students.filter((s) => s.status === 'in_progress').length;

  return (
    <div className="app teacher-app">
      <header className="row">
        <div>
          <h1>Teacher Command Center</h1>
          <p className="muted">Wildcatter · session-only data · download the PDF before you end</p>
        </div>
        <button className="btn danger" onClick={() => setConfirmEnd(true)}>End Session</button>
      </header>

      <div className="card row code-card">
        <div>
          <div className="muted">Class code — students enter this to join</div>
          <div className="code-display">{roster?.joinCode}</div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={!!roster?.requireApproval}
            onChange={(e) => op('teacher:set_approval', { requireApproval: e.target.checked })}
          />
          Name approval required
        </label>
      </div>

      {notice && <div className="note">{notice}</div>}
      <p className="err" role="alert">{error}</p>

      {pending.length > 0 && (
        <div className="card">
          <h2>Waiting for approval ({pending.length})</h2>
          <p className="muted">Approve a name and that student heads to the oil patch right away.</p>
          {pending.map((s) => (
            <div key={s.id} className="row approval-row">
              <b>{s.name}</b>
              <span>
                <button className="btn small" onClick={() => op('teacher:approve_name', { studentId: s.id })}>Approve</button>
                <button className="btn small secondary" onClick={() => {
                  const name = window.prompt('New name for this student:', s.name);
                  if (name) op('teacher:rename', { studentId: s.id, name });
                }}>Rename</button>
                <button className="btn small danger" onClick={() => op('teacher:kick', { studentId: s.id })}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Class accuracy</h2>
        <div className="class-accuracy">
          <div className="trail-stat wide">
            <div className="trail-stat-name"><span aria-hidden="true">🛢️</span> The Wildcat Driller — the whole class</div>
            <div className="big-number">{cls.count ? `${cls.average}%` : '—'}</div>
            <div className="muted">{cls.count} {cls.count === 1 ? 'student' : 'students'} finished · average accuracy</div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => downloadPdf(roster)}>⬇ Download PDF report</button>
        </div>
        <p className="muted">The PDF is the only record that survives the session. Download it before you end.</p>
      </div>

      <div className="card">
        <h2>Roster ({students.length})</h2>
        <p className="muted">{inProgress} in progress · {completed} completed</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Status</th><th>Accuracy</th><th></th></tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={4} className="muted">Nobody has joined yet. Share the class code!</td></tr>
              )}
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className={`conn-dot ${s.connected ? 'on' : 'off'}`} title={s.connected ? 'Connected' : 'Disconnected'} />{' '}
                    {s.name}{!s.approved && <span className="badge pending">pending</span>}
                  </td>
                  <td><span className={`badge ${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                  <td className="num">{s.accuracy != null ? `${s.accuracy}%` : '—'}</td>
                  <td className="row-actions">
                    <button className="btn small danger" onClick={() => op('teacher:kick', { studentId: s.id })}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmEnd && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className="card dialog">
            <h2 id="end-title">End this session?</h2>
            <p><b>This will delete session data. Do you want to proceed?</b></p>
            <p className="muted">
              Every student record for this session is erased from server memory
              immediately. There is no undo. Make sure you downloaded the PDF first.
            </p>
            <div className="btn-row right">
              <button className="btn secondary" onClick={() => setConfirmEnd(false)}>Cancel</button>
              <button className="btn danger" onClick={async () => { setConfirmEnd(false); await op('teacher:end_session'); }}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">7th Grade Texas History · Wildcatter · TEKS 7.7A, 7.7B, 7.1B, 7.12B</footer>
    </div>
  );
}

/* ---------------- PDF (jsPDF + autotable, fully client-side) ---------------- */

function downloadPdf(roster) {
  if (!roster) return;
  const date = new Date().toISOString().slice(0, 10);
  const doc = new jsPDF();
  const BRAND = [58, 44, 28]; // oil-black / derrick timber

  doc.setFontSize(16);
  doc.text('Wildcatter — Session Report', 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90);
  const completed = roster.students.filter((s) => s.status === 'completed').length;
  doc.text(
    `Class code: ${roster.joinCode}   ·   Date: ${date}   ·   Students: ${roster.students.length}   ·   Completed: ${completed}`,
    14, 23
  );

  const rows = roster.students.map((s) => [
    s.name,
    STATUS_LABEL[s.status],
    s.accuracy != null ? `${s.accuracy}%` : '—',
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['Student', 'Status', 'Accuracy']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND },
  });

  const cls = (roster.classAccuracy || {})[SIDE] || { count: 0, average: 0 };
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Class accuracy (whole class, one group)', 'Students finished', 'Average']],
    body: [['The Wildcat Driller', String(cls.count), cls.count ? `${cls.average}%` : '—']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: BRAND },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('7th Grade Texas History · Wildcatter · TEKS 7.7A, 7.7B, 7.1B, 7.12B', 14, doc.internal.pageSize.getHeight() - 8);

  doc.save(`wildcatter_${roster.joinCode}_${date}.pdf`);
}
