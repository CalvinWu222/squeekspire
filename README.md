# Squeekspire

Unofficial fan-made game, not affiliated with Squeekchain.

Yesterday's real hamster data shapes your dungeon, refreshed daily from a public
hourly archive. A Vite + TypeScript roguelike deckbuilder with a replay-validated shared
leaderboard, featuring **Zoomie
Gremlin**: “gm, I have not slept”.

## Run locally

Double-click `start.bat` to launch the game. It selects the supplied portable Node,
installs dependencies if `node_modules` is missing, and starts Vite.

For a PowerShell session, use the supplied portable Node. The `NODE_OPTIONS` line
also works around this workspace's restricted Windows ancestor-directory permissions.
The npm cache stays inside the project.

```powershell
$env:Path="C:\Users\Administrator\squeek-code\tools\node-v22.11.0-win-x64;"+$env:Path
$env:NODE_OPTIONS="--preserve-symlinks --preserve-symlinks-main"
npm.cmd install
npm.cmd run dev
```

Vite prints the local URL, normally `http://127.0.0.1:5173`. `npm.cmd run dev`
also serves `/api/score` and `/api/leaderboard` through the same handlers used by
Vercel. Without Redis credentials, the API uses `.tmp/leaderboard.json`.
`SQUEEKSPIRE_SCORE_FILE` can
override the local file path. Redis is optional for local play.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run preview
```

`build` typechecks and writes the frontend to `dist/`; `preview` serves that static
build locally. Use `dev` for local API testing. No credentials or wallet are needed
to play. A static-only host or an unavailable API displays **Offline - local scores**.

## Play

- Open How to Play for five swipeable visual tips; expand More details for the full
  rules.
- Choose Start Game, a mode, and Zoomie Gremlin to enter your first battle. After
  winning, climb the route by choosing a lit hour; forks can skip one room, but
  hours 8, 16, and 24 are mandatory act gates. Continue resumes an unfinished save.
- Spend energy by dragging attack cards onto an enemy, or click a card and then
  its target. Click skills and powers to play them. Enemy intent is shown above
  its head. End the turn to draw again.
- Win battles to pick one of three cards. Shop, remove cards, heal, or upgrade at safe
  hours. Inspect cards and relics in the collection.
- The first card sets the Zoomie Chain type at 0; another of that type adds 1, capped
  at 20. A different type resets it to 0; End Turn resets the count and type. Enemy
  damage does not break it. Wheel Brake preserves the count/type only while played;
  Freeze for Mint saves pre-play scoring floors for the battle, while the live Chain
  can still reset. See [all Chain rules and card exceptions](docs/zoomer_chain_rules.md).
- Elites and bosses guarantee an unowned relic, each act has a Treasure room, and
  shops offer two distinct unowned relics (one when only one remains). The Codex
  lists how to get every relic. See [sources, odds, and the 200-run before/after
  acquisition survey](docs/relic_sources.md).
- **Final score rewards progression:** 200 per completed room, 300 extra per elite,
  1,000 extra per boss, and 20,000 for clearing. Combat adds bounded points with
  square-root returns: at most 1,500 / 2,100 / 3,000 per normal / elite / boss fight.
  Late turns reduce those awards to zero. Unfinished runs cap at 19,999, so every
  clear outranks every non-clear. See [the balance model](docs/balance_model.md).
  Raw **Squeeks × Mult** combos still grow on screen; multipliers never increase
  enemy damage. Gold jackpot hours double multiplicative triggers, including chain
  links. Hibernation adds fog and a ×1.2 combat bonus within the battle cap.
- Daily consumes one attempt **when started**, per browser profile per UTC
  game day, resetting at 00:00 UTC. Reload resumes the logged run. Abandonment uses
  the attempt. Practice is unlimited; accepted live `SPINNING` status gives practice
  +1 energy per turn.
- Endless has a persistent five-minute wall clock, including reload time, and ×1.15
  enemy scaling per entered room. Like every mode, its separate board ranks final
  score; the largest raw hit is a display stat.
- Settings persist volume, animation speed, and reduced effects. The UI and five
  illustrated tips are English only. Big scores trigger a local SQUEEK burst; system reduced
  motion and reduced effects pause motion and flashes. More holds the leaderboard,
  replay export/verification, and abandonment.

Coins are in-game points. Everything is **testnet data only**: no private keys,
signing, transfers, token approvals, token rewards, or purchases.

Optional **Connect Wallet** controls on the main menu and leaderboard use an
injected `window.ethereum` provider. Connecting requests an account with
`eth_requestAccounts` and reads `eth_chainId`; the shortened address becomes your
player name. A **Switch to Sepolia** button explicitly requests
`wallet_switchEthereumChain` with chain ID `0xaa36a7`. These are the only wallet RPC
methods used. Account and chain changes update the UI. **Disconnect** forgets the
connection locally, without revoking provider permissions. Connections last for
the current page session; reloading starts as the same saved guest again. Guest play
works without a wallet or on any network. Wallet names are labels, not authenticated
identities. No signatures are requested; an address displayed on the shared board
does not prove ownership of that wallet.

## Captured run data and the API limitation

The real API was fetched and inspected before coding:

- `https://api.squeekchain.com/v1/settlements?range=24h`
- `https://api.squeekchain.com/v1/status`
- Historical baseline inspection also used `range=7d` and `range=30d`.

