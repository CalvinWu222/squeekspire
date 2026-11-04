# Squeekspire

A captured real hamster run snapshot shapes your dungeon (daily refresh coming
soon). A Vite + TypeScript roguelike deckbuilder with a replay-validated shared
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
- Consecutive cards of the same type build the Zoomie Chain, ×1.1 per link, capped at
  20. Changing types or turns resets it; Freeze for Mint preserves a multiplier floor.
- Each won battle scores **Squeeks × Mult**. Additive bonuses apply before
  multiplicative bonuses. Score multipliers never increase combat damage. Top-work
  hours are gold jackpots: each multiplicative trigger, including chain links, is
  doubled. Hibernation applies fog and a ×1.2 final score bonus.
- Daily consumes one attempt **when started**, per browser profile per UTC
  game day, resetting at 00:00 UTC. Reload resumes the logged run. Abandonment uses
  the attempt. Practice is unlimited; accepted live `SPINNING` status gives practice
  +1 energy per turn.
- Endless has a persistent five-minute wall clock, including reload time, and ×1.15
  enemy scaling per entered room. Its separate board ranks the largest scored hit.
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

The API exposes **rolling** ranges and rejects historical start/end parameters. It
cannot supply a globally frozen 00:00 UTC snapshot to a static client. A first-player
localStorage snapshot would give different players different daily maps.

This MVP therefore deliberately uses a **captured real hamster run snapshot** for
official gameplay; **daily refresh is coming soon**. A snapshot notice remains
visible even when the API is online. The UTC game date is salted into the public settlement
hash/round seed, producing the same map for everyone on that date. Both requested
endpoints are still fetched at startup with a four-second timeout; availability and
the practice energy flag are the only live effects. Offline play uses the identical
canonical daily rules. This snapshot does not automatically update each night.

The snapshot contains 8,725 work and 853 blocks. Difficulty is
`clamp(8725 / 10891, 0.8, 1.3)`. The median is calculated from seven complete historical
daily buckets. Their captured API boundary is 12:00 UTC, distinct from the game's
00:00 UTC reset. Historical peak RPM is unavailable; boss cadence uses the disclosed estimate
`max(hourly work) / 60`, rather than current sensor RPM. Price inflation is clamped to
±20% using historical minted-volume ratios. See [API shape and evidence](docs/api-shape.md).

A future static daily publisher can archive a versioned 00:00 UTC manifest; clients and
the verifier should then use that identical published manifest. No daily publisher
is included. The shared score API verifies against that same
captured fixture; enabling Redis does not refresh the gameplay snapshot.

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
containing the seed inputs, actions, score claims, and an integrity checksum.
**Verify replay JSON** reconstructs the map and run from scratch, validates each action,
and compares the recomputed score. Imported files never enter the local board.
Completed local runs also replay before being saved. Hidden combo hints stay inside
the player's run and are never included on the leaderboard or broadcast.

[`server/replay.ts`](server/replay.ts) is the API's server-verification boundary.
`verifySubmission(payload)` supplies the authoritative fixture to the shared engine,
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
