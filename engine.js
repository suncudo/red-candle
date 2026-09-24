// Red Candle game rules, shared by the browser and the server.
//
// Deterministic: the same seed, speed and press ticks always give the same run,
// so the server can replay a player's presses and compute the score itself.
// Time moves in fixed ticks (TICK seconds) and only plain arithmetic is used in
// anything that decides the outcome, so every JS engine gets the same numbers.
// Visual effects are not part of this file: the game reports events through `on`.

export const TICK = 1 / 120;
export const MAX_HP = 5;
export const OUCH = 1.3;    // seconds the trader spends flying after a kick
export const BANNER = 2.4;  // seconds the level banner pauses the chart

export const SPEEDS = {
  chill:  { mult: 1.35, note: 'Relaxed pace. Good for a first try.' },
  normal: { mult: 1,    note: 'The intended pace.' },
  degen:  { mult: 0.72, note: 'Fast from the very first candle.' },
};

// dur = seconds per candle, pRed = chance of a red candle,
// streak = max reds in a row, flip = chance a green candle dumps into red halfway,
// long = chance a red is a long one you survive by mashing, heavy = chance a red needs 3 taps
export const LEVELS = [
  { name: 'Sideways',    note: 'Warm-up. Take your time.',                candles: 12, dur: 1.35, pRed: 0.3,  streak: 1, flip: 0,    long: 0,    heavy: 0 },
  { name: 'Bull Run',    note: 'New: long reds. Mash Space to stay up!',  candles: 15, dur: 1.0,  pRed: 0.26, streak: 1, flip: 0,    long: 0.3,  heavy: 0 },
  { name: 'Correction',  note: 'New: heavy reds. Sell them with 3 taps!', candles: 15, dur: 0.92, pRed: 0.45, streak: 2, flip: 0,    long: 0.2,  heavy: 0.3 },
  { name: 'Pump & Dump', note: 'Green candles can flip red mid-way!',     candles: 15, dur: 0.88, pRed: 0.35, streak: 2, flip: 0.25, long: 0.18, heavy: 0.25 },
  { name: 'Flash Crash', note: 'Red streaks, full speed.',                candles: 18, dur: 0.72, pRed: 0.48, streak: 3, flip: 0.15, long: 0.22, heavy: 0.3 },
];

export function levelDef(i) {
  if (i < LEVELS.length) return LEVELS[i];
  const n = i - LEVELS.length + 1;  // endless: keeps getting faster
  return { name: 'Degen Hour ' + n, note: 'Endless mode. How long can you last?', candles: 20,
           dur: Math.max(0.38, 0.7 - n * 0.05), pRed: 0.5, streak: 3, flip: 0.2, long: 0.25, heavy: 0.35 };
}

// mulberry32: small seeded random generator, identical everywhere
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// mode 'play' is a real run; mode 'intro' is the attract chart behind the menu
export function createGame({ seed, speed = 'normal', mode = 'play', on = () => {} }) {
  const g = {
    seed: seed >>> 0, speed: SPEEDS[speed] ? speed : 'normal', rand: makeRng(seed), on,
    mode: 'intro', tick: 0, time: 0, hp: MAX_HP, score: 0, combo: 0, done: 0,
    candles: [], cur: null, price: 100, ouch: 0, lvl: 0, lvlDone: 0, banner: 0,
    stand: 0, spike: 0, reds: 0, longs: 0, heavies: 0,
    presses: [], fast: 0, endTick: 0,
  };
  for (let i = 0; i < 14; i++) { newCandle(g); finishCandle(g, true); }
  g.mode = mode;
  if (mode === 'play') g.banner = BANNER;
  newCandle(g);
  return g;
}

function newCandle(g) {
  const L = levelDef(g.lvl), R = g.rand, play = g.mode === 'play';
  let run = 0;
  for (let i = g.candles.length - 1; i >= 0 && g.candles[i].red; i--) run++;
  let red = R() < L.pRed;
  if (run >= L.streak) red = false;
  if (g.ouch > 0) red = false;
  const flip = !red && play && g.ouch === 0 && R() < L.flip;
  // the first few red candles are slow so new players learn the move
  if (red && play) g.reds++;
  // a long red: lasts 3s and has to be survived by mashing Space
  const long = red && play && g.reds > 3 && R() < L.long;
  if (long) g.longs++;
  // a heavy red: needs 3 taps before it closes
  const heavy = red && !long && play && g.reds > 3 && R() < L.heavy;
  if (heavy) g.heavies++;
  const tutorial = red && play && (g.reds <= 3 || (long && g.longs <= 2) || (heavy && g.heavies <= 2));
  const o = g.price, size = o * (0.004 + R() * 0.012) * (long ? 2.8 : heavy ? 1.8 : 1);
  const c = red ? o - size : o + size;
  let dur = L.dur * SPEEDS[g.speed].mult * (flip ? 1.4 : heavy ? 1.6 : 1);
  if (long) dur = 3;
  g.cur = { o, c, red, tutorial, flip, size, long, need: heavy ? 3 : 1, heavy,
    h: Math.max(o, c) + R() * size * 0.7,
    l: Math.min(o, c) - R() * size * 0.7,
    vol: 0.3 + R() * 0.7 + (red ? 0.3 : 0),
    age: 0, dur: tutorial && !long ? Math.max(2, dur) : dur, pressed: false, result: null, redAt: 0 };
}

