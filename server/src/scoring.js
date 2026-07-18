// scoring.js — PURE accuracy math. No I/O, no sockets. Easy to unit-test.
// Same "honest scoring" spirit as Chronos: no speed bonuses, no streaks, no multipliers.
//
// Each graded action has a verdict:
//   'right'   -> 1 point
//   'partial' -> 0.5 point
//   'wrong'   -> 0 points
// Accuracy = round(pointsEarned / totalActions * 100).

export const POINTS = { right: 1, partial: 0.5, wrong: 0 };

export function pointsFor(verdict) {
  return POINTS[verdict] ?? 0;
}

// actions: array of { verdict } (order/kind doesn't matter for the total).
// totalActions: the denominator (e.g., 8 for Survive the Season, 12 for Claim the Land).
export function accuracyPercent(actions, totalActions) {
  if (!totalActions) return 0;
  const earned = actions.reduce((sum, a) => sum + pointsFor(a.verdict), 0);
  return Math.round((earned / totalActions) * 100);
}

export function pointsEarned(actions) {
  return actions.reduce((sum, a) => sum + pointsFor(a.verdict), 0);
}

// Average accuracy across a set of completed players (used for per-nation/per-tribe class stats).
// players: array of { accuracy } for COMPLETED players in one group.
export function averageAccuracy(players) {
  if (!players.length) return 0;
  const sum = players.reduce((s, p) => s + (p.accuracy ?? 0), 0);
  return Math.round(sum / players.length);
}
