# Red Candle 🕯️

A trading reflex game. While candles are green, chill. When a red one appears, hit **Space** (or tap) to sell before it closes, or your chair kicks you in the butt.

**Play:** https://suncudo.github.io/red-candle/

- 5 market phases (Sideways → Bull Run → Correction → Pump & Dump → Flash Crash), then endless "Degen Hour"
- Heavy reds need 3 taps, long reds need mashing, green candles can dump into red mid-way
- Every wrong press costs points and resets your streak
- Chill / Normal / Degen speeds, each with its own record
- Day and night cycle outside the window
- Share your run on X, sign in with X and climb the leaderboard

It's one static page (`index.html`) with no build step. Open it in a browser and play.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game |
| `online.js` | Share on X, sign in with X, leaderboard |
| `config.js` | Firebase web config (empty = the game runs without sign-in and leaderboard) |
| `firestore.rules` | Who may read and write the leaderboard |

## Turning on sign-in and the leaderboard

Uses Firebase's free Spark plan (no card needed).

1. **Firebase project:** at [console.firebase.google.com](https://console.firebase.google.com) create a project (Google Analytics not needed).
2. **Database:** Build → **Firestore Database** → Create database (production mode). Open the **Rules** tab, paste `firestore.rules`, click **Publish**.
3. **X app:** in the [X Developer Portal](https://developer.x.com), create an app and open **User authentication settings**:
   - App permissions: *Read*, type: *Web App*
   - Callback URL: `https://<your-project-id>.firebaseapp.com/__/auth/handler`
   - Website URL: `https://suncudo.github.io/red-candle/`
   - Copy the **API Key** and **API Key Secret** (Keys and tokens tab).
4. **Sign-in:** Firebase → Build → **Authentication** → Get started → Sign-in method → **Twitter**: enable, paste the key and secret, save.
   Then Authentication → Settings → **Authorized domains** → add `suncudo.github.io`.
5. **Game config:** Project settings → Your apps → add a **Web app** (no hosting), copy `apiKey`, `authDomain`, `projectId`, `appId` into `config.js`, commit and push.

The web config is meant to be public. `firestore.rules` only lets anyone read the leaderboard and lets signed-in players save their own best run under their real X name.

**About cheating:** the game runs in the player's browser, so a determined player could send a fake score. The rules reject impossible numbers, tie every score to a real X account and limit how often a player can update, but they can't fully prevent cheating.
