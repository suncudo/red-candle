// Online features: share on X, verified X handle, server-checked leaderboard.
// Everything goes through the game's server (config.js → server); the browser never
// writes scores itself. The server replays each run and computes the score.
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.RED_CANDLE_CONFIG || {};
  const SERVER = (cfg.server || '').replace(/\/$/, '');
  const GAME_URL = SERVER ? SERVER + '/' : location.origin + location.pathname;
  const PLAYER_KEY = 'redcandle-player';   // { handle, token } once verified
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const intent = text => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);

  let player = null;
  try { player = JSON.parse(localStorage.getItem(PLAYER_KEY)); } catch (e) {}
  let last = null;

  // ---------- share (works without the server) ----------
  function shareLink(r) {
    const text = `I made ${r.score} profit and reached level ${r.level} (${r.levelName}) in Red Candle 🕯️ Can you beat me?`;
    let url = GAME_URL;
    if (SERVER) {
      const q = new URLSearchParams({ score: r.score, level: r.level, speed: r.speed });
      if (player) q.set('h', player.handle);
      url = `${SERVER}/s?${q}`;
    }
    return intent(text) + '&url=' + encodeURIComponent(url);
  }
  window.addEventListener('redcandle:over', e => {
    last = e.detail;
    $('shareX').href = shareLink(last);
  });

  if (!SERVER) return;
  document.querySelectorAll('[data-online]').forEach(el => { el.hidden = false; });

  async function api(path, options) {
    const res = await fetch(SERVER + path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server error');
    return data;
  }
  const post = (path, data) => api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

  // ---------- run tickets: a server-issued seed, fetched ahead so starting is instant ----------
  let ticket = null;
  function fetchTicket() { api('/api/start').then(t => { ticket = t; }).catch(() => { ticket = null; }); }
  fetchTicket();
  window.RedCandleOnline = {
    takeTicket() { const t = ticket; ticket = null; fetchTicket(); return t; },
  };

  // ---------- verified handle ----------
  function showPlayer() {
    $('handleShow').textContent = player ? '@' + player.handle + ' ✓' : '—';
    $('verifyStart').hidden = !!player;
    $('verifyDone').hidden = !player;
    $('verifySteps').hidden = true;
    if (player) $('verifiedAs').textContent = '@' + player.handle;
  }
  showPlayer();

  // a saved token stops working if the handle was verified again elsewhere
  if (player) {
    api(`/api/claim?handle=${encodeURIComponent(player.handle)}&token=${encodeURIComponent(player.token)}`)
      .then(r => { if (r.valid === false) { player = null; try { localStorage.removeItem(PLAYER_KEY); } catch (e) {} showPlayer(); } })
      .catch(() => {});
  }

  // the server only looks for the code, so the rest of the post can be a joke
  const VERIFY_POSTS = [
    code => `A red candle just went straight up my... portfolio 🕯️🍑\nVerified trader: ${code}`,
    code => `Got liquidated by a red candle. Literally. In the butt. 🕯️🍑\nTrader ID: ${code}`,
    code => `My chair has a stop-loss and it's aimed at my butt 🪑🍑🕯️\n${code}`,
    code => `Didn't sell the red candle. The red candle sold me. 🕯️🍑\nVerifying: ${code}`,
    code => `Buy the dip, they said. The dip hit back. 🍑🕯️\nMy trader code: ${code}`,
  ];
  const verifyText = code => VERIFY_POSTS[Math.floor(Math.random() * VERIFY_POSTS.length)](code) + `\n${GAME_URL}`;

  let pending = null;   // { handle, nonce, code } while verifying
  $('verifyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const handle = $('handleInput').value.trim().replace(/^@/, '');
    $('handleNote').textContent = 'Getting your code…';
    try {
      const r = await post('/api/claim', { step: 'code', handle });
      pending = { handle, nonce: r.nonce, code: r.code };
      $('verifyCode').textContent = r.code;
      $('verifyPost').href = intent(verifyText(r.code));
      $('verifySteps').hidden = false;
      $('verifyStart').hidden = true;
      $('handleNote').textContent = '';
      $('tweetNote').textContent = '';
    } catch (err) { $('handleNote').textContent = err.message; }
  });

  $('confirmForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!pending) return;
    $('tweetNote').textContent = 'Checking your post…';
    try {
      const r = await post('/api/claim', { step: 'verify', handle: pending.handle, nonce: pending.nonce, tweetUrl: $('tweetInput').value });
      player = { handle: r.handle, token: r.token };
      try { localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); } catch (e) {}
      pending = null;
      showPlayer();
    } catch (err) { $('tweetNote').textContent = err.message; }
  });

  $('verifyCancel').addEventListener('click', () => { pending = null; showPlayer(); });
  $('verifyForget').addEventListener('click', () => {
    player = null;
    try { localStorage.removeItem(PLAYER_KEY); } catch (e) {}
    showPlayer();
  });

  // ---------- submitting a run ----------
  window.addEventListener('redcandle:over', async () => {
    const status = $('lbStatus');
    if (!last.run) { status.textContent = "This run isn't ranked: the game couldn't reach the server when it started."; return; }
    if (!player) { status.textContent = 'Verify your X handle in the Menu to get on the leaderboard.'; return; }
    if (last.score <= 0) { status.textContent = 'Make a profit to get on the leaderboard.'; return; }
    status.textContent = 'Checking your run…';
    // presses travel as gaps between ticks, which keeps the request small
    let prev = 0;
    const gaps = last.run.presses.map(t => { const d = t - prev; prev = t; return d; });
    try {
      const r = await post('/api/submit', { handle: player.handle, token: player.token, ticket: last.run.ticket, speed: last.run.speed, presses: gaps, endTick: last.run.endTick });
      status.textContent = r.best ? `Verified and saved: ${r.score} as @${player.handle}. New best!` : `Verified: ${r.score}. Your best on ${last.run.speed} is still ${r.bestScore}.`;
    } catch (err) { status.textContent = 'Score not saved: ' + err.message; }
  });

  // ---------- leaderboard overlay ----------
  let boardSpeed = 'normal', returnTo = null;
  async function loadBoard(speed) {
    boardSpeed = speed;
    document.querySelectorAll('[data-board]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.board === speed)));
    $('boardList').innerHTML = '';
    $('boardNote').textContent = 'Loading…';
    let rows;
    try { rows = (await api('/api/board?speed=' + speed)).rows; }
    catch (err) { $('boardNote').textContent = 'Could not load the leaderboard: ' + err.message; return; }
    if (speed !== boardSpeed) return;
    $('boardNote').textContent = rows.length ? `Top ${rows.length} · verified players · best run each` : 'No scores yet. Be the first!';
    const me = player ? player.handle.toLowerCase() : null;
    $('boardList').innerHTML = rows.map((r, i) => {
      const h = esc(r.handle);
      return `
      <li class="${r.id === me ? 'me' : ''}">
        <span class="rank">${i + 1}</span>
        <span class="who"><a href="https://x.com/${h}" target="_blank" rel="noopener">@${h}</a> <small>· lvl ${r.level}</small></span>
        <span class="pts">${r.score}</span>
      </li>`;
    }).join('');
  }
  function openBoard() {
    returnTo = ['intro', 'over'].find(id => !$(id).hidden) || null;
    if (returnTo) $(returnTo).hidden = true;
    $('board').hidden = false;
    let speed = 'normal';
    try { speed = localStorage.getItem('redcandle-speed') || 'normal'; } catch (e) {}
    loadBoard(last ? last.speed : speed);
    $('boardClose').focus();
  }
  $('boardBtn1').addEventListener('click', openBoard);
  $('boardBtn2').addEventListener('click', openBoard);
  $('boardClose').addEventListener('click', () => { $('board').hidden = true; if (returnTo) $(returnTo).hidden = false; });
  document.querySelectorAll('[data-board]').forEach(b => b.addEventListener('click', () => loadBoard(b.dataset.board)));
})();
