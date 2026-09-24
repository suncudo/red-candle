// Paste your Firebase web app config here (Firebase console → Project settings →
// Your apps → Web app → "SDK setup and configuration" → Config) to turn on
// "Sign in with X" and the leaderboard. Leave it empty and the game still
// works, just without the online features.
// These values are meant to be public: firestore.rules decides what they can do.
window.RED_CANDLE_CONFIG = {
  // Vercel address of this game (e.g. 'https://red-candle.vercel.app'). When set,
  // "Share on X" posts a picture card of the run; empty = plain link to the game.
  shareBase: 'https://red-candle-lime.vercel.app',
  firebase: {
    apiKey: 'AIzaSyCFSjW_k1DEAc407zovE1_pCEmpbAPZ-ow',
    authDomain: 'red-candle-game.firebaseapp.com',
    projectId: 'red-candle-game',
    appId: '1:80739106766:web:fd62addcea5ca2e809b59f',
  },
};
