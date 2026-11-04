// Keep the public board independent of game boot, wallet discovery and saved runs.
if (/^\/leaderboard\/?$/.test(window.location.pathname)) {
  void import('./leaderboard-page').then(page => page.mountLeaderboard());
} else {
  void import('./main');
}
