-- ADOMS SAPA constraint draft.
-- Existing executable-DDL primary keys are active below.
-- The 51 FK statements are evidence-backed candidates but intentionally commented out:
-- current rows and writes preserve empty strings, which an active FK would reject.

SET search_path TO adoms2, public;

ALTER TABLE adoms2."action"
  ADD CONSTRAINT "pk_action" PRIMARY KEY ("action_id");

ALTER TABLE adoms2."annual_schedule"
  ADD CONSTRAINT "pk_annual_schedule" PRIMARY KEY ("sched_id");

ALTER TABLE adoms2."asset"
  ADD CONSTRAINT "pk_asset" PRIMARY KEY ("asset_id");

ALTER TABLE adoms2."asset_target_map"
  ADD CONSTRAINT "pk_asset_target_map" PRIMARY KEY ("asset_id", "target_code");

ALTER TABLE adoms2."audit_log"
  ADD CONSTRAINT "pk_audit_log" PRIMARY KEY ("log_id");

ALTER TABLE adoms2."ceo_activity"
  ADD CONSTRAINT "pk_ceo_activity" PRIMARY KEY ("activity_id");

ALTER TABLE adoms2."civil_manual"
  ADD CONSTRAINT "pk_civil_manual" PRIMARY KEY ("manual_id");

ALTER TABLE adoms2."civil_safety_plan"
  ADD CONSTRAINT "pk_civil_safety_plan" PRIMARY KEY ("plan_id");

ALTER TABLE adoms2."compliance_task"
  ADD CONSTRAINT "pk_compliance_task" PRIMARY KEY ("task_id");

ALTER TABLE adoms2."contract"
  ADD CONSTRAINT "pk_contract" PRIMARY KEY ("contract_id");

ALTER TABLE adoms2."contract_compliance"
  ADD CONSTRAINT "pk_contract_compliance" PRIMARY KEY ("cc_id");

ALTER TABLE adoms2."contract_duty"
  ADD CONSTRAINT "pk_contract_duty" PRIMARY KEY ("cduty_id");

ALTER TABLE adoms2."contract_eval_item"
  ADD CONSTRAINT "pk_contract_eval_item" PRIMARY KEY ("item_no");

ALTER TABLE adoms2."contract_eval_score"
  ADD CONSTRAINT "pk_contract_eval_score" PRIMARY KEY ("score_id");

ALTER TABLE adoms2."contract_eval_setting"
  ADD CONSTRAINT "pk_contract_eval_setting" PRIMARY KEY ("setting_id");

ALTER TABLE adoms2."contract_hazard"
  ADD CONSTRAINT "pk_contract_hazard" PRIMARY KEY ("hazard_id");

ALTER TABLE adoms2."contract_hazard_map"
  ADD CONSTRAINT "pk_contract_hazard_map" PRIMARY KEY ("hazard_id", "hazard_code");

ALTER TABLE adoms2."contract_mgmt_item"
  ADD CONSTRAINT "pk_contract_mgmt_item" PRIMARY KEY ("item_no");

ALTER TABLE adoms2."drill_eval"
  ADD CONSTRAINT "pk_drill_eval" PRIMARY KEY ("eval_id");

ALTER TABLE adoms2."drill_plan"
  ADD CONSTRAINT "pk_drill_plan" PRIMARY KEY ("drill_id");

ALTER TABLE adoms2."duty_assignment"
  ADD CONSTRAINT "pk_duty_assignment" PRIMARY KEY ("assign_id");

ALTER TABLE adoms2."duty_class"
  ADD CONSTRAINT "pk_duty_class" PRIMARY KEY ("duty_key");

ALTER TABLE adoms2."eval_criteria"
  ADD CONSTRAINT "pk_eval_criteria" PRIMARY KEY ("criteria_id");

ALTER TABLE adoms2."evidence"
  ADD CONSTRAINT "pk_evidence" PRIMARY KEY ("evidence_id");

ALTER TABLE adoms2."form_template"
  ADD CONSTRAINT "pk_form_template" PRIMARY KEY ("form_id");

