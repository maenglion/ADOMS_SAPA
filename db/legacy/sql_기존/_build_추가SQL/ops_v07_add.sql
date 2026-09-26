-- ADOMS 데모 2차 — ops_v0.7 추가분 (2026-09-21)
--
-- ★ 이 파일을 ops_v06_add.sql 다음에 돌린다.
--   v0.7 에서 늘어난 것:
--   · 표 6개 — 체계 기록(system_record) · 제5호 나목 평가 기준(eval_criteria)
--              수급인 평가(contract_eval_item · contract_eval_score · contract_eval_setting)
--              교육 실시 점검(training_check)
--   · 칸 — contract 23 · order_received 3 · worker_voice 14 · training_course 1 · safety_budget 1
--          inspection_batch 7 · action 2 · inspection 1 · evidence 1 · compliance_task 2
--     (시드 CSV 에 있는 칸 + 화면이 appendRow·patchRow 로 쓰는 칸. 「화면이 씀」 표시는 CSV 에는 없는 칸)
--   모두 if not exists 라 여러 번 돌려도 안전하다. 칸은 지우지 않는다. 외래키는 걸지 않는다.
--
-- 근거 조문(생성기 머리말에서 원문 대조한 것)
--   중대재해처벌법 법 제5조(단서 — 실질적으로 지배·운영·관리) · 제9조제3항
--   시행령 제4조제1·3·5·7·8·9호 · 제5조·제9조·제11조 각 제2항제1호(위탁 점검 결과 지체 없이 보고받을 것)
--   · 각 제2항제3호·제4호(교육 점검·이행 지시) · 제10조제8호(운영·관리 업무 도급)
--   산업안전보건법 제15조제1항 · 시행령 제15조제1항 · 제53조제1항(평가 기준 항목)
--
-- 스키마: adoms2

set search_path to adoms2, public;

-- ── 1. 체계 기록 (시행령 제4조제1·3·5·7·8호) ────────────────────────────
create table if not exists system_record (
  record_id        text primary key,   -- 기록 번호
  clause_no        text,               -- 시행령 제4조 몇 호
  mok              text,               -- 목(가·나·다)
  record_kind      text,               -- 기록 종류(문서 등록·문서 개정·반기 점검·반기 평가·위험성평가 결과 보고 …)
  title            text,               -- 제목
  target_role      text,               -- 대상 직위(안전보건관리책임자·관리감독자·안전보건총괄책임자)
  target_ref       text,               -- 대상 문서·지정 기록 번호(POL·MAN·SOR)
  target_staff_id  text,               -- 평가 대상자
  dept_id          text,               -- 부서
  done_at          date,               -- 실시일
  half             text,               -- 반기(2026 상반기 등)
  checker_staff_id text,               -- 점검·평가한 사람
  content          text,               -- 내용
  action_needed    text,               -- 필요한 조치
  action_done_at   date,               -- 필요 조치 완료일
  covers           text,               -- 담은 목(제8호 가·나·다)
  score            int,                -- 평가 점수(합)
  item_scores      text,               -- 항목별 점수(C01=10;C02=9 …)
  substitute       text,               -- 갈음 근거(위험성평가·산업안전보건위원회)
  budget_amount    bigint,             -- 부여한 예산(원 · 제5호 가목)
  doc_name         text,               -- 근거 문서 이름
  ceo_reported     text,               -- 경영책임자 보고받음 Y
  reported_at      date,               -- 경영책임자 보고일
  report_method    text,               -- 보고 방식(전자 결재·대면 보고·서면 보고)
  created_by       text,               -- 기록한 사람
  note             text,               -- 비고
  report_proxy     text                -- 총괄이 대신 적은 보고 기록 Y(화면이 씀)
);

create table if not exists eval_criteria (
  criteria_id      text primary key,   -- 평가 기준 번호
  target_role      text,               -- 대상 직위
  item_no          int,                -- 항목 순번
  item             text,               -- 평가 항목(법정 업무)
  points           int,                -- 배점(기관이 정함)
  law_basis        text,               -- 근거 조문
  active           text,               -- 사용 여부 Y/N
  note             text                -- 비고
);

