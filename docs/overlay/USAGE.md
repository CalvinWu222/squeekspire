# Squeekspire stream overlay

Open `/overlay/setup` on the running app to configure a live preview, copy its
same-origin URL, and see the OBS source dimensions. The leaderboard footer links
to this page. These routes have dedicated Vercel rewrites and boot independently
of the game, audio, saved runs and wallets.

In OBS, add **Sources > + > Browser**, leave **Local file** off, paste the URL,
and use the dimensions shown by setup. No custom CSS is required. At scale 1,
use **1200 x 260** for the bar or **440 x 800** for the card. The extra space is
transparent; it leaves room for fallback notices and five leaderboard rows.

| Parameter | Values | Default |
| --- | --- | --- |
| `layout` | `bar` (top 3), `card` (top 5) | `bar` |
| `scale` | Number, clamped to 0.5 through 2; scale the OBS dimensions too | `1` |
| `show` | Comma-separated `status,boss,board`; at least one valid section | All three |
| `bg` | `transparent`, `dark` | `transparent` |

Examples:

- `/overlay?layout=bar&scale=1&show=status,boss,board&bg=transparent`
- `/overlay?layout=card&scale=1&show=status,boss,board&bg=transparent`
- `/overlay?layout=card&scale=1.5&show=status,boss&bg=dark`

Status and rankings refresh independently every 15 seconds, with request timeouts
and no overlapping request per feed. The UTC date is checked at each refresh;
yesterday's rankings disappear while the next board loads. Daily rules use the
same validated dated/latest/bundled snapshot chain as the game. Fallback maps are
labeled and retried every minute. A board with a different seed is withheld until
it matches the displayed map.

Live status reads `https://api.squeekchain.com/v1/status`. Only an accepted, online,
known hamster state is displayed as SPINNING or IDLE. Measurements beyond their
declared age limit show SIGNAL LOST. Optional `rpmMilli` and `distanceMm` are
converted to RPM and metres; missing metrics show a dash. Ranking errors retain
and label the last loaded board for the current UTC day. The empty local
development board has no invented players.

## Screenshots and browser checks

Run the dev server, then use portable Node with the normal workspace NODE_OPTIONS:

```powershell
$env:SQUEEKSPIRE_URL = 'http://127.0.0.1:5175/'
node scripts/verify-overlay.mjs
```

The script only accepts loopback HTTP URLs. `bar-real.png` and `card-real.png`
capture real endpoint results over a checkerboard game scene. `bar-sample.png`
and `card-sample.png` use clearly labeled browser-only fixtures to show populated
rankings and spinning telemetry. No scores are submitted or stored.
`source-transparent.png` captures the source with alpha. Setup is captured at
desktop and mobile sizes. `verification.json` records assertions and disclosure.
