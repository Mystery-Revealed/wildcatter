// SessionRegistry.js — creates and looks up sessions by a short join code.
// Sessions live ONLY in memory. No database. When a session is removed
// (teacher ends it, or the idle sweep runs), its data is gone — which is
// exactly the "nothing kept long-term" guarantee.

import { config } from '../config.js';

export class SessionRegistry {
  constructor() {
    /** @type {Map<string, object>} joinCode -> session */
    this.sessions = new Map();
  }

  _newCode() {
    // 6-digit numeric code, unique among live sessions.
    for (let tries = 0; tries < 50; tries++) {
      let code = '';
      for (let i = 0; i < config.joinCodeLength; i++) {
        code += Math.floor(Math.random() * 10);
      }
      if (!this.sessions.has(code)) return code;
    }
    throw new Error('Could not allocate a unique join code');
  }

  create(sessionShape) {
    const joinCode = this._newCode();
    const session = { joinCode, createdAt: Date.now(), lastActivityAt: Date.now(), ...sessionShape };
    this.sessions.set(joinCode, session);
    return session;
  }

  get(joinCode) {
    return this.sessions.get(String(joinCode));
  }

  touch(joinCode) {
    const s = this.sessions.get(String(joinCode));
    if (s) s.lastActivityAt = Date.now();
  }

  remove(joinCode) {
    return this.sessions.delete(String(joinCode));
  }

  // Idle sweep: drop sessions with no activity for longer than the window.
  // Call on an interval from index.js. This is the automatic backstop that
  // clears any session a teacher walked away from without ending.
  sweepIdle(maxIdleMs = config.idleSessionSweepMs) {
    const now = Date.now();
    const removed = [];
    for (const [code, s] of this.sessions) {
      if (now - (s.lastActivityAt || s.createdAt) > maxIdleMs) {
        this.sessions.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