// a "pump & dump" candle: rises green, then dumps into red — now it must be sold
function flipCandle(g) {
  const k = g.cur, p = k.age / k.dur, v = k.o + (k.c - k.o) * (1 - (1 - p) * (1 - p));
  k.flip = false; k.red = true; k.pressed = false; k.result = null; k.redAt = k.age;
  k.h = Math.max(k.h, v); k.c = k.o - k.size * 1.3; k.l = k.c - g.rand() * k.size * 0.5; k.vol += 0.4;
  g.on('flip');
}

function levelUp(g) {
  g.lvl++; g.lvlDone = 0; g.banner = BANNER;
  const healed = g.hp < MAX_HP;
  if (healed) g.hp++;
  g.on('levelup', { healed });
}

function hit(g) {
  g.hp--; g.combo = 0; g.ouch = OUCH;
  g.on('hit');
}

function finishCandle(g, silent) {
  const c = g.cur;
  if (!silent && c.red && !c.pressed) { c.result = 'miss'; hit(g); }
  else if (!silent && c.long && c.result !== 'miss') {
    c.result = 'cut'; g.combo++;
    const gain = 50 * (g.lvl + 1);
    g.score += gain;
    g.on('survive', { gain });
  }
  g.candles.push(c);
  if (g.candles.length > 40) g.candles.shift();
  g.price = c.c;
  if (!silent) {
    g.done++; g.lvlDone++;
    if (g.lvlDone >= levelDef(g.lvl).candles && g.hp > 0) levelUp(g);
  }
}

// how far the trader's butt is off the seat, in px (eased so a press feels like a hop)
export const standLift = g => (1 - (1 - g.stand) * (1 - g.stand)) * 55;

// a red candle that still needs the player's attention
export const danger = g => g.mode === 'play' && g.cur.red && g.ouch === 0 && g.banner === 0
  && (g.cur.long ? g.cur.result !== 'miss' : !g.cur.pressed);

// the player pressed Space (or tapped) right now, between ticks
export function press(g) {
  if (g.mode !== 'play' || g.ouch > 0 || g.banner > 0) return;
  g.presses.push(g.tick);
  const c = g.cur;
  if (c.long) {
    // every press pops the trader up out of the chair, away from the candle
    if (c.result === 'miss') return;
    c.pressed = true; g.stand = 1;
    g.score += g.lvl + 1;
    g.on('mash');
    return;
  }
  // every press on green, or on a red you already sold, costs points and the streak
  if (!c.red || c.pressed) {
    const pen = 5 * (g.lvl + 1);
    g.score = Math.max(0, g.score - pen); g.combo = 0;
    g.on('wrong', { pen });
    return;
  }
  // faster than a human can react to the candle turning red
  if (c.need === (c.heavy ? 3 : 1) && c.age - c.redAt < 0.1) g.fast++;
  if (c.need > 1) {
    c.need--;
    g.on('more', { need: c.need });
    return;
  }
  c.pressed = true;
  g.combo++;
  const gain = 10 * (g.lvl + 1) * (1 + Math.floor(g.combo / 5));
  g.score += gain; c.result = 'cut';
  g.on('sell', { gain, combo: g.combo });
}

// advance the game by one tick
export function step(g) {
  const dt = TICK;
  g.tick++; g.time += dt;
  if (g.ouch > 0) {
    g.ouch = Math.max(0, g.ouch - dt);
    if (g.ouch === 0 && g.hp <= 0) { g.mode = 'over'; g.endTick = g.tick; g.on('over'); }
  }
  if (g.mode === 'over') return;
  if (g.banner > 0) { g.banner = Math.max(0, g.banner - dt); return; }
  g.cur.age += dt * (g.mode === 'play' ? 1 : 0.5);
  if (g.cur.flip && g.cur.age >= g.cur.dur * 0.4) flipCandle(g);

  // long red: a candle creeps out of the seat and lunges; standing up keeps you clear
  g.stand = Math.max(0, g.stand - dt * 1.25);
  const k = g.cur;
  if (k.long && k.result !== 'miss' && g.ouch === 0) {
    const ramp = Math.min(1, k.age / 1.0);
    const phase = (g.time * 9 / (2 * Math.PI)) % 1;         // triangle wave in place of sin,
    const wave = 1 - 4 * Math.abs(phase - 0.5);             // so no engine-specific maths
    g.spike = ramp * 34 + wave * 7 * ramp;
    if (k.age > 0.7 && g.spike > standLift(g) + 4) { k.result = 'miss'; k.pressed = true; hit(g); }
  } else {
    g.spike = Math.max(0, g.spike - dt * 120);
  }
  if (g.cur.age >= g.cur.dur) {
    finishCandle(g, g.mode !== 'play');
    newCandle(g);
  }
}

// Replays a recorded run and returns what it actually scored.
// presses: ascending tick numbers; the run must end (game over) by endTick.
export function replay({ seed, speed, presses, endTick }) {
  const g = createGame({ seed, speed, mode: 'play' });
  let i = 0;
  while (g.mode !== 'over' && g.tick <= endTick) {
    while (i < presses.length && presses[i] === g.tick) { press(g); i++; }
    if (i < presses.length && presses[i] < g.tick) return { ok: false, reason: 'presses out of order' };
    step(g);
  }
  if (g.mode !== 'over') return { ok: false, reason: 'the run did not end' };
  return { ok: true, score: g.score, level: g.lvl + 1, levelName: levelDef(g.lvl).name, candles: g.done, fast: g.fast, endTick: g.endTick };
}
