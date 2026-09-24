// Share card image that X shows under a shared run.
// /api/og?score=1240&level=4&speed=normal&h=someone  → PNG for that run
// /api/og                                              → generic game card
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { card } from './_card.js';

// Geist, SIL Open Font License (see _fonts/OFL.txt)
const font = readFile(new URL('./_fonts/Geist-Regular.ttf', import.meta.url));

export async function GET(request) {
  const svg = await satori(card(new URL(request.url).searchParams), {
    width: 1200, height: 630,
    fonts: [{ name: 'Geist', data: await font, weight: 400, style: 'normal' }],
  });
  const png = new Resvg(svg).render().asPng();
  return new Response(png, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, immutable' },
  });
}
