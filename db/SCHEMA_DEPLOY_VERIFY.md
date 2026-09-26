# Railway PostgreSQL Schema Deployment Verification

## 실행 결과

- 일자: 2026-09-26
- 상태: **적용 보류 — 연결 정보 형식 오류**
- migration 실행: 미실행
- transaction 시작: 미실행
- schema 변경: 없음
- seed/data import: 미실행

## 연결 사전검증

Netlify의 `DATABASE_URL` 설정 존재 여부와 값을 확인했다. 저장된 값은 PostgreSQL 연결 URI가 아니라 `host:port` 형식이며 다음 필수 요소가 없다.

- URI scheme (`postgres://` 또는 `postgresql://`)
- 사용자명
- 비밀번호
- 데이터베이스명

따라서 Railway PostgreSQL에 안전하게 접속할 수 없어 연결 확인 단계에서 중단했다. 잘못된 연결값으로 임의의 사용자명·비밀번호·데이터베이스명을 추정하지 않았다.

## Migration 적용 상태

아래 SQL은 모두 실행하지 않았다. 원본 migration 파일도 수정하지 않았다.

1. `db/migrations/0001_tables.sql` — 미실행
2. `db/migrations/0002_constraints.sql` — 미실행
3. `db/migrations/0003_views.sql` — 미실행

FK 후보 51개는 migration 원본의 비활성 상태 그대로다.

## 실측 검증

DB 연결이 성립하지 않아 다음 항목은 측정하지 않았다.

| 항목 | 기대값 | 실측값 |
|---|---:|---:|
| user table | 91 | 미측정 |
| view | 4 | 미측정 |
| primary key | 52 | 미측정 |
| 활성 foreign key | 0 | 미측정 |
| schema 이름 | `adoms2` | 미측정 |
| table별 column 수 | migration 정의와 일치 | 미측정 |
| 중복 table/view 이름 | 0 | 미측정 |
| view 참조 오류 | 0 | 미측정 |
| 데이터가 있는 table | 0 | 미측정 |

미측정 값을 성공으로 간주하지 않는다. Railway PostgreSQL의 schema 및 data 상태도 이번 작업에서는 확인되지 않았다.

## 수정 제안

Netlify의 `DATABASE_URL`을 Railway가 제공하는 완전한 PostgreSQL 연결 URI로 교체해야 한다. 형식은 아래 요소를 모두 포함해야 한다.

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Railway가 SSL 옵션을 요구하면 제공된 연결 문자열의 query parameter도 그대로 유지해야 한다. 수정 후에는 연결 확인부터 다시 시작하고, 세 migration을 한 세션의 단일 transaction 및 오류 즉시 중단 조건으로 실행한 뒤 DB catalog와 전 table row count를 직접 측정해야 한다.

---

## 재시도 1 — 2026-09-26

### 결과

- 상태: **적용 보류 — 연결 정보 형식 오류 재확인**
- 연결 확인: 실패
- migration 실행: 미실행
- transaction 시작: 미실행
- schema 변경: 없음
- seed/data import: 미실행

### 연결 사전검증

연결값 수정 통보 후 Netlify `adoms-runtime` 프로젝트의 Production `DATABASE_URL`을 다시 확인하고 페이지를 새로 불러온 뒤 재검증했다. 실제 저장값은 여전히 27자의 `host:port` 형식이었다.

다음 PostgreSQL URI 필수 요소가 확인되지 않았다.

- `postgres://` 또는 `postgresql://` scheme
- 사용자명
- 비밀번호
- `/DATABASE` 경로

표시 캐시 가능성을 배제하기 위해 새로 불러온 화면에서도 같은 결과를 확인했다. 따라서 연결 문자열을 임의 조합하지 않고 연결 사전검증 단계에서 즉시 중단했다.

### 적용 및 실측 상태

`0001_tables.sql`, `0002_constraints.sql`, `0003_views.sql`은 모두 실행하지 않았다. 기대값 TABLE 91, VIEW 4, PK 52, 활성 FK 0 및 전 table row count 0은 DB 접속 전 중단으로 모두 미측정이다. 미측정 값을 성공으로 처리하지 않는다.

이전 실패 기록과 수정 제안은 위에 그대로 보존한다. Netlify Production 환경변수에 Railway의 완전한 `DATABASE_PUBLIC_URL`이 실제 저장되었는지 다시 확인한 뒤 재시도해야 한다.

---

## 재시도 2 — 2026-09-26

### 결과

- 상태: **적용 및 실측 검증 완료**
- 연결 대상: Railway 외부 접속용 `DATABASE_PUBLIC_URL`
- database/user: `railway` / `postgres`
- 대상 schema: `adoms2`
- migration 실행: 완료
- seed/data import: 미실행

Netlify의 `DATABASE_URL`은 Railway 내부 전용 호스트를 사용하는 정상적인 내부 URI이므로 외부 실행 환경에서는 DNS 해석이 되지 않았다. 함께 설정된 외부 접속용 `DATABASE_PUBLIC_URL`을 사용해 연결했다. 비밀값은 문서에 기록하지 않았다.

### 적용 전 확인

- 사용자 객체 수: 0
- `adoms2` schema 존재 수: 0
- 판정: 빈 DB 조건 충족

### Migration 적용

아래 세 파일을 순서대로 한 PostgreSQL 세션의 단일 transaction과 오류 즉시 중단 조건으로 적용했다.

