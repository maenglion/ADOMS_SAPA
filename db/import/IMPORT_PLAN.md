# PostgreSQL Baseline Import Plan

## 상태

이 단계는 dry-run 전용이다. Railway PostgreSQL에는 연결하거나 데이터를 쓰지 않는다. 실제 INSERT 기능은 아직 구현하지 않았다.

## 정본 선택 규칙

`lib/data.ts`의 `opsDirs()`와 `seed(table)` 규칙을 그대로 사용한다.

1. `us_*` 디렉터리를 이름 내림차순으로 순회한다.
2. 그다음 `ops_*` 디렉터리를 이름 내림차순으로 순회한다.
3. 각 table은 위 순서에서 처음 발견되는 `{table}.csv` 하나만 선택한다.
4. 이전 판의 같은 table CSV는 누적하지 않는다.
5. CSV parser는 BOM, 따옴표, quoted newline과 빈 문자열을 `lib/data.ts`와 같은 방식으로 처리한다.
6. seed row에는 현재 화면이 적용하는 `scrubRow()`를 적용한다. 원본 CSV는 수정하지 않는다.

## 물리 대상

- `db/migrations/0001_tables.sql`의 91개 table만 대상으로 한다.
- 직전 DB 실측에서 Railway `adoms2`의 91개 table이 이 migration과 일치함을 확인했다. 이번 dry-run은 Railway에 재접속하지 않고 해당 migration을 실제 DB table 목록의 정적 기준으로 사용한다.
- `db/migrations/0004_import_compat.sql`의 `audit_log.target`, `audit_log.what` 추가를 적재 호환 목표에 포함한다. 이 migration은 아직 Railway에 실행하지 않았다.
- `accident_case`, `accident_stat`은 제외한다.
- `task_approval_patch`는 table로 만들지 않는다. `task_id`로 `compliance_task` seed에 먼저 병합한다.
- 그 뒤 `.data/overlay.json`의 `taskPatch`를 적용해 현재 승인 화면의 우선순위를 유지한다. 단, 삭제된 과거 업무로 확정된 `TSK-000782` patch는 운영 table에 적용하지 않고 provenance로 보존한다.
- PK는 `0002_constraints.sql`의 활성 PK 52개만 검사한다.
- FK 후보 51개는 계속 비활성 상태로 둔다.

## Overlay 적용 순서

1. `task_approval_patch` → `compliance_task`
2. `taskPatch` → `compliance_task`. `TSK-000782`는 확정 orphan으로 제외하고 원문을 provenance에 보존
3. `evidence` → `evidence` INSERT 후보
4. `inspection` → `inspection` INSERT 후보
5. `log` → `audit_log` INSERT 후보. 241행 전체를 `at→changed_at`, `by→changed_by`, `action→action`, `note→note`, `target→target`, `what→what`으로 매핑
6. `tables[table]` → 같은 table의 seed 앞에 INSERT 후보로 추가
7. `patches[table][key]` → 현재 코드가 `readTable(table, keyCol)`에 사용하는 key로 기존 row를 patch

Overlay patch가 가리키는 row가 없거나 key mapping을 확인할 수 없으면 임의로 새 row를 만들지 않고 dry-run을 차단한다. 예외는 원인과 처리 방식이 확정되고 provenance 원문 보존까지 검증된 `TSK-000782` 한 건뿐이다.

## 확정 provenance 처리

`db/import/migration_provenance.json`은 dry-run 때 원본 overlay에서 다시 생성한다. `TSK-000782` 한 건에 대해 다음을 보존한다.

- 원문 patch
- 원래 `task_id`
- overlay 기록 시점과 그 근거 필드
- 마지막 물리 존재 판과 마지막 유효 판
- 제거 확인 판
- 운영 import 제외 이유

원문 patch와 provenance의 `raw_patch`를 다시 비교해 값이 다르거나 기록 수가 1건이 아니면 dry-run을 차단한다.

## 감사 로그 매핑

- `changed_at`, `changed_by`를 canonical column으로 사용한다.
- `at`, `by` 중복 물리 column은 만들지 않는다.
- `target`, `what`은 `0004_import_compat.sql`로 독립 `TEXT` column을 추가한다.
- key가 실제로 존재하지 않는 1행의 `action`, `target`, `note`는 새 값을 만들지 않는다.
- 존재하는 `note=""`는 NULL로 바꾸지 않는다.
- 241행을 모두 적재 후보로 유지하며 100행 제한이나 화면 정렬은 import 단계에서 적용하지 않는다.
- DB adapter 전환 시에만 `changed_at→at`, `changed_by→by` alias와 기존 화면의 정렬/limit를 재현한다.

## 보존 원칙

