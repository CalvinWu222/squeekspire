# Online leaderboard changes

- Added Vercel `POST /api/score` and `GET /api/leaderboard?mode=daily|all&seed=...`
  entry points, backed by shared handlers also used by `npm run dev`.
- The server bounds JSON payloads and action counts, replays runs against the
  canonical daily snapshot, checks claimed scores, sanitizes names, and applies
  per-IP submission/read limits. Redis storage uses REST `fetch` and atomic Lua
  operations without a Redis SDK. Local development uses an ignored file store.
- The client submits finished runs, displays shared scores as **Global
  leaderboard**, and falls back to **Offline - local scores** when the API is
  unavailable. Refresh reconnects. Daily, Practice, and Endless stay separate.
  Wallet addresses are shortened for display; guests retain `guest` + number IDs.
- Added `vercel.json`, `.env.example`, and README deployment instructions. Real
  environment files are ignored. No credentials are bundled into the frontend.
- Added original canvas cover art in `docs/cover/cover-1200x630.png` and
  `docs/cover/cover-512.png`, its editable `scene.html`, and the offline
  `scripts/render-cover.mjs` renderer.

## Verification

- `npm.cmd test`: **209 tests passed across 16 files**, including 19 API/replay/
  persistence tests and 9 leaderboard client/UI tests. Coverage includes legal
  nonzero-score runs, tampered claims with recomputed checksums, illegal actions,
  canonical seed/rule validation, rate limits, spoofed IP headers, payload limits,
  equivalent-replay deduplication, mode separation, credential aliases, and mocked
  Redis REST contracts.
- `npm.cmd run build`: passed TypeScript checking (including `api/`) and the Vite
  production frontend build. Both function entry points also bundled as Node ESM
  with Vite SSR; importing and invoking the bundled handler under Node 22 returned
  HTTP 200. No live Vercel or Upstash service was contacted.
- `scripts/shots-online.mjs`: five legal runs accepted through the actual local
  HTTP API with HTTP 201; four browser smoke checks passed with zero page errors.
  Verified global rows, shortened wallet labels, offline local scores, and online
  recovery. Required screenshot: `shots/online/leaderboard.png` (1440 x 1200).
  Also saved `leaderboard-offline.png` and `report.json`. Samples use an isolated,
  ignored local store and are not included in shipped game data.
- Both cover PNGs were rendered and visually inspected at exactly 1200 x 630 and
  512 x 512. Scene source, renderer, and dimension report are included.

## Deployment requirements

Deploy manually with a Vercel account/project (Node.js 22) and an Upstash account
with a Redis database. Set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`, or the complete aliases `KV_REST_API_URL` and
`KV_REST_API_TOKEN`. Set them only on the server; never prefix them with `VITE_`.
No accounts, credentials, custom domain, or Redis service are required for local
development. `.env.local` is supported by the development wrapper. A custom domain
is optional and is configured in Vercel with the DNS records it supplies.

Vercel without Redis configuration returns 503 so the browser falls back locally;
serverless memory/files cannot provide shared durable storage. See README's
**Deploy** section for steps. No deployment, push, account creation, dependency
installation, or external network access was performed for this work.

## Scope of verification

Replay validates legal choices and resulting scores. Wallet addresses and guest
IDs are unsigned labels, and browser daily-attempt rules remain local. Replays
cannot establish real elapsed time or stop a player from submitting legal automated
runs. Practice's live spinning bonus is client-declared and remains on its separate
board. Current daily rules still use the captured canonical hamster snapshot.
