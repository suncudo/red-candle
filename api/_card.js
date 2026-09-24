// Share card layout (1200×630), as plain objects so it needs no JSX build step.
// Kept apart from og.js so it can be previewed without Vercel.
import { readRun } from './_run.js';

const C = { ground: '#0b0d15', panel: '#141827', line: '#262c42', text: '#e9e5d8', muted: '#8a8fa6', green: '#2fd67b', red: '#ff4a5c', amber: '#ffb347' };

const el = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

// a little chart: steady green climb, then one big red candle
function chart() {
  const candles = [
    [40, 70, 'g'], [70, 60, 'g'], [110, 80, 'g'], [150, 50, 'g'], [175, 90, 'g'],
    [230, 60, 'g'], [260, 100, 'g'], [330, 70, 'g'], [360, 320, 'r'],
  ];
  return el({ position: 'relative', width: 420, height: 440 },
    ...candles.map(([bottom, h, c], i) => el({
      position: 'absolute', left: 20 + i * 44, bottom: c === 'r' ? 60 : bottom,
      width: 28, height: h, borderRadius: 4, background: c === 'r' ? C.red : C.green,
    })),
  );
}

// ?score=… makes a card for one run; without it, a generic game card
export function card(params) {
  const run = readRun(params);
  const left = params.has('score')
    ? [
        el({ fontSize: 34, color: C.muted }, run.handle ? `@${run.handle}` : 'A trader'),
        el({ fontSize: 132, color: C.amber, lineHeight: 1 }, run.score.toLocaleString('en-US')),
        el({ fontSize: 34, color: C.muted, letterSpacing: 4 }, 'PROFIT'),
        el({ fontSize: 40, color: C.text, marginTop: 28 }, `Level ${run.level} · ${run.levelName}`),
        el({ fontSize: 28, color: C.muted, marginTop: 8 }, `${run.speed} speed · Can you beat it?`),
      ]
    : [
        el({ fontSize: 44, color: C.text, lineHeight: 1.3, maxWidth: 620 }, 'Sell every red candle before your chair kicks you.'),
        el({ fontSize: 26, color: C.muted, marginTop: 24 }, '5 market phases · endless mode · leaderboard'),
      ];

  return el({ width: '100%', height: '100%', background: C.ground, padding: 64, justifyContent: 'space-between', alignItems: 'center' },
    el({ flexDirection: 'column', justifyContent: 'center', width: 620 },
      el({ fontSize: 40, color: C.red, letterSpacing: 6, marginBottom: 28 }, 'RED CANDLE'),
      ...left,
    ),
    el({ background: C.panel, border: `2px solid ${C.line}`, borderRadius: 16, padding: 16 }, chart()),
  );
}
