# ADOMS SAPA Baseline Import Verification

## Result

- Status: `FAILED_ROLLED_BACK`
- PostgreSQL schema: `adoms2`
- Application transition: prohibited
- Seed/data import: not committed

## Stage 1 — 0004 import compatibility migration

`0004_import_compat.sql` was applied successfully in its own transaction.

| Check | Actual | Expected | Result |
|---|---:|---:|---|
| table | 91 | 91 | PASS |
| view | 4 | 4 | PASS |
| primary key | 52 | 52 | PASS |
| active foreign key | 0 | 0 | PASS |
| total rows after 0004 | 0 | 0 | PASS |
| `audit_log.target` | present | present | PASS |
| `audit_log.what` | present | present | PASS |

The table/view object set and PK/FK counts did not change outside the two intended nullable `TEXT` columns.

## Stage 2 — baseline import

The import transaction stopped on the first `audit_log` batch and was rolled back.

- PostgreSQL SQLSTATE: `23502` (`not_null_violation`)
- Failing column: `adoms2.audit_log.log_id`
- Failure: the importer supplied `NULL` for `log_id`.
- Catalog evidence: `log_id` is `NOT NULL`, `is_identity = YES`, `is_generated = NEVER`, and has no ordinary column default.
- Cause: the importer excluded only `is_generated = ALWAYS` columns from INSERT. PostgreSQL identity columns are reported separately through `is_identity`, so `log_id` was incorrectly included in the INSERT column list with a null value.

No schema or data was changed to bypass the error. The migration SQL, source CSV, `.data`, active FK state, and app code were not modified.

## Rollback verification

The database was queried directly after the failure.

| Check | Actual | Expected | Result |
|---|---:|---:|---|
| table | 91 | 91 | PASS |
| view | 4 | 4 | PASS |
| primary key | 52 | 52 | PASS |
| active foreign key | 0 | 0 | PASS |
| total rows | 0 | 0 | PASS |
| non-empty tables | 0 | 0 | PASS |

`import_verify.csv` records all 91 tables with their expected final row count and the post-rollback actual count of zero. Content checksums, overlay INSERT existence checks, and overlay PATCH value checks are marked `NOT_RUN` or zero because no import was committed.

## Required correction before retry

The importer must treat `information_schema.columns.is_identity = YES` as server-generated and omit that column from INSERT, just as it omits generated columns. This is an importer correction only; `0004_import_compat.sql` and the existing schema migrations do not need to change for this error.

After that correction, the full import must be retried from the verified empty database in one transaction and all requested per-table, overlay, orphan, audit-log, view, FK, and checksum checks must pass before application transition.

## Adapter transition condition

The deployed app still uses CSV + overlay mode. A future PostgreSQL adapter must return `changed_at` as `at` and `changed_by` as `by`, and reproduce the activity feed with `ORDER BY changed_at DESC LIMIT 100`. All 241 overlay audit rows remain an import requirement.

