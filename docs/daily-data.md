# Daily Squeekchain data

`node scripts/refresh-daily.mjs` uses Node 22 with no additional dependencies.
It performs only public GET requests to `api.squeekchain.com`: settlements with
`range=24h` and `range=30d`, plus `/v1/status`. Invalid responses fail the job before
any data files are written. No custom historical query parameters are used.

## Archive and publish dates

The 24h endpoint rolls by hour and ends at the next full hour. The current hour
is incomplete, so the archive accepts only buckets whose end is at or before the
run time. It merges observations by `startAt` and keeps the archive sorted.
Runs at 00:10 and 12:10 UTC overlap enough to collect every completed hour.
GitHub Actions can be delayed; if an hour falls outside the available range before
it is collected, the publisher reports that missing coverage instead of inventing it.

For play day `2026-11-04`, the dated file is
`public/data/daily/2026-11-04.json`, and `dataDate` is `2026-11-03`.
Its window is exactly November 3, 00:00 through November 4, 00:00 UTC.
The JSON contains 24 hours, `generatedAt`, the real API `sourceWindow`, seven
historical daily periods, and metadata listing each missing hour. Missing hours
are zero-filled only in the daily file, never the archive.

The November 4 bootstrap was created after the API had rolled beyond the start
of November 3. **This first dated file has partial coverage (12 missing hours)**; its
`meta.missingHours` is the authoritative list. It stays frozen even if later
archive collection can fill more hours. Future coverage builds up through the
twice-daily job.

Historical medians prefer full UTC days reconstructed from 24 observed archive
hours. Until enough history exists, complete 30d API buckets provide the remaining
periods. Those periods can start at an hour other than midnight; their actual
timestamps and source provenance are retained. Partial archive days never count as
complete daily history. Base-unit sums use integer arithmetic.

## Repeated runs and recovery

A normal rerun updates the archive but preserves an existing dated file and its
generation timestamp. `latest.json` contains the same published snapshot. The
workflow commits only when files change, using
`data: daily snapshot YYYY-MM-DD [bot]`, and pushes to `main` for Vercel deployment.

To regenerate a dated file deliberately, run:

```sh
node scripts/refresh-daily.mjs --force
```

This can change the current challenge's seed and rules. Use it before players
begin that day's runs whenever possible. Preserve the hourly archive and older
dated files in version control; they allow replay verification after midnight and
after subsequent deployments. The noon run normally collects tomorrow's input
without changing today's challenge.

## Client and verifier

The client requests `/data/daily/<todayUTC>.json`, then `/data/daily/latest.json`,
then uses the bundled fixture if both are missing, invalid, or unreachable.
Each candidate is validated before use. A stale latest snapshot is re-seeded
with today's UTC play date and identified as a fallback in the notice. The
fixture's source date is also displayed with `fallback`. Startup and UTC rollover
resolve the snapshot before starting a run or consuming an official attempt.

The verifier reads the deployed `public/data` files included by `vercel.json`.
It matches the submitted seed to a known dated snapshot, a retained fallback
snapshot, or the bundled fixture, then replays with those authoritative rules.
Client-supplied difficulty, hourly work, or other scoring inputs are never trusted.
Old dated files remain available for runs completed after a UTC reset.

Live status can grant the existing practice-only spinning bonus. It never changes
the daily seed, map, or score rules. Published snapshots use hourly buckets for
their seed and omit the rolling recent-settlement events.
