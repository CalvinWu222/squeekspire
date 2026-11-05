# Streamer QA evidence

Run the local server on port 5175, then run `scripts/qa-overlay.mjs` with the
portable Node and the workspace's preserve-symlinks NODE_OPTIONS. It accepts
loopback HTTP only and never submits scores. `results.json` records measurements,
HUD collisions and browser checks. `before.json` records the original clipping.

The eight `matrix-*` contact sheets show bar/card on all four requested canvases,
at every corner/edge, with scale 0.5 / 1 / 1.5 / 2 across columns. They deliberately
include bad HUD placements. Automated fitting also checks the center anchor and
all three detail levels: 864 combinations. Read text in the full-size
`placement-*` files; contact-sheet thumbnails are for comparing position only.

`downscale-*` resamples a complete 1920×1080 scene to 1280×720, like OBS output
scaling. `contrast-*` shows solid versus reduced panel fill. `source-alpha.png`
and `startup-delayed-module-transparent.png` retain PNG alpha. The latter is
entirely transparent by design. `setup-*` captures desktop/mobile setup.
`offline-*` blocks the status and board APIs. `legacy/` contains the existing
acceptance suite's real-endpoint and clearly labeled sample screenshots, captured
again after the fixes.

Use a compact bar or minimal card at 720p. In this scene a compact card near the
top left still reaches the bottom-left webcam; a minimal card clears it. Full
detail text remains too small after 1080p→720p downscaling. HUD reservations are
guides, and the matrix records collisions rather than claiming all placements
are safe. Portrait uses a 16:9 game strip with a separate enlarged webcam.

These are real Chromium renders of the overlay over an original **AI-generated**
MOBA/webcam backdrop, with browser-only valid stress fixtures. The backdrop is a
synthetic game scene and fictional adult streamer, not a captured live match.
Stress values include 80-character names, a wallet address, CJK, markup-like
names, and scores/telemetry up to 1e100. No game or leaderboard records were
changed. Chromium checks do not establish a particular installed OBS/CEF version
or GPU load. The default OBS installation path was absent on this machine.

## Backdrop provenance

`moba-webcam-backdrop.png` was created with the built-in image generation tool and
copied into this directory. Browser/CSS compositing preserves the backdrop's
landscape aspect ratio. Final generation prompt:

> Use case: ui-mockup. Asset type: original realistic streamer QA screenshot backdrop, landscape 1920x1080 or 2048x1152, no Squeekspire overlay. Create a convincing crisp screenshot of an ORIGINAL isometric fantasy MOBA match reminiscent of the layout of League of Legends but no logos, exact copyrighted characters or branding. Detailed green river jungle, stone midlane, tiny heroes battling near center, cyan magical effects and an extremely bright white spell burst at upper left/mid-left to test overlay contrast; dark forest upper right to test dark contrast. Essential realistic game HUD: square minimap occupying bottom-right 18% width by24%height; dark elaborate Q W E R ability/inventory/healthbar HUD bottom-center spanning 40%width by14%height; small team scoreboard top center 30%width by6%height. Put a realistic embedded webcam video rectangle at BOTTOM-LEFT,20%width by23%height: fictional adult male streamer in headphones, dim room, relaxed neutral expression, no text on webcam. Make minimap and ability slots well defined at the edges specified, fine UI details. Leave top-left and top-right beneath scoreboard-height open for overlay placement. Frame is the whole stream screenshot, no borders or outer monitor, no watermark, no marketing text. This is a synthetic QA reference, not evidence of an actual game match.

The generated image's actual HUD extents are conservatively measured in the QA
script (including the larger webcam and minimap frames), rather than assuming
the prompt's requested percentages were exact.
