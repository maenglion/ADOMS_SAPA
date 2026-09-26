# ADOMS SAPA PostgreSQL Migration Decisions

## 1. 초안 범위

- 이 문서는 `db/migrations/0001_tables.sql`부터 `0003_views.sql`까지의 결정 근거다.
- SQL은 PostgreSQL `adoms2` 스키마 기준의 정적 초안이다. DB 접속, 실행, schema 생성, data 적재는 하지 않았다.
- 목표는 CSV/overlay 모드의 이름, 문자열 값, 빈 문자열, 병합 순서와 화면 출력을 바꾸지 않는 것이다.
- 1차 스키마는 호환성을 우선한다. 사용자 데이터 칼럼은 nullable `TEXT`로 두고, 실행 DDL 근거가 있는 `audit_log.log_id`만 identity `bigint`로 둔다.
- 기존 실행 DDL에서 확인된 PK 52개만 활성화했다. 신규 39개 표의 논리 키는 중복 검증 전에는 PK/UNIQUE로 강제하지 않는다.
- 근거가 확인된 FK 51개는 정확한 후보문으로 작성했지만 활성화하지 않았다. 현재 앱이 FK 칼럼에도 `""`를 쓰므로 활성 FK는 현재 의미를 바꾸고 신규 쓰기를 거부한다.

## 2. 91개 table 생성 근거

### 2.1 실행 가능한 기존 DDL의 표 52개

다음 표는 순차 실행 DDL에 실제 `CREATE TABLE` 근거와 PK 근거가 있다.

`action`, `annual_schedule`, `asset`, `asset_target_map`, `audit_log`, `ceo_activity`, `civil_manual`, `civil_safety_plan`, `compliance_task`, `contract`, `contract_compliance`, `contract_duty`, `contract_eval_item`, `contract_eval_score`, `contract_eval_setting`, `contract_hazard`, `contract_hazard_map`, `contract_mgmt_item`, `drill_eval`, `drill_plan`, `duty_assignment`, `duty_class`, `eval_criteria`, `evidence`, `form_template`, `hazard_code`, `hazard_report`, `hazard_step`, `incident`, `incident_nil_check`, `incident_report`, `incident_response`, `incident_response_setting`, `inspection`, `inspection_batch`, `law_change`, `material_item`, `notification`, `order_received`, `org_dept`, `risk_assessment`, `risk_assessment_item`, `safety_budget`, `safety_manual`, `safety_org_role`, `safety_policy`, `staff`, `system_record`, `training_check`, `training_course`, `training_record`, `worker_voice`.

칼럼은 실행 DDL/필드대장과 동결 데이터·코드 관측 칼럼의 합집합이다. 관측됐지만 누적 SQL에 없던 61개를 삭제하지 않았고, 필드대장에만 있던 93개도 nullable `TEXT`로 보존했다. 이 선택은 값 생성이나 의미 확정을 뜻하지 않는다.

### 2.2 신규 설계 표 39개

다음 표는 기존 SQL에는 없지만 현재 코드, seed 또는 overlay의 이름과 행 모양에 근거가 있다.

`budget_exec`, `civil_record`, `evidence_split`, `law_sync_applied`, `law_sync_decision`, `org_profile`, `sys_code`, `sys_mail_log`, `sys_menu`, `usa_order`, `usb1_basic`, `usb1_contract`, `usb1_contract_duty`, `usb1_hazard_place`, `usb1_transport`, `usb1_work_site`, `usb1_workplace`, `usb1_ws_mgmt`, `usb2_assign`, `usb2_basic`, `usb2_law`, `usb2_role`, `usb2_timing`, `usc_record`, `usd_record`, `use_plan`, `use_record`, `use_site`, `usf_ceo_activity`, `usf_ceo_log`, `usf_file`, `usf_judge`, `usf_letter`, `usf_letter_read`, `usf_notice`, `usf_round`, `usg_case`, `usg_stat_occur`, `usg_ws_industry`.

`civil_record`는 동적 행 생성 코드에서 확인된 29개 text 칼럼, `org_profile`은 기본값·필드 목록·저장 코드에서 확인된 18개 text 칼럼을 사용했다. 이 46개 중 `columns.csv`가 놓친 46개도 포함했다.

## 3. 제외 2개와 병합 1개

