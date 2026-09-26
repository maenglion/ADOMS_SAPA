# ADOMS SAPA PostgreSQL Schema Audit

## 1. 범위와 결론

- 점검 기준일: 2026-09-26
- 점검 방식: 동결된 코드, CSV/overlay 인벤토리, 필드대장, ERD, 기존 SQL 전체를 정적으로 비교했다. PostgreSQL 접속, DDL/DML 실행, 앱 코드 변경은 하지 않았다.
- `tables.csv`의 98개는 **이관 입력 및 런타임 계약 인벤토리**로 유지한다. 구성은 표 94개와 앱이 직접 부르는 뷰 4개다.
- 기존 문서의 “기존 SQL 표 53개”는 `ops_cumulative.sql`의 선언을 센 값이다. 실제 순차 실행 파일에는 표 52개만 있으며, `task_approval_patch`는 누적 파일에만 있다.
- 정본 PostgreSQL 물리 목표는 **표 91개 + 뷰 4개 = 95개 객체**로 결정한다.
  - 실행 가능한 기존 표 52개를 유지한다.
  - SQL에 없는 41개 중 `accident_case`, `accident_stat` 2개는 각각 `usg_case`, `usg_stat_occur`의 중복 원천이므로 이관하지 않는다.
  - 나머지 신규 표 39개를 설계 대상으로 둔다.
  - `task_approval_patch`는 독립 운영 표로 만들지 않고 `compliance_task`에 합친다. 합성 순서는 seed → `task_approval_patch` → overlay `taskPatch`다.
  - 앱이 DB 모드에서 직접 부르는 뷰 4개를 만든다.
- 아직 형을 확정할 근거가 없는 194개 칸은 `UNKNOWN`이다. 이름만 보고 PostgreSQL 형을 정하지 않는다.
- 이 문서는 migration SQL이 아니다. `schema_matrix.csv`의 `canonical_decision`은 다음 설계 단계의 결정/보류 상태를 나타낸다.

## 2. 정본 우선순위

최신 날짜가 아니라 “현재 화면 결과를 재현하는 증거력”을 기준으로 다음 순서를 적용한다.

1. **현재 코드의 읽기·쓰기·병합 규칙과 `db_calls.csv`**: 실제 화면이 요구하는 객체, 키, 최신 행 선택, overlay 우선순위를 결정한다.
2. **동결된 seed CSV와 `.data/overlay.json`의 실제 헤더·값**: 현재 결과에 존재하는 칸, 빈 문자열/값 모양, 실제 사용 형을 결정한다.
3. **순차 실행 DDL**: `01_schema.sql` → `ops_v0.2_add.sql` → `ops_v03_v04_add.sql` → `ops_v05_add.sql` → `ops_v06_add.sql` → `ops_v07_add.sql` → `ops_v08_add.sql`. 기존 52개 표의 PK/FK/default/check와 형에 대한 실행 정본이다.
4. **뷰 DDL**: `02_views.sql`과 추가 SQL의 view 정의. 기초 표/칼럼을 위 1~3단계와 맞춘 뒤 적용한다.
5. **20260922 필드대장**: 업무 뜻과 과거 설계 칸을 설명하는 보조 정본이다. 실제 데이터에 없는 93개 칸은 자동 채택하지 않고 코드 필요성과 적재 원천을 확인한다.
6. **`columns.csv`, `tables.csv`**: 여러 원천을 합친 유용한 감사 인덱스이나 자동 생성 결과이므로 원천과 대조한다.
7. **`ops_cumulative.sql`**: 칼럼 합집합 인벤토리로만 사용한다. 실행 DDL 정본으로 사용하지 않는다.
8. **`ERD.mmd`**: 관계 후보 인덱스다. “추정” 선은 FK가 아니며 실제 순차 DDL과 다시 대조한다.

`ops_cumulative.sql`은 칼럼 선언 뒤의 `--`가 쉼표까지 주석으로 만들어 열 사이 구분이 사라진다. 일부 default/check도 값이나 닫는 구문이 주석에 들어가며, `asset_target_map`의 복합 PK도 빠졌다. 따라서 파일을 그대로 실행할 수 없다.

## 3. 98개 표·뷰 인벤토리

