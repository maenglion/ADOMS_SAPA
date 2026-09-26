-- 화면이 읽는 뷰 (테이블 직접 접근 금지)
set search_path = adoms2, public;

-- 담당자 To-Do
create or replace view v_duty_todo as
select t.task_id, t.status, t.due_date, (t.due_date - current_date) as days_left,
       a.assign_id, a.dept_id, d0.dept_name, a.owner_staff_id, a.deputy_staff_id,
       a.applicability, a.scope, a.asset_id, s.asset_name,
       c.duty_key, c.area, c.code36, c.code36_name, c.impl_type, c.impl_type_name,
       c.target_code, c.target_name, c.law, c.doc, c.unit_label_ko, c.duty_name,
       c.evidence_kind, c.badge, c.yongin_mark
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join duty_class c on c.duty_key = a.duty_key
left join asset s on s.asset_id = a.asset_id
left join org_dept d0 on d0.dept_id = a.dept_id;

-- 의무 상세(조문·증빙·서식)
create or replace view v_duty_detail as
select c.*, f.form_id, f.title as form_title, f.source as form_source
from duty_class c
left join form_template f on f.form_id = c.schedule_id;

-- 관리대상(자산) 화면
create or replace view v_asset_duty as
select s.asset_id, s.asset_name, s.asset_gbn, s.asset_kind, s.asset_class, s.safety_grade,
       s.dept_id, s.sapa_l2_result, m.target_code, c.duty_key, c.code36, c.code36_name,
       c.impl_type_name, c.law, c.unit_label_ko, c.duty_name, c.badge, c.yongin_mark
from asset s
join asset_target_map m on m.asset_id = s.asset_id
join duty_class c on c.target_code = m.target_code;

-- 부서별 진도
create or replace view v_dept_progress as
select d0.dept_id, d0.dept_name, t.status, count(*) as cnt
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join org_dept d0 on d0.dept_id = a.dept_id
group by 1,2,3;

-- 법령 화면 (그룹 → 법률 → 문서 → 조)
create or replace view v_law_tree as
select law_group, law_group_name, law, doc, layer, unit_label_ko, article_title,
       count(*) as duty_cnt, min(code36) as sample_code
from duty_class group by 1,2,3,4,5,6,7;

-- 대시보드 요약
create or replace view v_kpi_summary as
select c.area, c.code36, c.code36_name,
       count(*) filter (where t.status = '이행완료') as done,
       count(*) filter (where t.status = '점검완료') as checked,
       count(*) filter (where t.status = '조치필요') as need_action,
       count(*) filter (where t.status = '기간초과') as overdue,
       count(*) filter (where t.status = '이행대기') as waiting,
       count(*) as total
from compliance_task t
join duty_assignment a on a.assign_id = t.assign_id
join duty_class c on c.duty_key = a.duty_key
group by 1,2,3;