- `accident_case`: 앱 코드가 읽지 않고 동일한 32행을 `usg_case`가 담당하므로 생성하지 않는다.
- `accident_stat`: 앱 코드가 읽지 않고 동일한 166행을 `usg_stat_occur`가 담당하므로 생성하지 않는다.
- `task_approval_patch`: 독립 운영 표가 아니라 `compliance_task`의 결재 칼럼을 보충하는 seed 단계다. `task_id`로 `compliance_task`에 합치며 순서는 `compliance_task seed → task_approval_patch → overlay taskPatch`다. 이 표의 `head_ok_at`, `head_ok_by`를 포함한 칼럼은 `compliance_task`에 넣었다.

## 4. UNKNOWN 194개 처리

- 원본 인벤토리의 UNKNOWN 판정 194개는 모두 최종 형을 미확정으로 기록하고 1차 호환 형을 nullable `TEXT`로 결정했다.
- 물리 스키마에는 192개 UNKNOWN 칼럼이 만들어진다. 나머지 2개는 제외된 `accident_case.files`, `accident_stat.note`다. 같은 의미의 정본 칼럼 `usg_case.files`, `usg_stat_occur.note`도 각각 UNKNOWN→TEXT로 별도 포함되어 있다.
- 다음 목록은 원본 194개 전체다. 숫자·날짜·boolean·jsonb로 임의 변환하지 않는다.

- `accident_case` (1, 제외): `files`
- `accident_stat` (1, 제외): `note`
- `action` (1): `action_basis`
- `asset` (1): `deleted`
- `budget_exec` (9): `amount`, `budget_id`, `created_at`, `created_by`, `evidence_name`, `evidence_url`, `exec_date`, `exec_desc`, `exec_id`
- `ceo_activity` (3): `asset_id`, `follow_up_task_id`, `target_code`
- `civil_manual` (2): `evidence_name`, `evidence_url`
- `civil_record` (1): `action_done_at`
- `civil_safety_plan` (2): `confirm_proxy`, `confirmed_by`
- `compliance_task` (1): `remark`
- `contract` (7): `completed_at`, `contract_at`, `control_confirmed_at`, `control_confirmed_by`, `cost_settled`, `eval_detail`, `settled_at`
- `contract_compliance` (2): `checked_by`, `evidence_url`
- `contract_duty` (1): `evidence_id`
- `contract_eval_setting` (8): `pass_default`, `pass_fire`, `pass_general`, `pass_risk`, `set_at`, `set_by`, `setting_id`, `weights`
- `drill_plan` (1): `photos`
- `duty_assignment` (2): `decided_at`, `decided_by`
- `duty_class` (7): `retired`, `rev_at`, `rev_item`, `rev_note`, `rev_run`, `rev_state`, `rev_text`
- `evidence_split` (6): `act`, `at`, `by`, `file_name`, `pair_key`, `split_id`
- `form_template` (2): `file_docx`, `file_html`
- `hazard_report` (2): `photo_close`, `photo_wide`
- `incident` (3): `cause_evidence_url`, `done_evidence_url`, `plan_evidence_url`
- `incident_report` (1): `evidence_url`
- `incident_response` (1): `evidence_url`
- `incident_response_setting` (6): `first_report_limit_min`, `memo`, `note`, `set_at`, `set_by`, `set_id`
- `inspection_batch` (14): `approve_note`, `approved_at`, `n_bad`, `n_fix`, `n_ok`, `n_open`, `n_total`, `n_unsubmitted`, `open_kind`, `open_reason`, `requested_at`, `requested_by`, `return_reason`, `returned_at`
- `law_sync_decision` (8): `action`, `at`, `by`, `decision`, `duty_keys`, `item_id`, `note`, `run_id`
- `material_item` (4): `byeolpyo5`, `ceo_confirmed_at`, `ceo_confirmed_by`, `ceo_proxy`
- `order_received` (1): `basis_clause`
- `risk_assessment` (1): `note`
- `risk_assessment_item` (1): `note`
- `safety_budget` (2): `duty_key`, `target_code`
- `safety_org_role` (2): `evidence_url`, `last_eval_at`
- `staff` (1): `phone`
- `sys_code` (8): `at`, `by`, `code_id`, `note`, `set_id`, `sort`, `state`, `value`
- `sys_mail_log` (12): `at`, `error`, `from_staff_id`, `mail_id`, `msg_id`, `notif_type`, `status`, `subject`, `to_dept`, `to_email`, `to_name`, `to_staff_id`
- `sys_menu` (4): `at`, `by`, `data`, `menu_rid`
- `system_record` (3): `action_done_at`, `evidence_url`, `report_proxy`
- `training_check` (10): `area`, `check_id`, `checked_at`, `checked_by`, `half`, `method`, `note`, `period`, `proxy`, `summary`
- `training_record` (7): `done_by`, `duty_key`, `evidence_url`, `instruct_basis`, `instruct_due`, `instructed_at`, `instructed_by`
- `usb1_contract` (13): `asset_id`, `biz_no`, `completed_at`, `contract_at`, `control_confirmed_at`, `control_confirmed_by`, `cost_settled`, `eval_detail`, `note`, `place_codes`, `settled_at`, `vendor_manager`, `vendor_phone`
- `usb1_ws_mgmt` (4): `dept_id`, `state`, `updated_at`, `updated_by`
- `usb2_basic` (1): `deleted`
- `usc_record` (3): `block`, `seq`, `site_id`
- `use_record` (2): `deleted`, `updated_by`
- `usf_ceo_activity` (11): `activity_id`, `created_at`, `created_by`, `deleted`, `deleted_at`, `deleted_by`, `evidence_name`, `evidence_url`, `proxy`, `updated_at`, `updated_by`
- `usf_file` (1): `evidence_url`
- `usf_letter` (2): `evidence_name`, `evidence_url`
- `usf_notice` (2): `evidence_name`, `evidence_url`
- `usg_case` (3): `deleted_at`, `deleted_by`, `files`
- `usg_stat_occur` (3): `note`, `uploaded_by`, `uploaded_file`

