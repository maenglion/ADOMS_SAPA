# PostgreSQL READ Cutover Verification

## Scope

- Baseline READ adapter commit: `749c298c33fc6e58faa727abe5f7dd130f968be9`
- Current UI contract: frozen CSV + overlay
- Target READ source: Railway PostgreSQL schema `adoms2`
- WRITE source: unchanged
- Database/schema/data changes: prohibited

## Netlify environment configuration

- Site: `adoms-runtime`
- Production: `ADOMS_DATA_BACKEND=csv`
- Deploy Preview / branch deploy: `ADOMS_DATA_BACKEND=postgres`
- `ADOMS_DATA_BACKEND` remains independent of `DATABASE_URL` presence.
- `DATABASE_URL` is stored as a server-side secret and its value is not recorded here.
- The first Preview deployment exposed that `DATABASE_URL` still resolved to the Railway private hostname, which Netlify could not resolve. The variable was corrected to the existing external PostgreSQL URI and the Preview was redeployed.
- No unrelated environment variable was changed.

## Preview deployment

- Branch: `read-cutover-preview`
- Branch URL: `https://read-cutover-preview--adoms-runtime.netlify.app/`
- Verified deploy permalink: `https://6ab7f37c98c1960008fe74f0--adoms-runtime.netlify.app/`
- Deploy commit: `13b0ca9`
- Deploy/build result: success
- Runtime backend: `postgres`
- Regression verification completed: 2026-09-27 01:44 KST

The corrected deployment rendered PostgreSQL-backed pages, but it did not satisfy the zero-mismatch cutover gate.

| Check | Result |
| --- | ---: |
| Attempted read-only golden requests | 137 |
| HTTP 200 | 133 |
| HTTP 504 | 4 |
| Skipped write-causing GET paths | 3 |
| Expected extracted values | 7,373 |
| Preview extracted values | 7,093 |
| Value mismatches | 178 |
| Expected-only values | 280 |
| Preview-only values | 0 |
| Key metric cases | 159 |
| Key metric value mismatches | 16 |
| Key metric missing / extra | 0 / 0 |

All four role variants of `/actions` returned HTTP 504 after about 30 seconds. Representative mismatches included:

- Management target total: `383 -> 26` for CEO, general manager, and road head; `255 -> 1` for road role.
- Facility/product split: `378 + 5 -> 21 + 5`; road role `255 + 0 -> 1 + 0`.
- Due-soon count: `1,340 -> 1,337`; road role `499 -> 497`.
- Overdue count: `185 -> 183`; road role `60 -> 59`.
- `/duties/list` approval count: `2 -> 151`.

`/evidence` returned the PostgreSQL adapter contract of the latest 100 audit rows. The older frozen HTML contains 241 audit rows, so that known contract change also appears in the full golden difference. It does not explain the other row-count and timeout failures.

## Production decision

- Production READ cutover: **not performed**
- Production backend: `csv`
- Production cutover time: none
- Rollback required: no; Production never left `csv`
- Prescribed rollback remains: set Production `ADOMS_DATA_BACKEND=csv` and redeploy.

The existing Production CSV deployment rendered without a server exception, but its smoke values were also not golden-equivalent: the observed general-manager dashboard showed management target `1`, due-soon `0`, overdue `0`, and completion `100%`. The deployed environment has no explicit frozen seed-root variable, while the code's default seed path is outside the application directory. This is recorded as a separate deployment-packaging/configuration issue; no code or environment correction was made in this cutover task.

## Database and write safety

- Railway `adoms2` physical row count was independently re-read after Preview verification: `25,022`.
- Baseline row count before verification: `25,022`.
- Row-count change: `0`.
- The three known write-causing GET paths were not requested.
- Application WRITE logic, upload/storage, schema, constraints, and source data were not changed.

## Conclusion

Preview deployment connectivity succeeded with the PostgreSQL READ backend, but regression verification failed. Production remains on CSV and must not be switched to PostgreSQL until the missing/extra/value/ordering/type/NULL contract counts are all zero and the `/actions` timeout is resolved. The existing Netlify CSV seed-path issue must also be resolved or explicitly incorporated into the deployment contract before a new cutover attempt.

## Remote CSV baseline restoration and same-environment A/B — 2026-09-27

The earlier PostgreSQL mismatch was not treated as conclusive until the Netlify CSV deployment baseline was restored. A branch deploy was built from `main` lineage with `ADOMS_DATA_BACKEND=csv`. Production remained unchanged and stayed on `csv` throughout.

