# Red Candle 🕯️

A trading reflex game. While candles are green, chill. When a red one appears, hit **Space** (or tap) to sell before it closes, or your chair kicks you in the butt.

**Play:** https://red-candle-lime.vercel.app/ (mirror: https://suncudo.github.io/red-candle/)

- 5 market phases (Sideways → Bull Run → Correction → Pump & Dump → Flash Crash), then endless "Degen Hour"
- Heavy reds need 3 taps, long reds need mashing, green candles can dump into red mid-way
- Every wrong press costs points and resets your streak
- Chill / Normal / Degen speeds, each with its own record
- Day and night cycle outside the window
- Verify your X handle, climb a server-checked leaderboard, share your run on X
- Handmade chiptune soundtrack that speeds up with the market

The game is a static page plus a few small server functions on Vercel, no build step.

## Files

| File | What it is |
|---|---|
|  | The page: drawing, sound, input |
|  | The game rules, deterministic, shared by the page and the server |
|  | Share on X, handle verification, leaderboard |
|  | Address of the game's server (empty = offline, no leaderboard) |
|  | Signed run ticket (the seed that decides the candles) |
|  | Replays a run and stores the score it computes |
|  | Top 20 per speed |
|  | Proves an X handle belongs to the player |
| ,  | Picture card for runs shared on X |
|  | Browsers get no database access at all |

## How the leaderboard stays honest

- **Scores are computed by the server.** The page records only the run ticket and when Space was pressed. The server replays the run with the same  and stores whatever that produces, so a typed-in score is impossible. Each ticket counts once, a run can't be longer than the time since its ticket was issued, and reactions faster than a human (under 0.1s) are rejected.
- **Handles are proven, not claimed.** The player posts a short code from their X account and pastes the link. The server reads the post through X's free public embed endpoint (no API key, no cost) and checks the author and the code. The code comes from a secret only the player's browser holds, so copying someone's post doesn't help.
- **Only the server touches the database** (Firebase Admin SDK, key in the  env var on Vercel).
- What it can't stop: a bot that actually plays the game well. That's true of every browser game with a leaderboard.

## Setup

1. Firebase project with Firestore; deploy the rules: [1m[37m===[39m Deploying to 'red-candle-game'...[22m

[36m[1mi [22m[39m deploying [1mfirestore[22m
[36m[1mi  firestore:[22m[39m ensuring required API [1mfirestore.googleapis.com[22m is enabled...
[36m[1mi  firestore:[22m[39m ensuring required API [1mfirestore.googleapis.com[22m is enabled...
[36m[1mi  cloud.firestore:[22m[39m checking [1mfirestore.rules[22m for compilation errors...
[32m[1m+  cloud.firestore:[22m[39m rules file [1mfirestore.rules[22m compiled successfully
[36m[1mi  firestore:[22m[39m latest version of [1mfirestore.rules[22m already up to date, skipping upload...
[36m[1mi [22m[39m [1m[36mfirestore: [39m[22mdeploying indexes...
[32m[1m+  firestore:[22m[39m released rules [1mfirestore.rules[22m to [1mcloud.firestore[22m

[32m[1m+ [22m[39m [1m[4mDeploy complete![24m[22m

[1mProject Console:[22m https://console.firebase.google.com/project/red-candle-game/overview.
2. Firebase → Project settings → Service accounts → Generate new private key; put the whole JSON into the  env var on Vercel and redeploy.
3. Put the Vercel address into  and the allowed origins list in .
