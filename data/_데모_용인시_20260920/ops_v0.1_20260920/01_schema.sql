-- 용인시 데모 2차 · 운영 테이블 (PostgreSQL / Supabase)
-- 설계: 20_개발\_데모_용인시_20260920\01_설계\(설계)ADOMS_데모2차_ERD·프로세스_20260920_v0.1.html
-- 규칙: 화면은 이 표를 직접 읽지 않는다 — 02_views.sql 의 뷰만 읽는다.

create schema if not exists adoms2;
set search_path = adoms2, public;

-- ② 분류층(읽기 전용 · 정본+분류 스냅숏) -------------------------------------
create table if not exists duty_class (
  duty_key        text primary key,
  yongin_mark     text,                     -- Y · 조건부
  area            text,                     -- I · F · M
  code36          text,  code36_name text,  -- 중처법 의무조항 36
  task_name       text,                     -- 2단 세부 이행업무(문서+조)
  target_code     text,  target_name  text, -- 관리대상 TG
  impl_type       text,  impl_type_name text,-- 이행 유형 T
  law_group       text,  law_group_name text,
  law text, doc text, layer text, unit_label_ko text, article_title text, duty_name text,
  verdict text, duty_subject text, cycle_text text, assign_basis text, evidence_kind text,
  badge text, why text, source_text text,
  law_id text, doc_id text, unit_id text, schedule_id text, obl_id text,
  review_status   text default 'pending'
);
create index if not exists ix_duty_code on duty_class(code36);
create index if not exists ix_duty_target on duty_class(target_code);
create index if not exists ix_duty_law on duty_class(law);

-- ③ 기관층 -------------------------------------------------------------------
create table if not exists org_dept (
  dept_id text primary key, dept_name text not null, dept_role text, parent_dept_id text
);
create table if not exists staff (
  staff_id text primary key, display_name text not null, dept_id text references org_dept(dept_id),
  duty_role text, email text, phone text, note text   -- note: 2026-09-21 추가(가상 인물·점검반 표시)
);
create table if not exists asset (
  asset_id text primary key, asset_name text, asset_gbn text, asset_kind text, asset_class text,
  safety_grade text, completed_ymd text, addr text,
  dept_id text references org_dept(dept_id), source text,
  sapa_l2_result text, sapa_basis text, need_data text, verified text default 'N'
);
create table if not exists asset_target_map (
  asset_id text references asset(asset_id), target_code text, basis text, confidence text,
  primary key (asset_id, target_code)
);

-- ④ 배정층 -------------------------------------------------------------------
create table if not exists duty_assignment (
  assign_id text primary key,
  duty_key text references duty_class(duty_key),
  asset_id text references asset(asset_id),           -- null 이면 유형·기관 단위
  scope text check (scope in ('기관','유형','자산')),
  target_code text,
  dept_id text references org_dept(dept_id),
  owner_staff_id text references staff(staff_id),      -- 담당자 정
  deputy_staff_id text references staff(staff_id),     -- 담당자 부
  applicability text check (applicability in ('해당','비해당','확인필요')) default '확인필요',
  applicability_note text, cycle text, cycle_days int,
  decided_by text, decided_at timestamptz, badge text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ix_asg_dept on duty_assignment(dept_id);
create index if not exists ix_asg_duty on duty_assignment(duty_key);

-- ⑤ 이행층 -------------------------------------------------------------------
create table if not exists compliance_task (
  task_id text primary key,
  assign_id text references duty_assignment(assign_id),
  period_label text, due_date date,
  status text check (status in ('이행대기','기간초과','이행완료','조치필요','점검완료')) default '이행대기',
  done_at date, done_by text references staff(staff_id), remark text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ix_task_status on compliance_task(status);
create index if not exists ix_task_due on compliance_task(due_date);

create table if not exists form_template (
  form_id text primary key, title text, doc_id text, law_id text, schedule_kind text,
  schedule_no text, source text, file_html text, file_docx text, canon_release text
);
create table if not exists evidence (
  evidence_id text primary key, task_id text references compliance_task(task_id),
  evidence_kind text, file_name text, file_url text, form_id text references form_template(form_id),
  uploaded_by text references staff(staff_id), uploaded_at timestamptz default now(), note text
);
create table if not exists inspection (
  insp_id text primary key, task_id text references compliance_task(task_id),
  inspector_staff_id text references staff(staff_id), insp_date date,
  result text check (result in ('적합','부적합','보류')), finding text, note text
);
create table if not exists action (
  action_id text primary key, insp_id text references inspection(insp_id),
  action_type text, due_date date, done_at date, result text, note text
);
-- ★ 2026-09-21 컬럼 이름 정정 — 시드 CSV·앱 코드와 어긋나 적재가 멈추던 자리.
--   noti_id→notif_id · kind→notif_type · staff_id→to_staff_id · body→message · note 추가
--   (스키마 카탈로그 _build/export_schema.py 가 찾아냈다. 아직 어디에도 적재하지 않았으므로 여기서 고친다.)
create table if not exists notification (
  notif_id text primary key, to_staff_id text references staff(staff_id),
  task_id text references compliance_task(task_id), notif_type text,
  sent_at timestamptz default now(), read_at timestamptz, message text, note text
);
