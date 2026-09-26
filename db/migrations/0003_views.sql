-- ADOMS SAPA required PostgreSQL views.
-- These four views are the DB-mode calls recorded in db_calls.csv.

SET search_path TO adoms2, public;

CREATE OR REPLACE VIEW adoms2.v_duty_todo AS
SELECT t.task_id,
       t.status,
       t.due_date,
       (NULLIF(t.due_date, '')::date - current_date) AS days_left,
       a.assign_id,
       a.dept_id,
       d0.dept_name,
       a.owner_staff_id,
       a.deputy_staff_id,
       a.applicability,
       a.scope,
       a.asset_id,
       s.asset_name,
       c.duty_key,
       c.area,
       c.code36,
       c.code36_name,
       c.impl_type,
       c.impl_type_name,
       c.target_code,
       c.target_name,
       c.law,
       c.doc,
       c.unit_label_ko,
       c.duty_name,
       c.evidence_kind,
       c.badge,
       c.yongin_mark
FROM adoms2.compliance_task AS t
JOIN adoms2.duty_assignment AS a ON a.assign_id = t.assign_id
JOIN adoms2.duty_class AS c ON c.duty_key = a.duty_key
LEFT JOIN adoms2.asset AS s ON s.asset_id = a.asset_id
LEFT JOIN adoms2.org_dept AS d0 ON d0.dept_id = a.dept_id;

CREATE OR REPLACE VIEW adoms2.v_duty_detail AS
SELECT c.*,
       f.form_id,
       f.title AS form_title,
       f.source AS form_source
FROM adoms2.duty_class AS c
LEFT JOIN adoms2.form_template AS f ON f.form_id = c.schedule_id;

CREATE OR REPLACE VIEW adoms2.v_task_approval AS
SELECT t.task_id,
       t.assign_id,
       t.status AS "이행상태",
       t.approval_status AS "결재상태",
       t.period_year,
       t.half_year,
       t.plan_date,
       t.due_date,
       t.done_at,
       t.submitted_at,
       t.approved_at,
       t.rejected_at,
       t.reject_reason,
       (NULLIF(t.approved_at, '')::date - NULLIF(t.created_at, '')::date) AS "결재소요일",
       a.dept_id,
       a.owner_staff_id,
       a.deputy_staff_id,
       a.applicability,
       c.code36,
       c.code36_name,
       c.area,
       c.target_code,
       c.target_name,
       c.law,
       c.duty_name,
       c.badge
FROM adoms2.compliance_task AS t
JOIN adoms2.duty_assignment AS a ON a.assign_id = t.assign_id
JOIN adoms2.duty_class AS c ON c.duty_key = a.duty_key;

CREATE OR REPLACE VIEW adoms2.v_contract_duty AS
SELECT k.contract_id,
       k.contract_name,
       k.counterpart,
       k.contract_type,
       k.start_date,
       k.end_date,
       k.dept_id,
       k.asset_id,
       s.asset_name,
       d.cduty_id,
       d.status,
       d.done_at,
       c.code36,
       c.code36_name,
       c.duty_name,
       c.law
FROM adoms2.contract AS k
LEFT JOIN adoms2.asset AS s ON s.asset_id = k.asset_id
LEFT JOIN adoms2.contract_duty AS d ON d.contract_id = k.contract_id
LEFT JOIN adoms2.duty_class AS c ON c.duty_key = d.duty_key;
