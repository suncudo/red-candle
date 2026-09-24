// GET /api/start → a signed run ticket. The seed decides the candles, so it comes
// from the server; the signature proves the ticket was issued here and when.
import { randomBytes } from 'node:crypto';
import { sign, json, preflight } from './_server.js';

export const OPTIONS = preflight;

export function GET(request) {
  try {
    const seed = randomBytes(4).readUInt32BE(0);
    const issued = Date.now();
    return json(request, { seed, issued, sig: sign(`run:${seed}:${issued}`) });
  } catch (err) {
    return json(request, { error: err.message }, 503);
  }
}
