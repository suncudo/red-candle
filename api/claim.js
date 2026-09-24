// Proving you own an X handle, without X's paid API:
//
// POST /api/claim { step: 'code', handle }
//   → { nonce, code }. The code is derived from a secret nonce only the player's
//     browser keeps, so seeing the code in someone's post doesn't let you reuse it.
// POST /api/claim { step: 'verify', handle, nonce, tweetUrl }
//   → reads the post through X's free public oEmbed endpoint, checks it was posted
//     by @handle and contains the code, then returns a player token for that handle.
//     Verifying again (by the real owner) replaces any earlier claim.
import { FieldValue } from 'firebase-admin/firestore';
import { firestore, sign, verify, randomId, json, preflight, body, HANDLE } from './_server.js';

export const OPTIONS = preflight;

const codeFor = (h, nonce) => 'RC-' + sign(`claim:${h}:${nonce}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
const TWEET = /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})(?:[/?#].*)?$/;

export async function POST(request) {
  const fail = (error, status = 400) => json(request, { error }, status);
  let b;
  try { b = await body(request, 2000); } catch { return fail('Bad request'); }
  const handle = String(b?.handle || '').replace(/^@/, '');
  if (!HANDLE.test(handle)) return fail('Use your X handle: letters, digits and _ only, up to 15 characters.');
  const h = handle.toLowerCase();

  try {
    if (b.step === 'code') {
      const nonce = randomId(16);
      return json(request, { nonce, code: codeFor(h, nonce) });
    }

    if (b.step !== 'verify') return fail('Bad request');
    const nonce = String(b.nonce || '');
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(nonce)) return fail('Start again: get a new code');
    const m = TWEET.exec(String(b.tweetUrl || '').trim());
    if (!m) return fail('Paste the link to your post, like https://x.com/you/status/123…');
    if (m[1].toLowerCase() !== h) return fail(`That post isn't from @${handle}.`);

    // X's public embed endpoint: free, no key, only works for public posts
    const url = `https://x.com/${m[1]}/status/${m[2]}`;
    const res = await fetch('https://publish.twitter.com/oembed?omit_script=true&url=' + encodeURIComponent(url), { redirect: 'follow' });
    if (!res.ok) return fail("Couldn't read that post. Make sure it's public and try again in a minute.");
    const post = await res.json();
    const author = String(post.author_url || '').split('/').pop().toLowerCase();
    if (author !== h) return fail(`That post isn't from @${handle}.`);
    if (!String(post.html || '').includes(codeFor(h, nonce))) return fail("Your code isn't in that post. Post the exact text and try again.");

    // X's spelling of the handle, from the post's author link
    const realHandle = String(post.author_url).split('/').pop();
    const claimId = randomId(12);
    await firestore().collection('handles').doc(h).set({ handle: realHandle, claimId, tweet: url, verifiedAt: FieldValue.serverTimestamp() });
    return json(request, { handle: realHandle, token: sign(`player:${h}:${claimId}`) });
  } catch (err) {
    return fail(err.message === 'Server is not configured yet' ? err.message : 'Server error', 503);
  }
}

// GET /api/claim?handle=x&token=… → is this saved token still valid? (someone may have re-verified)
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const h = String(q.get('handle') || '').toLowerCase();
  if (!HANDLE.test(h)) return json(request, { valid: false });
  try {
    const doc = await firestore().collection('handles').doc(h).get();
    return json(request, { valid: doc.exists && verify(`player:${h}:${doc.data().claimId}`, q.get('token')) });
  } catch (err) {
    return json(request, { error: 'Server error' }, 503);
  }
}
