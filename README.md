# Wildcatter

A solo, class-wide Texas History economy game for **Unit 6 — Cotton, Cattle, Railroads, and the Age of Oil**.
Everyone in the class is an independent Texas oil driller — a **wildcatter** — from **1901 to 1931**.

> January 10, 1901: a hill near Beaumont erupts a hundred feet of oil into the sky, and nothing in
> Texas is ever the same. Drill smart, survive the busts, and become the kind of oilman people trust —
> and learn why boom-and-bust is a rhythm you feel, not a phrase you memorize.

- **TEKS:** 7.7A (oil industrializes Texas), 7.7B (boom-and-bust cycles), 7.1B (1901 Spindletop), 7.12B (supply and demand — lived, not defined).
- **Shape:** 6 eras × 2 graded decisions = **12 graded actions**; three meters — 💵 **Cash**, 🛢️ **Wells** (producing capacity), 🤝 **Reputation** (trust with crews, landowners, and buyers — the anti-swindler meter) — all start at 50.
- **The price ticker:** a scripted, **display-only** oil-price counter runs across the top the whole game. It spikes and crashes with history — from about **$1.85 a barrel** to just **3¢** in the post-Spindletop glut, back over a dollar by the 1920s, then crashing again with the **East Texas field (1930)** before **1931 prorationing** settles it back to about a dollar on the result screen. It is stored in cents, never a meter, and never scored.
- **The honest design:** you **cannot stop the boom and bust, only drill well through it.** Unlike the sibling debt game, there are **no scripted meter tolls** — every change to Cash / Wells / Reputation comes from your own 12 decisions. There is **no early-fail**; the wildcatter always drills all thirty years, and the debrief lands the boom-and-bust lesson (TEKS 7.7B) and supply and demand (7.12B).
- **Sensitivity:** swindler-era fraud — fake "guaranteed" shares ("Swindletop"), sight-unseen scams, hidden contract fine print, and hot-oil smuggling — is graded **wrong** via Reputation hits in every era, and the feedback names it as wrong, never clever. Well-accident danger is named as fire and lost men, never with gore.

Built on the shared Texas History game engine (Pattern A): server-authoritative Node + Express + Socket.IO, a React 18 + Vite thin client, one Render web service, and a live **Teacher Command Center** reporting one class-wide accuracy group. All session state lives in server memory — no database. See `D:\Texas History\Common_Build_Standards.md`.

**Pairs with the Boom-and-Bust Meter app and the Spindletop app** (Unit 6): see the cycle and tour the gusher there — then live it here.

## Run it locally

```bash
npm install          # cascades to server/ and client/ via postinstall (exFAT-safe, no workspaces)
npm run build        # builds the React client into client/dist
npm start            # node server/src/index.js — serves the built client + sockets on :4750
```

Then open:
- **Students:** <http://localhost:4750/>
- **Teacher Command Center:** <http://localhost:4750/#teacher> (create a session, share the 6-digit code)

```bash
npm test             # server test suite (content bank, balance, price ticker, lifecycle, sensitivity, scoring)
```

## Deploy (Render) & embed (Wix)

- Render → New Blueprint Instance → connect this repo. `render.yaml` is included: `buildCommand: npm install && npm run build`, `startCommand: node server/src/index.js`. Render sets `PORT`.
- In Wix: **Add → Embed Code → Embed a Site**, paste the Render HTTPS URL (~1000×720). Put the `#teacher` route on a **password-protected** Wix page; the in-app 4-digit PIN is a second layer.

## Layout

```
server/src/games/wildcatter.js     the game: 6 eras, the answer key (verdicts/effects/feedback), the oil-price ticker + debrief
server/src/games/_stepGame.js      the shared step-game factory (carries the display-only price field)
server/src/GameManager.js          sessions, roster, class accuracy, PDF data — engine (unchanged)
client/src/components/student/      Datapad (title/how/join), MatchView, ResultScreen
client/src/components/shared/       RigPanel (wildcat-lease SVG that builds up with Wells), PriceTicker (the running oil-price bar), MetersBar
client/src/components/teacher/      CommandCenter (code, approval, roster, PDF, end-session)
client/public/assets/images/        6 Higgsfield illustrations (title/gusher + 5 era scenes + ending)
```

*Made for 7th Grade Texas History · TEKS 7.7A, 7.7B, 7.1B, 7.12B.*
