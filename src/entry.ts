// Public broadcast pages never boot the game, wallet discovery or saved runs.
if (/^\/overlay\/setup\/?$/.test(window.location.pathname)) {
  void import('./overlay-setup').then(page => page.mountOverlaySetup());
} else if (/^\/overlay\/?$/.test(window.location.pathname)) {
  void import('./overlay').then(page => page.mountOverlay());
} else if (/^\/leaderboard\/?$/.test(window.location.pathname)) {
  void import('./leaderboard-page').then(page => page.mountLeaderboard());
} else {
  void import('./main');
}
