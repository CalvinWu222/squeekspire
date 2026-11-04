# Leaderboard and BGM browser acceptance

Local server: <http://127.0.0.1:5174/leaderboard>.

`desktop.png` (1440×1000 viewport) and `mobile.png` (390×844 viewport) show real API results from seven legal, replay-verified sample runs in the isolated `.tmp/leaderboard-bgm.json` development store. Their visible LOCAL QA banner identifies the fixture data. No production, Redis, or existing local leaderboard data was changed. All screenshots cover the full page.

`empty.png` uses a clearly labeled, browser-only empty API response so the empty state can be reproduced after local samples exist. `error.png` shows a labeled simulated network failure and the retained last loaded board. The browser then successfully refreshes the real API again.

`report.json` records the samples and passing browser checks: real overview API, route reload and menu link, 1440/390/320px layouts, three crowned hamster portraits, shortened Sepolia identity, deck themes, no audio before interaction, quiet native WebAudio playback, persisted mute/unmute, combat track switching, desktop/mobile settings and End Turn accessibility, API error handling and recovery. Public external requests are blocked during this local acceptance run.

To reproduce against an already-running isolated local dev server in PowerShell:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
$env:SQUEEKSPIRE_URL='http://127.0.0.1:5174/'
$env:SQUEEKSPIRE_SCORE_FILE='.tmp/leaderboard-bgm.json'
$env:SQUEEKSPIRE_QA_SEED='1'
& ..\tools\node-v22.11.0-win-x64\node.exe scripts/verify-leaderboard-bgm.mjs
```

The server must also use `SQUEEKSPIRE_SCORE_FILE=.tmp/leaderboard-bgm.json`. The script only accepts loopback HTTP URLs, requires local storage before submitting samples, and reuses existing sample runs on subsequent runs. Omit `SQUEEKSPIRE_QA_SEED` for read-only checking and screenshots without sample submissions.
