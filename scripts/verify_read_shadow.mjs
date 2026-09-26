import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputDir = path.resolve(process.argv[2] || "db/read-shadow");
const csvFile = path.join(outputDir, "csv_snapshot.json");
const postgresFile = path.join(outputDir, "postgres_snapshot.json");
const loader = path.join(root, "scripts", "ts_loader.mjs");
const worker = path.join(root, "scripts", "read_contract_snapshot.mjs");
fs.mkdirSync(outputDir, { recursive: true });

function run(backend, file) {
  const result = spawnSync(process.execPath, ["--import", pathToFileURL(loader).href, worker, file], {
    cwd: root,
    env: {
      ...process.env,
      ADOMS_APP_DIR: root,
      ADOMS_OPS_DIR: process.env.ADOMS_OPS_DIR || path.join(root, "data", "_데모_용인시_20260920"),
      ADOMS_DATA_BACKEND: backend,
      TZ: "Asia/Seoul",
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
  });
  if (result.status !== 0) throw new Error(`${backend} snapshot failed\n${result.stdout}\n${result.stderr}`);
}

function identityKey(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return JSON.stringify(row);
  const preferred = ["task_id", "duty_key", "assign_id", "asset_id", "dept_id", "staff_id", "evidence_id", "insp_id", "action_id", "notif_id", "round_id", "judge_id", "rec_id", "record_id", "incident_id", "order_id", "activity_id", "change_id", "contract_id", "form_id", "risk_id", "item_id", "target_code", "code", "id"];
  const candidates = Object.keys(row).filter((key) => /(?:^id$|_id$|_key$|_code$|_no$|^code$)/.test(key));
  const found = [...preferred.filter((key) => candidates.includes(key)), ...candidates.filter((key) => !preferred.includes(key)).sort()]
    .filter((key) => row[key] !== null && row[key] !== "");
  if (!found.length && Object.hasOwn(row, "at")) {
    return ["at", "by", "action", "target"].filter((key) => Object.hasOwn(row, key)).map((key) => `${key}=${String(row[key] ?? "")}`).join("|");
  }
  return found.length ? found.map((key) => `${key}=${String(row[key])}`).join("|") : JSON.stringify(row);
}

function compareObject(a, b, name, key, summary, details) {
  for (const column of Object.keys(a)) {
    const csv = a[column];
    const postgres = b?.[column];
    if ((csv === null || csv === "") && csv !== postgres) {
      summary.null_empty_mismatch++;
      details.push({ case: name, key, column, kind: "null_empty", csv, postgres });
    } else if (typeof csv !== typeof postgres) {
      summary.type_mismatch++;
      details.push({ case: name, key, column, kind: "type", csv: typeof csv, postgres: typeof postgres });
    } else if (JSON.stringify(csv) !== JSON.stringify(postgres)) {
      summary.value_mismatch++;
      details.push({ case: name, key, column, kind: "value", csv, postgres });
    }
  }
}

function classify(csvValue, dbValue, name, summary, details) {
  if (!Array.isArray(csvValue)) {
    const a = csvValue === undefined ? null : csvValue;
    const b = dbValue === undefined ? null : dbValue;
    if (typeof a !== typeof b) { summary.type_mismatch++; details.push({ case: name, kind: "type", csv: a, postgres: b }); }
    else if (a && b && typeof a === "object") compareObject(a, b, name, identityKey(a), summary, details);
    else if (JSON.stringify(a) !== JSON.stringify(b)) { summary.value_mismatch++; details.push({ case: name, kind: "value", csv: a, postgres: b }); }
    return;
  }
  if (!Array.isArray(dbValue)) {
    summary.type_mismatch++;
    details.push({ case: name, kind: "type", csv: "array", postgres: typeof dbValue });
    return;
  }
  const aKeys = csvValue.map(identityKey), bKeys = dbValue.map(identityKey);
  const unique = new Set(aKeys).size === aKeys.length && new Set(bKeys).size === bKeys.length;
  const aSorted = [...aKeys].sort(), bSorted = [...bKeys].sort();
  const sameMembers = unique && aKeys.length === bKeys.length && aSorted.every((key, index) => key === bSorted[index]);
  const aSet = new Set(aKeys), bSet = new Set(bKeys);
  const missing = unique ? aKeys.filter((key) => !bSet.has(key)).length : Math.max(0, csvValue.length - dbValue.length);
  const extra = unique ? bKeys.filter((key) => !aSet.has(key)).length : Math.max(0, dbValue.length - csvValue.length);
  summary.missing_rows += missing;
  summary.extra_rows += extra;
  if (missing) details.push({ case: name, kind: "missing_rows", count: missing });
  if (extra) details.push({ case: name, kind: "extra_rows", count: extra });
  if (sameMembers && aKeys.some((key, index) => key !== bKeys[index])) {
    summary.ordering_mismatch++;
    details.push({ case: name, kind: "ordering" });
  }
  const dbByKey = unique ? new Map(dbValue.map((row) => [identityKey(row), row])) : null;
  const length = Math.min(csvValue.length, dbValue.length);
  for (let index = 0; index < length; index++) {
    const csvRow = csvValue[index];
    const key = identityKey(csvRow);
    const dbRow = dbByKey?.get(key) ?? dbValue[index];
    if (dbRow === undefined) continue;
    if (!csvRow || typeof csvRow !== "object" || Array.isArray(csvRow)) {
      if (typeof csvRow !== typeof dbRow) summary.type_mismatch++;
      else if (csvRow !== dbRow) summary.value_mismatch++;
      continue;
    }
    compareObject(csvRow, dbRow, name, key, summary, details);
  }
}

run("csv", csvFile);
if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ status: "CSV_ONLY", cases: JSON.parse(fs.readFileSync(csvFile, "utf8")).comparison_cases }));
  process.exit(0);
}
run("postgres", postgresFile);

