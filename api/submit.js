// POST /api/submit → replays a finished run and records its score.
// The browser sends only the ticket, the speed and when Space was pressed;
// the score is whatever the replay produces. Only this server writes scores.
import { FieldValue } from 'firebase-admin/firestore';
import { replay, TICK } from '../engine.js';
import { firestore, verify, json, preflight, body, HANDLE, SPEED_KEYS } from './_server.js';

export const OPTIONS = preflight;

const MAX_BODY = 400_000;          // bytes; ~50k presses
const TICKET_TTL = 3 * 3600_000;   // a run must be submitted within 3 hours of starting
const MAX_FAST = 3;                // presses quicker than human reaction we tolerate

export async function POST(request) {
  const fail = (error, status = 400) => json(request, { error }, status);
  let b;
  try { b = await body(request, MAX_BODY); } catch { return fail('Bad request'); }

  const { handle, token, ticket, speed, endTick } = b || {};
  if (!HANDLE.test(handle || '')) return fail('Bad handle');
  if (!SPEED_KEYS.includes(speed)) return fail('Bad speed');
  if (!ticket || !Number.isInteger(ticket.seed) || !Number.isInteger(ticket.issued)) return fail('Bad ticket');
  if (!Number.isInteger(endTick) || endTick < 1) return fail('Bad run');
  if (!Array.isArray(b.presses) || !b.presses.every(d => Number.isInteger(d) && d >= 0)) return fail('Bad run');

  try {
    const db = firestore();
    const h = handle.toLowerCase();

    // the player: a verified handle and the token issued when it was verified
    const owner = await db.collection('handles').doc(h).get();
    if (!owner.exists || !verify(`player:${h}:${owner.data().claimId}`, token)) {
      return fail('Verify your X handle again to submit scores', 401);
    }

    // the ticket: issued by us, recently, and the run can't be longer than the time since
    if (!verify(`run:${ticket.seed}:${ticket.issued}`, ticket.sig)) return fail('Bad ticket');
    const elapsed = Date.now() - ticket.issued;
    if (elapsed > TICKET_TTL) return fail('This run is too old to submit');
    if (endTick * TICK * 1000 > elapsed + 5000) return fail('Run is longer than the time since it started');

    // presses arrive as gaps between ticks; rebuild the tick numbers and replay
    let t = 0;
    const presses = b.presses.map(d => (t += d));
    const r = replay({ seed: ticket.seed, speed, presses, endTick });
    if (!r.ok) return fail('Run could not be replayed: ' + r.reason);
    if (r.fast > MAX_FAST) return fail('Reactions faster than humanly possible');

    // each ticket counts once; keep the handle's best per speed
    const runRef = db.collection('runs').doc(String(ticket.seed) + '-' + ticket.issued);
    const scoreRef = db.collection('boards').doc(speed).collection('scores').doc(h);
    const result = await db.runTransaction(async tx => {
      const [run, prev] = await Promise.all([tx.get(runRef), tx.get(scoreRef)]);
      if (run.exists) return { duplicate: true };
      tx.create(runRef, { handle: h, speed, score: r.score, at: FieldValue.serverTimestamp() });
      const best = !prev.exists || r.score > prev.data().score;
      if (best) {
        tx.set(scoreRef, { handle: owner.data().handle, score: r.score, level: r.level, candles: r.candles, at: FieldValue.serverTimestamp() });
      }
      return { best, bestScore: best ? r.score : prev.data().score };
    });
    if (result.duplicate) return fail('This run was already submitted', 409);
    return json(request, { score: r.score, level: r.level, levelName: r.levelName, candles: r.candles, ...result });
  } catch (err) {
    return fail(err.message === 'Server is not configured yet' ? err.message : 'Server error', 503);
  }
}
