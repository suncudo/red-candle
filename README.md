# Red Candle 🕯️

A trading reflex game. While candles are green, chill. When a red one appears, hit **Space** (or tap) to sell before it closes, or your chair kicks you in the butt.

**Play:** https://red-candle-lime.vercel.app/ (mirror: https://suncudo.github.io/red-candle/)

- 5 market phases (Sideways → Bull Run → Correction → Pump & Dump → Flash Crash), then endless "Degen Hour"
- Heavy reds need 3 taps, long reds need mashing, green candles can dump into red mid-way
- Every wrong press costs points and resets your streak
- Chill / Normal / Degen speeds, each with its own record
- Day and night cycle outside the window
- Add your X handle to climb the leaderboard, then share your run on X

It's one static page (`index.html`) with no build step. Open it in a browser and play.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game |
| `online.js` | Share on X, X handle, leaderboard |
| `config.js` | Firebase web config (empty = the game runs without the leaderboard) |
| `firestore.rules` | Who may read and write the leaderboard |
| `firebase.json`, `.firebaserc` | Lets `firebase deploy --only firestore:rules` find the rules and project |

## How the leaderboard works

Runs on Firebase's free Spark plan (no card needed). No X API is used: X's API is pay-per-use, so sign-in with X would cost money per player.

- Each browser signs in to Firebase anonymously, in the background.
- A player types their X handle. The first browser to save a handle owns it; nobody else can post scores under it.
- Each handle keeps its best run per speed. It can only be replaced by a higher score, at most once every 15 seconds.
- **Share on X** just opens a pre-filled post, so it needs no API either.

## Setting it up in your own Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Build → **Authentication** → Get started → Sign-in method → **Anonymous** → Enable.
3. Build → **Firestore Database** → Create database, then deploy the rules: `firebase deploy --only firestore:rules` (or paste `firestore.rules` into the Rules tab).
4. Project settings → Your apps → add a **Web app**, and copy `apiKey`, `authDomain`, `projectId`, `appId` into `config.js`.

The web config is meant to be public. `firestore.rules` decides what it can do.

**About cheating:** the game runs in the player's browser, so a determined player could send a fake score, or grab someone's handle before they do. The rules reject impossible numbers and lock each handle to one browser, but they can't fully prevent cheating.
