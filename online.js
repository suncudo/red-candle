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

  // ---------- sign in + leaderboard (Firebase) ----------
  const cfg = (window.RED_CANDLE_CONFIG || {}).firebase || {};
  if (!cfg.apiKey || !cfg.projectId || !window.firebase) return;
  document.querySelectorAll('[data-online]').forEach(el => { el.hidden = false; });

  firebase.initializeApp(cfg);
  const auth = firebase.auth(), db = firebase.firestore();
  const PENDING = 'redcandle-pending';
  let user = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // the player's X account id, used to link their name to their X profile
  const xidOf = u => (u.providerData.find(p => p.providerId === 'twitter.com') || {}).uid || null;
  const board = speed => db.collection('boards').doc(speed).collection('scores');

  function renderAuth() {
    const box = $('authBox');
    if (user) {
      box.innerHTML = (user.photoURL ? `<img src="${esc(user.photoURL)}" alt="">` : '') +
        `<b>${esc(user.displayName || 'player')}</b><button type="button" class="spd mini" id="signOut">Sign out</button>`;
      $('signOut').addEventListener('click', () => auth.signOut());
    } else {
      box.innerHTML = '<button type="button" class="mini" id="signInTop">Sign in with X</button>';
      $('signInTop').addEventListener('click', signIn);
    }
    $('lbSignIn').hidden = !!user || !last || last.score <= 0;
  }

  function signIn() {
    // remember the finished run so it can be saved once sign-in completes
    if (last && last.score > 0) { try { localStorage.setItem(PENDING, JSON.stringify(last)); } catch (e) {} }
    const provider = new firebase.auth.TwitterAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(provider);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') $('lbStatus').textContent = 'Sign-in failed: ' + err.message;
    });
  }
  $('lbSignIn').addEventListener('click', signIn);
  auth.getRedirectResult().catch(err => { $('lbStatus').textContent = 'Sign-in failed: ' + err.message; });

  // keeps each player's best run per speed; firestore.rules only accepts a better score
  async function submit(r) {
    $('lbStatus').textContent = 'Saving your score…';
    try {
      const ref = board(r.speed).doc(user.uid);
      const snap = await ref.get();
      if (snap.exists && snap.data().score >= r.score) {
        $('lbStatus').textContent = `Your best on ${r.speed} is still ${snap.data().score}.`;
        return true;
      }
      await ref.set({
        name: user.displayName || 'player', photo: user.photoURL || null, xid: xidOf(user),
        score: r.score, level: r.level, candles: r.candles,
        at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      $('lbStatus').textContent = 'New best saved to the leaderboard!';
      return true;
    } catch (err) {
      $('lbStatus').textContent = err.code === 'permission-denied'
        ? 'Score not saved: it was rejected (too soon after your last one, or not valid).'
        : 'Score not saved: ' + err.message;
      return false;
    }
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
    let docs;
    try { docs = (await board(speed).orderBy('score', 'desc').limit(20).get()).docs; }
    catch (err) { $('boardNote').textContent = 'Could not load the leaderboard: ' + err.message; return; }
    if (speed !== boardSpeed) return;
    $('boardNote').textContent = note || (docs.length ? `Top ${docs.length} · best run per player` : 'No scores yet. Be the first!');
    $('boardList').innerHTML = docs.map((d, i) => {
      const r = d.data(), name = esc(r.name);
      const who = r.xid ? `<a href="https://x.com/i/user/${esc(r.xid)}" target="_blank" rel="noopener">${name}</a>` : name;
      return `
      <li class="${user && d.id === user.uid ? 'me' : ''}">
        <span class="rank">${i + 1}</span>
        ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : '<span></span>'}
        <span class="who">${who} <small>· lvl ${r.level}</small></span>
        <span class="pts">${r.score}</span>
      </li>`;
    }).join('');
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
  auth.onAuthStateChanged(async u => {
    user = u;
    renderAuth();
    if (!user) return;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING)); localStorage.removeItem(PENDING); } catch (e) {}
    if (!pending) return;
    last = pending;
    const ok = await submit(pending);
    openBoard(ok ? $('lbStatus').textContent : null);
  });
})();