## 5. 타입 충돌 33개 처리 결과

33개 모두 미해결 상태로 방치하지 않고 1차 형을 `TEXT`로 결정했다. 이는 최종 업무 형을 text로 확정했다는 뜻이 아니라 현재 앱의 문자열 계약을 보존하는 호환 결정이다. unresolved conflict는 0개다.

| 분류 | 칼럼 | 수 | 결정 근거 |
|---|---|---:|---|
| 날짜·식별 문자열 | `asset.completed_ymd`, `form_template.schedule_no`, `incident_report.seq`, `safety_manual.clause_no`, `safety_org_role.clause_no`, `safety_policy.clause_no`, `system_record.clause_no`, `safety_policy.fiscal_year`, `task_approval_patch.period_year`, `task_approval_patch.evidence_cnt` | 10 | 코드가 문자열 비교·표시·조합을 하며 `clause_no`에는 `M8-5` 같은 비숫자 값도 사용한다. 병합 대상 칼럼은 `compliance_task`에 TEXT로 반영했다. |
| 금액·크기·시간 | `contract.amount`, `contract.safety_cost`, `contract.cost_planned`, `evidence.file_size`, `safety_budget.planned_amount`, `safety_budget.executed_amount`, `system_record.budget_amount`, `training_record.hours` | 8 | 쓰기는 문자열 및 빈 문자열을 보내고 계산 시점에 `Number()`로 변환한다. `hours`는 소수 입력도 허용한다. |
| 날짜·일시 | `evidence.uploaded_at`, `incident_report.reported_at`, `incident_report.ceo_ack_at`, `incident_report.recorded_at`, `incident_response.done_at`, `incident_response.recorded_at`, `inspection_batch.started_at`, `law_change.notice_sent_at`, `notification.sent_at`, `notification.read_at`, `task_approval_patch.submitted_at`, `task_approval_patch.approved_at`, `task_approval_patch.rejected_at`, `task_approval_patch.created_at`, `task_approval_patch.plan_date` | 15 | 동결 값은 날짜와 공백 구분 일시가 섞여 있고 코드는 `slice`, `localeCompare`, 문자열 정렬을 사용한다. timestamptz 변환은 형과 시간대 및 출력 문자열을 바꾼다. 병합 대상 칼럼은 `compliance_task`에 TEXT로 반영했다. |

뷰에서 날짜 계산이 필요한 두 곳만 `NULLIF(value, '')::date`로 명시 변환한다. 저장 칼럼의 원문 문자열은 바꾸지 않는다.

## 6. FK 51개 근거와 활성화 보류

