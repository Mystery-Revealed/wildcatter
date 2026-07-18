// socket.js — socket.io-client singleton. In production the client is served
// by the same origin as the server; in dev, Vite proxies /socket.io to :4000.

import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io({ autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

// Promise-based emit with a 10s timeout, so buttons never hang silently when
// the school network eats a packet.
export function emitAck(event, payload) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, error: 'timeout' });
      }
    }, 10000);
    getSocket().emit(event, payload, (res) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(res ?? { ok: false, error: 'no_response' });
      }
    });
  });
}

// Human-readable error strings (5th grade friendly).
export const ERROR_TEXT = {
  timeout: 'The server did not answer. Check your internet and try again.',
  no_session: 'That code didn’t match an open class. Check it and try again.',
  full: 'This class session is full. Tell your teacher.',
  nickname_empty: 'Please type a name (at least 2 letters).',
  nickname_blocked: 'Please pick a different name.',
  bad_name: 'Please pick a different name.',
  bad_pin: 'That PIN doesn’t match.',
  unknown_game: 'The game could not be found. Refresh and try again.',
  not_your_turn: 'It’s not your turn yet.',
  no_match: 'Your match could not be found. Ask your teacher for help.',
  partner_still_here: 'Your partner is still connected.',
  session_gone: 'That session has ended.',
};

export const errorText = (code) => ERROR_TEXT[code] || 'Something went wrong. Please try again.';
