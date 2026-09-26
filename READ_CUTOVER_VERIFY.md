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

