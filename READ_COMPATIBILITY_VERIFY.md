# PostgreSQL READ Compatibility Verification

## Scope

- Contract: the frozen CSV + overlay runtime output
- Preview backend under test: PostgreSQL
- Production backend: CSV, unchanged
- Database data/schema, UI, role logic, WRITE paths, and golden files: unchanged
- Stable mismatch entering this work: 28
- Time-dependent `/exec` raw differences: tracked separately

## Root-cause comparison

### 1. `/actions` — 2 stable differences

| Item | Golden / CSV runtime | PostgreSQL runtime before fix |
| --- | --- | --- |
| `ACT-000006.action_type` | `시정` | `보완` |

- READ path: `actionsByInsp()` -> `readTable("action", "action_id")`.
- CSV source: `us_v1.9_20260926/seed/action.csv`, then `.data/overlay.json` `patches.action.ACT-000006`.
- PostgreSQL source: `adoms2.action` through the frozen live READ-order contract.
- Filter: the existing inspection/action maps by `insp_id`; unchanged.
- Sort/limit: frozen action row order; full-table READ limit `100000`.
- Type/NULL conversion: no mismatch.
- Exact cause: the seed value is `보완`, while the overlay patch changes it to `시정`. The PostgreSQL import already contains the patched value, but the frozen READ-order contract contained a stale override that changed it back to `보완` on read.
- Minimal correction: change only the stale contract override to `시정`.

The request cache did not alter the `CheckFlag[]` result. Direct canonical SHA-256 comparison after the correction matched for all roles:

| Role | Rows | CSV SHA-256 | PostgreSQL SHA-256 | Result |
| --- | ---: | --- | --- | --- |
| `gm` | 30 | `5c5189aee2610e7b74c0474481a8b9b91b8657284ddb0efa80911682a0d07bc1` | same | PASS |
| `road` | 30 | `6ac23293335fcc8b592804ac4a917425b90ec17bfbeccff6bb4bc5d1cb3e41b3` | same | PASS |
| `road_head` | 30 | `cb83afe8c6ce0e41fd9c66df2642acdb4cafd596cc2f0b81aac3143d86c2ccfe` | same | PASS |
| `ceo` | 30 | `9f3621e11eb224931c1090031422a033a7bd7f54f16997f03f0e11186576bdc7` | same | PASS |

### 2. Dashboard workplace ordering — 6 stable differences

| Item | Golden / CSV runtime | PostgreSQL runtime before fix |
| --- | --- | --- |
| workplace row 1 / row 2 | `본청` / `의회` | `의회` / `본청` |

- READ path: `readTable("usb1_workplace", "wp_id")` used by the dashboard evidence merge.
- CSV source: `us_v1.5_20260924/seed/usb1_workplace.csv`; `WP-01` precedes `WP-02`.
- PostgreSQL source: `adoms2.usb1_workplace`.
- Filter: none for the displayed workplace list.
- Sort/limit: CSV file order is the contract; the page adds no sort and no relevant limit.
- Type/NULL conversion: no mismatch.
- Exact cause: the raw CSV order contract existed, but the keyed/live PostgreSQL path did not use it, so physical database row order leaked into the output for three roles and two displayed cells per role.
- Minimal correction: when `usb1_workplace` has no live overlay contract, reuse its raw frozen order contract. No PK or natural sort was introduced.

### 3. `/duties/list` approval count — 4 stable differences

| Item | Golden / CSV runtime | PostgreSQL runtime before fix |
| --- | --- | --- |
| list total / approved count | `6 / 2` | `6 / 151` |

- READ path: `/duties/list` -> `tasks()` -> `approval_status === "승인"`.
- CSV source: selected `compliance_task.csv` plus `.data/overlay.json` `taskPatch`.
- PostgreSQL source: `adoms2.compliance_task`.
- Filter: the existing role/department list filters and the exact `approval_status === "승인"` predicate; unchanged.
- Sort/limit: existing task order and page limit; not causal.
- Type/NULL conversion: empty/missing approval fields were not converted to `NULL`; not causal.
- Exact cause: the physical migration intentionally merged `task_approval_patch` into `compliance_task`. CSV `tasks()` does not read that table; it applies only two overlay approvals. PostgreSQL `tasks()` therefore exposed 149 approval-layer rows that belong to `approvals()`, producing `151` instead of `2`.
- Minimal correction: only the PostgreSQL `tasks()` UI read removes the approval-patch-only fields and reapplies `.data/overlay.json` `taskPatch`. `approvals()` still reads the merged physical approval layer, preserving its separate contract.

### 4. `/evidence` audit-log range/order — 16 stable differences

| Item | Golden / CSV runtime | PostgreSQL runtime before fix |
| --- | --- | --- |
| audit-log range | all 241 overlay rows | latest 100 rows |
| audit-log order | stored overlay array order | `changed_at DESC` |

- READ path: `/evidence` -> `activityLog()`.
- CSV source: `.data/overlay.json` `log`, 241 rows.
- PostgreSQL source: `adoms2.audit_log`.
- Filter: none.
- Sort/limit: CSV uses stored array order with no truncation. PostgreSQL used `ORDER BY changed_at DESC LIMIT 100`.
- Type/NULL conversion: `changed_at AS at` and `changed_by AS by` are correct and retained; no mismatch came from the aliases or empty values.
- Exact cause: range, ordering, and limit were changed in the PostgreSQL adapter even though the frozen page contract returns the full stored overlay sequence.
- Minimal correction: select all rows in imported sequence using `ORDER BY ctid`; retain only the existing aliases. No physical `at`/`by` columns were added.

## Verification

Targeted verification first covered the four affected routes for all four roles:

- HTTP: 16/16 successful
- Extracted values: 1,117/1,117
- Value mismatch: 0
- Expected-only / extra: 0 / 0
- Metrics: 68/68

The complete read-only Preview regression was then repeated against the same deployment:

| Check | Result |
| --- | ---: |
| HTTP 200 | 137 / 137 |
| Skipped write-causing GET combinations | 3 |
| Golden values | 7,373 / 7,373 |
| Expected-only / extra | 0 / 0 |
| Stable value mismatch | 0 |
| Key metrics | 159 / 159, mismatch 0 |
| Calculation crosscheck | 68 / 68 |
| Raw time-dependent `/exec` difference | 4 |

The four raw differences are the elapsed-hours cell on `/exec`, one per role. They changed from the frozen capture's `30.5시간` to the later request's `31.7시간`. They remain classified separately as time-dependent output and are not a stable READ compatibility mismatch. The golden was not modified.

## Decision

PostgreSQL READ stable compatibility mismatch is now `0`. Production remains on `ADOMS_DATA_BACKEND=csv`; this result does not by itself perform the cutover. The representative cold/warm performance gate remains a separate prerequisite before any Production switch.
