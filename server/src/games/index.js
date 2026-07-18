// games/index.js — registry of playable games. GameManager looks games up here,
// keeping the engine reusable across Texas History units.

import wildcatter from './wildcatter.js';

export const GAMES = {
  [wildcatter.id]: wildcatter,
};

export function getGame(id) {
  return GAMES[id] || null;
}