### 3.1 순차 SQL로 실제 생성 가능한 표 52개

`action`, `annual_schedule`, `asset`, `asset_target_map`, `audit_log`, `ceo_activity`, `civil_manual`, `civil_safety_plan`, `compliance_task`, `contract`, `contract_compliance`, `contract_duty`, `contract_eval_item`, `contract_eval_score`, `contract_eval_setting`, `contract_hazard`, `contract_hazard_map`, `contract_mgmt_item`, `drill_eval`, `drill_plan`, `duty_assignment`, `duty_class`, `eval_criteria`, `evidence`, `form_template`, `hazard_code`, `hazard_report`, `hazard_step`, `incident`, `incident_nil_check`, `incident_report`, `incident_response`, `incident_response_setting`, `inspection`, `inspection_batch`, `law_change`, `material_item`, `notification`, `order_received`, `org_dept`, `risk_assessment`, `risk_assessment_item`, `safety_budget`, `safety_manual`, `safety_org_role`, `safety_policy`, `staff`, `system_record`, `training_check`, `training_course`, `training_record`, `worker_voice`.

`ops_cumulative.sql`은 여기에 `task_approval_patch`를 더해 53개라고 선언하지만, 이 표는 순차 SQL에 없고 누적 파일도 실행 불가다. 데이터 병합 규칙상 독립 운영 표가 아니라 `compliance_task`의 이관 입력이다.

### 3.2 기존 SQL의 뷰

기존 SQL 전체에는 뷰 12개가 있다.

- 앱이 DB 모드에서 직접 부르는 4개: `v_contract_duty`, `v_duty_detail`, `v_duty_todo`, `v_task_approval`
- 현재 98개 인벤토리에 포함되지 않은 8개: `v_asset_duty`, `v_ceo_activity`, `v_compliance_matrix`, `v_dept_progress`, `v_kpi_summary`, `v_law_tree`, `v_risk_overview`, `v_vendor`

뒤의 8개는 SQL로 생성 가능하지만 현재 `db_calls.csv`의 필수 계약은 아니다. 만들더라도 현재 앱 동일 결과의 선행조건으로 세지 않는다.

### 3.3 기존 SQL에 없다고 분류된 표 41개

`accident_case`, `accident_stat`, `budget_exec`, `civil_record`, `evidence_split`, `law_sync_applied`, `law_sync_decision`, `org_profile`, `sys_code`, `sys_mail_log`, `sys_menu`, `usa_order`, `usb1_basic`, `usb1_contract`, `usb1_contract_duty`, `usb1_hazard_place`, `usb1_transport`, `usb1_work_site`, `usb1_workplace`, `usb1_ws_mgmt`, `usb2_assign`, `usb2_basic`, `usb2_law`, `usb2_role`, `usb2_timing`, `usc_record`, `usd_record`, `use_plan`, `use_record`, `use_site`, `usf_ceo_activity`, `usf_ceo_log`, `usf_file`, `usf_judge`, `usf_letter`, `usf_letter_read`, `usf_notice`, `usf_round`, `usg_case`, `usg_stat_occur`, `usg_ws_industry`.

이 중 실제 신규 설계 대상은 39개다. `accident_case` 32행은 `usg_case` 32행, `accident_stat` 166행은 `usg_stat_occur` 166행과 중복되고 현재 코드가 앞의 두 표를 부르지 않으므로 이관 대상에서 제외한다.

## 4. 칼럼 비교

### 4.1 전체 수치

- `columns.csv`: 1,310개 표×칼럼 행
- 관측 형 분포: text 804, `UNKNOWN` 194, integer 112, date 107, text(Y/N) 42, timestamptz 31, jsonb 후보 18, numeric 1, date/timestamptz 혼재 1
- 누적 SQL 칼럼 인벤토리에 없는 관측 칼럼: 15개 기존 표의 61개
- 관측 인벤토리에 없고 20260922 필드대장에만 있는 칼럼: 14개 표의 93개
- 양쪽에 있으나 정규화한 형이 다른 칼럼: 16개 표의 33개
- SQL이 없는 41개 표에 `columns.csv`가 수집한 칼럼은 438개다. 그중 빈 표/값 없음에서 나온 형은 `UNKNOWN`으로 유지한다.