다음 51개는 순차 실행 DDL의 `REFERENCES`로 확인됐다. ERD가 추정으로 잘못 표시한 `staff→contract.manager_staff_id`와 ERD에서 빠진 `inspection_batch→inspection.batch_id`도 실제 추가 SQL에서 확인했다.

`inspection→action.insp_id`; `org_dept→asset.dept_id`; `asset→asset_target_map.asset_id`; `asset→ceo_activity.asset_id`; `org_dept→ceo_activity.dept_id`; `compliance_task→ceo_activity.follow_up_task_id`; `duty_assignment→compliance_task.assign_id`; `staff→compliance_task.done_by`; `asset→contract.asset_id`; `org_dept→contract.dept_id`; `staff→contract.manager_staff_id`; `contract→contract_compliance.contract_id`; `contract_mgmt_item→contract_compliance.item_no`; `contract→contract_duty.contract_id`; `duty_class→contract_duty.duty_key`; `contract→contract_hazard.contract_id`; `contract→contract_hazard_map.contract_id`; `hazard_code→contract_hazard_map.hazard_code`; `duty_class→duty_assignment.duty_key`; `asset→duty_assignment.asset_id`; `org_dept→duty_assignment.dept_id`; `staff→duty_assignment.owner_staff_id`; `staff→duty_assignment.deputy_staff_id`; `compliance_task→evidence.task_id`; `form_template→evidence.form_id`; `staff→evidence.uploaded_by`; `asset→incident.asset_id`; `org_dept→incident.dept_id`; `compliance_task→inspection.task_id`; `staff→inspection.inspector_staff_id`; `inspection_batch→inspection.batch_id`; `org_dept→inspection_batch.scope_dept_id`; `staff→notification.to_staff_id`; `compliance_task→notification.task_id`; `org_dept→order_received.dept_id`; `asset→order_received.asset_id`; `org_dept→risk_assessment.dept_id`; `staff→risk_assessment.assessor_staff_id`; `risk_assessment→risk_assessment_item.risk_id`; `staff→risk_assessment_item.owner_staff_id`; `org_dept→safety_budget.dept_id`; `duty_class→safety_budget.duty_key`; `staff→safety_manual.owner_staff_id`; `org_dept→safety_org_role.dept_id`; `staff→safety_org_role.staff_id`; `staff→safety_policy.owner_staff_id`; `org_dept→staff.dept_id`; `staff→training_record.staff_id`; `org_dept→training_record.dept_id`; `duty_class→training_record.duty_key`; `org_dept→worker_voice.dept_id`.

`0002_constraints.sql`에는 위 51개의 정확한 `ALTER TABLE ... FOREIGN KEY ... REFERENCES` 후보문만 있다. 모두 주석 상태다. 이유는 다음과 같다.

- 현재 CSV와 쓰기 코드는 “관계 없음”을 NULL이 아니라 `""`로 저장한다.
- PostgreSQL FK는 `""`를 값으로 보므로 부모 키 `""`가 없으면 적재와 신규 쓰기를 거부한다.
- `NOT VALID`도 기존 행 검증만 미룰 뿐 신규 `""` 쓰기는 거부하므로 호환 해결책이 아니다.
- 빈 문자열 정책과 orphan 실측이 끝난 뒤에만 후보를 활성화한다.

## 7. 보류한 이름 기반 관계 41개

다음 관계는 칼럼 이름만 같거나 접미사가 비슷하다는 근거뿐이므로 FK 후보 SQL도 만들지 않았다.