ALTER TABLE adoms2."hazard_code"
  ADD CONSTRAINT "pk_hazard_code" PRIMARY KEY ("hazard_code");

ALTER TABLE adoms2."hazard_report"
  ADD CONSTRAINT "pk_hazard_report" PRIMARY KEY ("hz_id");

ALTER TABLE adoms2."hazard_step"
  ADD CONSTRAINT "pk_hazard_step" PRIMARY KEY ("step_id");

ALTER TABLE adoms2."incident"
  ADD CONSTRAINT "pk_incident" PRIMARY KEY ("incident_id");

ALTER TABLE adoms2."incident_nil_check"
  ADD CONSTRAINT "pk_incident_nil_check" PRIMARY KEY ("nil_id");

ALTER TABLE adoms2."incident_report"
  ADD CONSTRAINT "pk_incident_report" PRIMARY KEY ("report_id");

ALTER TABLE adoms2."incident_response"
  ADD CONSTRAINT "pk_incident_response" PRIMARY KEY ("resp_id");

ALTER TABLE adoms2."incident_response_setting"
  ADD CONSTRAINT "pk_incident_response_setting" PRIMARY KEY ("set_id");

ALTER TABLE adoms2."inspection"
  ADD CONSTRAINT "pk_inspection" PRIMARY KEY ("insp_id");

ALTER TABLE adoms2."inspection_batch"
  ADD CONSTRAINT "pk_inspection_batch" PRIMARY KEY ("batch_id");

ALTER TABLE adoms2."law_change"
  ADD CONSTRAINT "pk_law_change" PRIMARY KEY ("change_id");

ALTER TABLE adoms2."material_item"
  ADD CONSTRAINT "pk_material_item" PRIMARY KEY ("item_id");

ALTER TABLE adoms2."notification"
  ADD CONSTRAINT "pk_notification" PRIMARY KEY ("notif_id");

ALTER TABLE adoms2."order_received"
  ADD CONSTRAINT "pk_order_received" PRIMARY KEY ("order_id");

ALTER TABLE adoms2."org_dept"
  ADD CONSTRAINT "pk_org_dept" PRIMARY KEY ("dept_id");

ALTER TABLE adoms2."risk_assessment"
  ADD CONSTRAINT "pk_risk_assessment" PRIMARY KEY ("risk_id");

ALTER TABLE adoms2."risk_assessment_item"
  ADD CONSTRAINT "pk_risk_assessment_item" PRIMARY KEY ("risk_item_id");

ALTER TABLE adoms2."safety_budget"
  ADD CONSTRAINT "pk_safety_budget" PRIMARY KEY ("budget_id");

ALTER TABLE adoms2."safety_manual"
  ADD CONSTRAINT "pk_safety_manual" PRIMARY KEY ("manual_id");

ALTER TABLE adoms2."safety_org_role"
  ADD CONSTRAINT "pk_safety_org_role" PRIMARY KEY ("role_id");

ALTER TABLE adoms2."safety_policy"
  ADD CONSTRAINT "pk_safety_policy" PRIMARY KEY ("policy_id");

ALTER TABLE adoms2."staff"
  ADD CONSTRAINT "pk_staff" PRIMARY KEY ("staff_id");

ALTER TABLE adoms2."system_record"
  ADD CONSTRAINT "pk_system_record" PRIMARY KEY ("record_id");

ALTER TABLE adoms2."training_check"
  ADD CONSTRAINT "pk_training_check" PRIMARY KEY ("check_id");

ALTER TABLE adoms2."training_course"
  ADD CONSTRAINT "pk_training_course" PRIMARY KEY ("course_id");

ALTER TABLE adoms2."training_record"
  ADD CONSTRAINT "pk_training_record" PRIMARY KEY ("training_id");

ALTER TABLE adoms2."worker_voice"
  ADD CONSTRAINT "pk_worker_voice" PRIMARY KEY ("voice_id");

-- FK candidates (51). Activate only after empty-string and orphan policy is approved.