자동 수집이 동적 객체 전개를 놓친 예외도 확인됐다.

- `civil_record`: `columns.csv`에는 `record_id` 1개만 있으나 `addCivil()`의 고정 행 모양에는 29개 text 칼럼이 명시돼 있다. 추가로 확인된 28개는 `clause_ref`, `record_kind`, `title`, `target_ref`, `asset_id`, `facility_name`, `plan_year`, `done_at`, `half`, `checker_staff_id`, `r1`, `r2`, `r3`, `r4`, `covers`, `content`, `action_kind`, `action_needed`, `action_due`, `action_done_at`, `evidence_name`, `evidence_url`, `ceo_reported`, `reported_at`, `report_method`, `report_proxy`, `created_by`, `note`다.
- `org_profile`: `columns.csv`에는 칼럼이 없지만 `ORG_DEFAULT`, `ORG_FIELDS`, 저장 코드에서 18개 text 칼럼이 확인된다. `org_id`, `org_name`, `org_type`, `ceo_title`, `disaster_agency`, `sapa_scope`, `hq_addr`, `hq_built`, `hq_floors`, `hq_gfa`, `hq_site`, `hq_annex`, `area_km2`, `population`, `districts`, `phone`, `updated_at`, `updated_by`다.

따라서 신규 41개 표의 칼럼 정본을 `columns.csv` 438개로 닫을 수 없다. 위 46개 코드 확인 칼럼을 더하고, `_analyze_summary.json`의 동적 호출 11곳을 migration 설계 때 다시 펼쳐 확인해야 한다. 여기서 text는 코드의 `Record<string, string>` 계약으로 확인된 것이며 이름으로 추정한 형이 아니다.

### 4.2 관측됐지만 누적 SQL 인벤토리에 없는 61개

- `asset` (12): `consign`, `consign_note`, `deleted`, `mgmt_class`, `mgmt_laws`, `res_dam_height`, `res_emergency_plan`, `res_storage_k`, `subject_name`, `subject_note`, `subject_source`, `subject_tier`
- `civil_manual` (2): `evidence_name`, `evidence_url`
- `compliance_task` (8): `approval_status`, `approved_at`, `approved_by`, `check_result`, `reject_reason`, `rejected_at`, `submitted_at`, `submitted_by`
- `contract_compliance` (1): `evidence_url`
- `duty_class` (7): `retired`, `rev_at`, `rev_item`, `rev_note`, `rev_run`, `rev_state`, `rev_text`
- `incident` (3): `cause_evidence_url`, `done_evidence_url`, `plan_evidence_url`
- `law_change` (7): `changed_units`, `human_items`, `new_mst`, `new_units`, `removed_units`, `run_id`, `status`
- `org_dept` (5): `duties`, `org_path`, `related_note`, `unit_kind`, `web_checked`
- `risk_assessment` (4): `kind`, `source`, `targets`, `wp_id`
- `risk_assessment_item` (5): `current_measure`, `freq`, `residual_level`, `score`, `sev`
- `safety_org_role` (1): `evidence_url`
- `staff` (2): `approval_level`, `position`
- `system_record` (1): `evidence_url`
- `task_approval_patch` (2): `head_ok_at`, `head_ok_by`
- `training_record` (1): `evidence_url`

이 목록은 삭제 후보가 아니다. 현재 결과를 재현하려면 실제 데이터와 코드 사용 여부를 우선해 정본 스키마에 수용하거나 명시적으로 병합해야 한다.

### 4.3 20260922 필드대장에만 있는 93개