`action→notification.action_id`; `asset→civil_manual.asset_id`; `asset→civil_safety_plan.asset_id`; `asset→hazard_report.asset_id`; `asset→usb1_contract.asset_id`; `drill_plan→drill_eval.drill_id`; `evidence→contract_duty.evidence_id`; `hazard_report→hazard_step.hz_id`; `incident→incident_report.incident_id`; `incident→incident_response.incident_id`; `incident→order_received.related_incident_id`; `incident_response_setting→sys_code.set_id`; `inspection_batch→action.batch_id`; `inspection_batch→notification.batch_id`; `law_sync_applied→law_change.run_id`; `law_sync_applied→law_sync_decision.run_id`; `risk_assessment_item→safety_budget.risk_item_id`; `safety_budget→budget_exec.budget_id`; `staff→civil_manual.owner_staff_id`; `staff→civil_safety_plan.owner_staff_id`; `staff→incident.owner_staff_id`; `staff→incident_report.reporter_staff_id`; `staff→material_item.owner_staff_id`; `staff→notification.from_staff_id`; `staff→order_received.owner_staff_id`; `staff→sys_mail_log.from_staff_id`; `staff→sys_mail_log.to_staff_id`; `staff→system_record.checker_staff_id`; `staff→system_record.target_staff_id`; `staff→usa_order.from_staff_id`; `staff→usb1_contract.manager_staff_id`; `staff→usb2_assign.staff_id`; `staff→usb2_role.staff_id`; `staff→usf_letter_read.staff_id`; `staff→worker_voice.plan_owner_staff_id`; `staff→worker_voice.reviewer_staff_id`; `training_course→training_record.course_id`; `usb1_workplace→risk_assessment.wp_id`; `usb1_workplace→usb1_work_site.wp_id`; `usf_letter→usf_letter_read.letter_id`; `usf_round→usf_judge.round_id`.

## 8. NOT NULL, DEFAULT, UNIQUE 및 PK 결정

- 일반 칼럼에 새로운 `NOT NULL`, `DEFAULT`, `UNIQUE`, CHECK를 추가하지 않았다.
- 기존 순차 DDL의 52개 PK만 활성화했다. PK의 NOT NULL/UNIQUE 효과는 기존 DDL 근거가 있다.
- `audit_log.log_id`의 identity 생성은 기존 `bigserial primary key` 근거를 보존한 것이다.
- 신규 39개 표는 코드의 논리 키가 있어도 실제 중복 여부를 검증하기 전에는 PK/UNIQUE를 추가하지 않는다.
- `asset_target_map(asset_id, target_code)`와 `contract_hazard_map(hazard_id, hazard_code)`는 실행 DDL의 복합 PK를 유지한다.

## 9. 뷰 4개

DB 모드의 직접 호출 근거가 있는 `v_duty_todo`, `v_duty_detail`, `v_task_approval`, `v_contract_duty`만 만든다. 원본 view DDL의 출력 칼럼과 join은 유지했다. TEXT 저장으로 인해 날짜 연산이 필요한 두 식만 빈 문자열을 보존할 수 있도록 `NULLIF(..., '')::date`로 변경했다.

## 10. 아직 결정하지 않은 사항

- UNKNOWN 194개의 최종 PostgreSQL 업무 형
- 33개 충돌 칼럼을 향후 typed column으로 승격할지 여부
- FK 후보 51개의 빈 문자열 정책, orphan 결과, 활성화 시점
- 추정 관계 41개의 실제 업무 관계 및 FK 승격 여부
- 신규 39개 표의 PK/UNIQUE와 append-only 이력 표의 대리 키
- `contract_hazard_map` 복합 PK와 현재 단일 키 `patchRow` 사이의 쓰기 계약
- 61개 관측 전용 칼럼과 93개 필드대장 전용 칼럼의 장기 정본 여부
- 동적 호출 11곳의 전체 테이블/칼럼 집합 재검증
- audit overlay `{at, action, target, by, note}`를 `audit_log` 칼럼으로 바꾸는 적재 규칙
- seed와 overlay를 합치는 실제 load/upsert 순서, 페이지 나눔, 최신 행 정렬 키
- 필수 4개 외 기존 뷰 8개의 배포 여부

이 미결 사항은 현재 SQL을 DB에 실행하기 전에 별도 데이터 실측과 승인으로 닫아야 한다.

## 11. 정적 검증 결과

- `CREATE TABLE`: 91
- `CREATE OR REPLACE VIEW`: 4
- 활성 PK: 52
- 근거 확인 FK 후보문: 51
- 활성 FK: 0
- 원본 UNKNOWN 판정: 194
- 물리 스키마의 UNKNOWN→TEXT: 192
- 제외 표 소속 UNKNOWN: 2
- 타입 충돌: 33, 모두 1차 TEXT 결정
- unresolved type conflict: 0
- 객체 집합, 중복 칼럼, PK 칼럼, FK 후보의 양쪽 칼럼/부모 PK, 뷰 참조 칼럼, 괄호·따옴표·세미콜론, PostgreSQL 63바이트 constraint 이름 충돌을 검사했고 오류는 0개였다.
- PostgreSQL 서버 접속 또는 SQL 실행을 통한 검증은 하지 않았다.
