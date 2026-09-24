// Reads a finished run from share-link query params, trusting nothing:
// numbers are clamped, the handle must look like an X handle, and the
// level name is looked up from the level number rather than taken from the URL.
const PHASES = ['Sideways', 'Bull Run', 'Correction', 'Pump & Dump', 'Flash Crash'];
const SPEEDS = { chill: 'Chill', normal: 'Normal', degen: 'Degen' };

const int = (v, min, max) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export function readRun(params) {
  const level = int(params.get('level'), 1, 999);
  const h = params.get('h') || '';
  return {
    score: int(params.get('score'), 0, 999999999),
    level,
    levelName: level <= PHASES.length ? PHASES[level - 1] : `Degen Hour ${level - PHASES.length}`,
    speed: SPEEDS[params.get('speed')] || 'Normal',
    handle: /^[A-Za-z0-9_]{1,15}$/.test(h) ? h : '',
  };
}

// the same run as a query string, rebuilt from the cleaned values
export function runQuery(run, speedKey) {
  const q = new URLSearchParams({ score: run.score, level: run.level, speed: speedKey });
  if (run.handle) q.set('h', run.handle);
  return q.toString();
}
