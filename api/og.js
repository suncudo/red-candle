// Share card image that X shows under a shared run.
// /api/og?score=1240&level=4&speed=normal&h=someone  → PNG for that run
// /api/og                                              → generic game card
import { ImageResponse } from '@vercel/og';
import { card } from './_card.js';

export const config = { runtime: 'edge' };

export default function handler(req) {
  return new ImageResponse(card(new URL(req.url).searchParams),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=86400, immutable' } });
}
