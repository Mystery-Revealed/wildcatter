// profanity.js — nickname filter. The TEACHER'S APPROVAL is the real gate;
// this just auto-blocks the obvious stuff so a bad word never flashes on the
// roster while the teacher is looking away.

const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'nigg', 'fag',
  'whore', 'slut', 'penis', 'vagina', 'porn', 'sex', 'rape', 'nazi', 'kkk',
  'damn', 'hell', 'crap', 'stupid', 'idiot', 'butthole', 'boob', 'anus',
];

// Returns { ok: boolean, reason?: string, cleaned: string }
export function checkNickname(raw, maxLen = 20) {
  const cleaned = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);

  if (cleaned.length < 2) return { ok: false, reason: 'empty', cleaned };

  const lower = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const word of BLOCKED) {
    if (lower.includes(word)) return { ok: false, reason: 'blocked', cleaned };
  }
  return { ok: true, cleaned };
}