-- Candidate 01: executable DDL evidence.
-- ALTER TABLE adoms2."action"
--   ADD CONSTRAINT "fk_action_insp_id_inspection"
--   FOREIGN KEY ("insp_id") REFERENCES adoms2."inspection" ("insp_id");

-- Candidate 02: executable DDL evidence.
-- ALTER TABLE adoms2."asset"
--   ADD CONSTRAINT "fk_asset_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 03: executable DDL evidence.
-- ALTER TABLE adoms2."asset_target_map"
--   ADD CONSTRAINT "fk_asset_target_map_asset_id_asset"
--   FOREIGN KEY ("asset_id") REFERENCES adoms2."asset" ("asset_id");

-- Candidate 04: executable DDL evidence.
-- ALTER TABLE adoms2."ceo_activity"
--   ADD CONSTRAINT "fk_ceo_activity_asset_id_asset"
--   FOREIGN KEY ("asset_id") REFERENCES adoms2."asset" ("asset_id");

-- Candidate 05: executable DDL evidence.
-- ALTER TABLE adoms2."ceo_activity"
--   ADD CONSTRAINT "fk_ceo_activity_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 06: executable DDL evidence.
-- ALTER TABLE adoms2."ceo_activity"
--   ADD CONSTRAINT "fk_ceo_activity_follow_up_task_id_compliance_task"
--   FOREIGN KEY ("follow_up_task_id") REFERENCES adoms2."compliance_task" ("task_id");

-- Candidate 07: executable DDL evidence.
-- ALTER TABLE adoms2."compliance_task"
--   ADD CONSTRAINT "fk_compliance_task_assign_id_duty_assignment"
--   FOREIGN KEY ("assign_id") REFERENCES adoms2."duty_assignment" ("assign_id");

-- Candidate 08: executable DDL evidence.
-- ALTER TABLE adoms2."compliance_task"
--   ADD CONSTRAINT "fk_compliance_task_done_by_staff"
--   FOREIGN KEY ("done_by") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 09: executable DDL evidence.
-- ALTER TABLE adoms2."contract"
--   ADD CONSTRAINT "fk_contract_asset_id_asset"
--   FOREIGN KEY ("asset_id") REFERENCES adoms2."asset" ("asset_id");

