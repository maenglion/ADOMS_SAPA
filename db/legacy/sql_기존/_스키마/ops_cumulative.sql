-- ADOMS 데모 2차 — 운영 DB 누적 DDL (자동 생성 2026-09-22)
-- 생성기 _build/export_schema.py · 손으로 고치지 않는다(다시 돌리면 덮어쓴다).
-- ★ 여기에는 v0.1~현재까지 **만들어진 칸 전부**가 들어 있다.
--   사용자가 지우라고 하기 전에는 어떤 칸도 빠지지 않는다(지시 2026-09-21).
create schema if not exists adoms2;
set search_path to adoms2, public;

-- action  (/actions, /budget, /calendar, /contracts, /drills, /drills/[id], /duties/[key], /evidence, /hazards, /hazards/[id], /inspections, /m, /recurrence, /review, /settings, /system, /system/record, /training)
create table if not exists action (
  action_id              text primary key-- 조치 번호 [v0.1],
  insp_id                text references inspection(insp_id)-- 점검 번호 [v0.1],
  action_type            text          -- 조치 구분(보완·시정) [v0.1],
  due_date               date          -- 기한 [v0.1],
  done_at                date          -- 이행 완료일 [v0.1],
  result                 text          -- 판정 결과 [v0.1],
  note                   text          -- 비고 [v0.1],
  approval_status        text          -- 결재 상태(작성중·제출·승인·반려) [v0.2],
  created_by             text          -- 만든 사람 [v0.2],
  submitted_at           timestamptz   -- 제출 일시 [v0.2],
  submitted_by           text          -- 제출한 사람 [v0.2],
  approved_at            timestamptz   -- 승인 일시 [v0.2],
  approved_by            text          -- 승인한 사람 [v0.2],
  rejected_at            timestamptz   -- 반려 일시 [v0.2],
  reject_reason          text          -- 반려 사유 [v0.2],
  created_at             timestamptz   -- 만든 일시 [v0.2],
  updated_at             timestamptz   -- 고친 일시 [v0.2],
  task_id                text          -- 과제 번호 [v0.5],
  batch_id               text          -- 점검 회차 번호 [v0.5],
  requested_by           text          -- 조치를 요구한 사람(점검자) [v0.5],
  requested_at           date          -- 조치 요구일 [v0.5],
  started_at             date          -- 시행일 [v0.5],
  resubmit_note          text          -- 보완 제출 때 부서가 적은 말 [v0.5],
  resubmitted_by         text          -- 보완 제출한 사람 [v0.5],
  rejudged_insp_id       text          -- 이 조치를 닫은(또는 되돌린) 재판정 [v0.5],
  action_basis           text          -- 조치 근거 조문(법정 조치 구분일 때 · 화면이 씀) [v0.7],
  prev_action_type       text          -- 바꾸기 전 조치 구분(화면이 씀) [v0.7]
);