1. `db/migrations/0001_tables.sql`
2. `db/migrations/0002_constraints.sql`
3. `db/migrations/0003_views.sql`

세 파일 모두 오류 없이 완료되어 transaction이 commit됐다. migration 파일은 수정하지 않았고 FK 후보 51개도 비활성 상태를 유지했다.

### 최종 실측

| 항목 | 기대값 | 실측값 | 판정 |
|---|---:|---:|---|
| user table | 91 | 91 | 일치 |
| view | 4 | 4 | 일치 |
| primary key | 52 | 52 | 일치 |
| 활성 foreign key | 0 | 0 | 일치 |
| schema | `adoms2` | `adoms2` | 일치 |
| 중복 table/view 이름 | 0 | 0 | 일치 |
| 참조 오류가 있는 view | 0 | 0 | 일치 |
| 데이터가 있는 table | 0 | 0 | 일치 |
| 전체 table row 합계 | 0 | 0 | 일치 |

### View 참조 검증

각 view에 대해 실제 `SELECT * ... LIMIT 0`을 실행했다.

- `v_contract_duty`: 정상
- `v_duty_detail`: 정상
- `v_duty_todo`: 정상
- `v_task_approval`: 정상

### Table별 column 및 row 수

| table | columns | rows |
|---|---:|---:|
| action | 27 | 0 |
| annual_schedule | 11 | 0 |
| asset | 26 | 0 |
| asset_target_map | 4 | 0 |
| audit_log | 9 | 0 |
| budget_exec | 9 | 0 |
| ceo_activity | 16 | 0 |
| civil_manual | 19 | 0 |
| civil_record | 29 | 0 |
| civil_safety_plan | 23 | 0 |
| compliance_task | 28 | 0 |
| contract | 55 | 0 |
| contract_compliance | 11 | 0 |
| contract_duty | 7 | 0 |
| contract_eval_item | 14 | 0 |
| contract_eval_score | 20 | 0 |
| contract_eval_setting | 8 | 0 |
| contract_hazard | 6 | 0 |
| contract_hazard_map | 5 | 0 |
| contract_mgmt_item | 8 | 0 |
| drill_eval | 19 | 0 |
| drill_plan | 45 | 0 |
| duty_assignment | 18 | 0 |
| duty_class | 41 | 0 |
| eval_criteria | 8 | 0 |
| evidence | 23 | 0 |
| evidence_split | 6 | 0 |
| form_template | 10 | 0 |
| hazard_code | 4 | 0 |
| hazard_report | 49 | 0 |
| hazard_step | 7 | 0 |
| incident | 44 | 0 |
| incident_nil_check | 7 | 0 |
| incident_report | 24 | 0 |
| incident_response | 14 | 0 |
| incident_response_setting | 6 | 0 |
| inspection | 20 | 0 |
| inspection_batch | 33 | 0 |
| law_change | 16 | 0 |
| law_sync_applied | 6 | 0 |
| law_sync_decision | 8 | 0 |
| material_item | 18 | 0 |
| notification | 11 | 0 |
| order_received | 33 | 0 |
| org_dept | 9 | 0 |
| org_profile | 18 | 0 |
| risk_assessment | 17 | 0 |
| risk_assessment_item | 15 | 0 |
| safety_budget | 15 | 0 |
| safety_manual | 10 | 0 |
| safety_org_role | 15 | 0 |
| safety_policy | 13 | 0 |
| staff | 9 | 0 |
| sys_code | 8 | 0 |
| sys_mail_log | 12 | 0 |
| sys_menu | 4 | 0 |
| system_record | 28 | 0 |
| training_check | 10 | 0 |
| training_course | 12 | 0 |
| training_record | 20 | 0 |
| usa_order | 12 | 0 |
| usb1_basic | 16 | 0 |
| usb1_contract | 62 | 0 |
| usb1_contract_duty | 8 | 0 |
| usb1_hazard_place | 6 | 0 |
| usb1_transport | 9 | 0 |
| usb1_work_site | 9 | 0 |
| usb1_workplace | 16 | 0 |
| usb1_ws_mgmt | 4 | 0 |
| usb2_assign | 6 | 0 |
| usb2_basic | 15 | 0 |
| usb2_law | 14 | 0 |
| usb2_role | 8 | 0 |
| usb2_timing | 8 | 0 |
| usc_record | 17 | 0 |
| usd_record | 13 | 0 |
| use_plan | 5 | 0 |
| use_record | 13 | 0 |
| use_site | 5 | 0 |
| usf_ceo_activity | 11 | 0 |
| usf_ceo_log | 5 | 0 |
| usf_file | 9 | 0 |
| usf_judge | 11 | 0 |
| usf_letter | 12 | 0 |
| usf_letter_read | 5 | 0 |
| usf_notice | 8 | 0 |
| usf_round | 14 | 0 |
| usg_case | 14 | 0 |
| usg_stat_occur | 23 | 0 |
| usg_ws_industry | 3 | 0 |
| worker_voice | 22 | 0 |

실측용 임시 테이블의 첫 실행에서는 자동 commit과 `ON COMMIT DROP` 조합으로 임시 테이블이 다음 검증문 전에 제거됐다. 영구 DB 객체에는 영향이 없었으며, 세션 종료 시 제거되는 일반 임시 테이블로 재실행해 위 결과를 확인했다.
