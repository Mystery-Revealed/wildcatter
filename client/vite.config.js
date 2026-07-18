import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Chromebook/tablet/phone target — no exotic build features needed.
// In production the Node server serves the built client from one origin;
// in dev, Vite proxies socket traffic to the game server on :4750.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true, // expose on LAN so classroom devices can reach the dev build
    proxy: {
      '/socket.io': { target: 'http://localhost:4750', ws: true },
    },
  },
});
