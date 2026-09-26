-- ★ 2026-09-21 정정 2건
--   ① ceo_activity 에 note 칸 추가 — 시드 CSV 에 있는데 DDL 에 없어 적재가 멈추던 자리
--   ② sapa_clause 채우기를 split_part(code36,';',1) 로 — code36 에 「F01;F03」처럼
--      둘이 든 행 4건(F01;F03 · F04;F07 · F07;F12 · I13;F12)이 빈칸으로 남던 자리
--   준거: 법 제4조제1항 각 호(1 체계구축 · 2 재발방지 · 3 개선·시정명령 · 4 관계법령 관리상 조치) + 제5조 도급
-- ops_v0.2 — 운영·관리 필드 보강 (용인시 데모 2차)
-- 근거: 참고 명세 「중대재해 통합관리시스템」 명세 + 사용자 지시(2026-09-20)
--   「생성일과 승인일의 차이를 둔다」 — 문서·과제는 만든 날과 결재된 날이 다르다.
-- 적용 순서: 01_schema.sql 을 먼저 돌린 뒤 이 파일을 돌린다. 여러 번 돌려도 안전하다.
set search_path = adoms2, public;

-- ═══════════════════════════════════════════════════════════════
-- 1. 공통 운영 필드 — 만든 날 · 낸 날 · 결재된 날을 나눈다
-- ═══════════════════════════════════════════════════════════════
--  status  : 작성중 → 제출 → 승인 | 반려(→ 작성중으로 되돌아감)
--  이행 상태(compliance_task.status)와는 다른 축이다.
--    compliance_task.status = 업무가 끝났나(이행대기·이행완료…)
--    approval_status        = 그 기록이 결재를 받았나(작성중·제출·승인·반려)
do $$
declare t text;
begin
  foreach t in array array['compliance_task','evidence','inspection','action'] loop
    execute format('alter table %I add column if not exists approval_status text default ''작성중''', t);
    execute format('alter table %I add column if not exists created_by text', t);
    execute format('alter table %I add column if not exists submitted_at timestamptz', t);
    execute format('alter table %I add column if not exists submitted_by text', t);
    execute format('alter table %I add column if not exists approved_at timestamptz', t);
    execute format('alter table %I add column if not exists approved_by text', t);
    execute format('alter table %I add column if not exists rejected_at timestamptz', t);
    execute format('alter table %I add column if not exists reject_reason text', t);
    execute format('alter table %I add column if not exists created_at timestamptz default now()', t);
    execute format('alter table %I add column if not exists updated_at timestamptz default now()', t);
  end loop;
end $$;

alter table compliance_task
  add column if not exists period_year int,
  add column if not exists half_year text,            -- 상반기 · 하반기 (참고 명세 코드값)
  add column if not exists plan_date date,            -- 계획일(언제 하기로 했나)
  add column if not exists evidence_cnt int default 0,
  add column if not exists check_result text;         -- 이행완료 · 보완필요 · 미이행 · 해당없음

-- ═══════════════════════════════════════════════════════════════
-- 2. 변경 이력 — 누가 무엇을 언제 바꿨나 (한 곳에 모은다)
-- ═══════════════════════════════════════════════════════════════
create table if not exists audit_log (
  log_id bigserial primary key,
  table_name text, row_key text, action text,         -- insert · update · approve · reject
  changed_by text, changed_at timestamptz default now(),
  before_json jsonb, after_json jsonb, note text
);
create index if not exists ix_audit_row on audit_log(table_name, row_key);

