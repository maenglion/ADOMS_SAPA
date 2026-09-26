-- ADOMS 데모 2차 — ops_v0.3 · v0.4 추가분 (2026-09-21)
--
-- ★ 이 파일을 ops_v0.1 · ops_v0.2 다음에 돌린다.
--   v0.3 에서 **표 2개**가 늘었고, v0.4 에서 contract 에 **칸 8개**가 늘었다.
--   이것을 먼저 돌리지 않으면 CSV 적재가 그 표에서 멈춘다.
--
-- 스키마: adoms2

set search_path to adoms2, public;

-- ── 1. 위험성평가 (v0.3 신설) ─────────────────────────────────────
-- 중대재해처벌법 시행령 제4조제3호 「유해·위험요인을 확인·개선하는 절차」의 실물.
create table if not exists risk_assessment (
  risk_id            text primary key,
  title              text,
  dept_id            text references org_dept(dept_id),
  place              text,                       -- 평가한 현장
  method             text,                       -- 체크리스트법 · 위험성 수준 3단계 판단법 등
  assessed_at        date,
  assessor_staff_id  text references staff(staff_id),
  worker_joined      text,                       -- 종사자 참여 Y/N (시행령 제4조제3호)
  review_cycle       text,
  next_due           date,
  status             text,                       -- 완료 · 진행 중
  note               text,
  created_at         timestamptz default now()
);

create table if not exists risk_assessment_item (
  risk_item_id     text primary key,
  risk_id          text references risk_assessment(risk_id),
  hazard_factor    text,                         -- 위험요인
  hazard_kind      text,                         -- 추락 · 질식 · 전기 · 기계 · 화학 · 교통 · 관리
  risk_level       text,                         -- 높음 · 보통 · 낮음
  measure          text,                         -- 개선 조치
  measure_due      date,
  measure_done_at  date,
  owner_staff_id   text references staff(staff_id),
  note             text
);

create index if not exists ix_risk_item_risk on risk_assessment_item(risk_id);
create index if not exists ix_risk_dept on risk_assessment(dept_id);

-- ── 2. 계약 칸 늘리기 (v0.4) ──────────────────────────────────────
-- 도급·용역·위탁 71건을 담으려면 아래 칸이 있어야 한다.
alter table contract add column if not exists contract_method   text;  -- 제한경쟁·수의계약·협상에 의한 계약
alter table contract add column if not exists trade             text;  -- 토목·건축·전기·기계·환경·조경·안전·정보·서비스·물품
alter table contract add column if not exists safety_cost       bigint;-- 산업안전보건관리비(공사)
alter table contract add column if not exists worker_cnt        int;   -- 투입 인원
alter table contract add column if not exists subcontract       text;  -- 재하도급 Y/N
alter table contract add column if not exists eval_score        int;   -- 수급인 안전보건 수준평가 점수
alter table contract add column if not exists eval_date         date;  -- 평가 실시일
alter table contract add column if not exists manager_staff_id  text references staff(staff_id);

-- ── 3. 시연 중 입력분을 담을 자리 ────────────────────────────────
-- CSV 로 돌릴 때는 덮개 파일(.data/overlay.json)에 쌓이지만,
-- Supabase 로 옮기면 여기에 바로 들어간다. 무엇이 시연 입력인지 구분하려고 둔다.
alter table evidence        add column if not exists entered_in_demo boolean default false;
alter table compliance_task add column if not exists entered_in_demo boolean default false;

-- ── 4. 뷰 ────────────────────────────────────────────────────────
create or replace view v_risk_overview as
select r.risk_id, r.title, r.place, r.dept_id, d.dept_name, r.method,
       r.assessed_at, r.worker_joined, r.status, r.next_due,
       count(i.risk_item_id)                                              as item_cnt,
       count(*) filter (where i.risk_level = '높음')                       as high_cnt,
       count(*) filter (where i.measure_done_at is not null)               as done_cnt
from risk_assessment r
left join risk_assessment_item i on i.risk_id = r.risk_id
left join org_dept d on d.dept_id = r.dept_id
group by r.risk_id, r.title, r.place, r.dept_id, d.dept_name, r.method,
         r.assessed_at, r.worker_joined, r.status, r.next_due;

-- 수급인(업체) 단위로 묶어 본다 — 한 업체에 일이 얼마나 몰렸는지, 빠진 것이 있는지.
create or replace view v_vendor as
select c.counterpart                                                      as vendor,
       min(c.trade)                                                       as trade,
       count(*)                                                           as contract_cnt,
       sum(c.amount)                                                      as amount_sum,
       sum(coalesce(c.worker_cnt, 0))                                     as worker_sum,
       count(*) filter (where c.safety_clause like '%없음%')               as no_clause_cnt,
       count(*) filter (where c.evaluation_done <> 'Y')                   as no_eval_cnt,
       count(*) filter (where c.subcontract = 'Y')                        as subcontract_cnt,
       round(avg(c.eval_score))                                           as eval_score_avg
from contract c
group by c.counterpart;

-- 권한 — 화면은 anon 으로 읽기만 한다.
grant usage on schema adoms2 to anon, authenticated;
grant select on risk_assessment, risk_assessment_item, v_risk_overview, v_vendor to anon, authenticated;

alter table risk_assessment       enable row level security;
alter table risk_assessment_item  enable row level security;
create policy if not exists p_risk_read      on risk_assessment      for select using (true);
create policy if not exists p_risk_item_read on risk_assessment_item for select using (true);
