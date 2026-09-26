-- ADOMS 데모 2차 — ops_v0.6 추가분 (2026-09-21)
--
-- ★ 이 파일을 ops_v0.1 · v0.2 · ops_v03_v04_add.sql · ops_v05_add.sql 다음에 돌린다.
--   v0.6 에서 늘어난 것:
--   · 표 9개 — 연간 일정(annual_schedule) · 시민재해 체계(civil_safety_plan · civil_manual)
--              유해·위험요인 신고(hazard_report · hazard_step) · 대피훈련(drill_plan · drill_eval)
--              재해 발생 이력 없음 확인(incident_nil_check) · 교육 과정(training_course)
--   · 칸 — incident 29 · order_received 21 · safety_budget 5 · training_record 10
--     (시드 CSV 에 있는 칸 + 화면이 appendRow·patchRow 로 쓰는 칸. 「화면이 씀」 표시는 CSV 에는 없는 칸)
--   모두 if not exists 라 여러 번 돌려도 안전하다. 칸은 지우지 않는다.
--   자료형은 시드 값으로 골랐다(날짜만 있으면 date · 시각까지 있으면 timestamptz · 숫자만 있으면 int/bigint).
--   외래키는 걸지 않는다 — 예시 자료에 자산 대장 밖 시설(용인경전철 LRT-EVERLINE)과 미지정 부서(D99)가 있다.
--
-- 근거 조문(생성기 머리말에서 원문 대조한 것)
--   중대재해처벌법 법 제4조제1항제2호·제3호 · 제9조제1항·제2항 제2호·제3호(재발방지·개선명령)
--   시행령 제4조제4호(예산) · 제5조제2항제3호·제4호(교육 점검) · 제10조제4·5·7·8호 · 제11조제2항(시민재해 체계)
--   시설물안전법 제24조제1항 · 시행령 제19조(보수·보강 착수·완료 기한)
--
-- 스키마: adoms2

set search_path to adoms2, public;

-- ── 1. 연간 일정 — 법이 날짜를 정하지 않은 운영 일정(서울시 안내서 예시) ────────
create table if not exists annual_schedule (
  sched_id        text primary key,    -- 일정 번호
  kind            text,                -- 일정 종류(서울시 운영 예시 등)
  title           text,                -- 일정 이름
  month_from      int,                 -- 시작 월
  day_from        int,                 -- 시작 일
  month_to        int,                 -- 끝 월
  day_to          int,                 -- 끝 일
  basis           text,                -- 관련 조문(날짜는 법에 없음을 함께 적음)
  source          text,                -- 출처 자료(쪽·표 번호)
  href            text,                -- 이어지는 화면 주소
  note            text                 -- 비고
);

-- ── 2. 시민재해 체계 (시행령 제10조·제11조) ───────────────────────────
create table if not exists civil_safety_plan (
  plan_id         text primary key,    -- 안전계획 번호
  plan_year       int,                 -- 계획 연도
  facility_kind   text,                -- 공중이용시설 · 공중교통수단
  asset_id        text,                -- 자산 번호(FMS)
  facility_name   text,                -- 시설 이름
  asset_gbn       text,                -- 시설 구분(건축물·교량·터널 등)
  asset_kind      text,                -- 시설 종류
  asset_class     text,                -- 종별(1·2·3종)
  dept_id         text,                -- 관리 부서
  plan_status     text,                -- 수립 · 작성중 · 미수립
  plan_basis      text,                -- 계획 근거(자체 안전계획 · 시설물안전법 제6조 · 철도안전법 제6조)
  ceo_confirmed   text,                -- 경영책임자 확인·보고받음 Y/N(제4호 단서 갈음 성립 조건)
  confirmed_at    date,                -- 경영책임자 확인·보고받은 날
  mok_ga          text,                -- 가목(인력) 포함 Y/N
  mok_na          text,                -- 나목(점검) 포함 Y/N
  mok_da          text,                -- 다목(보수·보강) 포함 Y/N
  items_planned   int,                 -- 계획 항목 수
  items_done      int,                 -- 이행한 항목 수
  established_at  date,                -- 계획 수립일
  owner_staff_id  text,                -- 담당자
  note            text,                -- 비고
  confirm_proxy   text,                -- 총괄이 대신 적은 확인 기록 Y(화면이 씀)
  confirmed_by    text                 -- 확인을 기록한 사람(화면이 씀)
);