- `action` (11): `approval_status`, `approved_at`, `approved_by`, `created_at`, `created_by`, `reject_reason`, `rejected_at`, `rejudged_insp_id`, `submitted_at`, `submitted_by`, `updated_at`
- `audit_log` (9): `action`, `after_json`, `before_json`, `changed_at`, `changed_by`, `log_id`, `note`, `row_key`, `table_name`
- `ceo_activity` (2): `created_at`, `evidence_file`
- `compliance_task` (10): `created_at`, `created_by`, `entered_in_demo`, `evidence_cnt`, `half_year`, `period_year`, `plan_date`, `resubmit_note`, `resubmit_round`, `updated_at`
- `contract` (2): `created_at`, `updated_at`
- `contract_eval_score` (20): `contract_id`, `eval_date`, `evaluated_by`, `note`, `p1`, `p2`, `p3`, `p4`, `p5`, `p6`, `p7`, `p8`, `p9`, `p10`, `pass_mark`, `result`, `score_id`, `total`, `weights`, `work_risk`
- `duty_assignment` (3): `created_at`, `plan_input_type`, `updated_at`
- `duty_class` (2): `sapa_clause`, `sapa_clause_name`
- `evidence` (12): `approval_status`, `approved_at`, `approved_by`, `created_at`, `created_by`, `entered_in_demo`, `mime_type`, `reject_reason`, `rejected_at`, `submitted_at`, `submitted_by`, `updated_at`
- `incident` (2): `history`, `reopen_count`
- `inspection` (11): `approval_status`, `approved_at`, `approved_by`, `batch_id`, `created_at`, `created_by`, `reject_reason`, `rejected_at`, `submitted_at`, `submitted_by`, `updated_at`
- `inspection_batch` (7): `insp_method`, `outsource_org`, `report_proxy`, `report_received_at`, `report_received_by`, `report_recorded_by`, `rule_basis`
- `risk_assessment` (1): `created_at`
- `worker_voice` (1): `report_proxy`

합계 93개다. 이 중 상당수는 순차 DDL에는 있으나 동결 데이터/코드 쓰기 객체에서 관측되지 않은 설계 칼럼이다. 따라서 “누락 데이터”와 “불필요 칼럼” 중 어느 쪽인지 적재 전 확인해야 하며, 필드대장만으로 값을 만들어 넣지 않는다.

### 4.4 칼럼명/의미 충돌

- 감사 로그 overlay는 `{at, action, target, by, note}`이고 DDL은 `{log_id, table_name, row_key, action, before_json, after_json, changed_by, changed_at, note}`다. `at↔changed_at`, `by↔changed_by`, `target↔table_name/row_key` 변환 규칙이 필요하다. README의 `actor` 설명은 실제 DDL과 맞지 않는다.
- `task_approval_patch`의 관측 `head_ok_at`, `head_ok_by`는 누적 선언에 없고, 누적 선언 자체에는 PK가 없다. 이 두 칼럼을 포함해 `compliance_task`로 합쳐야 한다.
- `incident`의 관측 `*_evidence_url`과 DDL의 `*_evidence`는 같은 의미인지 확인 전에는 서로 이름을 바꾸거나 합치지 않는다.
- `contract_compliance`, `civil_manual`, `safety_org_role`, `system_record`, `training_record`의 `evidence_url`은 관측됐지만 DDL에 없다. 파일 이름/URL 칼럼과 의미가 다를 수 있으므로 별도 칼럼으로 보존한다.
- `duty_class`의 `rev_*`/`retired`는 법령 동기화 및 숨김 동작에 쓰이는 관측 칼럼이고, 필드대장의 `sapa_clause*`는 별도 설계 칼럼이다. 한쪽을 다른 쪽의 별칭으로 간주하지 않는다.

### 4.5 형 충돌 33개

| 표 | 칼럼 | 관측 형 | DDL 형 |
|---|---|---:|---:|
| asset | completed_ymd | integer | text |
| contract | amount, safety_cost, cost_planned | integer | bigint |
| evidence | uploaded_at | date | timestamptz |
| evidence | file_size | integer | bigint |
| form_template | schedule_no | integer | text |
| incident_report | seq | integer | text |
| incident_report | reported_at, ceo_ack_at, recorded_at | timestamptz | text |
| incident_response | done_at, recorded_at | timestamptz | text |
| inspection_batch | started_at | date | timestamptz |
| law_change | notice_sent_at | date | timestamptz |
| notification | sent_at, read_at | date | timestamptz |
| safety_budget | planned_amount, executed_amount | integer | bigint |
| safety_manual | clause_no | integer | text |
| safety_org_role | clause_no | integer | text |
| safety_policy | clause_no, fiscal_year | integer | text |
| system_record | clause_no | integer | text |
| system_record | budget_amount | integer | bigint |
| task_approval_patch | submitted_at, approved_at, rejected_at, created_at, plan_date | date | text |
| task_approval_patch | period_year, evidence_cnt | integer | text |
| training_record | hours | integer | numeric |