The API exposes **rolling** ranges and rejects historical start/end parameters.
`scripts/refresh-daily.mjs` fetches and validates 24h, 30d, and status responses before
writing anything. It merges completed hourly buckets into
`public/data/hourly-buckets.json`; incomplete current hours never enter the archive.
GitHub Actions runs at **00:10 and 12:10 UTC**, and can also run manually. Changed
data is committed to `main`, which triggers the Vercel deployment.

`public/data/daily/YYYY-MM-DD.json` is named for its UTC **play date** and describes
the preceding full UTC day in `dataDate`. Every file contains 24 hourly buckets;
unavailable hours are zero and listed in `meta.missingHours`. Seven complete daily
periods supply the median: archived UTC sums are preferred, otherwise real 30d API
buckets retain their rolling boundaries and recorded provenance. The API's daily
buckets are not assumed to start at midnight. The first bootstrap can contain
partial hours; see [daily publishing and recovery](docs/daily-data.md).

The client validates and loads today's dated file, then `latest.json`, then the
bundled fixture. Its notice gives the actual UTC data date and labels fallbacks.
The UTC play date and loaded settlement buckets determine the shared seed.
Startup and midnight rollover await loading before a new run begins. Dated files
stay immutable on reruns unless explicitly regenerated with `--force`; the noon
job still advances the archive for tomorrow. The server verifier reads the same
published files bundled into its Vercel functions and recomputes authoritative rules.

Only an accepted, online live `SPINNING` status affects practice energy. Historical
peak RPM is unavailable; boss cadence uses the estimate `max(hourly work) / 60`.
Price inflation is clamped to ±20% using historical minted-volume ratios. The bundled
fallback contains 8,725 work and 853 blocks, with a seven-period median of 10,891.
See [API shape and evidence](docs/api-shape.md).

## Shared leaderboard and replay

Guest IDs look like `guest4821`; connected wallet names look like `0x1234...abcd`.
Finished runs are saved locally and submitted to `POST /api/score`. The server
replays the submitted seed and action log with the shared deterministic engine and
authoritative fixture, computes the result, and rejects invalid logs or score
mismatches. Payloads are limited to 256 KiB and 4,000 actions. Names are sanitized;
per-IP limits are 12 submissions and 120 leaderboard reads per minute. Storage uses
Upstash Redis REST through `fetch`, without a Redis SDK.

`GET /api/leaderboard?mode=daily&seed=...` filters the daily seed;
`mode=all` returns the all-time board and is the default for bare
`GET /api/leaderboard` requests. The client labels successful API results
**Global leaderboard**. If the API is unreachable, it falls back to saved results
and clearly labels them **Offline - local scores**. Local development's shared API
uses its local store until Redis is configured; it does not connect to a deployed board.
The optional `runMode=daily|practice|endless` query keeps game modes separate.
Daily queries default to Daily runs; all-time queries include all modes unless filtered.

Saves, local daily claims, streaks, and separate mode boards live in localStorage.
If storage is blocked, the UI announces session-only storage. Clearing browser data
resets the local profile and daily limit. Guest names and unsigned wallet addresses
are self-reported labels; these controls are basic abuse prevention, not global
identity or competition enforcement.

Every legal player choice is recorded. **Export action log** downloads versioned JSON
containing the seed inputs, actions, score claims, `scoreVersion: 2`, and an integrity checksum.
**Verify replay JSON** reconstructs the map and run from scratch, validates each action,
and compares the recomputed score. Imported files never enter the local board.
Completed local runs also replay before being saved. Hidden combo hints stay inside
the player's run and are never included on the leaderboard or broadcast.

Scoring v2 starts fresh rankings: the API, Redis namespace, and browser boards hide
old-version scores, and old action saves cannot resume under the new rules.
Profiles, consumed daily attempts, and streaks remain intact.

[`server/replay.ts`](server/replay.ts) is the API's server-verification boundary.
`verifySubmission(payload)` supplies the authoritative published snapshot (or validated fallback) to the shared engine,
rejects altered rule inputs and unfinished runs, and returns recomputed scores. It
is shared by serverless handlers and the local Vite middleware. The checksum detects
accidental corruption; it is not a signature. A client action log cannot prove
elapsed time, and replay validation does not authenticate a player. Browser daily
attempts and the endless wall clock remain client-side rules. Practice boards are
separate; the practice live-status energy flag is client-declared and is not
independently authenticated by replay.

