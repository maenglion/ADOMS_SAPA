import fs from "node:fs";
import path from "node:path";

const output = process.argv[2];
if (!output) throw new Error("snapshot output path is required");

const D = await import("@/lib/data.ts");
const { closePostgresPool } = await import("@/lib/db.ts");

const cases = [];
const add = async (name, call) => cases.push({ name, value: await call() });

await add("duties.default", () => D.duties({ limit: 100000 }));
await add("duties.area", () => D.duties({ area: "F", limit: 100000 }));
await add("duties.code36", () => D.duties({ code36: "F01", limit: 100000 }));
await add("duties.target", () => D.duties({ target: "TG18", limit: 100000 }));
await add("duties.group", () => D.duties({ group: "LF05", limit: 100000 }));
await add("duties.law", () => D.duties({ law: "고압가스 안전관리법", limit: 100000 }));
await add("duties.impl", () => D.duties({ impl: "T04", limit: 100000 }));
await add("duties.mark", () => D.duties({ mark: "Y", limit: 100000 }));
await add("duties.q", () => D.duties({ q: "고압", limit: 100000 }));
await add("dutyByKey", () => D.dutyByKey("DTY-00001"));
await add("assets.default", () => D.assets({ limit: 100000 }));
await add("assets.target", () => D.assets({ target: "TG13", limit: 100000 }));
await add("assets.dept", () => D.assets({ dept: "D09", limit: 100000 }));
await add("assets.q", () => D.assets({ q: "용인", limit: 100000 }));
await add("assetById", () => D.assetById("AR1998-0002431"));
await add("assetTargets", () => D.assetTargets("AR1998-0002431"));
await add("tasks.default", () => D.tasks({ limit: 100000 }));
await add("tasks.dept", () => D.tasks({ dept: "D03", limit: 100000 }));
await add("tasks.staff", () => D.tasks({ staff: "SD03-1", limit: 100000 }));
await add("tasks.status", () => D.tasks({ status: "점검완료", limit: 100000 }));

for (const [name, fn] of [
  ["depts", D.depts], ["staff", D.staff], ["forms", D.forms], ["contracts", D.contracts],
  ["ceoActivities", D.ceoActivities], ["lawChanges", D.lawChanges], ["inspectionBatches", D.inspectionBatches],
  ["approvals", D.approvals], ["contractDuties", D.contractDuties], ["contractHazards", D.contractHazards],
  ["budgets", D.budgets], ["trainings", D.trainings], ["voices", D.voices], ["incidents", D.incidents],
  ["orders", D.orders], ["evidences", D.evidences], ["activityLog", D.activityLog], ["inspections", D.inspections],
  ["actions_", D.actions_], ["notifications", D.notifications], ["riskAssessments", D.riskAssessments],
  ["riskItems", D.riskItems], ["assignments", D.assignments],
]) await add(name, fn);

await add("notifications.staff", () => D.notifications("SD03-1"));
await add("assignmentsFor", () => D.assignmentsFor("DTY-00011"));
await add("assignmentFor", () => D.assignmentFor("DTY-00011", "BR1992-0000156"));
await add("mappingFor", () => D.mappingFor("AR1998-0002431", "TG13"));

const goldenTables = [
  "compliance_task", "duty_assignment", "duty_class", "asset", "asset_target_map", "evidence", "inspection",
  "action", "notification", "usf_round", "usf_judge", "usc_record", "usd_record", "use_record",
  "usb1_workplace", "usb1_transport", "material_item", "usa_order", "incident", "hazard_report",
  "order_received", "safety_budget", "training_record", "usg_case", "usg_stat_occur", "usf_letter",
  "usf_notice", "usf_file", "sys_menu", "sys_code",
];
for (const table of goldenTables) await add(`readTable.${table}`, () => D.readTable(table));

const snapshot = {
  backend: process.env.ADOMS_DATA_BACKEND || "csv",
  source: D.source(),
  generated_at: new Date().toISOString(),
  comparison_cases: cases.length,
  exported_read_functions: 30,
  cases,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(snapshot), "utf8");
await closePostgresPool();
console.log(JSON.stringify({ backend: snapshot.backend, cases: cases.length, output }));