create table if not exists civil_manual (
  manual_id       text primary key,    -- 절차·매뉴얼·기록 번호
  clause_ref      text,                -- 시행령 조·호(10-7 = 제10조제7호)
  record_kind     text,                -- 업무처리절차 · 매뉴얼 · 반기 점검 · 교육 이수 점검 · 대피훈련
  title           text,                -- 제목
  covers          text,                -- 담은 목(가·나·다·라)
  missing         text,                -- 빠진 목
  basis           text,                -- 갈음 근거(철도안전법 제7조 등)
  asset_id        text,                -- 자산 번호
  facility_name   text,                -- 시설 이름
  enacted_at      date,                -- 제정일
  revised_at      date,                -- 개정일
  done_at         date,                -- 실시일
  last_check_at   date,                -- 최근 점검일
  reported_at     date,                -- 경영책임자 보고일
  participants    int,                 -- 참석 인원
  owner_staff_id  text,                -- 담당자
  note            text                 -- 비고
);

-- ── 3. 유해·위험요인 신고·조치 (시행령 제10조제7호 · 시설물안전법 제24조) ─────
create table if not exists hazard_report (
  hz_id             text primary key,  -- 신고 번호
  received_at       timestamptz,       -- 접수 일시
  channel           text,              -- 접수 경로(상시점검·직원 발견·시민 신고)
  channel_detail    text,              -- 세부 경로(안전신문고·120 등)
  reporter          text,              -- 신고한 사람
  received_by       text,              -- 접수한 사람
  asset_id          text,              -- 자산 번호
  asset_name        text,              -- 시설 이름
  asset_gbn         text,              -- 시설 구분
  asset_class       text,              -- 종별
  dept_id           text,              -- 관리 부서
  location          text,              -- 위치
  description       text,              -- 위험요인 설명
  code_group        text,              -- 유해·위험요인 대분류(이용자 안전·시설물 안전)
  code              text,              -- 유해·위험요인 분류 코드
  accident_type     text,              -- 사고 유형(넘어짐·부딪힘 등)
  possible_accident text,              -- 예상되는 사고
  photo_wide        text,              -- 전경 사진 주소
  photo_close       text,              -- 근접 사진 주소
  protect_action    text,              -- 피해방지조치(대피·접근차단·통제)
  protect_at        timestamptz,       -- 피해방지조치 일시
  protect_by        text,              -- 피해방지조치한 사람
  severity          text,              -- 1차 판단(경미·심각)
  judged_by         text,              -- 판단한 사람
  judged_at         timestamptz,       -- 판단 일시
  judge_memo        text,              -- 판단 메모
  minor_action      text,              -- 경미 건 즉시 조치 내용
  closed_at         date,              -- 종결일
  closed_by         text,              -- 종결한 사람
  notified_reporter text,              -- 신고자 결과 통보 Y/N
  notified_at       date,              -- 신고자 통보일
  ceo_reported_at   timestamptz,       -- 경영책임자 보고 일시
  ceo_report_mode   text,              -- 보고 방식(서면·구두 선보고 후 서면)
  ceo_reported_by   text,              -- 보고한 사람
  ceo_instruction   text,              -- 경영책임자 지시
  insp_at           date,              -- 긴급안전점검일
  insp_by           text,              -- 긴급안전점검한 사람
  insp_result       text,              -- 긴급안전점검 결과
  order_types       text,              -- 개선 지시 종류(이용제한·보수·보강·정밀안전진단)
  order_at          date,              -- 개선 지시일
  order_memo        text,              -- 개선 지시 메모
  fsam_applies      text,              -- 시설물안전법 제24조 기한 적용 Y/N
  basis_date        date,              -- 기한 기준일(조치명령·통보를 받은 날)
  fix_items         text,              -- 보수·보강 계획(항목~물량~비용~기간)
  fix_budget        text,              -- 보수·보강 예산 확보 상태
  fix_started_at    date,              -- 보수·보강 착수일
  fix_done_at       date,              -- 보수·보강 완료일
  done_at           date,              -- 처리 완료일
  note              text               -- 비고
);

