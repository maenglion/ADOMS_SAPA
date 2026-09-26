# PostgreSQL READ Shadow Adapter Verification

## 결론

- 상태: PASS
- 실제 화면 backend: `csv`
- PostgreSQL 역할: READ 비교 대상이며 아직 live read source가 아니다.
- 전환 조건: frozen golden과 shadow mismatch가 모두 0일 때만 별도 작업에서 검토한다.

## 구현 범위

- `ADOMS_DATA_BACKEND` 허용값은 `csv`, `postgres`이며 미설정 기본값은 `csv`다.
- `DATABASE_URL` 존재만으로 PostgreSQL로 자동 전환하지 않는다.
- PostgreSQL 연결은 server-only singleton pool을 사용한다.
- table/view 식별자는 91개 table과 4개 view allowlist 안에서만 허용한다.
- 기존 CSV 반환 shape를 기준으로 field name, type, NULL/빈 문자열, filtering, ordering, limit을 맞춘다.
- `audit_log.changed_at`, `changed_by`는 READ adapter에서만 `at`, `by`로 alias하고 `changed_at DESC`, `LIMIT 100`을 적용한다.
- WRITE, upload/storage, schema, FK, UI는 변경하지 않았다.

## 비교 결과

| 항목 | 결과 |
|---|---:|
| exported READ functions | 30 |
| comparison cases | 77 |
| missing rows | 0 |
| extra rows | 0 |
| value mismatch | 0 |
| type mismatch | 0 |
| ordering mismatch | 0 |
| NULL / empty-string mismatch | 0 |
| total mismatch | 0 |

비교는 frozen CSV 계약에서 행별 실제 필드 집합, 값, 타입, NULL/빈 문자열 상태, 행 순서를 각각 canonical SHA-256 서명으로 고정한 뒤 Railway 내부 `DATABASE_URL`의 PostgreSQL 결과와 대조했다. DB schema에만 존재하고 CSV 행에는 없는 nullable field는 UI 반환 계약에 포함하지 않는다.

## Golden 검증

- 기준시점: `2026-09-26`, `Asia/Seoul`
- 주소/역할 범위: 35주소 × 4역할
- 보존 HTML: 137
- `golden_values.csv`: 7,373 lines
- key metrics: 159
- calculation crosscheck: 68 / 68
- 계산 JSON `01_dashboard`~`05_table_rows`: 5 / 5 byte-identical
- `00_meta.json`: today, year, overlay hash와 source 의미는 동일하다. 재검증 환경 경로와 기존 capture의 TZ 기록값만 환경 메타데이터 차이로 분리했다.

## Build

- TypeScript 정적 검사: PASS
- Next.js production build: PASS
- 기존 CSV 계산 golden: PASS
- PostgreSQL READ shadow: PASS

## 운영 상태

- Netlify 화면 source는 계속 CSV + overlay다.
- `ADOMS_DATA_BACKEND=postgres` 전환은 수행하지 않았다.
- Railway 일회성 검증 서비스는 restart policy `Never`를 유지하고 production branch 연결을 해제했다.
- PostgreSQL WRITE adapter는 아직 없다.

## 관련 산출물

- `db/read-shadow/read_adapter_compare.json`
- `db/read-shadow/read_adapter_compare.csv`
- `db/read-shadow/read_comparison_contract.json`
- `db/read-shadow/read_order_contract.json`
- `scripts/verify_read_shadow.mjs`
- `scripts/read_contract_snapshot.mjs`
