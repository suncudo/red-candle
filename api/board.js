// GET /api/board?speed=normal → top 20, one best run per verified handle.
import { firestore, json, preflight, SPEED_KEYS } from './_server.js';

export const OPTIONS = preflight;

export async function GET(request) {
  const speed = new URL(request.url).searchParams.get('speed');
  if (!SPEED_KEYS.includes(speed)) return json(request, { error: 'Bad speed' }, 400);
  try {
    const snap = await firestore().collection('boards').doc(speed).collection('scores')
      .orderBy('score', 'desc').limit(20).get();
    const rows = snap.docs.map(d => ({ id: d.id, handle: d.data().handle, score: d.data().score, level: d.data().level }));
    return json(request, { rows }, 200, 'public, s-maxage=10, stale-while-revalidate=30');
  } catch (err) {
    return json(request, { error: err.message === 'Server is not configured yet' ? err.message : 'Server error' }, 503);
  }
}
