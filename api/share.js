// Share landing page: /s?score=1240&level=4&speed=normal&h=someone
// X reads the meta tags (and shows the card from /api/og); people are sent on to the game.
import { readRun, runQuery } from './_run.js';

export const config = { runtime: 'edge' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function handler(req) {
  const url = new URL(req.url);
  const run = readRun(url.searchParams);
  const speedKey = ['chill', 'normal', 'degen'].includes(url.searchParams.get('speed')) ? url.searchParams.get('speed') : 'normal';
  const image = `${url.origin}/api/og?${runQuery(run, speedKey)}`;
  const who = run.handle ? `@${run.handle}` : 'A trader';
  const title = `${who} made ${run.score.toLocaleString('en-US')} profit in Red Candle`;
  const desc = `Reached level ${run.level} (${run.levelName}) on ${run.speed} speed. Can you beat it?`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=/">
</head><body style="background:#0b0d15;color:#e9e5d8;font-family:monospace">
<p><a href="/" style="color:#ffb347">Play Red Candle</a></p>
</body></html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
