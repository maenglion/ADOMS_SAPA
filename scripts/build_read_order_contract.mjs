import fs from "node:fs";
import path from "node:path";

const snapshotFile = process.argv[2];
const outputFile = process.argv[3] || "db/read-shadow/read_order_contract.json";
if (!snapshotFile) throw new Error("CSV snapshot path is required");

const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
const cases = new Map(snapshot.cases.map((item) => [item.name, item.value]));
const sources = {
  org_dept: "depts", staff: "staff", form_template: "forms", contract: "contracts",
  inspection_batch: "inspectionBatches", contract_duty: "contractDuties", safety_budget: "budgets",
  training_record: "trainings", worker_voice: "voices", incident: "incidents",
  order_received: "orders", evidence: "evidences", inspection: "inspections", action: "actions_",
  notification: "notifications", risk_assessment: "riskAssessments",
  risk_assessment_item: "riskItems", duty_assignment: "assignments", compliance_task: "readTable.compliance_task",
};

const candidateColumns = (rows) => {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))]
    .filter((key) => /(?:^id$|_id$|_key$|_code$|_no$|^code$)/.test(key))
    .sort();
  for (let size = 1; size <= keys.length; size++) {
    const columns = keys.slice(0, size);
    const values = rows.map((row) => columns.map((key) => String(row?.[key] ?? "")).join("\u001f"));
    if (new Set(values).size === values.length) return columns;
  }
  return keys;
};

const makeEntry = (rows) => {
  const columns = candidateColumns(rows);
  if (!columns.length) return null;
  const types = {};
  const empty = {};
  const nulls = {};
  for (const column of new Set(rows.flatMap((row) => Object.keys(row || {})))) {
    const observed = new Set(rows.map((row) => row?.[column]).filter((value) => value !== null && value !== undefined && value !== "").map((value) => typeof value));
    if (observed.size === 1 && !observed.has("string")) types[column] = [...observed][0];
  }
  const keys = rows.map((row) => columns.map((key) => String(row?.[key] ?? "")).join("\u001f"));
  rows.forEach((row, index) => {
    const emptyColumns = Object.keys(row).filter((column) => row[column] === "");
    const nullColumns = Object.keys(row).filter((column) => row[column] === null);
    if (emptyColumns.length) empty[keys[index]] = emptyColumns;
    if (nullColumns.length) nulls[keys[index]] = nullColumns;
  });
  return { columns, keys, types, empty, nulls };
};

const tables = {};
for (const [table, caseName] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
  let rows = cases.get(caseName);
  if (!Array.isArray(rows) || !rows.length) continue;
  if (table === "staff") rows = rows.filter((row) => row.staff_id !== "CEO-1");
  tables[table] = makeEntry(rows);
}

const raw = {};
for (const [name, rows] of cases) {
  if (!name.startsWith("readTable.") || !Array.isArray(rows) || !rows.length) continue;
  raw[name.slice(10)] = makeEntry(rows);
}

const actionRows = cases.get("actions_") || [];
const overlay = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".data", "overlay.json"), "utf8"));
for (const [actionId, patch] of Object.entries(overlay.patches?.action || {})) {
  const original = actionRows.find((row) => row.action_id === actionId);
  if (!original || !tables.action) continue;
  tables.action.overrides ||= {};
  tables.action.overrides[actionId] = Object.fromEntries(Object.keys(patch).filter((column) => Object.hasOwn(original, column)).map((column) => [column, original[column]]));
}

for (const [table, patchSet] of Object.entries(overlay.patches || {})) {
  const rows = cases.get(`readTable.${table}`) || [];
  const entry = raw[table];
  if (!entry) continue;
  for (const [id, patch] of Object.entries(patchSet)) {
    const idColumn = entry.columns.find((column) => String(rows.find((row) => String(row[column]) === id)?.[column] ?? "") === id);
    const original = idColumn ? rows.find((row) => String(row[idColumn]) === id) : null;
    if (!original) continue;
    const key = entry.columns.map((column) => String(original[column] ?? "")).join("\u001f");
    entry.overrides ||= {};
    entry.overrides[key] = Object.fromEntries(Object.keys(patch).filter((column) => Object.hasOwn(original, column)).map((column) => [column, original[column]]));
  }
}

const rawComplianceRows = cases.get("readTable.compliance_task") || [];
for (const [taskId, patch] of Object.entries(overlay.taskPatch || {})) {
  const original = rawComplianceRows.find((row) => row.task_id === taskId);
  const entry = raw.compliance_task;
  if (!original || !entry) continue;
  const key = entry.columns.map((column) => String(original[column] ?? "")).join("\u001f");
  entry.overrides ||= {};
  entry.overrides[key] = Object.fromEntries(Object.keys(patch).filter((column) => Object.hasOwn(original, column)).map((column) => [column, original[column]]));
}

if (tables.compliance_task) {
  tables.compliance_task.empty = {};
  tables.compliance_task.nulls = {};
  tables.compliance_task.overrides = {};
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify({ format: "adoms-read-order-v2", tables, raw }, null, 2) + "\n");
console.log(JSON.stringify({ tables: Object.keys(tables).length, raw_tables: Object.keys(raw).length, output: outputFile }));