-- 제7호 종사자 의견 — v0.2 표에 처리 단계·경영책임자 보고 칸을 더한다
alter table worker_voice add column if not exists stage               text;  -- 처리 단계(접수·검토·개선방안·이행·종결)
alter table worker_voice add column if not exists needs_improvement   text;  -- 개선 필요 Y
alter table worker_voice add column if not exists reviewed_at         date;  -- 검토일
alter table worker_voice add column if not exists reviewer_staff_id   text;  -- 검토한 사람
alter table worker_voice add column if not exists plan                text;  -- 개선방안
alter table worker_voice add column if not exists plan_due            date;  -- 개선방안 이행 기한
alter table worker_voice add column if not exists plan_owner_staff_id text;  -- 개선방안 담당자
alter table worker_voice add column if not exists done_at             date;  -- 개선 이행 완료일
alter table worker_voice add column if not exists substitute          text;  -- 갈음한 회의체(산업안전보건위원회·협의체)
alter table worker_voice add column if not exists ceo_reported        text;  -- 경영책임자 보고받음 Y
alter table worker_voice add column if not exists reported_at         date;  -- 경영책임자 보고일
alter table worker_voice add column if not exists report_method       text;  -- 보고 방식
alter table worker_voice add column if not exists note                text;  -- 비고
alter table worker_voice add column if not exists report_proxy        text;  -- 총괄이 대신 적은 보고 기록 Y(화면이 씀)

-- ── 2. 도급·용역·위탁 (법 제5조 · 제9조제3항 · 시행령 제4조제9호 · 제10조제8호) ──
alter table contract add column if not exists entrust_type         text;    -- 위탁 유형(도급·용역·민간위탁·위임)
alter table contract add column if not exists apply_frame          text;    -- 적용 틀(산업·시민·둘 다)
alter table contract add column if not exists civil_scope          text;    -- 공중이용시설·교통수단 운영·관리 위탁 여부
alter table contract add column if not exists civil_basis          text;    -- 위탁 여부 판단 근거
alter table contract add column if not exists ctl_own              text;    -- 실질 지배 — 기관 소유 시설에서 함 Y/N
alter table contract add column if not exists ctl_lease            text;    -- 실질 지배 — 기관 임차 시설에서 함 Y/N
alter table contract add column if not exists ctl_repair           text;    -- 실질 지배 — 보수·보강 의무·예산이 기관에 있음 Y/N
alter table contract add column if not exists ctl_command          text;    -- 실질 지배 — 작업 중지·시정 지시 가능 Y/N
alter table contract add column if not exists ctl_vendor_site      text;    -- 수급인 소유·임차 시설에서 하는 일 있음 Y/N
alter table contract add column if not exists control_result       text;    -- 실질 지배 판단(해당·확인 필요·해당 없음)
alter table contract add column if not exists control_basis        text;    -- 실질 지배 판단 근거(계약서 조항 등)
alter table contract add column if not exists control_confirmed_at date;    -- 판단을 확인한 날(사람이 적음)
alter table contract add column if not exists control_confirmed_by text;    -- 판단을 확인한 사람
alter table contract add column if not exists work_risk            text;    -- 작업 위험도(일반·위험장소·화재·폭발·밀폐)
alter table contract add column if not exists eval_pass_mark       int;     -- 평가 합격선(점)
alter table contract add column if not exists eval_detail          text;    -- 항목별 평가 있음 Y
alter table contract add column if not exists proc_stage           text;    -- 도급 단계(발주·평가·계약·이행·준공 정산)
alter table contract add column if not exists order_at             date;    -- 발주일
alter table contract add column if not exists contract_at          date;    -- 계약일
alter table contract add column if not exists completed_at         date;    -- 준공일
alter table contract add column if not exists settled_at           date;    -- 정산일
alter table contract add column if not exists cost_planned         bigint;  -- 안전보건 관리비 계상액(원)
alter table contract add column if not exists cost_settled         bigint;  -- 안전보건 관리비 실사용 정산액(원)

create table if not exists contract_eval_item (
  item_no          int primary key,    -- 평가 항목 순번
  item_code        text,               -- 평가 항목 코드(EV01~)
  group_code       text,               -- 묶음 코드(가·나·다)
  group_name       text,               -- 묶음 이름(체계·실행·운영)
  item_name        text,               -- 평가 항목 이름
  pt_good          int,                -- 우수 점수
  pt_mid           int,                -- 보통 점수
  pt_low           int,                -- 미흡 점수
  mid_hint         text,               -- 보통 판단 예시
  low_hint         text,               -- 미흡 판단 예시
  default_weight   int,                -- 기본 가중치
  source           text,               -- 출처 자료(쪽 번호)
  basis            text,               -- 근거 조문
  basis_unit_id    text                -- 근거 조항호목 번호(정본)
);

