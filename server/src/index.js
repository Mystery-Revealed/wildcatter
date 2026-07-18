// index.js — HTTP + Socket.IO bootstrap. Serves the built React client and
// attaches the socket layer. One Render web service runs this file; the whole
// app (student game + Teacher Command Center) lives at one URL for the Wix iframe.
//
// All session state lives in server memory. No database, no accounts, no
// persistence: data vanishes on "End Session", after the idle sweep, or when
// the server restarts. The teacher's PDF is the only permanent record, by design.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import { config } from './config.js';
import { GameManager } from './GameManager.js';
import { attachSockets } from './sockets/socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const manager = new GameManager();

// Health check (handy on Render).
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, service: 'wildcatter', liveSessions: manager.registry.sessions.size }));

// Serve the built client (client/dist). During local dev you run Vite separately.
const clientDist = path.resolve(__dirname, config.clientDir);
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  const indexFile = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  next();
});

const server = http.createServer(app);
const io = new Server(server); // same-origin in production; Vite proxies in dev

attachSockets(io, manager);

// Idle sweep: drops abandoned sessions from memory (the automatic backstop —
// nothing outlives the inactivity window even if nobody clicks End Session).
setInterval(() => {
  const removed = manager.sweepIdle();
  if (removed.length) console.log(`[sweep] removed idle sessions: ${removed.join(', ')}`);
}, 5 * 60 * 1000);

server.listen(config.port, () => {
  console.log(`[wildcatter] listening on :${config.port} — sessions live in memory only`);
});
