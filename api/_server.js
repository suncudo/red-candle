// Shared server helpers: Firestore (admin access), signatures, JSON + CORS responses.
// Needs the FIREBASE_SERVICE_ACCOUNT env var (the service account JSON) on Vercel.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db = null, key = null;
function setup() {
  if (db) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Server is not configured yet');
  const sa = JSON.parse(raw);
  if (!getApps().length) initializeApp({ credential: cert(sa) });
  db = getFirestore();
  // signing key for run tickets and player tokens, derived from the service account's private key
  key = createHmac('sha256', sa.private_key).update('red-candle-signing-v1').digest();
}

export const firestore = () => (setup(), db);
export const sign = text => (setup(), createHmac('sha256', key).update(text).digest('base64url'));
export function verify(text, sig) {
  const a = Buffer.from(sign(text)), b = Buffer.from(String(sig || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
export const randomId = (bytes = 12) => randomBytes(bytes).toString('base64url');

export const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
export const SPEED_KEYS = ['chill', 'normal', 'degen'];

// the game is served from Vercel and mirrored on GitHub Pages
const ORIGINS = ['https://red-candle-lime.vercel.app', 'https://suncudo.github.io', 'http://localhost:5173'];
function cors(request) {
  const origin = request.headers.get('origin');
  return ORIGINS.includes(origin)
    ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' }
    : {};
}
export const preflight = request => new Response(null, { status: 204, headers: cors(request) });
export function json(request, data, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', 'cache-control': cache, ...cors(request) },
  });
}

// reads a JSON body, refusing anything over `limit` bytes
export async function body(request, limit) {
  const text = await request.text();
  if (text.length > limit) throw new Error('Request too large');
  return JSON.parse(text);
}
