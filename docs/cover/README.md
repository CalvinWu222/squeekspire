# Squeekspire cover art

Original artwork composed with the Canvas 2D API in [scene.html](scene.html). The
scene uses the game's pixel illustration language, parchment cards, a running
hamster, and a handmade wheel. Its midnight plum, copper, sage, and rose palette
contains no official Squeekchain marks, logos, or imported artwork.

- `cover-1200x630.png`: 1200 × 630 social / project cover.
- `cover-512.png`: independently arranged 512 × 512 square cover.

Render from the repository root with the project's portable Node setup:

```powershell
$env:PATH = 'C:\Users\Administrator\squeek-code\tools\node-v22.11.0-win-x64;' + $env:PATH
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
node scripts/render-cover.mjs
```

The script uses the installed Microsoft Edge in headless mode, a dedicated
`.tmp/cover-edge` profile, and local Chrome DevTools Protocol requests. It has no
npm dependencies and loads no remote content. `SQUEEKSPIRE_BROWSER` can override
the Chromium-compatible executable path. `render-report.json` records the exact
export dimensions and file sizes. Open `scene.html` locally for the wide source
scene, or `scene.html?shape=square` for the square composition.