create table if not exists hazard_step (
  step_id         text primary key,    -- 처리 기록 번호
  hz_id           text,                -- 신고 번호
  step            text,                -- 처리 단계(접수·피해방지조치·1차 판단 …)
  at              timestamptz,         -- 처리 일시
  by              text,                -- 처리한 사람
  memo            text,                -- 처리 메모
  note            text                 -- 비고
);

-- ── 4. 대피훈련 (시행령 제10조제7호 라목 · 단서 철도안전법 제7조) ──────────
create table if not exists drill_plan (
  drill_id          text primary key,  -- 훈련 번호
  target_key        text,              -- 대상 열쇠(자산 번호 또는 LRT-EVERLINE)
  target_name       text,              -- 대상 이름
  target_kind       text,              -- 공중교통수단 · 제1종시설물 · 2종시설물
  asset_class       text,              -- 종별
  legal_scope       text,              -- 법정 대상 · 자체 확대
  dept_id           text,              -- 관리 부서
  year              int,               -- 연도
  half              text,              -- 반기
  drill_type        text,              -- 훈련 유형(화재·지진·위험물 누출)
  method            text,              -- 훈련 방식(실행기반·토론기반·도상+실제)
  planned_at        timestamptz,       -- 계획 일시
  place             text,              -- 훈련 장소
  scenario          text,              -- 시나리오
  target_minutes    int,               -- 목표 대피시간(분)
  prep_coop         text,              -- 준비 — 사전협조 완료 여부
  prep_items        text,              -- 준비 — 훈련준비 완료 여부
  prep_budget       text,              -- 준비 — 예산·행정 완료 여부
  prep_memo         text,              -- 준비 메모
  carry_over        text,              -- 지난 훈련에서 넘겨받은 개선 과제
  r_cmd_main        text,              -- 임무 — 위기상황 총괄자(정)
  r_cmd_sub         text,              -- 임무 — 위기상황 총괄자(부)
  r_evac_main       text,              -- 임무 — 대피유도팀(정)
  r_evac_sub        text,              -- 임무 — 대피유도팀(부)
  r_resp_main       text,              -- 임무 — 현장대응팀(정)
  r_resp_sub        text,              -- 임무 — 현장대응팀(부)
  r_aid_main        text,              -- 임무 — 구호지원팀(정)
  r_aid_sub         text,              -- 임무 — 구호지원팀(부)
  r_eval_main       text,              -- 임무 — 훈련 검증자(정)
  r_eval_sub        text,              -- 임무 — 훈련 검증자(부)
  status            text,              -- 진행 상태(계획·준비·실시·평가 완료)
  done_at           date,              -- 훈련 실시일
  actual_minutes    int,               -- 실제 대피시간(분)
  participants      int,               -- 참여 인원
  absent            int,               -- 불참 인원
  photos            text,              -- 사진 주소(「 | 」로 구분)
  good_points       text,              -- 잘된 점
  shortfalls        text,              -- 미흡사항
  improvements      text,              -- 개선사항(다음 훈련 과제)
  substitute        text,              -- 비상대응계획으로 갈음 Y/N
  substitute_basis  text,              -- 갈음 근거
  ceo_checked       text,              -- 경영책임자 확인 Y/N
  ceo_checked_at    date,              -- 경영책임자 확인일
  ceo_check_mode    text,              -- 확인 방식(직접 확인·보고받음)
  note              text               -- 비고
);