-- Candidate 10: executable DDL evidence.
-- ALTER TABLE adoms2."contract"
--   ADD CONSTRAINT "fk_contract_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 11: executable DDL evidence.
-- ALTER TABLE adoms2."contract"
--   ADD CONSTRAINT "fk_contract_manager_staff_id_staff"
--   FOREIGN KEY ("manager_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 12: executable DDL evidence.
-- ALTER TABLE adoms2."contract_compliance"
--   ADD CONSTRAINT "fk_contract_compliance_contract_id_contract"
--   FOREIGN KEY ("contract_id") REFERENCES adoms2."contract" ("contract_id");

-- Candidate 13: executable DDL evidence.
-- ALTER TABLE adoms2."contract_compliance"
--   ADD CONSTRAINT "fk_contract_compliance_item_no_contract_mgmt_item"
--   FOREIGN KEY ("item_no") REFERENCES adoms2."contract_mgmt_item" ("item_no");

-- Candidate 14: executable DDL evidence.
-- ALTER TABLE adoms2."contract_duty"
--   ADD CONSTRAINT "fk_contract_duty_contract_id_contract"
--   FOREIGN KEY ("contract_id") REFERENCES adoms2."contract" ("contract_id");

-- Candidate 15: executable DDL evidence.
-- ALTER TABLE adoms2."contract_duty"
--   ADD CONSTRAINT "fk_contract_duty_duty_key_duty_class"
--   FOREIGN KEY ("duty_key") REFERENCES adoms2."duty_class" ("duty_key");

-- Candidate 16: executable DDL evidence.
-- ALTER TABLE adoms2."contract_hazard"
--   ADD CONSTRAINT "fk_contract_hazard_contract_id_contract"
--   FOREIGN KEY ("contract_id") REFERENCES adoms2."contract" ("contract_id");

-- Candidate 17: executable DDL evidence.
-- ALTER TABLE adoms2."contract_hazard_map"
--   ADD CONSTRAINT "fk_contract_hazard_map_contract_id_contract"
--   FOREIGN KEY ("contract_id") REFERENCES adoms2."contract" ("contract_id");

-- Candidate 18: executable DDL evidence.
-- ALTER TABLE adoms2."contract_hazard_map"
--   ADD CONSTRAINT "fk_contract_hazard_map_hazard_code_hazard_code"
--   FOREIGN KEY ("hazard_code") REFERENCES adoms2."hazard_code" ("hazard_code");

-- Candidate 19: executable DDL evidence.
-- ALTER TABLE adoms2."duty_assignment"
--   ADD CONSTRAINT "fk_duty_assignment_asset_id_asset"
--   FOREIGN KEY ("asset_id") REFERENCES adoms2."asset" ("asset_id");

-- Candidate 20: executable DDL evidence.
-- ALTER TABLE adoms2."duty_assignment"
--   ADD CONSTRAINT "fk_duty_assignment_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 21: executable DDL evidence.
-- ALTER TABLE adoms2."duty_assignment"
--   ADD CONSTRAINT "fk_duty_assignment_deputy_staff_id_staff"
--   FOREIGN KEY ("deputy_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 22: executable DDL evidence.
-- ALTER TABLE adoms2."duty_assignment"
--   ADD CONSTRAINT "fk_duty_assignment_duty_key_duty_class"
--   FOREIGN KEY ("duty_key") REFERENCES adoms2."duty_class" ("duty_key");

-- Candidate 23: executable DDL evidence.
-- ALTER TABLE adoms2."duty_assignment"
--   ADD CONSTRAINT "fk_duty_assignment_owner_staff_id_staff"
--   FOREIGN KEY ("owner_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 24: executable DDL evidence.
-- ALTER TABLE adoms2."evidence"
--   ADD CONSTRAINT "fk_evidence_form_id_form_template"
--   FOREIGN KEY ("form_id") REFERENCES adoms2."form_template" ("form_id");

-- Candidate 25: executable DDL evidence.
-- ALTER TABLE adoms2."evidence"
--   ADD CONSTRAINT "fk_evidence_task_id_compliance_task"
--   FOREIGN KEY ("task_id") REFERENCES adoms2."compliance_task" ("task_id");

-- Candidate 26: executable DDL evidence.
-- ALTER TABLE adoms2."evidence"
--   ADD CONSTRAINT "fk_evidence_uploaded_by_staff"
--   FOREIGN KEY ("uploaded_by") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 27: executable DDL evidence.
-- ALTER TABLE adoms2."incident"
--   ADD CONSTRAINT "fk_incident_asset_id_asset"
--   FOREIGN KEY ("asset_id") REFERENCES adoms2."asset" ("asset_id");

-- Candidate 28: executable DDL evidence.
-- ALTER TABLE adoms2."incident"
--   ADD CONSTRAINT "fk_incident_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 29: executable DDL evidence.
-- ALTER TABLE adoms2."inspection"
--   ADD CONSTRAINT "fk_inspection_batch_id_inspection_batch"
--   FOREIGN KEY ("batch_id") REFERENCES adoms2."inspection_batch" ("batch_id");

-- Candidate 30: executable DDL evidence.
-- ALTER TABLE adoms2."inspection"
--   ADD CONSTRAINT "fk_inspection_inspector_staff_id_staff"
--   FOREIGN KEY ("inspector_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 31: executable DDL evidence.
-- ALTER TABLE adoms2."inspection"
--   ADD CONSTRAINT "fk_inspection_task_id_compliance_task"
--   FOREIGN KEY ("task_id") REFERENCES adoms2."compliance_task" ("task_id");

-- Candidate 32: executable DDL evidence.
-- ALTER TABLE adoms2."inspection_batch"
--   ADD CONSTRAINT "fk_inspection_batch_scope_dept_id_org_dept"
--   FOREIGN KEY ("scope_dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 33: executable DDL evidence.
-- ALTER TABLE adoms2."notification"
--   ADD CONSTRAINT "fk_notification_task_id_compliance_task"
--   FOREIGN KEY ("task_id") REFERENCES adoms2."compliance_task" ("task_id");

-- Candidate 34: executable DDL evidence.
-- ALTER TABLE adoms2."notification"
--   ADD CONSTRAINT "fk_notification_to_staff_id_staff"
--   FOREIGN KEY ("to_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 35: executable DDL evidence.
-- ALTER TABLE adoms2."order_received"
--   ADD CONSTRAINT "fk_order_received_asset_id_asset"
--   FOREIGN KEY ("asset_id") REFERENCES adoms2."asset" ("asset_id");

-- Candidate 36: executable DDL evidence.
-- ALTER TABLE adoms2."order_received"
--   ADD CONSTRAINT "fk_order_received_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 37: executable DDL evidence.
-- ALTER TABLE adoms2."risk_assessment"
--   ADD CONSTRAINT "fk_risk_assessment_assessor_staff_id_staff"
--   FOREIGN KEY ("assessor_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 38: executable DDL evidence.
-- ALTER TABLE adoms2."risk_assessment"
--   ADD CONSTRAINT "fk_risk_assessment_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 39: executable DDL evidence.
-- ALTER TABLE adoms2."risk_assessment_item"
--   ADD CONSTRAINT "fk_risk_assessment_item_owner_staff_id_staff"
--   FOREIGN KEY ("owner_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 40: executable DDL evidence.
-- ALTER TABLE adoms2."risk_assessment_item"
--   ADD CONSTRAINT "fk_risk_assessment_item_risk_id_risk_assessment"
--   FOREIGN KEY ("risk_id") REFERENCES adoms2."risk_assessment" ("risk_id");

-- Candidate 41: executable DDL evidence.
-- ALTER TABLE adoms2."safety_budget"
--   ADD CONSTRAINT "fk_safety_budget_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 42: executable DDL evidence.
-- ALTER TABLE adoms2."safety_budget"
--   ADD CONSTRAINT "fk_safety_budget_duty_key_duty_class"
--   FOREIGN KEY ("duty_key") REFERENCES adoms2."duty_class" ("duty_key");

-- Candidate 43: executable DDL evidence.
-- ALTER TABLE adoms2."safety_manual"
--   ADD CONSTRAINT "fk_safety_manual_owner_staff_id_staff"
--   FOREIGN KEY ("owner_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 44: executable DDL evidence.
-- ALTER TABLE adoms2."safety_org_role"
--   ADD CONSTRAINT "fk_safety_org_role_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 45: executable DDL evidence.
-- ALTER TABLE adoms2."safety_org_role"
--   ADD CONSTRAINT "fk_safety_org_role_staff_id_staff"
--   FOREIGN KEY ("staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 46: executable DDL evidence.
-- ALTER TABLE adoms2."safety_policy"
--   ADD CONSTRAINT "fk_safety_policy_owner_staff_id_staff"
--   FOREIGN KEY ("owner_staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 47: executable DDL evidence.
-- ALTER TABLE adoms2."staff"
--   ADD CONSTRAINT "fk_staff_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 48: executable DDL evidence.
-- ALTER TABLE adoms2."training_record"
--   ADD CONSTRAINT "fk_training_record_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");

-- Candidate 49: executable DDL evidence.
-- ALTER TABLE adoms2."training_record"
--   ADD CONSTRAINT "fk_training_record_duty_key_duty_class"
--   FOREIGN KEY ("duty_key") REFERENCES adoms2."duty_class" ("duty_key");

-- Candidate 50: executable DDL evidence.
-- ALTER TABLE adoms2."training_record"
--   ADD CONSTRAINT "fk_training_record_staff_id_staff"
--   FOREIGN KEY ("staff_id") REFERENCES adoms2."staff" ("staff_id");

-- Candidate 51: executable DDL evidence.
-- ALTER TABLE adoms2."worker_voice"
--   ADD CONSTRAINT "fk_worker_voice_dept_id_org_dept"
--   FOREIGN KEY ("dept_id") REFERENCES adoms2."org_dept" ("dept_id");


