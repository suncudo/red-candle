// TEMP DEBUG: report which step fails on Vercel
import { card } from './_card.js';

export async function GET(request) {
  let step = 'start';
  try {
    step = 'import fs'; const { readFile } = await import('node:fs/promises');
    step = 'read font'; const font = await readFile(new URL('./_fonts/Geist-Regular.ttf', import.meta.url));
    step = 'import satori'; const satori = (await import('satori')).default;
    step = 'import resvg'; const { Resvg } = await import('@resvg/resvg-js');
    step = 'layout'; const svg = await satori(card(new URL(request.url).searchParams), { width: 1200, height: 630, fonts: [{ name: 'Geist', data: font, weight: 400, style: 'normal' }] });
    step = 'render'; const png = new Resvg(svg).render().asPng();
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  } catch (err) {
    return new Response(`failed at: ${step}\n${err && err.message}`, { status: 500 });
  }
}
