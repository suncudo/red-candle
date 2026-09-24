// Fill these in from Supabase → Project Settings → API to turn on
// "Sign in with X" and the leaderboard. Leave them empty and the game
// still works, just without the online features.
// The anon key is meant to be public: the database rules in
// supabase/schema.sql decide what it is allowed to do.
window.RED_CANDLE_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // 'twitter' is Supabase's classic X login; use 'x' if you enabled
  // the newer "X / Twitter (OAuth 2.0)" provider instead.
  authProvider: 'twitter',
};
