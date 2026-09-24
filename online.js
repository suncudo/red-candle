// Online features: share on X, sign in with X, leaderboard.
// Sharing always works; sign-in and the leaderboard need config.js filled in.
(() => {
  const $ = id => document.getElementById(id);
  const GAME_URL = location.origin + location.pathname;
  let last = null;

  // ---------- share (no backend needed) ----------
  function shareLink(r) {
    const text = `I made ${r.score} profit and reached level ${r.level} (${r.levelName}) in Red Candle 🕯️ Can you beat me?`;
    return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(GAME_URL);
  }
  window.addEventListener('redcandle:over', e => {
    last = e.detail;
    $('shareX').href = shareLink(last);
  });

  // ---------- sign in + leaderboard ----------
  const cfg = window.RED_CANDLE_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;
  document.querySelectorAll('[data-online]').forEach(el => { el.hidden = false; });

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const PENDING = 'redcandle-pending';
  let user = null;

  const meta = u => u?.user_metadata || {};
  const handleOf = u => meta(u).user_name || meta(u).preferred_username || meta(u).name || 'player';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderAuth() {
    const box = $('authBox');
    if (user) {
      const avatar = meta(user).avatar_url;
      box.innerHTML = (avatar ? `<img src="${esc(avatar)}" alt="">` : '') +
        `<b>@${esc(handleOf(user))}</b><button type="button" class="spd mini" id="signOut">Sign out</button>`;
      $('signOut').addEventListener('click', () => sb.auth.signOut());
    } else {
      box.innerHTML = '<button type="button" class="mini" id="signInTop">Sign in with X</button>';
      $('signInTop').addEventListener('click', signIn);
    }
    $('lbSignIn').hidden = !!user || !last || last.score <= 0;
  }

  function signIn() {
    // remember the finished run so it can be saved after X sends the player back
    if (last && last.score > 0) { try { localStorage.setItem(PENDING, JSON.stringify(last)); } catch (e) {} }
    sb.auth.signInWithOAuth({ provider: cfg.authProvider || 'twitter', options: { redirectTo: GAME_URL } });
  }
  $('lbSignIn').addEventListener('click', signIn);

  async function submit(r) {
    $('lbStatus').textContent = 'Saving your score…';
    const { error } = await sb.rpc('submit_score', { p_score: r.score, p_level: r.level, p_candles: r.candles, p_speed: r.speed });
    $('lbStatus').textContent = error ? 'Score not saved: ' + error.message : 'Saved to the leaderboard.';
    return !error;
  }

  window.addEventListener('redcandle:over', () => {
    if (last.score <= 0) $('lbStatus').textContent = 'Make a profit to get on the leaderboard.';
    else if (user) submit(last);
    else $('lbStatus').textContent = 'Sign in with X to put this score on the leaderboard.';
    renderAuth();
  });

  // ---------- leaderboard overlay ----------
  let boardSpeed = 'normal', returnTo = null;
  async function loadBoard(speed, note) {
    boardSpeed = speed;
    document.querySelectorAll('[data-board]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.board === speed)));
    $('boardList').innerHTML = '';
    $('boardNote').textContent = 'Loading…';
    const { data, error } = await sb.rpc('get_leaderboard', { p_speed: speed });
    if (speed !== boardSpeed) return;
    if (error) { $('boardNote').textContent = 'Could not load the leaderboard: ' + error.message; return; }
    $('boardNote').textContent = note || (data.length ? `Top ${data.length} · best run per player` : 'No scores yet. Be the first!');
    const me = user ? handleOf(user) : null;
    $('boardList').innerHTML = data.map((r, i) => `
      <li class="${r.handle === me ? 'me' : ''}">
        <span class="rank">${i + 1}</span>
        ${r.avatar_url ? `<img src="${esc(r.avatar_url)}" alt="">` : '<span></span>'}
        <span class="who">@${esc(r.handle)} <small>· lvl ${r.level}</small></span>
        <span class="pts">${r.score}</span>
      </li>`).join('');
  }
  function openBoard(note) {
    returnTo = ['intro', 'over'].find(id => !$(id).hidden) || null;
    if (returnTo) $(returnTo).hidden = true;
    $('board').hidden = false;
    let speed = 'normal';
    try { speed = localStorage.getItem('redcandle-speed') || 'normal'; } catch (e) {}
    loadBoard(last ? last.speed : speed, note);
    $('boardClose').focus();
  }
  $('boardBtn1').addEventListener('click', () => openBoard());
  $('boardBtn2').addEventListener('click', () => openBoard());
  $('boardClose').addEventListener('click', () => { $('board').hidden = true; if (returnTo) $(returnTo).hidden = false; });
  document.querySelectorAll('[data-board]').forEach(b => b.addEventListener('click', () => loadBoard(b.dataset.board)));

  // ---------- session ----------
  sb.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    renderAuth();
    if (!user) return;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING)); localStorage.removeItem(PENDING); } catch (e) {}
    if (!pending) return;
    last = pending;
    // Supabase advises not to await its own calls inside this callback
    setTimeout(async () => {
      const ok = await submit(pending);
      openBoard(ok ? 'Your score was saved!' : $('lbStatus').textContent);
    }, 0);
  });
})();