create table if not exists drill_eval (
  eval_id         text primary key,    -- 평가 번호
  drill_id        text,                -- 훈련 번호
  evaluator       text,                -- 평가자
  evaluated_at    date,                -- 평가일
  p1              int,                 -- 계획 — 훈련계획 문서 수립(10점)
  p2              int,                 -- 계획 — 시나리오 적정성(10점)
  p3              int,                 -- 계획 — 참석대상 통보·사전 교육(5점)
  p4              int,                 -- 계획 — 시설·장비 준비 확인(5점)
  c1              int,                 -- 전파 — 사전안내·안내방송·교육(10점)
  c2              int,                 -- 전파 — 신고·경보·자위소방대 연락(10점)
  x1              int,                 -- 실행 — 목표시간 내 대피(10점)
  x2              int,                 -- 실행 — 병목 없는 대피유도(10점)
  x3              int,                 -- 실행 — 관계자·이용자 모두 참석(5점)
  x4              int,                 -- 실행 — 유관기관 협업(5점)
  e1              int,                 -- 평가 — 종료 후 평가 실시(10점)
  e2              int,                 -- 평가 — 결과보고서에 잘된 점·개선사항(10점)
  total           int,                 -- 합계(100점)
  comment         text,                -- 평가 의견
  note            text                 -- 비고
);

-- ── 5. 재발방지 (법 제4조제1항제2호 · 제9조 각 항 제2호) ──────────────────
create table if not exists incident_nil_check (
  nil_id          text primary key,    -- 확인 번호
  period          text,                -- 반기(2026-H1 등)
  dept_id         text,                -- 부서
  confirmed_by    text,                -- 확인한 사람
  confirmed_at    date,                -- 확인일
  memo            text,                -- 확인 메모
  note            text                 -- 비고
);

alter table incident add column if not exists event_class       text;         -- 구분(산업재해·시민재해·아차사고)
alter table incident add column if not exists event_area        text;         -- 피해 대상(산업·시민)
alter table incident add column if not exists serious           text;         -- 중대재해 해당 여부(해당·해당 안 됨·확인 필요)
alter table incident add column if not exists accident_type     text;         -- 사고 유형(추락·끼임 등)
alter table incident add column if not exists place             text;         -- 발생 장소
alter table incident add column if not exists basis_clause      text;         -- 적용 조문(법 제4조제1항제2호 등)
alter table incident add column if not exists reported_by       text;         -- 등록한 사람
alter table incident add column if not exists owner_staff_id    text;         -- 담당자
alter table incident add column if not exists cause_due         date;         -- 원인 조사 기한
alter table incident add column if not exists investigated_at   date;         -- 원인 조사일
alter table incident add column if not exists investigated_by   text;         -- 원인 조사한 사람
alter table incident add column if not exists cause_evidence    text;         -- 조사 기록(파일 이름)
alter table incident add column if not exists plan_set_due      date;         -- 대책 수립 기한
alter table incident add column if not exists plan_set_at       date;         -- 대책 수립일
alter table incident add column if not exists plan_set_by       text;         -- 대책 수립한 사람
alter table incident add column if not exists plan_evidence     text;         -- 대책 문서(파일 이름)
alter table incident add column if not exists done_note         text;         -- 이행 내용
alter table incident add column if not exists done_evidence     text;         -- 이행 증빙(파일 이름)
alter table incident add column if not exists done_by           text;         -- 이행한 사람
alter table incident add column if not exists effect_due        date;         -- 효과 확인 예정일
alter table incident add column if not exists effect_checked_at date;         -- 효과 확인일
alter table incident add column if not exists effect_checked_by text;         -- 효과 확인한 사람
alter table incident add column if not exists effect_result     text;         -- 효과 판단(유효·재검토 필요)
alter table incident add column if not exists effect_note       text;         -- 효과 판단 근거
alter table incident add column if not exists effect_evidence   text;         -- 효과 확인 증빙(파일 이름)
alter table incident add column if not exists related_order_id  text;         -- 관련 명령 번호
alter table incident add column if not exists check_note        text;         -- 옮겨 온 행의 확인 필요 사항
alter table incident add column if not exists history           text;         -- 효과 확인 이력(「 | 」로 이어 적음 · 화면이 씀)
alter table incident add column if not exists reopen_count      int;          -- 대책 수립으로 되돌린 횟수(화면이 씀)

