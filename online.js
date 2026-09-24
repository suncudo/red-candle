// Online features: share on X, X handle, leaderboard.
// Sharing always works; the handle and leaderboard need config.js filled in.
(() => {
  const $ = id => document.getElementById(id);
  const GAME_URL = location.origin + location.pathname;
  const HANDLE_KEY = 'redcandle-handle';
  let last = null;
  let handle = '';
  try { handle = localStorage.getItem(HANDLE_KEY) || ''; } catch (e) {}

  // ---------- share (no backend needed) ----------
  // With shareBase set (the Vercel address), the link opens a page that gives
  // X a picture card of this run; otherwise it links straight to the game.
  const SHARE_BASE = ((window.RED_CANDLE_CONFIG || {}).shareBase || '').replace(/\/$/, '');
  function shareLink(r) {
    const text = `I made ${r.score} profit and reached level ${r.level} (${r.levelName}) in Red Candle 🕯️ Can you beat me?`;
    let url = GAME_URL;
    if (SHARE_BASE) {
      const q = new URLSearchParams({ score: r.score, level: r.level, speed: r.speed });
      if (handle) q.set('h', handle);
      url = `${SHARE_BASE}/s?${q}`;
    }
    return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
  }
  window.addEventListener('redcandle:over', e => {
    last = e.detail;
    $('shareX').href = shareLink(last);
  });

  // ---------- handle + leaderboard (Firebase) ----------
  const cfg = (window.RED_CANDLE_CONFIG || {}).firebase || {};
  if (!cfg.apiKey || !cfg.projectId || !window.firebase) return;
  document.querySelectorAll('[data-online]').forEach(el => { el.hidden = false; });

  firebase.initializeApp(cfg);
  const auth = firebase.auth(), db = firebase.firestore();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const board = speed => db.collection('boards').doc(speed).collection('scores');

  // Each browser gets a silent anonymous account. The first browser to save a
  // handle owns it, so nobody else can post scores under that name.
  let ready = null;
  const signedIn = () => ready || (ready = auth.currentUser ? Promise.resolve(auth.currentUser)
    : new Promise((resolve, reject) => {
        const off = auth.onAuthStateChanged(u => { if (u) { off(); resolve(u); } });
        auth.signInAnonymously().catch(err => { ready = null; off(); reject(err); });
      }));

  function showHandle() {
    $('handleShow').textContent = handle ? '@' + handle : '—';
    $('handleInput').value = handle ? '@' + handle : '';
  }
  showHandle();

  $('handleForm').addEventListener('submit', async e => {
    e.preventDefault();
    const h = $('handleInput').value.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) {
      $('handleNote').textContent = 'Use your X handle: letters, digits and _ only, up to 15 characters.';
      return;
    }
    $('handleNote').textContent = 'Saving…';
    try {
      const u = await signedIn();
      const ref = db.collection('handles').doc(h.toLowerCase());
      const snap = await ref.get();
      if (snap.exists && snap.data().uid !== u.uid) {
        $('handleNote').textContent = `@${h} is already taken on this leaderboard. Pick another one.`;
        return;
      }
      if (!snap.exists) await ref.set({ uid: u.uid, handle: h });
      handle = snap.exists ? snap.data().handle : h;
      try { localStorage.setItem(HANDLE_KEY, handle); } catch (e) {}
      showHandle();
      $('handleNote').textContent = `Saved. Your best runs will show up as @${handle}.`;
    } catch (err) {
      $('handleNote').textContent = 'Could not save the handle: ' + err.message;
    }
  });

  // keeps each handle's best run per speed; firestore.rules only accepts a better score
  async function submit(r) {
    $('lbStatus').textContent = 'Saving your score…';
    try {
      await signedIn();
      const ref = board(r.speed).doc(handle.toLowerCase());
      const snap = await ref.get();
      if (snap.exists && snap.data().score >= r.score) {
        $('lbStatus').textContent = `Your best on ${r.speed} is still ${snap.data().score}.`;
        return;
      }
      await ref.set({
        handle, score: r.score, level: r.level, candles: r.candles,
        at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      $('lbStatus').textContent = `New best saved as @${handle}!`;
    } catch (err) {
      $('lbStatus').textContent = err.code === 'permission-denied'
        ? 'Score not saved: it was rejected (less than 15s since your last save, or the numbers don’t add up).'
        : 'Score not saved: ' + err.message;
    }
  }

  window.addEventListener('redcandle:over', () => {
    if (last.score <= 0) $('lbStatus').textContent = 'Make a profit to get on the leaderboard.';
    else if (handle) submit(last);
    else $('lbStatus').textContent = 'Add your X handle in the Menu to get on the leaderboard.';
  });

  // ---------- leaderboard overlay ----------
  let boardSpeed = 'normal', returnTo = null;
  async function loadBoard(speed) {
    boardSpeed = speed;
    document.querySelectorAll('[data-board]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.board === speed)));
    $('boardList').innerHTML = '';
    $('boardNote').textContent = 'Loading…';
    let docs;
    try { docs = (await board(speed).orderBy('score', 'desc').limit(20).get()).docs; }
    catch (err) { $('boardNote').textContent = 'Could not load the leaderboard: ' + err.message; return; }
    if (speed !== boardSpeed) return;
    $('boardNote').textContent = docs.length ? `Top ${docs.length} · best run per player` : 'No scores yet. Be the first!';
    $('boardList').innerHTML = docs.map((d, i) => {
      const r = d.data(), h = esc(r.handle);
      return `
      <li class="${handle && d.id === handle.toLowerCase() ? 'me' : ''}">
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
