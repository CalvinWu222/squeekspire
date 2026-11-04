# Public API inspection and deterministic daily snapshots

Inspected with Node's `fetch` before implementation. The public endpoints are read-only;
this game contains no wallet, signing, transaction, or private-key integration.

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

## Why this MVP displays a frozen-data fallback even when the API is online

The API exposes rolling ranges, and requests adding `startAt`, `endAt`, or `end`
were rejected with HTTP 400 `{"error":"invalid_query"}`. A rolling window or a
first-visitor localStorage snapshot would give players different official maps on the
same date. Without a historical window API or a published immutable daily manifest,
a static client cannot independently establish a globally identical 00:00 UTC snapshot.

The MVP therefore uses the same published settled fixture for **all official rules**,
with the UTC game date included in its seed. It always announces this
fallback; online/offline status never changes the daily map or scoring inputs.
It still fetches both required public endpoints at startup. Only the accepted, online
`SPINNING` flag affects practice energy. Fetch failure or oracle rejection leaves the
canonical fallback playable. Refreshing or clearing browser storage cannot reroll it.

A production daily publisher can replace the fixtures with a versioned 00:00 UTC manifest
served as a static file. That is deliberately not represented as an implemented backend.

## Explicit MVP approximations

- Difficulty is `clamp(totalWork / sevenPeriodMedian, 0.8, 1.3)`.
  The seven complete API daily buckets before the saved map window have work totals
  `11182, 10891, 10587, 13297, 12561, 8505, 8984`; their median is `10891`.
  Their captured API boundary is 12:00 UTC, distinct from the game's 00:00 UTC reset.
- Hibernation means total work below 25% of the historical median. The engine applies
  the design's x1.2 score bonus and the UI shows fog.
- Historical RPM uses the deterministic proxy `max(hourly work) / 60`, approximately
  45.08 for the bundled snapshot. It is clearly described as an estimate, not a sensor peak.
- Price inflation is the saved 24h minted amount divided by the seven-period median
  minted amount, clamped to 0.8–1.2. Minted values are used only as a game-price ratio.
- The safe settlement anchor supplies immutable block height and progress. Live status
  anchors, arrival order, generated timestamps, and local storage never enter the seed.
- Top 1–3 nonzero work hours are gold jackpot nodes. Required gates are hours 8 and 16
  (elite) and hour 24 (Squeektoshi). Safe zero-work hours become rest/shop nodes, except
  the required gates.

The raw `24h`, `7d`, `30d`, and trimmed status snapshots are bundled for inspection.
