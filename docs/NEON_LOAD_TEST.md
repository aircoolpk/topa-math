# Neon Load Test — Topa Math

Date: 2026-11-10
Target: Neon project `rapid-glade-82793806`, branch `production`
Compute: `ep-steep-block-aoi64dnm` (read/write, autoscaling 0.25–2 CU, Singapore)
Client: this machine (Thailand), so every round trip pays the Thailand → Singapore latency.

## Harness

`scripts/load-test.mjs` logs in with the published demo account and then
cycles through the eleven read endpoints the frontend uses. Run it against
the local API (which talks to Neon) with:

```bash
node scripts/load-test.mjs 300 20      # requests, concurrency
```

## Result: 300 requests, concurrency 20, 0 errors

| Metric | Value |
|---|---|
| Throughput | 15.3 req/s |
| p50 | 486 ms |
| p90 | 3.8 s |
| p99 | 6.4 s |
| Errors | 0 (0.0%) |

Per endpoint:

| Endpoint | n | avg | max |
|---|---|---|---|
| `/me/dashboard?program_type=TH` | 28 | 5,363 ms | 7,040 ms |
| `/me/lessons` | 27 | 1,963 ms | 4,249 ms |
| `/rankings` | 27 | 630 ms | 1,749 ms |
| `/skills` | 27 | 494 ms | 1,929 ms |
| `/me/stats` | 27 | 566 ms | 1,495 ms |
| `/site/homepage` | 28 | 426 ms | 1,751 ms |
| `/children` | 27 | 550 ms | 1,946 ms |
| `/me/rank-summary` | 27 | 546 ms | 2,310 ms |
| `/me/profile` | 27 | 505 ms | 1,761 ms |
| `/subjects` | 27 | 418 ms | 1,383 ms |
| `/health/ready` | 28 | 611 ms | 1,754 ms |

## Where the time goes

A single `select 1` against the pooled endpoint costs **34 ms** (p50) from
this machine. That is the floor for every statement.

Counting the statements of one request (SQLAlchemy event listener, nothing
in the database changes):

| Endpoint | wall | statements | time in the database |
|---|---|---|---|
| `/me/dashboard?program_type=TH` | 5,203 ms | **83** | 3,703 ms |
| `/me/lessons` | 727 ms | 2 | 113 ms |
| `/site/homepage` | 191 ms | 1 | 73 ms |

The dashboard runs an N+1 pattern: the daily, weekly and monthly quest
queries are issued one after another, and the lesson list is rebuilt for
each of them. 83 statements × 34 ms ≈ 2.8 s of pure round-trip time, and
the remaining ~1.5 s is the legacy loader reading the lesson JSON files from
disk.

Everything else is already healthy: one to two statements per request.

## What this means for the Free plan

The Free plan allows 100 CU-hours per month and the compute suspends after
five idle minutes, so an idle database costs almost nothing. What burns the
budget is **statements per request**, because every statement keeps the
compute awake and billed.

With the dashboard at 83 statements, one busy hour costs roughly 83 × the
wall time of the request. Batching the dashboard into a single statement
reduces that to one round trip and takes the endpoint from about five
seconds to roughly 150 ms.

## Actions

1. **The API Worker batches the dashboard query** (`src/routes/me.ts` uses a
   single batched statement) — this is the cutover path and it removes the
   N+1 pattern entirely.
2. **Read the hot rows outside Postgres.** The homepage config, the lesson
   list and the subject list change rarely; caching them at the Worker
   isolates them (Cloudflare Cache API) keeps the compute suspended and
   removes most of the egress.
3. **Keep the pooler for traffic, the direct URL for migrations**, as
   already configured.
4. Re-run the harness after the cutover and compare against the numbers
   above.