`integer→bigint/numeric`은 범위 확장이지만 직렬화 모양을 확인한다. `text↔integer`, `text↔date/timestamptz`, `date↔timestamptz`는 현재 문자열 비교·표시·정렬과 시간대에 영향을 주므로 자동 변환하지 않는다.

## 5. PK/FK 비교

### 5.1 PK 충돌과 미확정 항목

- `asset_target_map`: `01_schema.sql`의 정본은 `(asset_id, target_code)` 복합 PK다. 누적 SQL은 이를 잃었지만 `tables.csv`의 키는 복합키를 보존했다.
- `contract_hazard_map`: 실행 DDL은 `(hazard_id, hazard_code)` 복합 PK인데 `tables.csv`의 코드 키는 `hazard_id` 하나다. 한 hazard에 여러 code가 있으면 단일 키 `patchRow`가 모호하므로 DB 쓰기 전 해결해야 한다.
- `audit_log`: 실행 DDL은 `log_id bigserial` PK지만 현재 overlay 로그 행에는 `log_id`가 없다. 적재 시 DB가 생성해야 한다.
- `contract_eval_score`: DDL에는 `score_id` PK가 있으나 현재 관측 행이 없어 값 규칙을 검증하지 못했다.
- `task_approval_patch`: 누적 선언에 PK가 없고 순차 DDL에도 표가 없다. `task_id`는 병합 키이지 독립 표 PK 정본이 아니다.
- `sys_code`는 같은 `code_id`, `sys_menu`는 같은 `menu_rid='ALL'`가 여러 줄 존재하는 append-only 이력이다. 논리 ID를 PK로 쓰지 말고 대리 PK/순서 칼럼이 필요하지만 그 형은 아직 `UNKNOWN`이다.
- SQL이 없는 표의 `tables.csv` 키는 코드의 `readTable`/`patchRow` 사용 또는 첫 칸에서 얻은 논리 키다. 실제 PK/UNIQUE 제약으로 확정된 것이 아니다.

### 5.2 관계 91개의 재분류

ERD는 49개를 DDL, 42개를 이름 추정으로 기록했지만 전체 순차 SQL과 대조하면 정확한 분리는 **91개 중 DDL 확인 50개, 이름 추정 41개**다. `staff → contract.manager_staff_id`는 ERD에서 추정으로 표시됐지만 `ops_v03_v04_add.sql`에 실제 `references staff(staff_id)`가 있다.

또한 순차 DDL에는 ERD 91개에 빠진 **`inspection_batch → inspection.batch_id`** FK가 1개 더 있다. 따라서 전체 SQL의 확인된 FK는 51개이며, ERD 자체의 총 관계 후보는 91개다.

#### DDL로 확인된 50개(ERD 91개 안)

`inspection→action.insp_id`; `org_dept→asset.dept_id`; `asset→asset_target_map.asset_id`; `asset→ceo_activity.asset_id`; `org_dept→ceo_activity.dept_id`; `compliance_task→ceo_activity.follow_up_task_id`; `duty_assignment→compliance_task.assign_id`; `staff→compliance_task.done_by`; `asset→contract.asset_id`; `org_dept→contract.dept_id`; `staff→contract.manager_staff_id`; `contract→contract_compliance.contract_id`; `contract_mgmt_item→contract_compliance.item_no`; `contract→contract_duty.contract_id`; `duty_class→contract_duty.duty_key`; `contract→contract_hazard.contract_id`; `contract→contract_hazard_map.contract_id`; `hazard_code→contract_hazard_map.hazard_code`; `duty_class→duty_assignment.duty_key`; `asset→duty_assignment.asset_id`; `org_dept→duty_assignment.dept_id`; `staff→duty_assignment.owner_staff_id`; `staff→duty_assignment.deputy_staff_id`; `compliance_task→evidence.task_id`; `form_template→evidence.form_id`; `staff→evidence.uploaded_by`; `asset→incident.asset_id`; `org_dept→incident.dept_id`; `compliance_task→inspection.task_id`; `staff→inspection.inspector_staff_id`; `org_dept→inspection_batch.scope_dept_id`; `staff→notification.to_staff_id`; `compliance_task→notification.task_id`; `org_dept→order_received.dept_id`; `asset→order_received.asset_id`; `org_dept→risk_assessment.dept_id`; `staff→risk_assessment.assessor_staff_id`; `risk_assessment→risk_assessment_item.risk_id`; `staff→risk_assessment_item.owner_staff_id`; `org_dept→safety_budget.dept_id`; `duty_class→safety_budget.duty_key`; `staff→safety_manual.owner_staff_id`; `org_dept→safety_org_role.dept_id`; `staff→safety_org_role.staff_id`; `staff→safety_policy.owner_staff_id`; `org_dept→staff.dept_id`; `staff→training_record.staff_id`; `org_dept→training_record.dept_id`; `duty_class→training_record.duty_key`; `org_dept→worker_voice.dept_id`.

