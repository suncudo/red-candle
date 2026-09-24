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
| `config.js` | Supabase keys (empty = the game runs without sign-in and leaderboard) |
| `supabase/schema.sql` | Leaderboard table and the functions the game calls |

## Turning on sign-in and the leaderboard

1. **Supabase:** create a free project at [supabase.com](https://supabase.com). In **SQL Editor**, run `supabase/schema.sql`.
2. **X app:** in the [X Developer Portal](https://developer.x.com), create an app and open **User authentication settings**:
   - App type: *Web App*
   - Callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
   - Website URL: `https://suncudo.github.io/red-candle/`
   - Copy the **API Key** and **API Key Secret** (Keys and tokens tab).
3. **Connect them:** in Supabase → **Authentication → Providers → Twitter**, enable it and paste the key and secret.
   In **Authentication → URL Configuration**, set Site URL and add a Redirect URL: `https://suncudo.github.io/red-candle/`
4. **Game config:** put the Project URL and `anon` public key (Supabase → Project Settings → API) into `config.js`, commit and push.

The `anon` key is meant to be public. The database rules in `schema.sql` only allow reading the leaderboard and saving your own score through `submit_score`.

**About cheating:** the game runs in the player's browser, so a determined player could send a fake score. The server rejects impossible numbers, ties every score to a real X account and rate-limits submissions, but it can't fully prevent cheating.
