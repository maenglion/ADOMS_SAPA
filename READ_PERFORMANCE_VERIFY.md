# PostgreSQL READ Performance Verification

## Scope and gate

- Baseline compatibility commit: `769cea1a383671c58d3416bfa4f278ec3df4f798`
- Instrumented measurement commit: `ca5082b280c1d6bfa4af0a97b5702e97db40732f`
- Netlify branch: `remote-csv-baseline`
- Role: `gm`
- Method: one sequential request at a time; first request is cold and the following nine are warm.
- Contract status before this test: HTTP 137/137, golden 7,373/7,373, stable mismatch 0, expected-only/extra 0/0, metrics 159/159, crosscheck 68/68.
- The four raw `/exec` elapsed-time values remain classified separately and were not treated as stable mismatches.

The same branch, commit, region, route parameters, and request pattern were used. Only `ADOMS_DATA_BACKEND` changed between the two branch deploys. Production remained `csv`. No write, database, schema, seed, UI, golden, or compatibility-contract change was made.

## Client-observed response time

All 100 requests returned HTTP 200: 50 CSV and 50 PostgreSQL.

| Route | Backend | Cold | Warm min | Warm median | Warm max / p95 | PostgreSQL / CSV warm median |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| dashboard `/` | CSV | 9.699 s | 1.235 s | 1.731 s | 2.338 s | 1.00× |
| dashboard `/` | PostgreSQL | 9.085 s | 3.642 s | 4.261 s | 4.755 s | **2.46×** |
| `/actions` | CSV | 3.952 s | 3.123 s | 3.555 s | 4.278 s | 1.00× |
| `/actions` | PostgreSQL | 14.246 s | 14.147 s | 14.625 s | 16.510 s | **4.11×** |
| `/duties/list` | CSV | 1.748 s | 1.140 s | 1.165 s | 2.617 s | 1.00× |
| `/duties/list` | PostgreSQL | 3.229 s | 2.421 s | 2.879 s | 3.385 s | **2.47×** |
| `/evidence` | CSV | 1.252 s | 0.916 s | 1.151 s | 1.555 s | 1.00× |
| `/evidence` | PostgreSQL | 4.814 s | 3.337 s | 3.600 s | 3.931 s | **3.13×** |
| `/tasks` | CSV | 1.366 s | 0.923 s | 1.131 s | 1.422 s | 1.00× |
| `/tasks` | PostgreSQL | 3.220 s | 2.912 s | 3.425 s | 3.724 s | **3.03×** |

With nine warm samples, nearest-rank p95 is the maximum sample. The dashboard CSV cold result includes a fresh function instance and is not used for the primary comparison; the gate uses warm medians.

## Server and database timing

`db total` is cumulative query work, not route wall time. Concurrent queries can overlap, so it may exceed the route render wall time. Dashboard values are a representative observed request; `/actions`, `/duties/list`, `/evidence`, and `/tasks` PostgreSQL values are medians of the visible request set. CSV dashboard, `/actions`, and `/duties/list` are representative samples, while CSV `/evidence` and `/tasks` are medians.

| Route | Backend | Logical reads | Physical SQL | Acquire | SQL | DB total | Server data render |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dashboard | CSV | 0 | 0 | 0 | 0 | 0 | 0.418 s |
| dashboard | PostgreSQL | 49 | 16 | 3.226 s | 3.694 s | 6.920 s | 4.371 s |
| `/actions` | CSV | 0 | 0 | 0 | 0 | 0 | 2.065 s |
| `/actions` | PostgreSQL | 270 | 16 | 0.619 s | 2.895 s | 3.514 s | 13.481 s |
| `/duties/list` | CSV | 0 | 0 | 0 | 0 | 0 | 0.349 s |
| `/duties/list` | PostgreSQL | 6 | 5 | 0.001 s | 1.240 s | 1.261 s | 1.832 s |
| `/evidence` | CSV | 0 | 0 | 0 | 0 | 0 | 0.147 s |
| `/evidence` | PostgreSQL | 18 | 11 | 0.634 s | 1.796 s | 2.460 s | 2.500 s |
| `/tasks` | CSV | 0 | 0 | 0 | 0 | 0 | 0.146 s |
| `/tasks` | PostgreSQL | 16 | 9 | 0.599 s | 1.634 s | 2.282 s | 2.324 s |

## `/actions` decomposition

The request-scoped memo continues to preserve 270 logical reads while reducing them to 16 physical SQL calls. The `checkFlagged()` portion remains 248 logical reads with 15 distinct tuples. Median cumulative connection acquisition is 0.619 seconds, cumulative SQL execution is 2.895 seconds, total DB work is 3.514 seconds, and server data-render wall time is 13.481 seconds. The approximate residual between route render and cumulative DB work is 9.983 seconds.

The 16 SQL calls are not completely sequential. Acquisition waits and existing concurrent call sites show overlap, so cumulative acquisition and SQL times are diagnostic work totals rather than an exact wall-clock partition. Even with this limitation, the dominant `/actions` delay is outside the measured database work: repeated server-side construction and calculation after the SQL round trips account for roughly ten seconds. The route remains the slowest user-visible path at a 14.625-second warm median.

## Decision

Performance acceptance **failed**. PostgreSQL warm medians are 2.46× to 4.11× the corresponding CSV medians, and every representative PostgreSQL path is slower. `/actions` is the primary blocker, followed by `/evidence` and `/tasks`.

Production READ cutover remains blocked. The next task should profile and reduce PostgreSQL-mode server calculation and materialization costs, especially the approximately ten-second non-DB portion of `/actions`, while preserving the already-passing contract. No cache, index, schema change, or semantic optimization was applied during this gate.

After the A/B measurement, the branch override was restored to `postgres` and a new branch deploy was requested. Production was independently confirmed as `ADOMS_DATA_BACKEND=csv`.

Raw comparison data is in `db/read-shadow/read_performance_compare.csv`.