- CSV의 `""`는 PostgreSQL `NULL`로 바꾸지 않는다.
- TEXT로 정한 값은 숫자, 날짜, boolean 또는 JSON 타입으로 정규화하지 않는다.
- 원본 CSV, `.data/overlay.json`, migration SQL과 앱 코드는 수정하지 않는다.
- source column이 대상 DB column에 없으면 버리지 않고 mapping gap으로 보고해 실제 적재를 차단한다.
- 활성 PK 중복이 있으면 순서나 최신값으로 임의 해결하지 않고 적재를 차단한다.

## Dry-run 실행

```powershell
node db/import/import_baseline.mjs --dry-run
```

필요하면 경로만 명시적으로 바꿀 수 있다.

```powershell
node db/import/import_baseline.mjs --dry-run `
  --data-root data/_데모_용인시_20260920 `
  --overlay .data/overlay.json `
  --manifest db/import/import_manifest.csv `
  --provenance db/import/migration_provenance.json
```

## Dry-run 차단 조건

- 활성 PK 중복
- 존재하지 않는 row를 가리키는 overlay patch
- application key를 확인할 수 없는 overlay patch
- DB에 없는 source/overlay table
- DB에 없는 source/overlay column
- `task_approval_patch` 자체의 중복 `task_id`
- 확정 orphan 제외 수와 provenance 원문 보존 수의 불일치
- overlay 감사로그의 미매핑 field 또는 원문 값 불일치

## 아직 수행하지 않는 것

- Railway PostgreSQL INSERT/COPY
- transaction 실행
- seed 또는 overlay 수정
- FK 활성화
- 앱의 CSV/DB 전환

## 2026-09-26 최초 dry-run 실측

| 항목 | 결과 |
|---|---:|
| 물리 대상 table | 91 |
| 선택된 seed 행 | 24,668 |
| overlay INSERT 후보 | 354 |
| 적용 가능한 overlay PATCH | 49 |
| 최종 예상 행 | 25,022 |
| 활성 PK 중복 | 0 |
| 대상 row가 없는 overlay patch | 1 |
| DB/source table mapping 누락 | 0 |
| source column이 DB에 없는 table | 1 |

Dry-run은 `BLOCKED`다. 다음 두 문제를 임의로 해석하지 않았다.

- `TSK-000782`: 최신 `compliance_task.csv`와 `task_approval_patch.csv`에는 없지만 `overlay.taskPatch`에는 남아 있다. `task_approval_patch` 2,465행은 모두 병합 가능하나 overlay `taskPatch` 13건 중 12건만 적용 가능하다.
- `audit_log`: 현재 화면의 overlay 행에는 `{at, action, target, by, note}`와 일부 행의 `what`이 있고 물리 table은 `{log_id, table_name, row_key, action, changed_by, changed_at, before_json, after_json, note}`다. `target`을 `table_name`과 `row_key` 중 어디에 둘지, `what`을 어디에 보존할지 결정할 근거가 없으므로 241행을 임의 변환하지 않는다.

기존 동결 분석의 seed 27,331행과 이번 24,668행의 차이는 정확히 2,663행이다. 이는 물리 이관에서 제외한 `accident_case` 32행과 `accident_stat` 166행, 독립 table이 아니라 `compliance_task`에 병합하는 `task_approval_patch` 2,465행의 합계다. 기존 분석의 overlay 추가 113행은 `overlay.log` 241행을 표 추가 행에서 제외한 수치다. 이번 INSERT 후보 354행은 그 113행에 감사 로그 241행을 포함한 값이다. 기존 overlay 수정 50건 중 1건은 최신 seed에 없는 `TSK-000782`를 가리켜 실제 적용 가능 수가 49건이다.

`db/import/import_manifest.csv`에는 91개 table별 선택 source CSV, seed/overlay/최종 행 수, PK 중복, 대상 column 누락과 차단 상태를 기록한다.

## 2026-09-26 확정 결정 반영 후 dry-run

| 항목 | 결과 |
|---|---:|
| 물리 대상 table | 91 |
| 선택된 seed 행 | 24,668 |
| overlay INSERT 후보 | 354 |
| 적용한 overlay PATCH | 49 |
| 확정 orphan 제외 | 1 |
| provenance 원문 보존 | 1 |
| 최종 예상 행 | 25,022 |
| audit log 무손실 mapping | 241 / 241 |
| 활성 PK 중복 | 0 |
| 미해결 overlay patch | 0 |
| DB/source table mapping 누락 | 0 |
| source column이 DB에 없는 table | 0 |

결과는 `READY`다. 이는 schema와 데이터 적재 계획에 대한 정적 dry-run 통과를 뜻한다. `0004_import_compat.sql` 실행과 Railway data INSERT는 아직 수행하지 않았다.
