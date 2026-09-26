-- ADOMS 데모 2차 — ops_v0.5 추가분 (2026-09-21)
--
-- ★ 이 파일을 ops_v0.1 · v0.2 · ops_v03_v04_add.sql 다음에 돌린다.
--   v0.5 에서 늘어난 것:
--   · 표 7개 — ① 체계 수립(safety_policy · safety_org_role · safety_manual)
--              도급 관리(hazard_code · contract_hazard_map · contract_mgmt_item · contract_compliance)
--   · 칸 — contract 10 · inspection 1 · action 11 · inspection_batch 10 · notification 4
--     (inspection·action·inspection_batch·notification 칸은 ③⑤⑥⑦ 화면이 쓰기 시작한 것)
--   모두 add column if not exists 라 여러 번 돌려도 안전하다. 칸은 지우지 않는다.
--
-- 스키마: adoms2

set search_path to adoms2, public;

-- ── 1. 체계 수립 (중대재해처벌법 시행령 제4조) ─────────────────────
create table if not exists safety_policy (
  policy_id       text primary key,
  clause_no       text,                 -- 시행령 제4조 몇 호
  policy_kind     text,                 -- 경영방침 · 안전보건 목표 · 부서별 세부 목표
  title           text,
  fiscal_year     text,
  summary         text,
  enacted_at      date,
  revised_at      date,
  posted          text,                 -- 게시 Y/N
  posted_where    text,
  approver_role   text,
  owner_staff_id  text references staff(staff_id),
  note            text
);

create table if not exists safety_org_role (
  role_id         text primary key,
  role_item       text,                 -- 선임·지정 7항목(안전보건관리책임자·안전관리자·보건관리자 …)
  scope           text,                 -- 기관 · 부서
  dept_id         text references org_dept(dept_id),
  designated      text,                 -- Y/N
  status          text,
  method          text,                 -- 직접 · 겸직 · 위탁
  designated_at   date,
  law_basis       text,                 -- 산업안전보건법 제15조 등
  clause_no       text,
  staff_id        text references staff(staff_id),
  doc_name        text,
  last_eval_at    date,                 -- 시행령 제4조제5호 반기 평가
  note            text
);

create table if not exists safety_manual (
  manual_id       text primary key,
  clause_no       text,                 -- 제3·5·7·8·9호
  title           text,
  covers          text,                 -- 담은 목(가·나·다)
  missing         text,                 -- 빠진 목
  enacted_at      date,
  revised_at      date,
  last_check_at   date,                 -- 반기 1회 점검
  owner_staff_id  text references staff(staff_id),
  note            text
);

-- ── 2. 도급·용역·위탁 관리 (법 제5조 · 시행령 제4조제9호) ─────────
create table if not exists hazard_code (
  hazard_code  text primary key,
  hazard_name  text,
  sort_no      int,
  note         text
);

create table if not exists contract_hazard_map (
  hazard_id    text,
  contract_id  text references contract(contract_id),
  hazard_code  text references hazard_code(hazard_code),
  map_basis    text,
  source_text  text,
  primary key (hazard_id, hazard_code)
);

create table if not exists contract_mgmt_item (
  item_no        int primary key,
  item_code      text,
  item_name      text,
  basis          text,                 -- 시행령 제4조제9호 가·나·다 · 법 제5조
  basis_unit_id  text,
  basis_text     text,
  applies_to     text,
  evidence_hint  text
);

create table if not exists contract_compliance (
  cc_id          text primary key,
  contract_id    text references contract(contract_id),
  item_no        int references contract_mgmt_item(item_no),
  item_code      text,
  status         text,                 -- 이행 · 보완필요 · 미이행 · 해당없음
  evidence_name  text,
  checked_at     date,
  checked_by     text,
  finding        text,
  note           text
);

