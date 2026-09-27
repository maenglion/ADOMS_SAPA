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

## PostgreSQL READ optimization pass 1 — 2026-09-27

### Contract and release rule

The optimization target is the result contract of the explicitly published frozen release, not whichever dataset happens to be newest. The published CSV runtime remains the compatibility oracle. Internal READ implementation may change for performance as long as visible values, role scope, filtering, ordering, limits, golden values, metrics, and crosschecks remain identical.

The semantic result cache is request-scoped and enabled only inside an `/actions` render. It stores the final contract result for an exact function-and-argument key, returns a clone to each caller, and is discarded when the request ends. It does not create cross-request staleness or alter the CSV path.

### Runtime location and common PostgreSQL overhead

- Netlify function region: `us-east-2`
- Railway PostgreSQL region: Singapore

The application function and database are cross-region. On light representative routes, PostgreSQL query wall time dominates the server render. Query wall includes database execution, cross-region transfer, and driver row decoding; the current boundary cannot split those components without changing the query protocol. Raw result sizes were about 18,380 to 20,365 rows on the light routes, so latency and row transfer/materialization remain common costs.

The new wall-clock counters use the union of overlapping intervals. They must not be confused with cumulative SQL work, which double-counts concurrent overlap.

### `/actions` semantic READ profile

Before final-result memoization, `/actions` executed 270 logical READs over 16 SQL tuples. The repeated work was not primarily new SQL. The same normalized arrays, filters, sorts, merges, and `CheckFlag[]` inputs were rebuilt inside the request.

| Semantic READ | Calls | Unique args | Cache hits after | Contract calculations after |
| --- | ---: | ---: | ---: | ---: |
| `staff` | 17 | 1 | 16 | 1 |
| `roundsOf` | 12 | 3 | 9 | 3 |
| `cellsOfRound` | 9 | 9 | 0 | 9 |
| `buildCells` | 9 | 7 | 2 | 7 |
| `tasks` | 9 | 2 | 7 | 2 |
| `allTasks` | 9 | 1 | 8 | 1 |
| `inspectionsByTask` | 9 | 1 | 8 | 1 |
| `actionsByInsp` | 9 | 1 | 8 | 1 |
| `evidences` | 7 | 1 | 6 | 1 |
| `judgesOf` | 9 | 9 | 0 | 9 |
| `oldAggOf` | 9 | 9 | 0 | 9 |

The logical domain calls still express the same page behavior, but only 18 calls now reach the SQL-result layer and 16 execute SQL. Canonical `CheckFlag[]` remains 30 rows with SHA-256 `5c5189aee2610e7b74c0474481a8b9b91b8657284ddb0efa80911682a0d07bc1`.

### Client-observed before/after result

All 50 optimized PostgreSQL requests returned HTTP 200. Each route was requested sequentially with one cold request and nine warm requests.

| Route | CSV warm median | PostgreSQL before | PostgreSQL after | After / CSV | After / before |
| --- | ---: | ---: | ---: | ---: | ---: |
| dashboard | 1.731 s | 4.261 s | 4.176 s | 2.41× | 0.98× |
| `/actions` | 3.555 s | 14.625 s | 5.477 s | 1.54× | **0.37×** |
| `/duties/list` | 1.165 s | 2.879 s | 3.023 s | 2.60× | 1.05× |
| `/evidence` | 1.151 s | 3.600 s | 3.436 s | 2.99× | 0.95× |
| `/tasks` | 1.131 s | 3.425 s | 3.471 s | 3.07× | 1.01× |

The optimization is scoped to `/actions`; changes of roughly five percent on the other routes are treated as run-to-run noise.

### `/actions` wall-clock decomposition after optimization

- logical calls reaching the SQL-result layer: 18
- physical SQL: 16
- cumulative DB work: about 3.288 s
- DB interval union wall time: about 2.410 s
- connection acquisition interval union: about 0.395 s
- query interval union: about 2.020 s
- server render: about 4.304 s
- non-DB server interval: about 1.894 s
- client warm median: 5.477 s

The former estimated non-DB portion of 9.983 seconds fell to about 1.894 seconds. `/actions` warm median improved by 62.6%, from 14.625 seconds to 5.477 seconds. The remaining gap is mainly common PostgreSQL access and cross-region row transfer rather than repeated semantic materialization.

### Verification and decision

