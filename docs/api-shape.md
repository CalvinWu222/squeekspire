# Public API inspection and deterministic daily snapshots

Inspected with Node's `fetch` before implementation. The public data endpoints are read-only.
The game now supports optional, read-only Sepolia wallet connection through an injected
`window.ethereum` provider: `eth_requestAccounts` selects an account and `eth_chainId`
reads its network. The explicit **Switch to Sepolia** button requests
`wallet_switchEthereumChain` (`0xaa36a7`). No signatures, transactions, token approvals,
or private keys are requested. Wallet addresses are self-reported player labels and
do not establish ownership or identity. Guest play remains available.

## Observed JSON

- `GET https://api.squeekchain.com/v1/settlements?range=24h` returns schema version 3,
  `status: "available"`, a `window` with ISO `startAt` / `endAt` and `bucketSeconds: 3600`,
  `summary`, 24 `buckets`, and up to 10 `recentSettlements`.
- Each hourly bucket has decimal **strings**: `settlementCount`, `activeRoundCount`,
  `workAdded`, `completedBlockCount`, and `sqkMintedBaseUnits`.
- Recent settlements have `transactionHash`, `settledThroughRound`, `blockHeight`,
  `cumulativeBlockUnits`, `blockTimestamp`, and `confirmationStatus: "safe"`.
- `range=7d` returns 28 six-hour buckets. `range=30d` returns 30 daily buckets.
- `GET https://api.squeekchain.com/v1/status` returns schema version 1,
  `measurement.coreStatus` (`IDLE` / `SPINNING`), `measurement.rpmMilli`,
  `measurement.speedMmPerSecond`, `measurement.freshness`, `oracle.state`, and
  `builder.anchor.blockHeight` / `blockProgress` / `settledThroughRound`.
- Historical peak RPM is **not** present in the settlements endpoint. Current RPM is
  a live measurement and cannot fairly affect an official daily run.

The bundled real-data snapshot has 8,725 work, 853 completed blocks, 23 active rounds,
and 135 settlements. Public safe settlement hashes and settled-through rounds are
retained as reproducible seed material. `fixtures/status.json` omits the API's unrelated
signer metadata. Fixture capture timestamps are retained in each JSON file.

## Publishing immutable UTC daily snapshots

The API exposes rolling ranges, and requests adding `startAt`, `endAt`, or `end`
were rejected with HTTP 400 `{"error":"invalid_query"}`. A rolling window or a
first-visitor localStorage snapshot would give players different official maps on the
same date. Without a historical window API or a published immutable daily manifest,
a static client cannot independently establish a globally identical 00:00 UTC snapshot.

The daily publisher now collects completed 24h hourly buckets twice a day, at
00:10 and 12:10 UTC. The hourly archive reconstructs the previous full UTC day.
Missing hours are explicitly zero-filled in each snapshot and recorded in its metadata;
they are never inserted as observed data into the archive. A dated file names the
day it is played, while `dataDate` identifies the source UTC day. It remains frozen
on repeat runs, and `latest.json` mirrors it. The noon job continues archiving even
when that day's file already exists.

Clients load and validate the dated file, then latest, then the bundled fixture.
The seed uses the UTC play date and loaded snapshot. The verifier reads the same
files from `public/data`, included in the deployed Vercel functions. Seven historical
periods prefer complete archived UTC daily sums; 30d fallback periods keep their
real rolling timestamps, and provenance is recorded. Snapshot seeds omit the API's
rolling recent-event list so events from another UTC day cannot enter a challenge.
Daily block height uses the sum of that day's completed blocks when no safe event
anchor is present. Only the accepted, online live `SPINNING` flag affects practice
energy. See [publisher operation and recovery](daily-data.md).

## Explicit MVP approximations

- Difficulty is `clamp(totalWork / sevenPeriodMedian, 0.8, 1.3)`.
  The seven complete API daily buckets before the saved map window have work totals
  `11182, 10891, 10587, 13297, 12561, 8505, 8984`; their median is `10891`.
  Their captured API boundary is 12:00 UTC, distinct from the game's 00:00 UTC reset.
- Hibernation means total work below 25% of the historical median. The engine applies
  a x1.2 combat score bonus within the battle cap, and the UI shows fog.
- Historical RPM uses the deterministic proxy `max(hourly work) / 60`, approximately
  45.08 for the bundled snapshot. It is clearly described as an estimate, not a sensor peak.
- Price inflation is the saved 24h minted amount divided by the seven-period median
  minted amount, clamped to 0.8–1.2. Minted values are used only as a game-price ratio.
- The bundled fallback retains its safe settlement anchor for block height and progress.
  Published daily files use their completed-block sum and zero progress. Live status
  anchors, arrival order, generated timestamps, and local storage never enter the seed.
- Top 1–3 nonzero work hours are gold jackpot nodes. Required gates are hours 8 and 16
  (elite) and hour 24 (Squeektoshi). Safe zero-work hours become rest/shop nodes, except
  the required gates.

The raw `24h`, `7d`, `30d`, and trimmed status snapshots are bundled for inspection.

## Game score API and scoring reset

`POST /api/score` accepts `{ seed, run, identity }`, where `run` is a finished
action replay exported by the game. Replay format `version: 1` and scoring
`scoreVersion: 2` are separate: the scoring version is required and included in the
export checksum. The API rejects missing, previous, or future scoring versions with
HTTP 400 `invalid_replay`. It replays every legal action through the same engine
and score module used by the client, checks the canonical daily snapshot, and
compares both final score and best hit. Client-provided scores are never trusted.

The HTTP 201 response contains `{ entry, scoreVersion: 2, storage }`. Every entry
includes `scoreVersion: 2`. `GET /api/leaderboard` returns
`{ entries, scoreVersion: 2, mode, storage }` with optional `seed` and `runMode`
matching the query. Daily queries require `mode=daily&seed=<uint32>`; `runMode`
separates daily, practice, and endless results. Bare GET returns the all-time board.
Every mode ranks by the progression-weighted final score. The raw best hit remains
available for display and replay verification, and never determines rank.

Scores from the previous formula are deliberately hidden rather than converted:
the old total cannot establish the progression and combat contributions needed by
the new model. Redis uses a fresh `squeekspire:score-v2:` namespace for entries,
indices, and deduplication. Local server files, browser boards, and the client API
reader filter out missing or different score versions. New writes drop old local
score rows. Old browser action saves cannot resume under changed scoring rules;
profiles, official daily attempt claims, and streak history remain intact.
