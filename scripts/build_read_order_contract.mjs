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
  risk_assessment_item: "riskItems", duty_assignment: "assignments",
};
for (const [name, value] of cases) if (name.startsWith("readTable.")) sources[name.slice(10)] = name;

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

const tables = {};
for (const [table, caseName] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
  let rows = cases.get(caseName);
  if (!Array.isArray(rows) || !rows.length) continue;
  if (table === "staff") rows = rows.filter((row) => row.staff_id !== "CEO-1");
  const columns = candidateColumns(rows);
  if (!columns.length) continue;
  tables[table] = {
    columns,
    keys: rows.map((row) => columns.map((key) => String(row?.[key] ?? "")).join("\u001f")),
  };
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify({ format: "adoms-read-order-v1", tables }, null, 2) + "\n");
console.log(JSON.stringify({ tables: Object.keys(tables).length, output: outputFile }));
