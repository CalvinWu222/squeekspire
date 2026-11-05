# Squeekspire stream overlay

Open `/overlay/setup` on the running app to configure a live preview, copy its
same-origin URL, and see the OBS source dimensions. The leaderboard footer links
to this page. These routes have dedicated Vercel rewrites and boot independently
of the game, audio, saved runs and wallets.

In OBS, add **Sources > + > Browser**, leave **Local file** off, paste the URL,
and use the dimensions shown by setup. Set the source frame rate to **30 FPS**.
Transparency works with the default OBS custom CSS; no extra CSS is required.

Setup defaults to a **full-canvas source** so anchors and safe areas are useful.
Match the browser source width and height to your scene: **1920 x 1080**,
**1280 x 720**, **2560 x 1440**, or **1080 x 1920** for a vertical scene. Use
**Transform > Reset Transform**, then **Fit to Screen**. Keep the aspect ratio;
**Stretch to Screen** or Shift-dragging the source in OBS will distort it.
The panel fits uniformly when the browser viewport is smaller or a different
shape. It never stretches within the page or grows beyond the requested scale.

Choose **Tight source** in setup if you prefer to position the panel with OBS.
The preview and recommended dimensions then match the selected layout, panels,
detail level and scale. With every panel enabled at scale 1:

| Detail level | Bar source | Card source |
| --- | --- | --- |
| Full | 1200 x 284 | 440 x 716 |
| Compact | 1012 x 220 | 388 x 520 |
| Minimal | 832 x 174 | 352 x 350 |

These sizes include a transparent shadow gutter. Multiply them by the scale and
round up, or copy the exact size from setup. Fewer panels need less space. Fixed
panel slots keep loading and fallback messages from moving the source edges.

| Parameter | Values | Default |
| --- | --- | --- |
| `layout` | `bar` (top 3), `card` (top 5) | `bar` |
| `scale` | Number, clamped to 0.5 through 2; maximum intended panel size | `1` |
| `show` | Comma-separated `status,boss,board`; at least one valid section | All three |
| `bg` | `transparent`, `dark` | `transparent` |
| `pos` | `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right` | `top-left` |
| `opacity` | Panel fill only, clamped to 0.25 through 1; text stays solid | `1` |
| `density` | `full`, `compact`, `min` | `full` |
| `safe` | `none`, `moba`, `fps`; see reserved HUD areas below | `none` |
| `motion` | `low`, `normal`; `low-motion=1` also selects low | `normal` in source; setup selects `low` |

Examples:

- `/overlay?layout=bar&scale=1&density=compact&pos=top&safe=moba&opacity=1&motion=low`
- `/overlay?layout=card&scale=1&density=compact&pos=right&safe=fps&opacity=1&motion=low`
- `/overlay?layout=card&scale=1.5&show=status,boss&bg=transparent&pos=top-left&motion=low`

## Placement and readable text

For a MOBA-style HUD, leave the **bottom-right minimap** and **bottom-center
abilities and health** clear. A compact bar near the top, or a minimal card in an
unused side area, is a useful starting point. Top-left can conflict with a webcam;
top-center can conflict with the scoreboard. At 720p, even a top-left compact card
inside the MOBA safe area can extend into a bottom-left webcam. Full cards need
still more room. Inspect the actual game and webcam layout before going live.
In a portrait scene with gameplay in the middle, a compact card above the game
can work well; inspect the final scene rather than shrinking a wide bar.

Safe presets apply to browser viewports at least **1000 x 600**:

| Preset | Reserved area |
| --- | --- |
| `moba` | Left 3%, right 22%, top 12%, bottom 24% |
| `fps` | Left 3%, right 3%, top 12%, bottom 20% |

Anchors place the panel within the remaining rectangle. These are guides for
common HUDs; they cannot detect your game or webcam. Use **None** for tight
sources. A smaller safe rectangle can reduce the panel below the requested scale.

At **720p**, scale **0.5** makes dense text difficult to read. Start at scale **1
or higher** with a **Compact bar** or **Minimal card**, or hide panels. Larger
labels help, but Full detail can still become too small after safe-area fitting
or downscaling. In the tested 1080p-to-720p MOBA-safe bar at scale 1.5, the smallest
main text was about **10.4 px** in Full, **12.3 px** in Compact and **13 px** in
Minimal. The requested scale is an upper bound; fitting can reduce it.

Some secondary labels start at 10 px at scale 1, about 6.7 px after a
1080p-to-720p downscale. For that output, start Compact/Minimal at scale 1.5 and
inspect the result; safe-area fitting may cap the effective scale. A direct 720p
scene at scale 1 or higher avoids that extra OBS downscale.

Inspect the final output when OBS downscales a 1080p/1440p canvas to 720p.
Enlarging the browser source render and then shrinking it in OBS does not make
small text readable. Setup's preview is fitted to the page, so judge text at
100% of the stream output. Keep a compact/full card clear of a bottom-left webcam
at 720p; the safe preset cannot account for every camera size and HUD arrangement.

Text has a dark outline/shadow and long names, addresses and large metrics are
bounded. Keep **panel opacity at 1** over bright action; lowering the fill to 0.25
can reduce contrast even though text stays opaque. `bg=transparent` leaves the
canvas outside the panel clear. `bg=dark` fills that canvas, so it is intended for
a separate dark scene rather than covering gameplay.

## Browser Source behavior

The source uses **local system fonts** without webfont requests or installation.
It has no scrolling page and does not need a font download to settle its layout.
Live feeds still need a connection; failures show unavailable/fallback states.
The source has no looping decorative animation. `motion=low` and the system's
reduced-motion setting disable transitions, and hidden documents pause refresh
timers. Becoming visible requests fresh data immediately.

**Shutdown source when not visible** saves work between scenes but reconnects the
source when shown. Leave it off if you prefer a ready source through scene
switches. **Refresh browser when scene becomes active** reloads the page and may
briefly show its connecting state; leave it off for smoother switches. OBS can
keep a non-visible source document alive, so its own shutdown setting is the
reliable way to stop that source entirely.

Use a current OBS release with Browser Source support. Browser QA covers the
installed Chromium engine, not every OBS Chromium/CEF version, GPU driver or
plugin combination. Test a refresh and scene switch in OBS before going live.

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

Run the dev server, then use portable Node with the normal workspace NODE_OPTIONS.
The streamer QA matrix can be repeated with:

```powershell
$env:SQUEEKSPIRE_URL = 'http://127.0.0.1:5175/'
node scripts/qa-overlay.mjs
```

`docs/overlay/qa/` contains the canvas/anchor/scale contact sheets, placement
examples, 720p downscale comparisons, transparency and offline checks, setup
screenshots, and `results.json`. The backdrop is an original AI-generated
MOBA/webcam scene; populated names, addresses, scores and telemetry are synthetic
browser fixtures. These are browser composites, not an actual OBS recording or
a real match. The script only accepts loopback HTTP URLs and submits no scores.

The earlier overlay browser checks are also available:

```powershell
$env:SQUEEKSPIRE_URL = 'http://127.0.0.1:5175/'
node scripts/verify-overlay.mjs
```

That script only accepts loopback HTTP URLs. Its `bar-real.png` and `card-real.png`
capture real endpoint results over a checkerboard game scene. `bar-sample.png`
and `card-sample.png` use clearly labeled browser-only fixtures to show populated
rankings and spinning telemetry. No scores are submitted or stored.
`source-transparent.png` captures the source with alpha. Setup is captured at
desktop and mobile sizes. `verification.json` records assertions and disclosure.