create table if not exists contract_eval_score (
  score_id         text primary key,   -- 평가 기록 번호(화면이 씀)
  contract_id      text,               -- 계약 번호
  eval_date        date,               -- 평가일
  work_risk        text,               -- 작업 위험도
  pass_mark        int,                -- 적용한 합격선
  total            int,                -- 100점 환산 점수
  result           text,               -- 합격·미달
  weights          text,               -- 적용한 가중치(쉼표 구분)
  evaluated_by     text,               -- 평가한 사람
  note             text,               -- 평가 메모
  p1               int,                -- 항목 1 점수(우수 5·보통 3·미흡 1)
  p2               int,                -- 항목 2 점수
  p3               int,                -- 항목 3 점수
  p4               int,                -- 항목 4 점수
  p5               int,                -- 항목 5 점수
  p6               int,                -- 항목 6 점수
  p7               int,                -- 항목 7 점수
  p8               int,                -- 항목 8 점수
  p9               int,                -- 항목 9 점수
  p10              int                 -- 항목 10 점수
);

create table if not exists contract_eval_setting (
  setting_id       text primary key,   -- 설정 번호(가장 늦은 줄이 지금 설정 · 화면이 씀)
  pass_default     int,                -- 합격선 — 기본
  pass_general     int,                -- 합격선 — 일반 작업
  pass_risk        int,                -- 합격선 — 위험장소 작업
  pass_fire        int,                -- 합격선 — 화재·폭발·밀폐 작업
  weights          text,               -- 항목별 가중치(쉼표 구분)
  set_at           timestamptz,        -- 설정 일시
  set_by           text                -- 설정한 사람
);

-- ── 3. 개선·시정명령 — 문서 성격·재해 구분 ────────────────────────────────
alter table order_received add column if not exists doc_nature   text;       -- 문서 성격(서면 행정처분·지도·권고·조언)
alter table order_received add column if not exists order_area   text;       -- 재해 구분(화면이 씀)
alter table order_received add column if not exists basis_clause text;       -- 적용 조문(재해 구분에 따라 · 화면이 씀)

-- ── 4. 교육 — 재해 구분별 점검 (시행령 제5조·제9조·제11조 각 제2항제3호) ─────
alter table training_course add column if not exists area text;               -- 재해 구분(I 산업·F 시설교통·M 원료제조물)

create table if not exists training_check (
  check_id         text primary key,   -- 점검 기록 번호(화면이 씀)
  area             text,               -- 재해 구분(I·F·M)
  period           text,               -- 점검 기간(반기 또는 연)
  half             text,               -- 반기
  checked_at       date,               -- 점검일
  checked_by       text,               -- 점검한 사람
  method           text,               -- 점검 방식(직접 점검·점검 결과 보고받음)
  proxy            text,               -- 총괄이 대신 적은 기록 Y
  summary          text,               -- 점검 결과 요약
  note             text                -- 비고
);

-- ── 5. 예산 — 재해 구분 ───────────────────────────────────────────────────
alter table safety_budget add column if not exists area text;                 -- 재해 구분(I·F·M · 화면이 씀)

-- ── 6. 점검 한 바퀴 — 위탁 점검 · 조치 구분 · 필요한 조치 ─────────────────
alter table inspection_batch add column if not exists rule_basis         text;         -- 근거 주기(의무조항 코드로 자동 · 화면이 씀)
alter table inspection_batch add column if not exists insp_method        text;         -- 점검 방식(직접 점검·위탁 점검 · 화면이 씀)
alter table inspection_batch add column if not exists outsource_org      text;         -- 위탁 점검 기관(화면이 씀)
alter table inspection_batch add column if not exists report_received_at date;         -- 위탁 점검 결과 보고받은 날(화면이 씀)
alter table inspection_batch add column if not exists report_received_by text;         -- 보고받은 사람(화면이 씀)
alter table inspection_batch add column if not exists report_recorded_by text;         -- 보고받음을 기록한 사람(화면이 씀)
alter table inspection_batch add column if not exists report_proxy       text;         -- 총괄이 대신 적은 보고 기록 Y(화면이 씀)

alter table action add column if not exists action_basis     text;                     -- 조치 근거 조문(법정 조치 구분일 때 · 화면이 씀)
alter table action add column if not exists prev_action_type text;                     -- 바꾸기 전 조치 구분(화면이 씀)

alter table inspection add column if not exists action_need text;                      -- 판정 때 고른 필요한 조치(화면이 씀)

alter table evidence add column if not exists file_type text;                          -- 올린 파일 형식(화면이 씀)

alter table compliance_task add column if not exists resubmit_round int;               -- 보완 제출 뒤 다음 판정 차수(화면이 씀)
alter table compliance_task add column if not exists resubmit_note  text;              -- 보완 제출 때 부서가 적은 말(화면이 씀)