The full read-only regression was evaluated against the previously published golden capture time; a run at the current date was not accepted as a replacement release. It passed HTTP 137/137, 7,373/7,373 extracted values, stable mismatch 0, expected-only/extra 0/0, metrics 159/159 with mismatch 0, crosscheck 68/68, and unchanged `CheckFlag[]` SHA. The four `/exec` elapsed-time cells remain the already classified raw time-dependent category. The verification-only clock variables were removed after the run so the branch Preview returned to normal current-time behavior.

Optimization pass 1 succeeds for `/actions`, but Production cutover remains blocked. PostgreSQL is still 1.54× to 3.07× slower than CSV at the warm median across the five routes. The next pass should address common PostgreSQL access overhead, cross-region placement, and oversized full-table row transfer without changing the published result contract. Production remains `csv`; Preview remains the PostgreSQL comparison environment.

Detailed before/after measurements are in `db/read-shadow/read_performance_optimization.csv`.

## PostgreSQL READ optimization pass 2 — explicit `/actions` request context

The second pass replaces repeated round-by-round materialization with one explicit request context. At request start it loads the canonical task rows, approval source, evidence, staff, inspections, actions, rounds, judges, notifications, and the three performance-record tables. Independent reads run concurrently. Approval projection is built once from the already loaded task/round/judge rows, so `applyItemApproval()` does not issue another task materialization on this route.

The context creates stable-order indexes for task area/dept/code, task inspections, inspection actions, department owners, latest task evidence, track/year/step/dept records, round judges, and inherited judges. Distinct rounds still receive their own cell and old-result calculation, but those calculations use the preloaded indexes instead of reading, normalizing, filtering, and sorting the full datasets again. Small linear scans in notification filtering, later-judge lookup, and owner lookup were also replaced with request-local Set/Map lookups.

### Materialization and query result

| Counter | Original profile | Semantic-cache pass | Explicit context |
| --- | ---: | ---: | ---: |
| SQL-result logical READ | 270 | 18 | **17** |
| Physical SQL | 16 | 16 | **16** |
| `tasks` calls/calculations | 9 calls | 2 calculations | **1 canonical materialization** |
| `allTasks` calls/calculations | 9 calls | 1 calculation | **0 additional task join** |
| Approval projection | repeated through READ graph | 1 semantic calculation | **1 merge from preloaded inputs** |
| `cellsOfRound` | 9 | 9 | **9 distinct rounds** |
| Base-cell calculations | 9 calls / 7 unique | 7 | **7** |
| Old-result aggregates | 9 | 9 | **9 distinct parameter sets** |
| Shared dataset normalization | repeated | semantic-result reuse | **1 request context** |

The unchanged SQL count is intentional: the target was repeated server materialization, not an arbitrary reduction of the 16 independent relation queries.

### `/actions` timing after pass 2

All four published roles returned HTTP 200 for one cold and nine sequential warm requests each. Client warm medians were `gm` 4.650 s, `road` 4.265 s, `road_head` 4.210 s, and `ceo` 4.215 s; the pooled 36-request warm median was 4.300 s. For the directly comparable `gm` series, the request changed from 14.625 s originally to 5.477 s after semantic memoization and **4.650 s** after the explicit context.

The nine warm `gm` server profiles have these medians:

- DB interval-union wall time: 2.318 s
- connection-acquisition interval union: 0.160 s
- query interval union: 2.175 s
- server render: 3.161 s
- non-DB server interval: **0.843 s**

Relative to the original 9.983-second non-DB estimate, request-local server calculation fell by about 91.6%. Relative to pass 1's 1.894 seconds it fell by about 55.5%. The remaining response time is dominated by the cross-region PostgreSQL query/row-transfer wall time rather than duplicate application materialization.

### Intermediate contract gate

The released comparison date remained `2026-09-26`; current-date output was not used to redefine the golden. The targeted Preview gate fetched only the 37 pages needed for the agreed 159 metrics, not the full 137-page regression. It passed HTTP 37/37, metrics 159/159 with value mismatch 0 and missing/extra 0/0, and calculation crosscheck 68/68.

Five calculation JSON payloads (`01` through `05`) were regenerated from the same frozen inputs and were byte-identical to the published files. The sixth calculation check compared `CheckFlag[]` for `gm`, `road`, `road_head`, and `ceo`: every role returned 30 rows and the same canonical SHA-256 as its published CSV calculation. Direct old-versus-context comparison of all nine round cell maps also had mismatch 0. TypeScript checking and the Next.js production build passed.

The verification-only branch clock was removed after the gate. Production remains `csv`; no WRITE, DB schema/data, golden, UI, role, or released data changes were made. This pass completes the `/actions` server-calculation target only. Common PostgreSQL overhead and the full five-route performance gate remain separate next steps before any Production READ cutover.