-- annual_schedule  (/calendar)
create table if not exists annual_schedule (
  sched_id               text primary key-- 일정 번호 [v0.6],
  kind                   text          -- 일정 종류(서울시 운영 예시 등) [v0.6],
  title                  text          -- 제목 [v0.6],
  month_from             int           -- 시작 월 [v0.6],
  day_from               int           -- 시작 일 [v0.6],
  month_to               int           -- 끝 월 [v0.6],
  day_to                 int           -- 끝 일 [v0.6],
  basis                  text          -- 관련 조문(날짜는 법에 없음을 함께 적음) [v0.6],
  source                 text          -- 출처 자료(쪽·표 번호) [v0.6],
  href                   text          -- 이어지는 화면 주소 [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- asset  (/duties/[key], /targets/[id])
create table if not exists asset (
  asset_id               text primary key-- 자산 번호 [v0.1],
  asset_name             text          -- 자산 이름 [v0.1],
  asset_gbn              text          -- 시설 구분 [v0.1],
  asset_kind             text          -- 시설 종류 [v0.1],
  asset_class            text          -- 종별(1·2·3종) [v0.1],
  safety_grade           text          -- 안전등급 [v0.1],
  completed_ymd          text          -- 준공일 [v0.1],
  addr                   text          -- 소재지 [v0.1],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.1],
  source                 text          -- 출처(FMS 등) [v0.1],
  sapa_l2_result         text          -- 중처법 판정 [v0.1],
  sapa_basis             text          -- 판정 근거 [v0.1],
  need_data              text          -- 더 필요한 자료 [v0.1],
  verified               text default  -- 확인 여부 [v0.1]
);

-- asset_target_map
create table if not exists asset_target_map (
  asset_id               text references asset(asset_id)-- 자산 번호 [v0.1],
  target_code            text          -- 관리대상 코드 [v0.1],
  basis                  text          -- 대응 근거(FMS 구분·종류 규칙 등) [v0.1],
  confidence             text          -- 대응 확신도(high·medium·low) [v0.1]
);

-- audit_log
create table if not exists audit_log (
  log_id                 bigserial primary key-- 기록 번호 [v0.2],
  table_name             text          -- 표 이름 [v0.2],
  row_key                text          -- 행 열쇠 [v0.2],
  action                 text          -- 한 일(insert·update·approve·reject) [v0.2],
  changed_by             text          -- 바꾼 사람 [v0.2],
  changed_at             timestamptz default now()-- 바꾼 일시 [v0.2],
  before_json            jsonb         -- 바꾸기 전 값(JSON) [v0.2],
  after_json             jsonb         -- 바꾼 뒤 값(JSON) [v0.2],
  note                   text          -- 비고 [v0.2]
);

-- ceo_activity
create table if not exists ceo_activity (
  activity_id            text primary key-- 활동 번호 [v0.2],
  activity_date          date          -- 활동일 [v0.2],
  activity_type          text          -- 활동 유형 [v0.2],
  title                  text          -- 제목 [v0.2],
  place                  text          -- 현장 [v0.2],
  target_code            text          -- 관리대상 코드 [v0.2],
  asset_id               text references asset(asset_id)-- 자산 번호 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  participants           text          -- 참석자 [v0.2],
  finding                text          -- 점검 의견·지적사항 [v0.2],
  instruction            text          -- 지시사항 [v0.2],
  follow_up_task_id      text references compliance_task(task_id)-- 후속 과제 [v0.2],
  evidence_file          text          -- 증빙 파일 [v0.2],
  created_by             text          -- 만든 사람 [v0.2],
  note                   text          -- 비고 [v0.2],
  created_at             timestamptz default now()-- 만든 일시 [v0.2]
);

-- civil_manual  (/drills, /evidence, /system)
create table if not exists civil_manual (
  manual_id              text primary key-- 절차·매뉴얼·기록 번호 [v0.6],
  clause_ref             text          -- 시행령 조·호(10-7 = 제10조제7호) [v0.6],
  record_kind            text          -- 업무처리절차 · 매뉴얼 · 반기 점검 · 교육 이수 점검 · 대피훈련 [v0.6],
  title                  text          -- 제목 [v0.6],
  covers                 text          -- 담은 목(가·나·다·라) [v0.6],
  missing                text          -- 빠진 목 [v0.6],
  basis                  text          -- 갈음 근거(철도안전법 제7조 등) [v0.6],
  asset_id               text          -- 자산 번호 [v0.6],
  facility_name          text          -- 시설 이름 [v0.6],
  enacted_at             date          -- 제정일 [v0.6],
  revised_at             date          -- 개정일 [v0.6],
  done_at                date          -- 실시일 [v0.6],
  last_check_at          date          -- 최근 점검일 [v0.6],
  reported_at            date          -- 경영책임자 보고일 [v0.6],
  participants           int           -- 참석 인원 [v0.6],
  owner_staff_id         text          -- 정담당 [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- civil_safety_plan  (/calendar, /evidence, /system)
create table if not exists civil_safety_plan (
  plan_id                text primary key-- 안전계획 번호 [v0.6],
  plan_year              int           -- 계획 연도 [v0.6],
  facility_kind          text          -- 공중이용시설 · 공중교통수단 [v0.6],
  asset_id               text          -- 자산 번호 [v0.6],
  facility_name          text          -- 시설 이름 [v0.6],
  asset_gbn              text          -- 시설 구분 [v0.6],
  asset_kind             text          -- 시설 종류 [v0.6],
  asset_class            text          -- 종별(1·2·3종) [v0.6],
  dept_id                text          -- 부서 번호 [v0.6],
  plan_status            text          -- 수립 · 작성중 · 미수립 [v0.6],
  plan_basis             text          -- 계획 근거(자체 안전계획 · 시설물안전법 제6조 · 철도안전법 제6조) [v0.6],
  ceo_confirmed          text          -- 경영책임자 확인·보고받음 Y/N(제4호 단서 갈음 성립 조건) [v0.6],
  confirmed_at           date          -- 경영책임자 확인·보고받은 날 [v0.6],
  mok_ga                 text          -- 가목(인력) 포함 Y/N [v0.6],
  mok_na                 text          -- 나목(점검) 포함 Y/N [v0.6],
  mok_da                 text          -- 다목(보수·보강) 포함 Y/N [v0.6],
  items_planned          int           -- 계획 항목 수 [v0.6],
  items_done             int           -- 이행한 항목 수 [v0.6],
  established_at         date          -- 계획 수립일 [v0.6],
  owner_staff_id         text          -- 정담당 [v0.6],
  note                   text          -- 비고 [v0.6],
  confirm_proxy          text          -- 총괄이 대신 적은 확인 기록 Y(화면이 씀) [v0.6],
  confirmed_by           text          -- 확인을 기록한 사람(화면이 씀) [v0.6]
);

-- compliance_task
create table if not exists compliance_task (
  task_id                text primary key-- 과제 번호 [v0.1],
  assign_id              text references duty_assignment(assign_id)-- 배정 번호 [v0.1],
  period_label           text          -- 주기 표시 [v0.1],
  due_date               date          -- 기한 [v0.1],
  status                 text check (status in ('이행대기','기간초과','이행완료','조치필요','점검완료')-- 이행 상태 [v0.1],
  done_at                date          -- 이행 완료일 [v0.1],
  done_by                text references staff(staff_id)-- 이행한 사람 [v0.1],
  remark                 text          -- 비고 [v0.1],
  created_at             timestamptz default now()-- 만든 일시 [v0.1],
  updated_at             timestamptz default now()-- 고친 일시 [v0.1],
  period_year            int           -- 연도 [v0.2],
  half_year              text          -- 반기 [v0.2],
  plan_date              date          -- 계획일 [v0.2],
  evidence_cnt           int           -- 증빙 수 [v0.2],
  check_result           text          -- 점검 판정(이행완료·보완필요·미이행) [v0.2],
  approval_status        text          -- 결재 상태(작성중·제출·승인·반려) [v0.2],
  created_by             text          -- 만든 사람 [v0.2],
  submitted_at           timestamptz   -- 제출 일시 [v0.2],
  submitted_by           text          -- 제출한 사람 [v0.2],
  approved_at            timestamptz   -- 승인 일시 [v0.2],
  approved_by            text          -- 승인한 사람 [v0.2],
  rejected_at            timestamptz   -- 반려 일시 [v0.2],
  reject_reason          text          -- 반려 사유 [v0.2],
  entered_in_demo        boolean       -- 시연 중 입력분 표시 [v0.3],
  resubmit_round         int           -- 보완 제출 뒤 다음 판정 차수(화면이 씀) [v0.7],
  resubmit_note          text          -- 보완 제출 때 부서가 적은 말(화면이 씀) [v0.7]
);

-- contract  (/api/export, /calendar, /contracts, /evidence)
create table if not exists contract (
  contract_id            text primary key-- 계약 번호 [v0.2],
  contract_name          text          -- 계약 이름 [v0.2],
  counterpart            text          -- 수급인(업체) [v0.2],
  asset_id               text references asset(asset_id)-- 자산 번호 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  contract_type          text          -- 계약 구분(공사·용역·위탁·물품) [v0.2],
  start_date             date          -- 계약 시작 [v0.2],
  end_date               date          -- 계약 종료 [v0.2],
  amount                 bigint        -- 계약 금액 [v0.2],
  safety_clause          text          -- 안전보건 확보 조항 유무 [v0.2],
  evaluation_done        text default  -- 수급인 안전보건 수준평가 실시 여부 [v0.2],
  note                   text          -- 비고 [v0.2],
  created_at             timestamptz default now()-- 만든 일시 [v0.2],
  updated_at             timestamptz default now()-- 고친 일시 [v0.2],
  contract_method        text          -- 계약 방식(제한경쟁·수의계약 등) [v0.3],
  trade                  text          -- 업종 [v0.3],
  safety_cost            bigint        -- 산업안전보건관리비 [v0.3],
  worker_cnt             int           -- 투입 인원 [v0.3],
  subcontract            text          -- 재하도급 여부 [v0.3],
  eval_score             int           -- 수급인 평가 점수 [v0.3],
  eval_date              date          -- 평가 실시일 [v0.3],
  manager_staff_id       text          -- 계약 담당 [v0.3],
  manager_phone          text          -- 부서 대표번호(예시) [v0.5],
  work_start_date        date          -- 착공·착수일 [v0.5],
  main_task              text          -- 주요 수행업무 [v0.5],
  work_place             text          -- 업무수행장소 [v0.5],
  vendor_rep_role        text          -- 수탁 담당자(직책만) [v0.5],
  vendor_safety_role     text          -- 수급인 쪽 안전 담당(직책만) [v0.5],
  vendor_contact_on_file text          -- 수탁 연락처 등록됨/미등록 [v0.5],
  vendor_doc_status      text          -- 수급인 확인 서류 제출 여부 [v0.5],
  regular_workers        int           -- 상시 근로자 수 [v0.5],
  attachments            text          -- 첨부파일 이름 목록 [v0.5],
  entrust_type           text          -- 위탁 유형(도급·용역·민간위탁·위임) [v0.7],
  apply_frame            text          -- 적용 틀(산업·시민·둘 다) [v0.7],
  civil_scope            text          -- 공중이용시설·교통수단 운영·관리 위탁 여부 [v0.7],
  civil_basis            text          -- 위탁 여부 판단 근거 [v0.7],
  ctl_own                text          -- 실질 지배 — 기관 소유 시설에서 함 Y/N [v0.7],
  ctl_lease              text          -- 실질 지배 — 기관 임차 시설에서 함 Y/N [v0.7],
  ctl_repair             text          -- 실질 지배 — 보수·보강 의무·예산이 기관에 있음 Y/N [v0.7],
  ctl_command            text          -- 실질 지배 — 작업 중지·시정 지시 가능 Y/N [v0.7],
  ctl_vendor_site        text          -- 수급인 소유·임차 시설에서 하는 일 있음 Y/N [v0.7],
  control_result         text          -- 실질 지배 판단(해당·확인 필요·해당 없음) [v0.7],
  control_basis          text          -- 실질 지배 판단 근거(계약서 조항 등) [v0.7],
  control_confirmed_at   date          -- 판단을 확인한 날(사람이 적음) [v0.7],
  control_confirmed_by   text          -- 판단을 확인한 사람 [v0.7],
  work_risk              text          -- 작업 위험도(일반·위험장소·화재·폭발·밀폐) [v0.7],
  eval_pass_mark         int           -- 평가 합격선(점) [v0.7],
  eval_detail            text          -- 항목별 평가 있음 Y [v0.7],
  proc_stage             text          -- 도급 단계(발주·평가·계약·이행·준공 정산) [v0.7],
  order_at               date          -- 발주일 [v0.7],
  contract_at            date          -- 계약일 [v0.7],
  completed_at           date          -- 준공일 [v0.7],
  settled_at             date          -- 정산일 [v0.7],
  cost_planned           bigint        -- 안전보건 관리비 계상액(원) [v0.7],
  cost_settled           bigint        -- 안전보건 관리비 실사용 정산액(원) [v0.7]
);

-- contract_compliance  (/contracts)
create table if not exists contract_compliance (
  cc_id                  text primary key-- 준수여부 번호 [v0.5],
  contract_id            text references contract(contract_id)-- 계약 번호 [v0.5],
  item_no                int references contract_mgmt_item(item_no)-- 관리의무 항목 번호(1~4) [v0.5],
  item_code              text          -- 관리의무 항목 코드 [v0.5],
  status                 text          -- 준수 여부(이행·보완필요·미이행·해당없음) [v0.5],
  evidence_name          text          -- 증빙 이름 [v0.5],
  checked_at             date          -- 점검일 [v0.5],
  checked_by             text          -- 점검한 사람 [v0.5],
  finding                text          -- 점검 의견·지적사항 [v0.5],
  note                   text          -- 비고 [v0.5]
);

-- contract_duty
create table if not exists contract_duty (
  cduty_id               text primary key-- 계약 의무 번호 [v0.2],
  contract_id            text references contract(contract_id)-- 계약 번호 [v0.2],
  duty_key               text references duty_class(duty_key)-- 의무 열쇠(정본) [v0.2],
  status                 text          -- 이행 상태 [v0.2],
  done_at                date          -- 이행 완료일 [v0.2],
  evidence_id            text          -- 증빙 번호 [v0.2],
  note                   text          -- 비고 [v0.2]
);

-- contract_eval_item  (/contracts)
create table if not exists contract_eval_item (
  item_no                int primary key-- 평가 항목 순번 [v0.7],
  item_code              text          -- 평가 항목 코드(EV01~) [v0.7],
  group_code             text          -- 묶음 코드(가·나·다) [v0.7],
  group_name             text          -- 묶음 이름(체계·실행·운영) [v0.7],
  item_name              text          -- 평가 항목 이름 [v0.7],
  pt_good                int           -- 우수 점수 [v0.7],
  pt_mid                 int           -- 보통 점수 [v0.7],
  pt_low                 int           -- 미흡 점수 [v0.7],
  mid_hint               text          -- 보통 판단 예시 [v0.7],
  low_hint               text          -- 미흡 판단 예시 [v0.7],
  default_weight         int           -- 기본 가중치 [v0.7],
  source                 text          -- 출처 자료(쪽 번호) [v0.7],
  basis                  text          -- 근거 조문 [v0.7],
  basis_unit_id          text          -- 근거 조항호목 번호(정본) [v0.7]
);

-- contract_eval_score  (/contracts)
create table if not exists contract_eval_score (
  score_id               text primary key-- 평가 기록 번호(화면이 씀) [v0.7],
  contract_id            text          -- 계약 번호 [v0.7],
  eval_date              date          -- 평가 실시일 [v0.7],
  work_risk              text          -- 작업 위험도 [v0.7],
  pass_mark              int           -- 적용한 합격선 [v0.7],
  total                  int           -- 100점 환산 점수 [v0.7],
  result                 text          -- 합격·미달 [v0.7],
  weights                text          -- 적용한 가중치(쉼표 구분) [v0.7],
  evaluated_by           text          -- 평가한 사람 [v0.7],
  note                   text          -- 평가 메모 [v0.7],
  p1                     int           -- 항목 1 점수(우수 5·보통 3·미흡 1) [v0.7],
  p2                     int           -- 항목 2 점수 [v0.7],
  p3                     int           -- 항목 3 점수 [v0.7],
  p4                     int           -- 항목 4 점수 [v0.7],
  p5                     int           -- 항목 5 점수 [v0.7],
  p6                     int           -- 항목 6 점수 [v0.7],
  p7                     int           -- 항목 7 점수 [v0.7],
  p8                     int           -- 항목 8 점수 [v0.7],
  p9                     int           -- 항목 9 점수 [v0.7],
  p10                    int           -- 항목 10 점수 [v0.7]
);

-- contract_eval_setting  (/contracts)
create table if not exists contract_eval_setting (
  setting_id             text primary key-- 설정 번호(가장 늦은 줄이 지금 설정 · 화면이 씀) [v0.7],
  pass_default           int           -- 합격선 — 기본 [v0.7],
  pass_general           int           -- 합격선 — 일반 작업 [v0.7],
  pass_risk              int           -- 합격선 — 위험장소 작업 [v0.7],
  pass_fire              int           -- 합격선 — 화재·폭발·밀폐 작업 [v0.7],
  weights                text          -- 항목별 가중치(쉼표 구분) [v0.7],
  set_at                 timestamptz   -- 설정 일시 [v0.7],
  set_by                 text          -- 설정한 사람 [v0.7]
);

-- contract_hazard
create table if not exists contract_hazard (
  hazard_id              text primary key-- 위험요인 번호 [v0.2],
  contract_id            text references contract(contract_id)-- 계약 번호 [v0.2],
  hazard_place           text          -- 장소 [v0.2],
  hazard_factor          text          -- 위험요인 [v0.2],
  risk_level             text          -- 위험도(높음·보통·낮음) [v0.2],
  measure                text          -- 조치 [v0.2]
);

-- contract_hazard_map  (/contracts)
create table if not exists contract_hazard_map (
  hazard_id              text          -- 계약 위험요인 번호 [v0.5],
  contract_id            text references contract(contract_id)-- 계약 번호 [v0.5],
  hazard_code            text references hazard_code(hazard_code)-- 유해·위험요인 코드(18항목) [v0.5],
  map_basis              text          -- 연결 근거(위험요인 문구 등) [v0.5],
  source_text            text          -- 조문 원문 [v0.5]
);

-- contract_mgmt_item  (/contracts)
create table if not exists contract_mgmt_item (
  item_no                int primary key-- 관리의무 항목 번호(1~4) [v0.5],
  item_code              text          -- 관리의무 항목 코드(E4-9-GA 등) [v0.5],
  item_name              text          -- 관리의무 항목 이름 [v0.5],
  basis                  text          -- 근거 조문 [v0.5],
  basis_unit_id          text          -- 근거 조항호목 번호(정본) [v0.5],
  basis_text             text          -- 근거 조문 원문 [v0.5],
  applies_to             text          -- 적용 범위 [v0.5],
  evidence_hint          text          -- 증빙 예시 [v0.5]
);

-- drill_eval  (/drills)
create table if not exists drill_eval (
  eval_id                text primary key-- 평가 번호 [v0.6],
  drill_id               text          -- 훈련 번호 [v0.6],
  evaluator              text          -- 평가자 [v0.6],
  evaluated_at           date          -- 평가일 [v0.6],
  p1                     int           -- 계획 — 훈련계획 문서 수립(10점) [v0.6],
  p2                     int           -- 계획 — 시나리오 적정성(10점) [v0.6],
  p3                     int           -- 계획 — 참석대상 통보·사전 교육(5점) [v0.6],
  p4                     int           -- 계획 — 시설·장비 준비 확인(5점) [v0.6],
  c1                     int           -- 전파 — 사전안내·안내방송·교육(10점) [v0.6],
  c2                     int           -- 전파 — 신고·경보·자위소방대 연락(10점) [v0.6],
  x1                     int           -- 실행 — 목표시간 내 대피(10점) [v0.6],
  x2                     int           -- 실행 — 병목 없는 대피유도(10점) [v0.6],
  x3                     int           -- 실행 — 관계자·이용자 모두 참석(5점) [v0.6],
  x4                     int           -- 실행 — 유관기관 협업(5점) [v0.6],
  e1                     int           -- 평가 — 종료 후 평가 실시(10점) [v0.6],
  e2                     int           -- 평가 — 결과보고서에 잘된 점·개선사항(10점) [v0.6],
  total                  int           -- 합계(100점) [v0.6],
  comment                text          -- 평가 의견 [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- drill_plan  (/calendar, /drills, /evidence)
create table if not exists drill_plan (
  drill_id               text primary key-- 훈련 번호 [v0.6],
  target_key             text          -- 대상 열쇠(자산 번호 또는 LRT-EVERLINE) [v0.6],
  target_name            text          -- 훈련 대상 이름 [v0.6],
  target_kind            text          -- 공중교통수단 · 제1종시설물 · 2종시설물 [v0.6],
  asset_class            text          -- 종별(1·2·3종) [v0.6],
  legal_scope            text          -- 법정 대상 · 자체 확대 [v0.6],
  dept_id                text          -- 부서 번호 [v0.6],
  year                   int           -- 연도 [v0.6],
  half                   text          -- 반기 [v0.6],
  drill_type             text          -- 훈련 유형(화재·지진·위험물 누출) [v0.6],
  method                 text          -- 훈련 방식(실행기반·토론기반·도상+실제) [v0.6],
  planned_at             timestamptz   -- 계획 일시 [v0.6],
  place                  text          -- 훈련 장소 [v0.6],
  scenario               text          -- 시나리오 [v0.6],
  target_minutes         int           -- 목표 대피시간(분) [v0.6],
  prep_coop              text          -- 준비 — 사전협조 완료 여부 [v0.6],
  prep_items             text          -- 준비 — 훈련준비 완료 여부 [v0.6],
  prep_budget            text          -- 준비 — 예산·행정 완료 여부 [v0.6],
  prep_memo              text          -- 준비 메모 [v0.6],
  carry_over             text          -- 지난 훈련에서 넘겨받은 개선 과제 [v0.6],
  r_cmd_main             text          -- 임무 — 위기상황 총괄자(정) [v0.6],
  r_cmd_sub              text          -- 임무 — 위기상황 총괄자(부) [v0.6],
  r_evac_main            text          -- 임무 — 대피유도팀(정) [v0.6],
  r_evac_sub             text          -- 임무 — 대피유도팀(부) [v0.6],
  r_resp_main            text          -- 임무 — 현장대응팀(정) [v0.6],
  r_resp_sub             text          -- 임무 — 현장대응팀(부) [v0.6],
  r_aid_main             text          -- 임무 — 구호지원팀(정) [v0.6],
  r_aid_sub              text          -- 임무 — 구호지원팀(부) [v0.6],
  r_eval_main            text          -- 임무 — 훈련 검증자(정) [v0.6],
  r_eval_sub             text          -- 임무 — 훈련 검증자(부) [v0.6],
  status                 text          -- 진행 상태(계획·준비·실시·평가 완료) [v0.6],
  done_at                date          -- 훈련 실시일 [v0.6],
  actual_minutes         int           -- 실제 대피시간(분) [v0.6],
  participants           int           -- 참여 인원 [v0.6],
  absent                 int           -- 불참 인원 [v0.6],
  photos                 text          -- 사진 주소(「 | 」로 구분) [v0.6],
  good_points            text          -- 잘된 점 [v0.6],
  shortfalls             text          -- 미흡사항 [v0.6],
  improvements           text          -- 개선사항(다음 훈련 과제) [v0.6],
  substitute             text          -- 비상대응계획으로 갈음 Y/N [v0.6],
  substitute_basis       text          -- 갈음 근거 [v0.6],
  ceo_checked            text          -- 경영책임자 확인 Y/N [v0.6],
  ceo_checked_at         date          -- 경영책임자 확인일 [v0.6],
  ceo_check_mode         text          -- 확인 방식(직접 확인·보고받음) [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- duty_assignment  (/duties/[key])
create table if not exists duty_assignment (
  assign_id              text primary key-- 배정 번호 [v0.1],
  duty_key               text references duty_class(duty_key)-- 의무 열쇠(정본) [v0.1],
  asset_id               text references asset(asset_id)-- 자산 번호 [v0.1],
  scope                  text check (scope in ('기관','유형','자산')-- 적용 범위(자산·유형) [v0.1],
  target_code            text          -- 관리대상 코드 [v0.1],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.1],
  owner_staff_id         text references staff(staff_id)-- 정담당 [v0.1],
  deputy_staff_id        text references staff(staff_id)-- 부담당 [v0.1],
  applicability          text check (applicability in ('해당','비해당','확인필요')-- 해당 여부 [v0.1],
  applicability_note     text          -- 해당 여부 메모 [v0.1],
  cycle                  text          -- 주기 [v0.1],
  cycle_days             int           -- 주기(일) [v0.1],
  decided_by             text          -- 정한 사람 [v0.1],
  decided_at             timestamptz   -- 정한 날짜 [v0.1],
  badge                  text          -- 화면 표시(배지) [v0.1],
  created_at             timestamptz default now()-- 만든 일시 [v0.1],
  updated_at             timestamptz default now()-- 고친 일시 [v0.1],
  plan_input_type        text          -- 계획 입력 유형(DATE_YM 연-월 · HALF_YEAR 반기) [v0.2]
);

-- duty_class
create table if not exists duty_class (
  duty_key               text primary key-- 의무 열쇠(정본) [v0.1],
  yongin_mark            text          -- 용인시 해당 표시 [v0.1],
  area                   text          -- 재해 구분(I 산업·F 시설교통·M 원료제조물) [v0.1],
  code36                 text          -- 중처법 의무조항 36 [v0.1],
  code36_name            text          -- 의무조항 이름 [v0.1],
  task_name              text          -- 세부 이행업무 [v0.1],
  target_code            text          -- 관리대상 코드 [v0.1],
  target_name            text          -- 관리대상 이름 [v0.1],
  impl_type              text          -- 이행 유형 T01~T10 [v0.1],
  impl_type_name         text          -- 이행 유형 이름 [v0.1],
  law_group              text          -- 법령 그룹 [v0.1],
  law_group_name         text          -- 법령 그룹 이름 [v0.1],
  law                    text          -- 근거 법령 [v0.1],
  doc                    text          -- 문서 [v0.1],
  layer                  text          -- 법령 계층(법률·대통령령·부령·고시) [v0.1],
  unit_label_ko          text          -- 조문(우리말 표기) [v0.1],
  article_title          text          -- 조 제목 [v0.1],
  duty_name              text          -- 의무 이름 [v0.1],
  verdict                text          -- 판정 [v0.1],
  duty_subject           text          -- 수범주체 [v0.1],
  cycle_text             text          -- 주기(원문) [v0.1],
  assign_basis           text          -- 배정 근거 [v0.1],
  evidence_kind          text          -- 증빙 종류 [v0.1],
  badge                  text          -- 화면 표시(배지) [v0.1],
  why                    text          -- 왜 이 의무인가 [v0.1],
  source_text            text          -- 조문 원문 [v0.1],
  law_id                 text          -- 법령 번호(정본) [v0.1],
  doc_id                 text          -- 문서 번호(정본) [v0.1],
  unit_id                text          -- 조항호목 번호(정본) [v0.1],
  schedule_id            text          -- 별표·서식 번호(정본) [v0.1],
  obl_id                 text          -- 의무 번호(정본) [v0.1],
  review_status          text default  -- 검수 상태 [v0.1],
  sapa_clause            text          -- 확보의무 대분류 [v0.2],
  sapa_clause_name       text          -- 확보의무 이름 [v0.2]
);

-- eval_criteria  (/system, /system/record)
create table if not exists eval_criteria (
  criteria_id            text primary key-- 평가 기준 번호 [v0.7],
  target_role            text          -- 대상 직위 [v0.7],
  item_no                int           -- 항목 순번 [v0.7],
  item                   text          -- 평가 항목(법정 업무) [v0.7],
  points                 int           -- 배점(기관이 정함) [v0.7],
  law_basis              text          -- 근거 조문 [v0.7],
  active                 text          -- 사용 여부 Y/N [v0.7],
  note                   text          -- 비고 [v0.7]
);

-- evidence  (/, /actions, /api/export, /budget, /contracts, /duties/[key], /evidence, /exec, /inspections, /m, /recurrence, /review, /scenario, /system)
create table if not exists evidence (
  evidence_id            text primary key-- 증빙 번호 [v0.1],
  task_id                text references compliance_task(task_id)-- 과제 번호 [v0.1],
  evidence_kind          text          -- 증빙 종류 [v0.1],
  file_name              text          -- 파일 이름 [v0.1],
  file_url               text          -- 파일 주소 [v0.1],
  form_id                text references form_template(form_id)-- 법정 서식 번호 [v0.1],
  uploaded_by            text references staff(staff_id)-- 올린 사람 [v0.1],
  uploaded_at            timestamptz default now()-- 올린 날짜 [v0.1],
  note                   text          -- 비고 [v0.1],
  file_size              bigint        -- 파일 크기(바이트) [v0.2],
  mime_type              text          -- 파일 형식(MIME) [v0.2],
  approval_status        text          -- 결재 상태(작성중·제출·승인·반려) [v0.2],
  created_by             text          -- 만든 사람 [v0.2],
  submitted_at           timestamptz   -- 제출 일시 [v0.2],
  submitted_by           text          -- 제출한 사람 [v0.2],
  approved_at            timestamptz   -- 승인 일시 [v0.2],
  approved_by            text          -- 승인한 사람 [v0.2],
  rejected_at            timestamptz   -- 반려 일시 [v0.2],
  reject_reason          text          -- 반려 사유 [v0.2],
  created_at             timestamptz   -- 만든 일시 [v0.2],
  updated_at             timestamptz   -- 고친 일시 [v0.2],
  entered_in_demo        boolean       -- 시연 중 입력분 표시 [v0.3],
  file_type              text          -- 올린 파일 형식 [v0.7]
);

-- form_template
create table if not exists form_template (
  form_id                text primary key-- 법정 서식 번호 [v0.1],
  title                  text          -- 제목 [v0.1],
  doc_id                 text          -- 문서 번호(정본) [v0.1],
  law_id                 text          -- 법령 번호(정본) [v0.1],
  schedule_kind          text          -- 별표·서식 구분 [v0.1],
  schedule_no            text          -- 별표·서식 번호 [v0.1],
  source                 text          -- 출처(FMS 등) [v0.1],
  file_html              text          -- 서식 HTML [v0.1],
  file_docx              text          -- 서식 DOCX [v0.1],
  canon_release          text          -- 정본 발행판 [v0.1]
);

-- hazard_code  (/contracts)
create table if not exists hazard_code (
  hazard_code            text primary key-- 유해·위험요인 코드(18항목) [v0.5],
  hazard_name            text          -- 유해·위험요인 이름 [v0.5],
  sort_no                int           -- 정렬 순서 [v0.5],
  note                   text          -- 비고 [v0.5]
);

-- hazard_report  (/calendar, /evidence, /hazards)
create table if not exists hazard_report (
  hz_id                  text primary key-- 신고 번호 [v0.6],
  received_at            timestamptz   -- 접수일 [v0.6],
  channel                text          -- 접수 경로 [v0.6],
  channel_detail         text          -- 세부 경로(안전신문고·120 등) [v0.6],
  reporter               text          -- 신고한 사람 [v0.6],
  received_by            text          -- 접수한 사람 [v0.6],
  asset_id               text          -- 자산 번호 [v0.6],
  asset_name             text          -- 자산 이름 [v0.6],
  asset_gbn              text          -- 시설 구분 [v0.6],
  asset_class            text          -- 종별(1·2·3종) [v0.6],
  dept_id                text          -- 부서 번호 [v0.6],
  location               text          -- 위치 [v0.6],
  description            text          -- 위험요인 설명 [v0.6],
  code_group             text          -- 유해·위험요인 대분류(이용자 안전·시설물 안전) [v0.6],
  code                   text          -- 유해·위험요인 분류 코드 [v0.6],
  accident_type          text          -- 사고 유형(넘어짐·부딪힘 등) [v0.6],
  possible_accident      text          -- 예상되는 사고 [v0.6],
  photo_wide             text          -- 전경 사진 주소 [v0.6],
  photo_close            text          -- 근접 사진 주소 [v0.6],
  protect_action         text          -- 피해방지조치(대피·접근차단·통제) [v0.6],
  protect_at             timestamptz   -- 피해방지조치 일시 [v0.6],
  protect_by             text          -- 피해방지조치한 사람 [v0.6],
  severity               text          -- 1차 판단(경미·심각) [v0.6],
  judged_by              text          -- 판단한 사람 [v0.6],
  judged_at              timestamptz   -- 판단 일시 [v0.6],
  judge_memo             text          -- 판단 메모 [v0.6],
  minor_action           text          -- 경미 건 즉시 조치 내용 [v0.6],
  closed_at              date          -- 종결일 [v0.6],
  closed_by              text          -- 종결한 사람 [v0.6],
  notified_reporter      text          -- 신고자 결과 통보 Y/N [v0.6],
  notified_at            date          -- 신고자 통보일 [v0.6],
  ceo_reported_at        timestamptz   -- 경영책임자 보고 일시 [v0.6],
  ceo_report_mode        text          -- 보고 방식(서면·구두 선보고 후 서면) [v0.6],
  ceo_reported_by        text          -- 보고한 사람 [v0.6],
  ceo_instruction        text          -- 경영책임자 지시 [v0.6],
  insp_at                date          -- 긴급안전점검일 [v0.6],
  insp_by                text          -- 긴급안전점검한 사람 [v0.6],
  insp_result            text          -- 긴급안전점검 결과 [v0.6],
  order_types            text          -- 개선 지시 종류(이용제한·보수·보강·정밀안전진단) [v0.6],
  order_at               date          -- 개선 지시일 [v0.6],
  order_memo             text          -- 개선 지시 메모 [v0.6],
  fsam_applies           text          -- 시설물안전법 제24조 기한 적용 Y/N [v0.6],
  basis_date             date          -- 기한 기준일(조치명령·통보를 받은 날) [v0.6],
  fix_items              text          -- 보수·보강 계획(항목~물량~비용~기간) [v0.6],
  fix_budget             text          -- 보수·보강 예산 확보 상태 [v0.6],
  fix_started_at         date          -- 보수·보강 착수일 [v0.6],
  fix_done_at            date          -- 보수·보강 완료일 [v0.6],
  done_at                date          -- 처리 완료일 [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- hazard_step  (/hazards)
create table if not exists hazard_step (
  step_id                text primary key-- 처리 기록 번호 [v0.6],
  hz_id                  text          -- 신고 번호 [v0.6],
  step                   text          -- 처리 단계(접수·피해방지조치·1차 판단 …) [v0.6],
  at                     timestamptz   -- 처리 일시 [v0.6],
  by                     text          -- 처리한 사람 [v0.6],
  memo                   text          -- 처리 메모 [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- incident  (/evidence, /recurrence)
create table if not exists incident (
  incident_id            text primary key-- 사고 번호 [v0.2],
  occurred_at            date          -- 발생 일시 [v0.2],
  disaster_type          text          -- 재해 구분 [v0.2],
  asset_id               text references asset(asset_id)-- 자산 번호 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  summary                text          -- 개요 [v0.2],
  cause                  text          -- 원인 [v0.2],
  casualties             text          -- 인명 피해 [v0.2],
  recurrence_plan        text          -- 재발방지 대책 [v0.2],
  plan_due               date          -- 대책 기한 [v0.2],
  plan_done_at           date          -- 대책 완료일 [v0.2],
  note                   text          -- 비고 [v0.2],
  event_class            text          -- 구분(산업재해·시민재해·아차사고) [v0.6],
  event_area             text          -- 피해 대상(산업·시민) [v0.6],
  serious                text          -- 중대재해 해당 여부(해당·해당 안 됨·확인 필요) [v0.6],
  accident_type          text          -- 사고 유형(추락·끼임 등) [v0.6],
  place                  text          -- 발생 장소 [v0.6],
  basis_clause           text          -- 적용 조문(법 제4조제1항제2호 등) [v0.6],
  reported_by            text          -- 등록한 사람 [v0.6],
  owner_staff_id         text          -- 정담당 [v0.6],
  cause_due              date          -- 원인 조사 기한 [v0.6],
  investigated_at        date          -- 원인 조사일 [v0.6],
  investigated_by        text          -- 원인 조사한 사람 [v0.6],
  cause_evidence         text          -- 조사 기록(파일 이름) [v0.6],
  plan_set_due           date          -- 대책 수립 기한 [v0.6],
  plan_set_at            date          -- 대책 수립일 [v0.6],
  plan_set_by            text          -- 대책 수립한 사람 [v0.6],
  plan_evidence          text          -- 대책 문서(파일 이름) [v0.6],
  done_note              text          -- 이행 내용 [v0.6],
  done_evidence          text          -- 이행 증빙(파일 이름) [v0.6],
  done_by                text          -- 이행한 사람 [v0.6],
  effect_due             date          -- 효과 확인 예정일 [v0.6],
  effect_checked_at      date          -- 효과 확인일 [v0.6],
  effect_checked_by      text          -- 효과 확인한 사람 [v0.6],
  effect_result          text          -- 효과 판단(유효·재검토 필요) [v0.6],
  effect_note            text          -- 효과 판단 근거 [v0.6],
  effect_evidence        text          -- 효과 확인 증빙(파일 이름) [v0.6],
  related_order_id       text          -- 관련 명령 번호 [v0.6],
  check_note             text          -- 옮겨 온 행의 확인 필요 사항 [v0.6],
  history                text          -- 효과 확인 이력(「 | 」로 이어 적음 · 화면이 씀) [v0.6],
  reopen_count           int           -- 대책 수립으로 되돌린 횟수(화면이 씀) [v0.6]
);

-- incident_nil_check  (/recurrence)
create table if not exists incident_nil_check (
  nil_id                 text primary key-- 확인 번호 [v0.6],
  period                 text          -- 반기(2026-H1 등) [v0.6],
  dept_id                text          -- 부서 번호 [v0.6],
  confirmed_by           text          -- 확인한 사람 [v0.6],
  confirmed_at           date          -- 확인일 [v0.6],
  memo                   text          -- 확인 메모 [v0.6],
  note                   text          -- 비고 [v0.6]
);

-- incident_report  (/recurrence)
create table if not exists incident_report (
  report_id              text primary key-- 보고 번호(IRP-…) [v0.8],
  incident_id            text          -- 사고 번호 [v0.8],
  report_stage           text          -- 단계: 최초보고 · 직후보고 · 수시보고 [v0.8],
  seq                    text          -- 수시보고 차수 [v0.8],
  reported_at            text          -- 보고 시각(YYYY-MM-DD HH:MM) [v0.8],
  reporter_staff_id      text          -- 보고자 [v0.8],
  recipients             text          -- 수신(경영책임자 · 총괄 · 관계 행정기관) [v0.8],
  agency_name            text          -- 관계 행정기관 이름 [v0.8],
  channel                text          -- 접수 경로 [v0.8],
  overview               text          -- 개요(언제·어디서·무엇이·어떻게) [v0.8],
  damage                 text          -- 피해(인명·기타) [v0.8],
  rescue                 text          -- 긴급구조 [v0.8],
  recovery               text          -- 수습(조치·동원 인력·장비) [v0.8],
  support                text          -- 지원·협조 [v0.8],
  next_plan              text          -- 향후 대책 [v0.8],
  evidence_name          text          -- 증빙 이름 [v0.8],
  evidence_url           text          -- 올린 파일 주소 [v0.8],
  ceo_ack_at             text          -- 경영책임자 받은 시각(최초보고) [v0.8],
  ceo_ack_by             text          -- 받은 사람(CEO-1) [v0.8],
  ceo_ack_proxy          text          -- 총괄 대리 기록 Y [v0.8],
  ceo_ack_recorded_by    text          -- 받음을 적은 사람 [v0.8],
  recorded_by            text          -- 기록한 사람 [v0.8],
  recorded_at            text          -- 기록한 시각 [v0.8],
  note                   text          -- 비고 [v0.8]
);

-- incident_response  (/recurrence)
create table if not exists incident_response (
  resp_id                text primary key-- 대응 기록 번호(IRS-…) [v0.8],
  incident_id            text          -- 사고 번호 [v0.8],
  kind                   text          -- 종류: recognize 인지 · call 112·119 · rescue 긴급구호 · inspect 긴급안전점검 · sign 위험표지 · restrict 이용 제한·통제(산업은 작업 중지·대피) · notify 주민 알림 · agency 관계 행정기관 신고 · press 언론 창구 · family 피해자·유가족 연락 · ceo_prevent·ceo_cause 경영책임자 지시 [v0.8],
  status                 text          -- 이행 상태 [v0.8],
  done_at                text          -- 이행 완료일 [v0.8],
  done_by                text          -- 이행한 사람 [v0.8],
  target_org             text          -- 신고한 기관·대상(지시면 받는 사람 staff_id) [v0.8],
  detail                 text          -- 내용(해당 없음이면 이유) [v0.8],
  evidence_name          text          -- 증빙 이름 [v0.8],
  evidence_url           text          -- 올린 파일 주소 [v0.8],
  proxy                  text          -- 총괄이 대신 적은 경영책임자 지시 Y [v0.8],
  recorded_by            text          -- 기록한 사람 [v0.8],
  recorded_at            text          -- 기록한 시각 [v0.8],
  note                   text          -- 비고 [v0.8]
);

-- incident_response_setting  (/recurrence)
create table if not exists incident_response_setting (
  set_id                 text primary key-- 설정 번호(IRT-…) [v0.8],
  first_report_limit_min integer       -- 최초보고 기한(분) — 안내서는 「즉시」, 시간은 기관이 정함 [v0.8],
  set_at                 text          -- 정한 시각 [v0.8],
  set_by                 text          -- 정한 사람 [v0.8],
  memo                   text          -- 정한 근거 [v0.8],
  note                   text          -- 비고 [v0.8]
);

-- inspection  (/review)
create table if not exists inspection (
  insp_id                text primary key-- 점검 번호 [v0.1],
  task_id                text references compliance_task(task_id)-- 과제 번호 [v0.1],
  inspector_staff_id     text references staff(staff_id)-- 점검자 [v0.1],
  insp_date              date          -- 점검일 [v0.1],
  result                 text check (result in ('적합','부적합','보류')-- 판정 결과 [v0.1],
  finding                text          -- 점검 의견·지적사항 [v0.1],
  note                   text          -- 비고 [v0.1],
  batch_id               text          -- 점검 회차 번호 [v0.2],
  approval_status        text          -- 결재 상태(작성중·제출·승인·반려) [v0.2],
  created_by             text          -- 만든 사람 [v0.2],
  submitted_at           timestamptz   -- 제출 일시 [v0.2],
  submitted_by           text          -- 제출한 사람 [v0.2],
  approved_at            timestamptz   -- 승인 일시 [v0.2],
  approved_by            text          -- 승인한 사람 [v0.2],
  rejected_at            timestamptz   -- 반려 일시 [v0.2],
  reject_reason          text          -- 반려 사유 [v0.2],
  created_at             timestamptz   -- 만든 일시 [v0.2],
  updated_at             timestamptz   -- 고친 일시 [v0.2],
  round_no               int           -- 몇 번째 판정인가(재점검 차수) [v0.5],
  action_need            text          -- 판정 때 고른 필요한 조치(화면이 씀) [v0.7]
);

-- inspection_batch  (/inspections)
create table if not exists inspection_batch (
  batch_id               text primary key-- 점검 회차 번호 [v0.2],
  title                  text          -- 제목 [v0.2],
  period_year            int           -- 연도 [v0.2],
  half_year              text          -- 반기 [v0.2],
  scope_dept_id          text references org_dept(dept_id)-- 주관 부서 [v0.2],
  target_dept_ids        text          -- 대상 부서 [v0.2],
  code36_list            text          -- 대상 의무조항 [v0.2],
  status                 text default  -- 이행 상태 [v0.2],
  started_by             text          -- 시행한 사람 [v0.2],
  started_at             timestamptz default now()-- 시행일 [v0.2],
  approved_by            text          -- 승인한 사람 [v0.2],
  approved_at            timestamptz   -- 승인 일시 [v0.2],
  note                   text          -- 비고 [v0.2],
  requested_by           text          -- 결재 상신한 사람 [v0.5],
  requested_at           timestamptz   -- 결재 상신 일시 [v0.5],
  approve_note           text          -- 결재 의견 [v0.5],
  return_reason          text          -- 돌려보낸 사유 [v0.5],
  returned_at            timestamptz   -- 돌려보낸 일시 [v0.5],
  n_total                int           -- 상신할 때의 숫자(대상) [v0.5],
  n_ok                   int           -- 상신 때 적합 수 [v0.5],
  n_fix                  int           -- 상신 때 보완필요 수 [v0.5],
  n_bad                  int           -- 상신 때 부적합 수 [v0.5],
  n_open                 int           -- 상신 때 조치 중 수 [v0.5],
  n_unsubmitted          int           -- 상신 때 미제출 수 [v0.5],
  open_reason            text          -- 조치 중인 건을 두고 상신한 사유(필수) [v0.5],
  open_kind              text          -- 상신 사유 유형(예산·인력 조치 필요 · 임시조치 완료 등) [v0.5],
  rule_basis             text          -- 근거 주기(의무조항 코드로 자동 · 화면이 씀) [v0.7],
  insp_method            text          -- 점검 방식(직접 점검·위탁 점검 · 화면이 씀) [v0.7],
  outsource_org          text          -- 위탁 점검 기관(화면이 씀) [v0.7],
  report_received_at     date          -- 위탁 점검 결과 보고받은 날(화면이 씀) [v0.7],
  report_received_by     text          -- 보고받은 사람(화면이 씀) [v0.7],
  report_recorded_by     text          -- 보고받음을 기록한 사람(화면이 씀) [v0.7],
  report_proxy           text          -- 총괄이 대신 적은 보고 기록 Y(화면이 씀) [v0.7]
);

-- law_change
create table if not exists law_change (
  change_id              text primary key-- 개정 번호 [v0.2],
  law                    text          -- 근거 법령 [v0.2],
  doc                    text          -- 문서 [v0.2],
  changed_kind           text          -- 개정 구분 [v0.2],
  promulgated_at         date          -- 공포일 [v0.2],
  effective_at           date          -- 시행일 [v0.2],
  affected_duty_cnt      int           -- 영향 의무 수 [v0.2],
  notice_sent_at         timestamptz   -- 알림 발송일 [v0.2],
  note                   text          -- 비고 [v0.2]
);

-- material_item  (/system)
create table if not exists material_item (
  item_id                text primary key-- 품목 번호(MAT-…) [v0.8],
  item_name              text          -- 품목 [v0.8],
  dept_id                text          -- 부서 번호 [v0.8],
  owner_staff_id         text          -- 정담당 [v0.8],
  acts                   text          -- 행위: produce·process·enduse·provide 를 「;」로 [v0.8],
  byeolpyo5              text          -- 별표 5: 호 번호(「;」로 여럿) · N(아님) · 빈칸(확인 필요) [v0.8],
  related_law            text          -- 관계 법령 [v0.8],
  verdict                text          -- 판정 [v0.8],
  reason                 text          -- 사유(필수) [v0.8],
  basis_ref              text          -- 근거(해설서 쪽 또는 「ADOMS 해석(확인 필요)」) [v0.8],
  judged_by              text          -- 판단자 [v0.8],
  judged_at              date          -- 판단일 [v0.8],
  ceo_confirmed_at       date          -- 경영책임자 확인일 [v0.8],
  ceo_confirmed_by       text          -- 확인한 사람 [v0.8],
  ceo_proxy              text          -- 총괄이 대신 적은 확인 Y [v0.8],
  updated_at             date          -- 고친 일시 [v0.8],
  created_by             text          -- 만든 사람 [v0.8],
  note                   text          -- 비고 [v0.8]
);

-- notification  (/actions, /training)
create table if not exists notification (
  notif_id               text primary key-- 알림 번호 [v0.1],
  to_staff_id            text references staff(staff_id)-- 받는 사람 [v0.1],
  task_id                text references compliance_task(task_id)-- 과제 번호 [v0.1],
  notif_type             text          -- 알림 종류(기한임박·기한초과) [v0.1],
  sent_at                timestamptz default now()-- 보낸 날짜 [v0.1],
  read_at                timestamptz   -- 읽은 일시 [v0.1],
  message                text          -- 알림 내용 [v0.1],
  note                   text          -- 비고 [v0.1],
  from_staff_id          text          -- 보낸 사람 [v0.5],
  action_id              text          -- 조치 번호 [v0.5],
  batch_id               text          -- 점검 회차 번호 [v0.5]
);

-- order_received  (/calendar, /evidence, /recurrence)
create table if not exists order_received (
  order_id               text primary key-- 명령 번호 [v0.2],
  received_at            date          -- 접수일 [v0.2],
  issuer                 text          -- 발령 기관 [v0.2],
  law                    text          -- 근거 법령 [v0.2],
  content                text          -- 내용 [v0.2],
  due_date               date          -- 기한 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  asset_id               text references asset(asset_id)-- 자산 번호 [v0.2],
  done_at                date          -- 이행 완료일 [v0.2],
  result                 text          -- 처리 상태(접수·조치 중·조치 완료·종결) [v0.2],
  evidence_file          text          -- 증빙 파일 [v0.2],
  issuer_kind            text          -- 발령기관 구분(중앙행정기관·지방자치단체) [v0.6],
  law_article            text          -- 근거 조문 [v0.6],
  order_no               text          -- 문서 번호 [v0.6],
  place                  text          -- 대상 장소 [v0.6],
  owner_staff_id         text          -- 정담당 [v0.6],
  assigned_at            date          -- 담당 지정일 [v0.6],
  action_plan            text          -- 이행 계획 [v0.6],
  started_at             date          -- 시행일 [v0.6],
  done_note              text          -- 이행 내용 [v0.6],
  done_by                text          -- 이행한 사람 [v0.6],
  reported_at            date          -- 이행 결과 보고일 [v0.6],
  report_evidence        text          -- 보고 문서(파일 이름) [v0.6],
  closed_at              date          -- 종결일 [v0.6],
  closed_note            text          -- 발령기관 확인 방법 [v0.6],
  extended_due           date          -- 연장된 기한 [v0.6],
  extend_reason          text          -- 연장 근거 [v0.6],
  related_incident_id    text          -- 관련 사고 번호 [v0.6],
  check_note             text          -- 옮겨 온 행의 확인 필요 사항 [v0.6],
  note                   text          -- 비고 [v0.6],
  doc_nature             text          -- 문서 성격(서면 행정처분·지도·권고·조언) [v0.7],
  order_area             text          -- 재해 구분(화면이 씀) [v0.7],
  basis_clause           text          -- 적용 조문(재해 구분에 따라 · 화면이 씀) [v0.7]
);

-- org_dept
create table if not exists org_dept (
  dept_id                text primary key-- 부서 번호 [v0.1],
  dept_name              text not null -- 부서 이름 [v0.1],
  dept_role              text          -- 부서 역할(총괄·관리·현업) [v0.1],
  parent_dept_id         text          -- 상위 부서 [v0.1]
);

-- risk_assessment  (/budget, /evidence)
create table if not exists risk_assessment (
  risk_id                text primary key-- 위험성평가 번호 [v0.3],
  title                  text          -- 제목 [v0.3],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.3],
  place                  text          -- 현장 [v0.3],
  method                 text          -- 평가 방법 [v0.3],
  assessed_at            date          -- 평가 실시일 [v0.3],
  assessor_staff_id      text references staff(staff_id)-- 평가자 [v0.3],
  worker_joined          text          -- 종사자 참여 여부 [v0.3],
  review_cycle           text          -- 재검토 주기 [v0.3],
  next_due               date          -- 다음 평가 기한 [v0.3],
  status                 text          -- 이행 상태 [v0.3],
  note                   text          -- 비고 [v0.3],
  created_at             timestamptz default now()-- 만든 일시 [v0.3]
);

-- risk_assessment_item  (/budget)
create table if not exists risk_assessment_item (
  risk_item_id           text primary key-- 위험요인 항목 번호 [v0.3],
  risk_id                text references risk_assessment(risk_id)-- 위험성평가 번호 [v0.3],
  hazard_factor          text          -- 위험요인 [v0.3],
  hazard_kind            text          -- 위험 유형 [v0.3],
  risk_level             text          -- 위험도(높음·보통·낮음) [v0.3],
  measure                text          -- 조치 [v0.3],
  measure_due            date          -- 조치 기한 [v0.3],
  measure_done_at        date          -- 조치 완료일 [v0.3],
  owner_staff_id         text references staff(staff_id)-- 정담당 [v0.3],
  note                   text          -- 비고 [v0.3]
);

-- safety_budget  (/budget, /evidence)
create table if not exists safety_budget (
  budget_id              text primary key-- 예산 번호 [v0.2],
  fiscal_year            int           -- 회계연도 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  target_code            text          -- 관리대상 코드 [v0.2],
  budget_kind            text          -- 용도 [v0.2],
  planned_amount         bigint        -- 편성액 [v0.2],
  executed_amount        bigint        -- 집행액 [v0.2],
  duty_key               text references duty_class(duty_key)-- 의무 열쇠(정본) [v0.2],
  note                   text          -- 비고 [v0.2],
  budget_item            text          -- 예산 항목(고정 6행 이름) [v0.6],
  budget_use             text          -- 제4호 용도(가·나·밖) [v0.6],
  use_basis              text          -- 용도 근거 조문 [v0.6],
  risk_item_id           text          -- 위험요인 항목 번호 [v0.6],
  updated_at             date          -- 고친 일시 [v0.6],
  area                   text          -- 재해 구분(I 산업·F 시설교통·M 원료제조물) [v0.7]
);

-- safety_manual  (/system)
create table if not exists safety_manual (
  manual_id              text primary key-- 절차·매뉴얼 번호 [v0.5],
  clause_no              text          -- 제3·5·7·8·9호 [v0.5],
  title                  text          -- 제목 [v0.5],
  covers                 text          -- 담은 목(가·나·다) [v0.5],
  missing                text          -- 빠진 목 [v0.5],
  enacted_at             date          -- 제정일 [v0.5],
  revised_at             date          -- 개정일 [v0.5],
  last_check_at          date          -- 반기 1회 점검 [v0.5],
  owner_staff_id         text references staff(staff_id)-- 정담당 [v0.5],
  note                   text          -- 비고 [v0.5]
);

-- safety_org_role  (/system, /system/record)
create table if not exists safety_org_role (
  role_id                text primary key-- 선임·지정 번호 [v0.5],
  role_item              text          -- 선임·지정 7항목(안전보건관리책임자·안전관리자·보건관리자 …) [v0.5],
  scope                  text          -- 적용 범위(자산·유형) [v0.5],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.5],
  designated             text          -- Y/N [v0.5],
  status                 text          -- 선임·지정 상태 [v0.5],
  method                 text          -- 선임 방식(직접·겸직·위탁) [v0.5],
  designated_at          date          -- 선임·지정일 [v0.5],
  law_basis              text          -- 산업안전보건법 제15조 등 [v0.5],
  clause_no              text          -- 시행령 제4조 몇 호 [v0.5],
  staff_id               text references staff(staff_id)-- 담당자 번호 [v0.5],
  doc_name               text          -- 근거 문서 이름 [v0.5],
  last_eval_at           date          -- 시행령 제4조제5호 반기 평가 [v0.5],
  note                   text          -- 비고 [v0.5]
);

-- safety_policy  (/system)
create table if not exists safety_policy (
  policy_id              text primary key-- 경영방침·목표 번호 [v0.5],
  clause_no              text          -- 시행령 제4조 몇 호 [v0.5],
  policy_kind            text          -- 경영방침 · 안전보건 목표 · 부서별 세부 목표 [v0.5],
  title                  text          -- 제목 [v0.5],
  fiscal_year            text          -- 회계연도 [v0.5],
  summary                text          -- 개요 [v0.5],
  enacted_at             date          -- 제정일 [v0.5],
  revised_at             date          -- 개정일 [v0.5],
  posted                 text          -- 게시 Y/N [v0.5],
  posted_where           text          -- 게시한 곳 [v0.5],
  approver_role          text          -- 승인 직위 [v0.5],
  owner_staff_id         text references staff(staff_id)-- 정담당 [v0.5],
  note                   text          -- 비고 [v0.5]
);

-- staff  (/contracts, /drills, /drills/[id], /duties/[key], /hazards, /hazards/[id], /inspections, /m, /recurrence, /risk, /settings, /system, /targets, /tasks, /training)
create table if not exists staff (
  staff_id               text primary key-- 담당자 번호 [v0.1],
  display_name           text not null -- 담당자 이름 [v0.1],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.1],
  duty_role              text          -- 역할(정담당·부담당·점검팀장 등) [v0.1],
  email                  text          -- 전자우편 [v0.1],
  phone                  text          -- 전화 [v0.1],
  note                   text          -- 비고 [v0.1]
);

-- system_record  (/system, /system/record)
create table if not exists system_record (
  record_id              text primary key-- 기록 번호 [v0.7],
  clause_no              text          -- 시행령 제4조 몇 호 [v0.7],
  mok                    text          -- 목(가·나·다) [v0.7],
  record_kind            text          -- 기록 종류(문서 등록·문서 개정·반기 점검·반기 평가·위험성평가 결과 보고 …) [v0.7],
  title                  text          -- 제목 [v0.7],
  target_role            text          -- 대상 직위(안전보건관리책임자·관리감독자·안전보건총괄책임자) [v0.7],
  target_ref             text          -- 대상 문서·지정 기록 번호(POL·MAN·SOR) [v0.7],
  target_staff_id        text          -- 평가 대상자 [v0.7],
  dept_id                text          -- 부서 번호 [v0.7],
  done_at                date          -- 실시일 [v0.7],
  half                   text          -- 반기(2026 상반기 등) [v0.7],
  checker_staff_id       text          -- 점검·평가한 사람 [v0.7],
  content                text          -- 내용 [v0.7],
  action_needed          text          -- 필요한 조치 [v0.7],
  action_done_at         date          -- 필요 조치 완료일 [v0.7],
  covers                 text          -- 담은 목(제8호 가·나·다) [v0.7],
  score                  int           -- 평가 점수(합) [v0.7],
  item_scores            text          -- 항목별 점수(C01=10;C02=9 …) [v0.7],
  substitute             text          -- 갈음 근거(위험성평가·산업안전보건위원회) [v0.7],
  budget_amount          bigint        -- 부여한 예산(원 · 제5호 가목) [v0.7],
  doc_name               text          -- 근거 문서 이름 [v0.7],
  ceo_reported           text          -- 경영책임자 보고받음 Y [v0.7],
  reported_at            date          -- 경영책임자 보고일 [v0.7],
  report_method          text          -- 보고 방식(전자 결재·대면 보고·서면 보고) [v0.7],
  created_by             text          -- 만든 사람 [v0.7],
  note                   text          -- 비고 [v0.7],
  report_proxy           text          -- 총괄이 대신 적은 보고 기록 Y(화면이 씀) [v0.7]
);

-- task_approval_patch
create table if not exists task_approval_patch (
  task_id                text          -- 과제 번호 [v0.2],
  approval_status        text          -- 결재 상태(작성중·제출·승인·반려) [v0.2],
  created_by             text          -- 만든 사람 [v0.2],
  submitted_at           text          -- 제출 일시 [v0.2],
  submitted_by           text          -- 제출한 사람 [v0.2],
  approved_at            text          -- 승인 일시 [v0.2],
  approved_by            text          -- 승인한 사람 [v0.2],
  rejected_at            text          -- 반려 일시 [v0.2],
  reject_reason          text          -- 반려 사유 [v0.2],
  created_at             text          -- 만든 일시 [v0.2],
  period_year            text          -- 연도 [v0.2],
  half_year              text          -- 반기 [v0.2],
  plan_date              text          -- 계획일 [v0.2],
  evidence_cnt           text          -- 증빙 수 [v0.2],
  check_result           text          -- 점검 판정(이행완료·보완필요·미이행) [v0.2]
);

-- training_check  (/training)
create table if not exists training_check (
  check_id               text primary key-- 점검 기록 번호(화면이 씀) [v0.7],
  area                   text          -- 재해 구분(I 산업·F 시설교통·M 원료제조물) [v0.7],
  period                 text          -- 점검 기간(반기 또는 연) [v0.7],
  half                   text          -- 반기 [v0.7],
  checked_at             date          -- 점검일 [v0.7],
  checked_by             text          -- 점검한 사람 [v0.7],
  method                 text          -- 점검 방식(직접 점검·점검 결과 보고받음) [v0.7],
  proxy                  text          -- 총괄이 대신 적은 기록 Y [v0.7],
  summary                text          -- 점검 결과 요약 [v0.7],
  note                   text          -- 비고 [v0.7]
);

-- training_course  (/calendar, /training)
create table if not exists training_course (
  course_id              text primary key-- 교육 과정 번호 [v0.6],
  course_name            text          -- 과정명 [v0.6],
  law                    text          -- 근거 법령 [v0.6],
  basis                  text          -- 근거 조문(법·시행규칙·별표) [v0.6],
  target                 text          -- 대상 [v0.6],
  cycle                  text          -- 주기 [v0.6],
  cycle_months           int           -- 주기(개월) [v0.6],
  required_hours         text          -- 법정 시간(원문 요지) [v0.6],
  applies_depts          text          -- 적용 부서(공백 구분 · 예시) [v0.6],
  hazardous_work         text          -- 유해·위험 작업 교육 Y/N [v0.6],
  note                   text          -- 비고 [v0.6],
  area                   text          -- 재해 구분(I 산업·F 시설교통·M 원료제조물) [v0.7]
);

-- training_record  (/calendar, /training)
create table if not exists training_record (
  training_id            text primary key-- 교육 번호 [v0.2],
  staff_id               text references staff(staff_id)-- 담당자 번호 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  course_name            text          -- 과정명 [v0.2],
  law                    text          -- 근거 법령 [v0.2],
  hours                  numeric       -- 시간 [v0.2],
  trained_at             date          -- 이수일 [v0.2],
  certificate_file       text          -- 수료증 [v0.2],
  duty_key               text references duty_class(duty_key)-- 의무 열쇠(정본) [v0.2],
  course_id              text          -- 교육 과정 번호 [v0.6],
  period                 text          -- 교육 기간 표시(2026년·상반기 등) [v0.6],
  due_date               date          -- 기한 [v0.6],
  status                 text          -- 이수 상태(이수·미실시) [v0.6],
  note                   text          -- 비고 [v0.6],
  instructed_at          date          -- 이행 지시일(제4호 · 화면이 씀) [v0.6],
  instructed_by          text          -- 이행 지시한 사람(화면이 씀) [v0.6],
  instruct_due           date          -- 지시한 이수 기한(화면이 씀) [v0.6],
  instruct_basis         text          -- 지시 근거 조문(화면이 씀) [v0.6],
  done_by                text          -- 이행한 사람 [v0.6]
);

-- worker_voice  (/evidence, /system, /system/record)
create table if not exists worker_voice (
  voice_id               text primary key-- 의견 번호 [v0.2],
  received_at            date          -- 접수일 [v0.2],
  channel                text          -- 접수 경로 [v0.2],
  dept_id                text references org_dept(dept_id)-- 부서 번호 [v0.2],
  content                text          -- 내용 [v0.2],
  review_result          text          -- 검토 결과 [v0.2],
  action_taken           text          -- 조치 내용 [v0.2],
  closed_at              date          -- 종결일 [v0.2],
  stage                  text          -- 처리 단계(접수·검토·개선방안·이행·종결) [v0.7],
  needs_improvement      text          -- 개선 필요 Y [v0.7],
  reviewed_at            date          -- 검토일 [v0.7],
  reviewer_staff_id      text          -- 검토한 사람 [v0.7],
  plan                   text          -- 개선방안 [v0.7],
  plan_due               date          -- 대책 기한 [v0.7],
  plan_owner_staff_id    text          -- 개선방안 담당자 [v0.7],
  done_at                date          -- 개선 이행 완료일 [v0.7],
  substitute             text          -- 갈음한 회의체(산업안전보건위원회·협의체) [v0.7],
  ceo_reported           text          -- 경영책임자 보고받음 Y [v0.7],
  reported_at            date          -- 경영책임자 보고일 [v0.7],
  report_method          text          -- 보고 방식 [v0.7],
  note                   text          -- 비고 [v0.7],
  report_proxy           text          -- 총괄이 대신 적은 보고 기록 Y(화면이 씀) [v0.7]
);