#### 이름으로만 추정된 41개

`action→notification.action_id`; `asset→civil_manual.asset_id`; `asset→civil_safety_plan.asset_id`; `asset→hazard_report.asset_id`; `asset→usb1_contract.asset_id`; `drill_plan→drill_eval.drill_id`; `evidence→contract_duty.evidence_id`; `hazard_report→hazard_step.hz_id`; `incident→incident_report.incident_id`; `incident→incident_response.incident_id`; `incident→order_received.related_incident_id`; `incident_response_setting→sys_code.set_id`; `inspection_batch→action.batch_id`; `inspection_batch→notification.batch_id`; `law_sync_applied→law_change.run_id`; `law_sync_applied→law_sync_decision.run_id`; `risk_assessment_item→safety_budget.risk_item_id`; `safety_budget→budget_exec.budget_id`; `staff→civil_manual.owner_staff_id`; `staff→civil_safety_plan.owner_staff_id`; `staff→incident.owner_staff_id`; `staff→incident_report.reporter_staff_id`; `staff→material_item.owner_staff_id`; `staff→notification.from_staff_id`; `staff→order_received.owner_staff_id`; `staff→sys_mail_log.from_staff_id`; `staff→sys_mail_log.to_staff_id`; `staff→system_record.checker_staff_id`; `staff→system_record.target_staff_id`; `staff→usa_order.from_staff_id`; `staff→usb1_contract.manager_staff_id`; `staff→usb2_assign.staff_id`; `staff→usb2_role.staff_id`; `staff→usf_letter_read.staff_id`; `staff→worker_voice.plan_owner_staff_id`; `staff→worker_voice.reviewer_staff_id`; `training_course→training_record.course_id`; `usb1_workplace→risk_assessment.wp_id`; `usb1_workplace→usb1_work_site.wp_id`; `usf_letter→usf_letter_read.letter_id`; `usf_round→usf_judge.round_id`.

추정 관계는 적재 데이터의 orphan/다중값을 검사하기 전에는 FK로 승격하지 않는다.

## 6. CSV 모드와 PostgreSQL 모드의 동일 결과 조건