const csv = JSON.parse(fs.readFileSync(csvFile, "utf8"));
const postgres = JSON.parse(fs.readFileSync(postgresFile, "utf8"));
const dbCases = new Map(postgres.cases.map((item) => [item.name, item.value]));
const summary = { missing_rows: 0, extra_rows: 0, value_mismatch: 0, type_mismatch: 0, ordering_mismatch: 0, null_empty_mismatch: 0 };
const samples = [];
let detailCount = 0;
const caseCounts = {};
const details = {
  push(item) {
    detailCount++;
    const key = `${item.case}:${item.kind}`;
    caseCounts[key] = (caseCounts[key] || 0) + (item.count || 1);
    if (caseCounts[key] <= 5) samples.push(item);
  },
};
for (const item of csv.cases) classify(item.value, dbCases.get(item.name), item.name, summary, details);
const total = Object.values(summary).reduce((sum, value) => sum + value, 0);
const report = {
  status: total === 0 ? "PASS" : "FAIL",
  generated_at: new Date().toISOString(),
  comparison_cases: csv.comparison_cases,
  exported_read_functions: csv.exported_read_functions,
  ...summary,
  total_mismatch: total,
  detail_count: detailCount,
  details: samples,
};
fs.writeFileSync(path.join(outputDir, "read_adapter_compare.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
const lines = ["case,kind,key,column,csv,postgres", ...samples.map((d) => [d.case, d.kind, d.key || "", d.column || "", JSON.stringify(d.csv ?? ""), JSON.stringify(d.postgres ?? "")].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))];
fs.writeFileSync(path.join(outputDir, "read_adapter_compare.csv"), lines.join("\n") + "\n", "utf8");
const cases = Object.entries(caseCounts).map(([case_kind, count]) => ({ case_kind, count }));
console.log(JSON.stringify({ ...report, details: samples, cases }));
process.exit(total === 0 ? 0 : 1);