-- ═══════════════════════════════════════════════════════════════
-- 3. 참고 명세에 있고 ops_v0.1 에 없던 표
-- ═══════════════════════════════════════════════════════════════
-- 3-1. 도급·용역·위탁 (SCR-030~033 · 중처법 제5조·제9조③)
create table if not exists contract (
  contract_id text primary key,
  contract_name text, counterpart text,               -- 수급인·수탁자
  asset_id text references asset(asset_id),
  dept_id text references org_dept(dept_id),
  contract_type text,                                 -- 도급 · 용역 · 위탁
  start_date date, end_date date, amount bigint,
  safety_clause text,                                 -- 안전보건 확보 조항 유무·내용
  evaluation_done text default 'N',                   -- 수급인 안전보건 수준 평가
  note text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists contract_hazard (                -- 위험장소·유해위험요인 (SCR-032)
  hazard_id text primary key,
  contract_id text references contract(contract_id),
  hazard_place text, hazard_factor text, risk_level text, measure text
);
create table if not exists contract_duty (                  -- 계약별 관리의무 이행 (SCR-033)
  cduty_id text primary key,
  contract_id text references contract(contract_id),
  duty_key text references duty_class(duty_key),
  status text, done_at date, evidence_id text, note text
);

-- 3-2. 기관장(경영책임자) 예방활동 (SCR-026 · 대메뉴 9)
create table if not exists ceo_activity (
  activity_id text primary key,
  activity_date date, activity_type text,             -- 현장점검 · 회의주재 · 교육 · 지시
  title text, place text, target_code text, asset_id text references asset(asset_id),
  dept_id text references org_dept(dept_id),
  participants text, finding text, instruction text,  -- 지시사항
  follow_up_task_id text references compliance_task(task_id),
  evidence_file text, created_by text, note text,   -- note: 시드에 있는 칸(2026-09-21 정정 — 없으면 적재가 멈춘다)
  created_at timestamptz default now()
);

-- 3-3. 예산 편성·집행 (I04 · F02 · M02 증빙의 숫자 근거)
create table if not exists safety_budget (
  budget_id text primary key,
  fiscal_year int, dept_id text references org_dept(dept_id),
  target_code text, budget_kind text,                 -- 인력 · 시설 · 장비 · 교육 · 점검
  planned_amount bigint, executed_amount bigint,
  duty_key text references duty_class(duty_key), note text
);

-- 3-4. 교육 이수 (I13 · F12 · M09)
create table if not exists training_record (
  training_id text primary key,
  staff_id text references staff(staff_id), dept_id text references org_dept(dept_id),
  course_name text, law text, hours numeric, trained_at date,
  certificate_file text, duty_key text references duty_class(duty_key)
);

-- 3-5. 종사자 의견 수렴 (I07)
create table if not exists worker_voice (
  voice_id text primary key,
  received_at date, channel text, dept_id text references org_dept(dept_id),
  content text, review_result text, action_taken text, closed_at date
);

-- 3-6. 재해·사고 기록 (I10 · F09 · M06 재발방지)
create table if not exists incident (
  incident_id text primary key,
  occurred_at date, disaster_type text,               -- 중대산업재해 · 중대시민재해
  asset_id text references asset(asset_id), dept_id text references org_dept(dept_id),
  summary text, cause text, casualties text,
  recurrence_plan text, plan_due date, plan_done_at date, note text
);

-- 3-7. 개선·시정 명령 접수 (I11 · F10 · M07)
create table if not exists order_received (
  order_id text primary key,
  received_at date, issuer text,                      -- 중앙행정기관 · 지자체
  law text, content text, due_date date,
  dept_id text references org_dept(dept_id), asset_id text references asset(asset_id),
  done_at date, result text, evidence_file text
);

-- 3-8. 법령 개정 알림 (대상관리 → 법령 변경 추적)
create table if not exists law_change (
  change_id text primary key,
  law text, doc text, changed_kind text,              -- 제정 · 일부개정 · 전부개정 · 폐지
  promulgated_at date, effective_at date,
  affected_duty_cnt int, notice_sent_at timestamptz, note text
);

-- ═══════════════════════════════════════════════════════════════
-- 4. 결재·이행 상태를 한 번에 보는 뷰 (화면용)
-- ═══════════════════════════════════════════════════════════════
create or replace view v_task_approval as
select t.task_id, t.assign_id, t.status as 이행상태, t.approval_status as 결재상태,
       t.period_year, t.half_year, t.plan_date, t.due_date, t.done_at,
       t.submitted_at, t.approved_at, t.rejected_at, t.reject_reason,
       (t.approved_at::date - t.created_at::date) as 결재소요일,
       a.dept_id, a.owner_staff_id, a.deputy_staff_id, a.applicability,
       c.code36, c.code36_name, c.area, c.target_code, c.target_name, c.law, c.duty_name, c.badge
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join duty_class c on c.duty_key = a.duty_key;

create or replace view v_contract_duty as
select k.contract_id, k.contract_name, k.counterpart, k.contract_type,
       k.start_date, k.end_date, k.dept_id, k.asset_id, s.asset_name,
       d.cduty_id, d.status, d.done_at, c.code36, c.code36_name, c.duty_name, c.law
from contract k
left join asset s on s.asset_id = k.asset_id
left join contract_duty d on d.contract_id = k.contract_id
left join duty_class c on c.duty_key = d.duty_key;

create or replace view v_ceo_activity as
select a.*, s.asset_name, d.dept_name
from ceo_activity a
left join asset s on s.asset_id = a.asset_id
left join org_dept d on d.dept_id = a.dept_id;

-- ═══════════════════════════════════════════════════════════════
-- 5. 참고 명세 이행현황표의 「행」 축 — 중처법 확보의무 대분류(제1~4호)
--    (에이전트 분석: 이 칸이 없으면 이행현황표·총괄표를 만들 수 없다)
-- ═══════════════════════════════════════════════════════════════
alter table duty_class
  add column if not exists sapa_clause text,        -- 제1호 · 제2호 · 제3호 · 제4호 · 도급(법 제5조·제9조③)
  add column if not exists sapa_clause_name text;

update duty_class set
  sapa_clause = case
    when split_part(code36, ';', 1) in ('I01','I02','I03','I04','I05','I06','I07','I08','I09',
                    'F01','F02','F03','F04','F05','F06','F07','F08',
                    'M01','M02','M03','M04','M05')                      then '제1호'
    when split_part(code36, ';', 1) in ('I10','F09','M06')                                   then '제2호'
    when split_part(code36, ';', 1) in ('I11','F10','M07')                                   then '제3호'
    when split_part(code36, ';', 1) in ('I12','I13','F11','F12','M08','M09')                 then '제4호'
    when split_part(code36, ';', 1) in ('I14','F13')                                         then '도급'
    else null end,
  sapa_clause_name = case
    when split_part(code36, ';', 1) in ('I01','I02','I03','I04','I05','I06','I07','I08','I09',
                    'F01','F02','F03','F04','F05','F06','F07','F08',
                    'M01','M02','M03','M04','M05')                      then '안전·보건 관리체계의 구축 및 이행'
    when split_part(code36, ';', 1) in ('I10','F09','M06')                                   then '재해 발생 시 재발방지 대책의 수립 및 이행'
    when split_part(code36, ';', 1) in ('I11','F10','M07')                                   then '중앙행정기관·지방자치단체가 명한 개선·시정 사항의 이행'
    when split_part(code36, ';', 1) in ('I12','I13','F11','F12','M08','M09')                 then '안전·보건 관계 법령에 따른 의무이행에 필요한 관리상의 조치'
    when split_part(code36, ';', 1) in ('I14','F13')                                         then '도급·용역·위탁 관계에서의 안전 및 보건 확보'
    else null end
where sapa_clause is null;

-- ═══════════════════════════════════════════════════════════════
-- 6. 점검 회차(취합 배치) — 참고 SCR-089·090 의 「취합 시작」·「결재하기」
-- ═══════════════════════════════════════════════════════════════
create table if not exists inspection_batch (
  batch_id text primary key,
  title text, period_year int, half_year text,
  scope_dept_id text references org_dept(dept_id),
  target_dept_ids text,                                -- 취합 대상 부서(쉼표 구분)
  code36_list text,                                    -- 점검 항목(36 코드 쉼표 구분)
  status text default '진행중',                        -- 진행중 · 결재요청 · 결재완료
  started_by text, started_at timestamptz default now(),
  approved_by text, approved_at timestamptz, note text
);
alter table inspection add column if not exists batch_id text references inspection_batch(batch_id);

-- 증빙 파일 규칙(참고 명세: 개당 10MB) · 계획 입력 유형(연-월 / 상·하반기)
alter table evidence
  add column if not exists file_size bigint,
  add column if not exists mime_type text;
alter table duty_assignment
  add column if not exists plan_input_type text default 'HALF_YEAR';   -- DATE_YM · HALF_YEAR

-- ═══════════════════════════════════════════════════════════════
-- 7. 이행현황표·총괄표 뷰 (행 = 대분류 → 36 카테고리, 열 = 대상/부서)
-- ═══════════════════════════════════════════════════════════════
create or replace view v_compliance_matrix as
select c.area, c.sapa_clause, c.sapa_clause_name, c.code36, c.code36_name,
       a.dept_id, d.dept_name, a.target_code, c.target_name,
       t.period_year, t.half_year,
       case
         when a.applicability = '비해당'                      then '해당없음'
         when t.check_result is not null                       then t.check_result
         when t.status in ('이행완료','점검완료')              then '이행완료'
         when t.status = '조치필요'                            then '보완필요'
         else '미이행' end                                     as 준수여부,
       count(*) as cnt
from duty_assignment a
join duty_class c on c.duty_key = a.duty_key
left join compliance_task t on t.assign_id = a.assign_id
left join org_dept d on d.dept_id = a.dept_id
group by 1,2,3,4,5,6,7,8,9,10,11,12;
