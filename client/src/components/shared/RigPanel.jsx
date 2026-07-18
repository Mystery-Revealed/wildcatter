// RigPanel.jsx — the status panel that replaces a map (spec §1, §3). Two stacked
// parts, both display-only (the server owns all gameplay truth):
//
//   1. THE WILDCAT OPERATION — an SVG of a lease on a bare Texas hill. The oil
//      earth is always there; as the Wells meter grows the scene builds up: a
//      timber derrick goes up, the well blows in (a black gusher plume), it gets
//      capped and a pumpjack rocks steadily, and finally a pipeline runs to a
//      refinery on the horizon. Unbuilt pieces show as faint dashed "plans."
//      Below, labeled chips repeat the same status in text — color is never the
//      only signal.
//
//   2. THE THIRTY YEARS — the six eras, 1901–1931, as a simple list with the
//      current era highlighted.

const STAGES = [
  { key: 'derrick',  name: 'Derrick raised',      icon: '🗼', at: 55 },
  { key: 'gusher',   name: 'Well blows in',       icon: '💥', at: 66 },
  { key: 'pumping',  name: 'Capped & pumping',    icon: '🛢️', at: 74 },
  { key: 'pipeline', name: 'Pipeline & refinery', icon: '🏭', at: 84 },
];

// Fixed era design (client display only; titles mirror the adapter).
const ERAS = [
  { n: 1, title: 'The Gusher', date: '1901' },
  { n: 2, title: 'Gusher Control', date: '1901' },
  { n: 3, title: 'The Glut', date: '1901–02' },
  { n: 4, title: 'Boomtown Life', date: '1902–04' },
  { n: 5, title: 'Chasing New Fields', date: '1903–20s' },
  { n: 6, title: 'East Texas', date: '1930–31' },
];

export default function RigPanel({ meters, chapterIndex = 0 }) {
  const wells = meters?.wells ?? 50;
  const has = (at) => wells >= at;
  const cur = Math.max(0, Math.min(ERAS.length - 1, chapterIndex));

  return (
    <div className="rig-panel">
      <div className="rig-scene-wrap">
        <div className="panel-title">Your wildcat lease</div>
        <svg
          className="rig-scene"
          viewBox="0 0 300 170"
          role="img"
          aria-label={`A wildcat oil lease on a Texas hill.${has(55) ? ' A timber derrick stands.' : ' Bare ground, ready to drill.'}${has(66) ? ' The well has blown in.' : ''}${has(74) ? ' A pumpjack rocks steadily.' : ''}${has(84) ? ' A pipeline runs to a refinery on the horizon.' : ''}`}
        >
          {/* sky + the bare hill */}
          <rect x="0" y="0" width="300" height="122" className="rp-sky" rx="10" />
          <path d="M0 122 Q80 96 160 110 Q240 122 300 100 L300 170 L0 170 Z" className="rp-ground" />

          {/* refinery + pipeline on the horizon — Wells ≥ 84 */}
          <g className={`rp-piece ${has(84) ? 'built' : 'planned'}`} aria-hidden="true">
            <rect x="250" y="70" width="10" height="34" className="rp-refinery" />
            <rect x="264" y="60" width="8" height="44" className="rp-refinery" />
            <rect x="276" y="76" width="10" height="28" className="rp-refinery" />
            <rect x="252" y="56" width="4" height="16" className="rp-refinery-stack" />
            {/* pipeline running along the ground toward the refinery */}
            <path d="M150 150 L246 118" className="rp-pipe" />
          </g>

          {/* the timber derrick — always the frame of a wildcat lease, but only
              "raised" at Wells ≥ 55 (below that it reads as a faint plan) */}
          <g className={`rp-piece ${has(55) ? 'built' : 'planned'}`} aria-hidden="true">
            <line x1="70" y1="150" x2="96" y2="48" className="rp-derrick" />
            <line x1="122" y1="150" x2="96" y2="48" className="rp-derrick" />
            <line x1="78" y1="120" x2="114" y2="120" className="rp-derrick-cross" />
            <line x1="84" y1="96" x2="108" y2="96" className="rp-derrick-cross" />
            <line x1="88" y1="74" x2="104" y2="74" className="rp-derrick-cross" />
            <rect x="90" y="44" width="12" height="8" className="rp-derrick-crown" />
          </g>

          {/* the gusher — the well blows in: a black plume over the derrick — Wells ≥ 66 */}
          <g className={`rp-piece ${has(66) ? 'built' : 'planned'}`} aria-hidden="true">
            <path d="M96 46 Q90 22 100 8 Q106 22 102 40 Q112 26 116 14 Q116 34 104 48 Z" className="rp-gusher" />
            <circle cx="108" cy="16" r="3" className="rp-gusher-drop" />
            <circle cx="90" cy="24" r="2.4" className="rp-gusher-drop" />
            <circle cx="116" cy="30" r="2" className="rp-gusher-drop" />
          </g>

          {/* the pumpjack — capped and pumping steadily — Wells ≥ 74 */}
          <g className={`rp-piece ${has(74) ? 'built' : 'planned'}`} aria-hidden="true">
            <rect x="150" y="132" width="52" height="8" className="rp-pj-base" rx="2" />
            <line x1="168" y1="134" x2="168" y2="112" className="rp-pj-post" />
            <line x1="150" y1="106" x2="196" y2="118" className="rp-pj-beam" />
            <line x1="150" y1="106" x2="148" y2="126" className="rp-pj-head" />
            <circle cx="168" cy="112" r="3" className="rp-pj-pivot" />
          </g>
        </svg>

        <div className="build-chips" role="list" aria-label="Well status">
          {STAGES.map((s) => {
            const done = has(s.at);
            return (
              <div key={s.key} role="listitem" className={`build-chip ${done ? 'done' : ''}`}>
                <span aria-hidden="true">{s.icon}</span> {s.name}
                <b className="build-state">{done ? '✓' : '—'}</b>
              </div>
            );
          })}
        </div>
        <p className="build-hint">The lease builds up as your <b>Wells</b> meter grows.</p>
      </div>

      <div className="era-listing">
        <div className="panel-title">The thirty years</div>
        <ol className="chapter-list">
          {ERAS.map((c, i) => {
            const state = i < cur ? 'past' : i === cur ? 'current' : 'future';
            return (
              <li key={c.n} className={`chapter-item ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="chapter-dot" aria-hidden="true">{i < cur ? '✓' : c.n}</span>
                <span className="chapter-name">{c.title}</span>
                <span className="chapter-date">{c.date}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