## Deploy

The repository contains Vercel configuration. See `DEPLOY_STATUS.md` for the
current deployment progress.

1. Use an existing Vercel account or create one, then import this repository as a
   Vite project. `vercel.json` sets `npm run build` and the `dist` output directory;
   TypeScript handlers under `api/` become Node serverless functions automatically.
   Use Node.js 22 in the Vercel project settings.
2. Add the Upstash Redis integration through Vercel Marketplace and select the
   free Redis plan. Connect it to this project so Vercel injects the server-side
   environment variables automatically.
3. The API reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
   The aliases `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   are also supported. Supply one complete pair. These are server-only secrets;
   never use a `VITE_` prefix or commit real values.
4. Deploy the project. Open the leaderboard and finish a run to check submission
   and replay verification. The frontend and `/api/*` functions share one origin;
   no separate backend URL or CORS setup is required.
5. Optionally add a custom domain in Vercel **Project Settings → Domains** and apply
   the DNS records Vercel provides. The API remains on the same domain.

For local Redis testing, copy `docs/environment.example` to `.env.local`, fill one credential
pair, and restart `npm.cmd run dev`. Without credentials, the local file/memory
fallback works for development. On Vercel, missing Redis credentials return HTTP 503
so the client shows its offline local board. Incomplete credentials also return 503.
Serverless memory and writable files are ephemeral and are not shared across
instances, so Redis is required for the durable global board.

## Project map

| File | Purpose |
| --- | --- |
| `src/main.ts`, `src/style.css` | Responsive camp, map, combat, encounters, collection, and results |
| `src/game/catalog.ts` | Exact starter, 30 core reward cards, meme cards, 15 relics, enemies and gates |
| `src/game/engine.ts` | Pure deterministic rules, scores, action log, export and replay |
| `src/game/data.ts`, `src/game/map.ts`, `src/game/rng.ts` | API handling, fixture baseline, UTC daily seed, 24-node routes |
| `src/game/storage.ts` | Guest/wallet score profiles, daily claim, resumed runs, local leaderboards |
| `src/wallet.ts` | Optional injected-provider account connection and Sepolia switching |
| `fixtures/` | Real 24h/7d/30d API captures and trimmed status |
| `api/score.ts`, `api/leaderboard.ts` | Vercel entry points for validated scores and shared rankings |
| `server/` | Replay validation, HTTP handlers, rate limiting, Redis/local storage |
| `docs/cover/`, `scripts/render-cover.mjs` | Original cover source, two PNG exports, and offline renderer |
| `src/**/*.test.ts` | Gameplay, replay, storage, API validation and rate-limit tests |

Section 13 of [design v3](docs/roguelike_design.md) takes precedence for balance:
72 HP, 3 energy, draw 5, hand cap 10, exact ten-card starter, capped 20-link chains,
specified enemy HP, reward rarity weights, and shop prices with inflation.
The v3.1 meme additions already present in that document are included. The earlier
roundtable's wallet and public hidden-combo broadcast suggestions are superseded.

Small MVP simplifications: Merge selects the first equal-level duplicate pair; Gud
Tek upgrades the first remaining hand card; Oracle Ping reorders with a default top
choice and shows the next three cards in the combat log; Moar repeats the previous
attack's base damage; Name Tag upgrades a card without a naming dialog. All daily
profiles share the same fixed pool. No paid or progression-based power is present.

Tests use Vitest; the UI smoke suite runs in Happy DOM under Node and opens no browser.
Vite/Vitest are started through small API wrappers to accommodate this workspace's
Windows permission restrictions. There are no production framework dependencies.

After building, start `npm.cmd run preview` and run `node scripts/shots-tips.mjs`
in another portable-Node session to capture the five-tip guide at 1280×800 and
390×844. The script uses the installed headless Edge browser, checks buttons and
touch swipes, and writes PNGs and an interaction report to `shots/tips/`.
Pass `--wallet` to the same script to capture the main menu and all five English
tips on desktop and mobile, plus interaction checks, in `shots/wallet/`:

```powershell
node scripts/shots-tips.mjs --wallet
```

With `npm.cmd run dev` running, `node scripts/shots-online.mjs` submits five legal
sample replays to the local API and captures `shots/online/leaderboard.png`, its
offline fallback, and an interaction report. It blocks external browser requests.
Set `SQUEEKSPIRE_SCORE_FILE=.tmp/online-screenshot.json` before starting the dev
server to isolate sample data, and set `SQUEEKSPIRE_URL` for the capture script if
Vite uses a port other than 5173.

Original project covers and the editable canvas source are in `docs/cover/`.
Recreate both PNG sizes with `node scripts/render-cover.mjs`, using installed
headless Edge without additional dependencies or remote content.

squeekchain-project: ddbde212-c014-45ae-8071-800e29e5e36f