### Deployment data root and seed selection

- Runtime backend: `csv`
- Root source: bundled frozen data
- Reported data root: `data/_데모_용인시_20260920`
- `ADOMS_OPS_DIR`: not set in the Preview runtime
- Runtime working directory: application root
- Selected source tables: 73
- Local/runtime selected source path mismatches: 0
- Local seed directories: 32; traced runtime directories: 30

`us_v1.3_20260924` and `ops_v1.4_20260924` are not present in the traced deploy artifact because none of their CSV files wins the table-by-table newest-file selection. Their absence changes no selected table source. The runtime and local selection maps agree for all 73 selected tables.

The first restoration deploy traced all 184 historical CSV files and failed while uploading the generated server function. The trace was narrowed to the 73 files selected by the existing `us_*` descending, then `ops_*` descending, first-file-per-table rule. The resulting deploy completed successfully without changing source data.

### CSV regression

| Check | Result |
| --- | ---: |
| Read-only GET responses | 137 / 137 HTTP 200 |
| `/actions` role responses | 4 / 4 HTTP 200 |
| Extracted golden values | 7,373 / 7,373 |
| Expected-only / extra | 0 / 0 |
| Key metrics | 159 / 159, mismatch 0 |
| Calculation crosscheck | 68 / 68 |
| Stable value mismatch | 0 |
| Raw time-dependent difference | 4 |

The four raw differences are the same `/exec` current elapsed-hours cell for the four roles. The frozen HTML was captured on 2026-09-26 at approximately 17:54 KST and contains `30.9시간`; the remote request was made at a later instant and rendered the current elapsed value. This is not a CSV source, role, ordering, or calculation mismatch. It is separated from the stable zero-mismatch gate and the golden file was not regenerated or edited.

The CSV `/actions` role requests returned in 3.60–3.82 seconds. Therefore the earlier `/actions` 504 is not a general Netlify route or deployment failure.

### Same-commit PostgreSQL A/B

The same commit and branch were redeployed with only `ADOMS_DATA_BACKEND` changed to `postgres`. Runtime diagnostics confirmed the PostgreSQL backend before the regression was run.

| Check | Result |
| --- | ---: |
| HTTP 200 / 504 | 133 / 4 |
| Extracted values | 7,149 / 7,373 |
| Raw / stable value mismatch | 30 / 26 |
| Expected-only / extra | 224 / 0 |
| Key metrics | 159 / 159, mismatch 0 |
| Calculation crosscheck | 68 / 68 |
| `/actions` | 4 / 4 HTTP 504, 30.37–31.16 seconds |

The 26 stable mismatches comprise audit-log range/order differences, dashboard row ordering differences, and approval-count differences. The 224 expected-only values are from the four `/actions` timeout bodies. PostgreSQL Preview is therefore not golden-equivalent.

Static execution-path accounting for `/actions` finds 270 PostgreSQL query calls with the frozen nine `usf_round` rows. `checkFlagged()` loops through three tracks and nine rounds; each `cellsOfRound()` rebuilds the same task, approval, inspection, action, staff, evidence, record, round, and judge data. This repeated full-table read pattern accounts for 248 calls inside `checkFlagged()` alone and is the classified PostgreSQL READ performance blocker. No optimization was performed in this task.

The requested five-route, ten-request cold/warm performance suite was not run because it is gated on a fully passing PostgreSQL Preview golden regression. Consequently per-route DB query duration and render timing are not reported as if they had been measured. The 137-request regression wall times were about 36.5 seconds for CSV and 120.1 seconds for PostgreSQL; these totals are batch-regression durations and are not user single-page latency measurements.

### Decision after A/B

- Production cutover remains blocked and was not performed.
- Production remains `ADOMS_DATA_BACKEND=csv`.
- The branch override was restored to `csv` after the failed PostgreSQL A/B. The final CSV redeploy completed at `https://6ab803642c4a38410876e2e3--adoms-runtime.netlify.app/`; runtime diagnostics reported backend `csv`, bundled data root, and 73 selected tables. A final cold `/actions` smoke returned HTTP 200 for all four roles.
- No database, schema, frozen CSV, overlay, WRITE path, golden file, or Production setting was changed.
- Detailed counters are recorded in `db/read-shadow/remote_csv_pg_ab.csv`.