alter table contract add column if not exists manager_phone          text;  -- 부서 대표번호(예시)
alter table contract add column if not exists work_start_date        date;  -- 착공·착수일
alter table contract add column if not exists main_task              text;  -- 주요 수행업무
alter table contract add column if not exists work_place             text;  -- 업무수행장소
alter table contract add column if not exists vendor_rep_role        text;  -- 수탁 담당자(직책만)
alter table contract add column if not exists vendor_safety_role     text;  -- 수급인 쪽 안전 담당(직책만)
alter table contract add column if not exists vendor_contact_on_file text;  -- 수탁 연락처 등록됨/미등록
alter table contract add column if not exists vendor_doc_status      text;  -- 수급인 확인 서류 제출 여부
alter table contract add column if not exists regular_workers        int;   -- 상시 근로자 수
alter table contract add column if not exists attachments            text;  -- 첨부파일 이름 목록

-- ── 3. 점검 한 바퀴 (③ 회차 · ⑤ 판정 · ⑥ 조치 · ⑦ 결재) ──────────
alter table inspection add column if not exists round_no int;              -- 몇 번째 판정인가(재점검 차수)

alter table action add column if not exists task_id          text;  -- 조치 대상 과제
alter table action add column if not exists batch_id         text;  -- 어느 점검 회차의 조치인가
alter table action add column if not exists requested_by     text;  -- 조치를 요구한 사람(점검자)
alter table action add column if not exists requested_at     date;  -- 조치 요구일
alter table action add column if not exists started_at       date;  -- 부서가 조치를 시작한 날
alter table action add column if not exists resubmit_note    text;  -- 보완 제출 때 부서가 적은 말
alter table action add column if not exists resubmitted_by   text;  -- 보완 제출한 사람
alter table action add column if not exists rejudged_insp_id text;          -- 이 조치를 닫은(또는 되돌린) 재판정

alter table inspection_batch add column if not exists requested_by   text;
alter table inspection_batch add column if not exists requested_at   timestamptz;
alter table inspection_batch add column if not exists approved_at    timestamptz;
alter table inspection_batch add column if not exists approve_note   text;
alter table inspection_batch add column if not exists return_reason  text;
alter table inspection_batch add column if not exists returned_at    timestamptz;
alter table inspection_batch add column if not exists n_total        int;   -- 상신할 때의 숫자(대상)
alter table inspection_batch add column if not exists n_ok           int;
alter table inspection_batch add column if not exists n_fix          int;
alter table inspection_batch add column if not exists n_bad          int;
alter table inspection_batch add column if not exists n_open         int;
alter table inspection_batch add column if not exists n_unsubmitted  int;
alter table inspection_batch add column if not exists open_reason    text;  -- 조치 중인 건을 두고 상신한 사유(필수)
alter table inspection_batch add column if not exists open_kind      text;  -- 상신 사유 유형(예산·인력 조치 필요 · 임시조치 완료 등)

alter table notification add column if not exists from_staff_id text;
alter table notification add column if not exists sent_at       date;
alter table notification add column if not exists read_at       date;
alter table notification add column if not exists action_id     text;
alter table notification add column if not exists batch_id      text;

-- ── 4. 배정 확인 (② 의무 파악 — 담당 부서가 해당·비해당을 닫는다) ──
alter table duty_assignment add column if not exists decided_by text;
alter table duty_assignment add column if not exists decided_at date;

-- ── 5. 판정 값 — 「보완필요」 허용 (2026-09-21 정정) ─────────────────
-- v0.1 DDL 은 inspection.result 를 (적합·부적합·보류)로 막았는데, 앱의 ⑤ 판정과 예시 자료는 「보완필요」를 쓴다.
-- 그대로 Supabase 에 붙이면 보완필요 판정이 거부된다(설계서 12장 작성 중 발견).
alter table inspection drop constraint if exists inspection_result_check;
alter table inspection add constraint inspection_result_check check (result in ('적합','보완필요','부적합','보류'));
alter table inspection_batch add column if not exists open_kind text;  -- (중복 방지 — 이미 있으면 무시)
