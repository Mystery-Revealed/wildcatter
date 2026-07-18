// config.js — ports, timers, and limits.

export const config = {
  // Render sets PORT; fall back to 4750 for local dev (a distinct port so this
  // game's dev server doesn't collide with the other Texas History games —
  // 4700/4701/4702/4720/4721/4730/4740 are already claimed by sibling games).
  port: process.env.PORT || 4750,

  // Where the built React client lives (client/dist). index.js serves it.
  clientDir: process.env.CLIENT_DIR || '../../client/dist',

  // Session / lobby limits
  joinCodeLength: 6,          // 6-digit numeric join code
  maxStudentsPerSession: 40,  // a large class
  maxNicknameLength: 20,

  // Teacher PIN: 4 digits, chosen at session creation, required on every
  // teacher operation so the Command Center survives a refresh or device swap.
  pinPattern: /^\d{4}$/,

  // Timers (ms)
  disconnectGraceMs: 25000,           // wait before offering the partner "finish vs the computer"
  idleSessionSweepMs: 2 * 60 * 60 * 1000, // sweep sessions with no activity after 2 hours

  // Name moderation: if true, students wait for teacher approval before playing.
  requireApprovalDefault: true,
};
