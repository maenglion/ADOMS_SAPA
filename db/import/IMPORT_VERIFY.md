# ADOMS SAPA Baseline Import Verification

## Latest result

- Status: `FAILED_ROLLED_BACK_CONNECTION`
- PostgreSQL schema: `adoms2`
- Application transition: prohibited
- Baseline data committed: no
- Current physical rows: 0 across all 91 tables

The prior `audit_log.log_id` failure record is preserved in `IMPORT_VERIFY_FAILED_20260926.md` and `WORKLOG.md`.

## Identity audit and correction

The live Railway catalog contains one identity column.

| schema | table | column | generation | source values | classification | action |
|---|---|---|---|---:|---|---|
| `adoms2` | `audit_log` | `log_id` | `BY DEFAULT` | 0 / 241 | Database-generated surrogate key | Exclude from INSERT columns |

No `audit_log` seed CSV exists, none of the 241 `overlay.log` rows contains `log_id`, and no other source table references `audit_log.log_id`. The similarly named `usf_ceo_log.log_id` is a separate table's text business identifier and remains an ordinary INSERT column.

The importer now reads `is_identity` and `identity_generation` from `information_schema.columns`.

- No source value: exclude the identity column and let PostgreSQL generate it.
- Complete source values on `BY DEFAULT`: preserve and insert them.
- Partial source values: block import instead of inserting `NULL` or generating replacements.
- Source values on `ALWAYS`: block import until an explicit preservation rule is approved.

## Revised dry-run

| Check | Result |
|---|---:|
| target tables | 91 |
| seed rows | 24,668 |
| overlay INSERT rows | 354 |
| overlay PATCH rows | 49 |
| final expected rows | 25,022 |
| PK duplicate rows | 0 |
| source table mapping missing | 0 |
| tables with missing source columns | 0 |
| confirmed orphan excluded | 1 |
| provenance preserved | 1 |
| dry-run status | `READY` |

The dry-run identity output was:

```text
adoms2.audit_log.log_id | generation=BY DEFAULT | source_values=0/241 | action=EXCLUDE_FROM_INSERT
```

## Transaction retry

The retry passed the empty-database preflight and the live identity decision. It then lost the external database connection during the long-running batch load and verification process. There was no successful commit signal.

No retry optimization, partial commit, row repair, or manual data correction was attempted after the connection failure.

## Rollback verification after retry

A new direct database connection measured the state after the failure.

| Check | Actual | Expected | Result |
|---|---:|---:|---|
| physical tables | 91 | 91 | PASS |
| total rows | 0 | 0 | PASS |
| non-empty tables | 0 | 0 | PASS |
| identity columns | 1 | 1 | PASS |
| active foreign keys | 0 | 0 | unchanged |

The open transaction was rolled back when the connection ended. `import_verify.csv` continues to represent the 91-table rollback state with expected rows 25,022 and actual rows 0. Content checksums and overlay value verification are not successful-import evidence and remain unexecuted.

## Remaining condition

The baseline import must be retried from the verified empty database using a connection-safe loading approach. It is not complete until all 91 expected row counts, 91 canonical checksums, 354 overlay INSERT rows, 49 overlay PATCH records, 241 audit rows, four views, zero active FKs, and the excluded orphan rule pass before and after commit.

The deployed app still uses CSV + overlay mode.