- **빈 값**: CSV 파서는 빈 셀을 `""`로 만든다. PostgreSQL import/PostgREST는 빈 값을 `NULL`로 만들거나 반환할 수 있다. 필터, `||` fallback, 문자열 비교 결과가 달라지므로 칼럼별 `""`/`NULL` 정책을 먼저 정해야 한다.
- **default**: DDL의 `now()`, `'작성중'`, `'진행중'`, `'N'`, `0`, `false`는 CSV에서 비어 있던 값을 새 값으로 만든다. 적재 중 default를 적용할지 원문 빈 값을 보존할지 구분한다.
- **Y/N**: 관측된 42개 Y/N 칼럼은 현재 문자열 비교를 사용한다. 코드 변경 없이 boolean으로 바꾸면 동일 결과가 깨진다. 기존 `entered_in_demo boolean`도 CSV 문자열과의 경계를 확인한다.
- **JSON**: `data`, `files` 등 18개 jsonb 후보 중 여러 소비자는 `JSON.parse(String(value))`를 쓴다. jsonb가 객체로 반환되면 `String(value)`가 `[object Object]`가 되어 파싱이 실패한다. 소비 코드가 객체를 처리하도록 바뀌기 전에는 JSON 문자열을 text로 보존하는 편이 현재 결과와 같다.
- **숫자**: ID, 조문 번호, 회차, 연도는 숫자처럼 보여도 선행 0, 빈 문자열, 문자열 정렬을 보존해야 할 수 있다. `UNKNOWN`이나 text를 값 이름만으로 integer로 바꾸지 않는다.
- **날짜/일시**: date는 시간대가 없고 timestamptz는 UTC 변환을 거친다. 현재 `YYYY-MM-DD` 문자열과 ISO 일시의 표시·정렬이 달라질 수 있다.
- **행 순서/최신값**: overlay `appendRow`는 새 행을 앞에 둔다. `sys_code`, `sys_menu`, `usf_judge` 등은 “처음/가장 최근 행이 승리” 규칙이 있다. PostgreSQL에는 명시적 `ORDER BY`와 안정적인 대리 순서 키가 필요하다.
- **병합/숨김**: `asset.deleted='Y'`, `duty_class.retired='Y'` 필터와 표별 overlay 우선순위를 SQL 조회에서도 그대로 재현해야 한다.
- **복합 키**: 현재 `patchRow`는 단일 키를 받는다. 복합 PK 표는 동일 행 선택 규칙을 별도로 맞춰야 한다.
- **페이지 제한**: 현재 DB 경로는 한 번에 `limit=5000`이며 PostgREST 서버 기본 상한에도 걸린다. `duty_class` 11,075행, `duty_assignment` 4,400행, `compliance_task`/`task_approval_patch` 2,465행, `evidence` 1,128행은 CSV 결과와 행 수가 달라질 수 있다.
- **감사 로그**: overlay 최근 300행 제한과 DB append-only 보존 정책은 결과가 다르다. 표시용 조회 범위와 보존 정책을 분리한다.

## 7. 자료별 충돌 요약과 다음 단계의 입력 계약

- `tables.csv`: 98개 계약과 병합/제외 메모의 정본. 단, “SQL 53”은 누적 선언 기준이므로 실행 가능 수 52와 구분한다.
- `columns.csv`: 현재 자동 수집된 칼럼과 194개 `UNKNOWN`의 정본. 동적 객체 전개를 놓친 `civil_record`/`org_profile` 예외가 있으므로 완전한 칼럼 목록으로 간주하지 않는다. 기존 SQL 타입 열은 누적 파일 인벤토리 기준이므로 실제 순차 DDL과 대조한다.
- `ERD.mmd`: 91개 후보를 보존하되 50/41로 재분류하고 누락된 `inspection.batch_id` FK를 별도 반영한다.
- `db_calls.csv`: DB 모드의 직접 호출은 32개이며, 4개 뷰가 필수다. `_analyze_summary.json`에 동적 호출 11곳이 미해결로 남아 있으므로 이 파일만으로 전체 호출을 증명하거나 98개 인벤토리를 축소하지 않는다.
- `README.md`: 병합 순서와 알려진 DB 모드 틈은 유효하다. 53/41/49/42 수치는 위 보정이 필요하고 감사 로그 `actor` 표기는 DDL의 `changed_by`와 충돌한다.
- 20260922 필드대장: 53개 기존 설계 표, 904개 칼럼의 업무 설명 자료다. 관측에 없는 93개 칼럼은 값 생성 없이 보류한다.
- `01_schema.sql` 및 추가 SQL: 기존 객체의 실행 정본이다. 파일 순서와 `alter table` 의존성을 유지해야 한다.
- `02_views.sql`: 6개 뷰, 추가 SQL: 6개 뷰를 제공한다. 현재 필수는 4개다.
- `03_load.sql`: v0.1의 일부 seed 순서만 설명하며 현재 95개 물리 목표의 전체 적재 계획이 아니다.
- `ops_cumulative.sql`: 합집합 목록 참고용이며 실행 금지다.

다음 단계에서 migration SQL을 만들 때는 `schema_matrix.csv`를 객체 체크리스트로 사용하되, `UNKNOWN` 해소, 61/93 칼럼 판정, 33개 형 충돌, 추정 FK orphan 검사, 빈 문자열/NULL 정책이 끝나기 전에는 스키마를 확정하지 않는다.