-- ── 6. 개선·시정명령 (법 제4조제1항제3호 · 제9조 각 항 제3호) ─────────────
alter table order_received add column if not exists issuer_kind         text;  -- 발령기관 구분(중앙행정기관·지방자치단체)
alter table order_received add column if not exists law_article         text;  -- 근거 조문
alter table order_received add column if not exists order_no            text;  -- 문서 번호
alter table order_received add column if not exists place               text;  -- 대상 장소
alter table order_received add column if not exists owner_staff_id      text;  -- 담당자
alter table order_received add column if not exists assigned_at         date;  -- 담당 지정일
alter table order_received add column if not exists action_plan         text;  -- 이행 계획
alter table order_received add column if not exists started_at          date;  -- 이행 착수일
alter table order_received add column if not exists done_note           text;  -- 이행 내용
alter table order_received add column if not exists done_by             text;  -- 이행한 사람
alter table order_received add column if not exists reported_at         date;  -- 이행 결과 보고일
alter table order_received add column if not exists report_evidence     text;  -- 보고 문서(파일 이름)
alter table order_received add column if not exists closed_at           date;  -- 종결일
alter table order_received add column if not exists closed_note         text;  -- 발령기관 확인 방법
alter table order_received add column if not exists extended_due        date;  -- 연장된 기한
alter table order_received add column if not exists extend_reason       text;  -- 연장 근거
alter table order_received add column if not exists related_incident_id text;  -- 관련 사고 번호
alter table order_received add column if not exists check_note          text;  -- 옮겨 온 행의 확인 필요 사항
alter table order_received add column if not exists note                text;  -- 비고

-- ── 7. 예산 편성·집행 (시행령 제4조제4호 가·나목) ─────────────────────────
alter table safety_budget add column if not exists budget_item  text;          -- 예산 항목(고정 6행 이름)
alter table safety_budget add column if not exists budget_use   text;          -- 제4호 용도(가·나·밖)
alter table safety_budget add column if not exists use_basis    text;          -- 용도 근거 조문
alter table safety_budget add column if not exists risk_item_id text;          -- 나목 — 개선할 위험요인 항목 번호
alter table safety_budget add column if not exists updated_at   date;          -- 고친 날

-- ── 8. 교육 (시행령 제5조제2항제3호·제4호) ────────────────────────────────
create table if not exists training_course (
  course_id       text primary key,    -- 교육 과정 번호
  course_name     text,                -- 과정명
  law             text,                -- 근거 법령
  basis           text,                -- 근거 조문(법·시행규칙·별표)
  target          text,                -- 교육 대상
  cycle           text,                -- 주기(반기·연·채용 시 …)
  cycle_months    int,                 -- 주기(개월)
  required_hours  text,                -- 법정 시간(원문 요지)
  applies_depts   text,                -- 적용 부서(공백 구분 · 예시)
  hazardous_work  text,                -- 유해·위험 작업 교육 Y/N
  note            text                 -- 비고
);

alter table training_record add column if not exists course_id      text;      -- 교육 과정 번호
alter table training_record add column if not exists period         text;      -- 교육 기간 표시(2026년·상반기 등)
alter table training_record add column if not exists due_date       date;      -- 이수 기한
alter table training_record add column if not exists status         text;      -- 이수 상태(이수·미실시)
alter table training_record add column if not exists note           text;      -- 비고
alter table training_record add column if not exists instructed_at  date;      -- 이행 지시일(제4호 · 화면이 씀)
alter table training_record add column if not exists instructed_by  text;      -- 이행 지시한 사람(화면이 씀)
alter table training_record add column if not exists instruct_due   date;      -- 지시한 이수 기한(화면이 씀)
alter table training_record add column if not exists instruct_basis text;      -- 지시 근거 조문(화면이 씀)
alter table training_record add column if not exists done_by        text;      -- 이수 등록한 사람(화면이 씀)
