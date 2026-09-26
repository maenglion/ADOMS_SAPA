#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

if (!process.argv.includes("--dry-run")) {
  console.error("This draft is dry-run only. Pass --dry-run; database writes are not implemented.");
  process.exit(64);
}

const dataRoot = path.resolve(
  repoRoot,
  argValue("--data-root") || process.env.ADOMS_OPS_DIR || "data/_데모_용인시_20260920",
);
const overlayPath = path.resolve(repoRoot, argValue("--overlay") || ".data/overlay.json");
const manifestPath = path.resolve(repoRoot, argValue("--manifest") || "db/import/import_manifest.csv");
const provenancePath = path.resolve(repoRoot, argValue("--provenance") || "db/import/migration_provenance.json");
const tablesSqlPath = path.join(repoRoot, "db/migrations/0001_tables.sql");
const constraintsSqlPath = path.join(repoRoot, "db/migrations/0002_constraints.sql");
const compatibilitySqlPath = path.join(repoRoot, "db/migrations/0004_import_compat.sql");

const EXCLUDED_SOURCE_TABLES = new Set(["accident_case", "accident_stat"]);
const SPECIAL_SOURCE_TABLES = new Set(["task_approval_patch"]);
const CONFIRMED_ORPHAN_TASK_PATCHES = new Map([
  ["TSK-000782", {
    last_present_version: "ops_v0.3_20260921",
    last_effective_version: "ops_v1.8_20260924",
    removal_confirmed_version: "ops_v1.9_20260924",
    exclusion_reason: "실제 삭제된 과거 업무에 대한 오래된 overlay patch이므로 현재 운영 compliance_task에는 적용하지 않는다.",
  }],
]);
const APPLICATION_KEYS = new Map([
  ["action", ["action_id"]],
  ["asset", ["asset_id"]],
  ["asset_target_map", ["asset_id", "target_code"]],
  ["duty_assignment", ["assign_id"]],
  ["duty_class", ["duty_key"]],
  ["inspection", ["insp_id"]],
  ["notification", ["notif_id"]],
  ["usb1_basic", ["basic_id"]],
  ["usc_record", ["rec_id"]],
  ["usd_record", ["rec_id"]],
  ["use_record", ["rec_id"]],
  ["usf_round", ["round_id"]],
  ["usg_case", ["case_no"]],
]);

function fail(message) {
  throw new Error(message);
}

function parseCsv(text) {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0];
  return {
    headers,
    rows: rows.slice(1).filter((r) => r.length > 1).map((r) => {
      const out = {};
      headers.forEach((h, i) => { out[h] = r[i] ?? ""; });
      return out;
    }),
  };
}

const SKIP_SCRUB = new Set(["source_text", "badge"]);
function scrubText(key, value) {
  let text = value
    .replace(/예시 데이터\(시연용\)|예시 자료\(시연용\)|가상 인물\(시연용\)|옮겨 온 행/g, "")
    .replace(/\(시연용\)/g, "")
    .replace(/\s*\(가상\)/g, "")
    .replace(/, 가상\)/g, ")");
  if (key === "note") text = text.replace(/^\s*예시 자료\s*$/, "").replace(/예시 자료/g, "");
  if (key === "why") text = text.replace(/^★\s*/, "").replace(/★사용자 검수 지정 자리 — /g, "").replace(/\(([^()]*?)\s*검수 필요\)/g, "");
  if (text !== value) text = text.replace(/\s+·(\s+·)+\s+/g, " · ").replace(/^\s*·\s+|\s+·\s*$/g, "").trim();
  return text;
}

function scrubRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    typeof value === "string" && !SKIP_SCRUB.has(key) ? scrubText(key, value) : value,
  ]));
}

function parseSchema(sql) {
  const tables = new Map();
  const re = /CREATE TABLE adoms2\."([^"]+)"\s*\(([\s\S]*?)\n\);/g;
  for (const match of sql.matchAll(re)) {
    const columns = [];
    const generated = new Set();
    for (const line of match[2].split(/\r?\n/)) {
      const col = line.match(/^\s*"([^"]+)"\s+(.+?)(?:,)?\s*$/);
      if (!col) continue;
      columns.push(col[1]);
      if (/\bGENERATED\b/i.test(col[2])) generated.add(col[1]);
    }
    tables.set(match[1], { columns, generated });
  }
  return tables;
}

function applyAddedColumns(sql, tables) {
  const alterRe = /ALTER TABLE adoms2\."([^"]+)"([\s\S]*?);/g;
  for (const alter of sql.matchAll(alterRe)) {
    const target = tables.get(alter[1]);
    if (!target) fail(`Compatibility migration references unknown table: ${alter[1]}`);
    const columnRe = /ADD COLUMN(?: IF NOT EXISTS)?\s+"([^"]+)"\s+[^,\r\n]+/g;
    for (const column of alter[2].matchAll(columnRe)) {
      if (!target.columns.includes(column[1])) target.columns.push(column[1]);
    }
  }
}

function parsePrimaryKeys(sql) {
  const pks = new Map();
  const re = /ALTER TABLE adoms2\."([^"]+)"\s+ADD CONSTRAINT\s+"[^"]+"\s+PRIMARY KEY\s*\(([^)]+)\);/g;
  for (const match of sql.matchAll(re)) {
    pks.set(match[1], [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  }
  return pks;
}

function seedDirs(root) {
  const all = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const pick = (prefix) => all.filter((name) => name.startsWith(prefix)).sort().reverse().map((name) => path.join(root, name, "seed"));
  return [...pick("us_"), ...pick("ops_")];
}

function relative(file) {
  return file ? path.relative(repoRoot, file).split(path.sep).join("/") : "";
}

function chooseCsv(table, dirs) {
  for (const dir of dirs) {
    const file = path.join(dir, `${table}.csv`);
    if (fs.existsSync(file)) return file;
  }
  return "";
}

function readSeed(table, dirs) {
  const file = chooseCsv(table, dirs);
  if (!file) return { file: "", headers: [], rows: [] };
  const parsed = parseCsv(fs.readFileSync(file, "utf8"));
  return { file, headers: parsed.headers, rows: parsed.rows.map(scrubRow) };
}

function keyFor(row, columns) {
  return columns.map((column) => String(row[column] ?? "")).join("\u001f");
}

function duplicates(rows, columns, generated) {
  if (!columns?.length) return { count: 0, keys: [] };
  const counts = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (columns.every((column) => generated.has(column) && String(row[column] ?? "") === "")) continue;
    const key = keyFor(row, columns);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const keys = [...counts].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
  return { count: keys.reduce((sum, item) => sum + item.count - 1, 0), keys };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] || {});
  const text = [headers, ...rows.map((row) => headers.map((h) => row[h]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n") + "\r\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const AUDIT_FIELD_MAP = new Map([
  ["at", "changed_at"],
  ["by", "changed_by"],
  ["action", "action"],
  ["note", "note"],
  ["target", "target"],
  ["what", "what"],
]);

function mapAuditRows(sourceRows) {
  const errors = [];
  const rows = sourceRows.map((source, index) => {
    const mapped = {};
    for (const [sourceColumn, value] of Object.entries(source)) {
      const targetColumn = AUDIT_FIELD_MAP.get(sourceColumn);
      if (!targetColumn) {
        errors.push(`row ${index}: no mapping for ${sourceColumn}`);
        continue;
      }
      mapped[targetColumn] = value;
    }
    for (const [sourceColumn, value] of Object.entries(source)) {
      const targetColumn = AUDIT_FIELD_MAP.get(sourceColumn);
      if (targetColumn && (!Object.hasOwn(mapped, targetColumn) || mapped[targetColumn] !== value)) {
        errors.push(`row ${index}: value mismatch ${sourceColumn}->${targetColumn}`);
      }
    }
    return mapped;
  });
  return { rows, errors };
}

function sourceColumns(rows, headers = []) {
  const columns = new Set(headers);
  for (const row of rows) for (const key of Object.keys(row)) columns.add(key);
  return columns;
}

function applyPatchSet(table, rows, patchSet, keyColumns, counters, confirmedExclusions = new Set()) {
  if (!patchSet || !Object.keys(patchSet).length) return rows;
  if (!keyColumns?.length) {
    counters.unmappedOverlayPatches += Object.keys(patchSet).length;
    counters.mappingIssues.push(`${table}: overlay patches have no application key mapping`);
    return rows;
  }
  const indexes = new Map();
  rows.forEach((row, index) => indexes.set(keyFor(row, keyColumns), index));
  for (const [rawKey, patch] of Object.entries(patchSet)) {
    const lookupKey = keyColumns.length === 1 ? String(rawKey) : String(rawKey).split("|").join("\u001f");
    const index = indexes.get(lookupKey);
    if (index === undefined) {
      if (confirmedExclusions.has(String(rawKey))) {
        counters.orphanExcluded += 1;
        counters.orphanExcludedDetails.push(`${table}:${rawKey}`);
        continue;
      }
      counters.unmatchedOverlayPatches += 1;
      counters.unmatchedOverlayPatchesByTable.set(table, (counters.unmatchedOverlayPatchesByTable.get(table) || 0) + 1);
      counters.unmatchedPatchDetails.push(`${table}:${rawKey}`);
      continue;
    }
    rows[index] = { ...rows[index], ...patch };
    counters.overlayPatchesByTable.set(table, (counters.overlayPatchesByTable.get(table) || 0) + 1);
  }
  return rows;
}

if (!fs.existsSync(dataRoot)) fail(`Data root not found: ${dataRoot}`);
if (!fs.existsSync(overlayPath)) fail(`Overlay not found: ${overlayPath}`);

const schema = parseSchema(fs.readFileSync(tablesSqlPath, "utf8"));
applyAddedColumns(fs.readFileSync(compatibilitySqlPath, "utf8"), schema);
const primaryKeys = parsePrimaryKeys(fs.readFileSync(constraintsSqlPath, "utf8"));
if (schema.size !== 91) fail(`Expected 91 migration tables, found ${schema.size}`);
if (primaryKeys.size !== 52) fail(`Expected 52 active primary keys, found ${primaryKeys.size}`);

const dirs = seedDirs(dataRoot);
const overlay = JSON.parse(fs.readFileSync(overlayPath, "utf8"));
const counters = {
  overlayInsertsByTable: new Map(),
  overlayPatchesByTable: new Map(),
  unmatchedOverlayPatches: 0,
  unmatchedOverlayPatchesByTable: new Map(),
  unmappedOverlayPatches: 0,
  unmatchedPatchDetails: [],
  mappingIssues: [],
  orphanExcluded: 0,
  orphanExcludedDetails: [],
};

const selected = new Map();
for (const table of schema.keys()) selected.set(table, readSeed(table, dirs));
const taskApproval = readSeed("task_approval_patch", dirs);

const tables = new Map();
const sourceHeaders = new Map();
for (const [table, seedInfo] of selected) {
  tables.set(table, seedInfo.rows.map((row) => ({ ...row })));
  sourceHeaders.set(table, new Set(seedInfo.headers));
}

// Confirmed mapping keeps changed_at/changed_by canonical and preserves target/what
// through 0004_import_compat.sql. Missing keys remain absent; present empty strings remain "".
const auditSourceRows = overlay.log || [];
const auditMapping = mapAuditRows(auditSourceRows);
tables.set("audit_log", auditMapping.rows);
counters.overlayInsertsByTable.set("audit_log", auditMapping.rows.length);

for (const [table, rows] of [["evidence", overlay.evidence || []], ["inspection", overlay.inspection || []]]) {
  tables.set(table, [...rows.map((row) => ({ ...row })), ...(tables.get(table) || [])]);
  counters.overlayInsertsByTable.set(table, rows.length);
}

for (const [table, added] of Object.entries(overlay.tables || {})) {
  if (!schema.has(table)) {
    counters.mappingIssues.push(`overlay.tables.${table}: target table does not exist`);
    continue;
  }
  tables.set(table, [...added.map((row) => ({ ...row })), ...(tables.get(table) || [])]);
  counters.overlayInsertsByTable.set(table, (counters.overlayInsertsByTable.get(table) || 0) + added.length);
}

// Existing decision: task_approval_patch is not a physical table. CSV mode applies it
// to compliance_task for approvals(), then taskPatch takes precedence.
const approvalByTask = new Map();
let taskApprovalDuplicateKeys = 0;
for (const row of taskApproval.rows) {
  if (approvalByTask.has(row.task_id)) taskApprovalDuplicateKeys += 1;
  approvalByTask.set(row.task_id, row);
}
let complianceRows = tables.get("compliance_task") || [];
const complianceTaskIds = new Set(complianceRows.map((row) => String(row.task_id ?? "")));
const unmatchedTaskApprovalIds = [...approvalByTask.keys()]
  .filter((taskId) => !complianceTaskIds.has(String(taskId)))
  .sort();
let taskApprovalMergedRows = 0;
complianceRows = complianceRows.map((row) => {
  if (!approvalByTask.has(row.task_id)) return row;
  taskApprovalMergedRows += 1;
  return { ...row, ...approvalByTask.get(row.task_id) };
});
tables.set("compliance_task", complianceRows);

const taskPatch = overlay.taskPatch || {};
const confirmedExclusions = new Set();
const provenanceRecords = [];
for (const [taskId, decision] of CONFIRMED_ORPHAN_TASK_PATCHES) {
  const rawPatch = taskPatch[taskId];
  if (!rawPatch) {
    counters.mappingIssues.push(`confirmed orphan ${taskId}: overlay.taskPatch source is missing`);
    continue;
  }
  if (complianceTaskIds.has(taskId)) {
    counters.mappingIssues.push(`confirmed orphan ${taskId}: current compliance_task unexpectedly exists`);
    continue;
  }
  confirmedExclusions.add(taskId);
  provenanceRecords.push({
    record_type: "excluded_orphan_task_patch",
    source_path: relative(overlayPath),
    source_section: "taskPatch",
    original_task_id: taskId,
    overlay_recorded_at: rawPatch.rejected_at,
    overlay_recorded_at_basis: "taskPatch.rejected_at",
    last_present_version: decision.last_present_version,
    last_effective_version: decision.last_effective_version,
    removal_confirmed_version: decision.removal_confirmed_version,
    exclusion_reason: decision.exclusion_reason,
    raw_patch: rawPatch,
  });
}
tables.set(
  "compliance_task",
  applyPatchSet("compliance_task", tables.get("compliance_task") || [], taskPatch, ["task_id"], counters, confirmedExclusions),
);

for (const [table, patchSet] of Object.entries(overlay.patches || {})) {
  if (!schema.has(table)) {
    counters.unmappedOverlayPatches += Object.keys(patchSet).length;
    counters.mappingIssues.push(`overlay.patches.${table}: target table does not exist`);
    continue;
  }
  const keys = APPLICATION_KEYS.get(table) || primaryKeys.get(table);
  tables.set(table, applyPatchSet(table, tables.get(table) || [], patchSet, keys, counters));
}

const allSeedFiles = [];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) if (name.endsWith(".csv")) allSeedFiles.push(path.join(dir, name));
}
const sourceTableNames = new Set(allSeedFiles.map((file) => path.basename(file, ".csv")));
const unmappedSourceTables = [...sourceTableNames]
  .filter((table) => !schema.has(table) && !EXCLUDED_SOURCE_TABLES.has(table) && !SPECIAL_SOURCE_TABLES.has(table))
  .sort();

const manifest = [];
let seedRowsTotal = 0;
let overlayInsertTotal = 0;
let overlayPatchTotal = 0;
let finalRowsTotal = 0;
let pkDuplicateTotal = 0;
let columnGapTableCount = 0;

for (const [table, target] of [...schema].sort(([a], [b]) => a.localeCompare(b))) {
  const seedInfo = selected.get(table);
  const rows = tables.get(table) || [];
  const inserts = counters.overlayInsertsByTable.get(table) || 0;
  const patches = counters.overlayPatchesByTable.get(table) || 0;
  const pk = primaryKeys.get(table) || [];
  const duplicate = duplicates(rows, pk, target.generated);
  const columns = sourceColumns(rows, seedInfo.headers);
  if (table === "compliance_task") {
    for (const column of taskApproval.headers) columns.add(column);
    for (const patch of Object.values(taskPatch)) for (const column of Object.keys(patch)) columns.add(column);
  }
  const missingTargetColumns = [...columns].filter((column) => !target.columns.includes(column)).sort();
  const unmatchedPatches = counters.unmatchedOverlayPatchesByTable.get(table) || 0;
  if (missingTargetColumns.length) columnGapTableCount += 1;
  const selectedSource = relative(seedInfo.file);
  const sourceVersion = selectedSource ? selectedSource.split("/").at(-3) : "";
  const seedRows = table === "audit_log" ? 0 : seedInfo.rows.length;
  const status = duplicate.count || missingTargetColumns.length || unmatchedPatches ? "BLOCKED" : "READY";
  const notes = [];
  if (!selectedSource) notes.push("no seed CSV; expected empty unless overlay adds rows");
  if (table === "audit_log") notes.push(`overlay.log mapped losslessly=${auditMapping.rows.length}/${auditSourceRows.length}; changed_at/changed_by canonical; target/what from 0004`);
  if (table === "compliance_task") {
    notes.push(`task_approval_patch source=${taskApproval.rows.length}; merged=${taskApprovalMergedRows}; unmatched=${unmatchedTaskApprovalIds.length}; taskPatch applied=${patches}; confirmed orphan excluded=${counters.orphanExcluded}; taskPatch unmatched=${unmatchedPatches}`);
  }
  manifest.push({
    table,
    selected_source_csv: selectedSource,
    source_version: sourceVersion,
    source_csv_rows: seedInfo.rows.length,
    seed_rows_used: seedRows,
    overlay_insert_rows: inserts,
    overlay_patch_rows: patches,
    final_expected_rows: rows.length,
    pk_columns: pk.join("+"),
    pk_duplicate_rows: duplicate.count,
    source_columns_missing_in_target: missingTargetColumns.join(";"),
    status,
    notes: notes.join(" | "),
  });
  seedRowsTotal += seedRows;
  overlayInsertTotal += inserts;
  overlayPatchTotal += patches;
  finalRowsTotal += rows.length;
  pkDuplicateTotal += duplicate.count;
}

writeCsv(manifestPath, manifest);
writeJson(provenancePath, {
  format: "adoms-sapa-migration-provenance-v1",
  records: provenanceRecords,
});

const mappingMissingCount = unmappedSourceTables.length + counters.mappingIssues.length;
const overlayPatchOutsideTarget = counters.unmatchedOverlayPatches + counters.unmappedOverlayPatches;
const provenanceRoundTrip = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
const provenancePreserved = provenanceRoundTrip.records.filter((record) => {
  const source = taskPatch[record.original_task_id];
  return source && JSON.stringify(record.raw_patch) === JSON.stringify(source);
}).length;
const manifestHash = crypto.createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
const provenanceHash = crypto.createHash("sha256").update(fs.readFileSync(provenancePath)).digest("hex");

console.log("ADOMS baseline import dry-run");
console.log(`Data root: ${relative(dataRoot)}`);
console.log(`Seed directory order: ${dirs.map(relative).join(" -> ")}`);
console.log("");
for (const row of manifest) {
  console.log([
    row.table,
    `source=${row.selected_source_csv || "(none)"}`,
    `seed=${row.seed_rows_used}`,
    `overlay_insert=${row.overlay_insert_rows}`,
    `overlay_patch=${row.overlay_patch_rows}`,
    `final=${row.final_expected_rows}`,
    `pk_duplicate=${row.pk_duplicate_rows}`,
    `status=${row.status}`,
  ].join(" | "));
}
console.log("");
console.log(`Target tables: ${schema.size}`);
console.log(`Seed rows: ${seedRowsTotal}`);
console.log(`Overlay INSERT rows: ${overlayInsertTotal}`);
console.log(`Overlay PATCH rows applied: ${overlayPatchTotal}`);
console.log(`Final expected rows: ${finalRowsTotal}`);
console.log(`PK duplicate rows: ${pkDuplicateTotal}`);
console.log(`Overlay patches outside target rows: ${overlayPatchOutsideTarget}`);
console.log(`Confirmed orphan patches excluded: ${counters.orphanExcluded}`);
console.log(`Provenance records preserved: ${provenancePreserved}`);
console.log(`Audit log lossless mapped rows: ${auditMapping.rows.length - auditMapping.errors.length}/${auditSourceRows.length}`);
console.log(`DB/source table mapping missing count: ${mappingMissingCount}`);
console.log(`Tables with source columns missing in target: ${columnGapTableCount}`);
console.log(`task_approval_patch source rows: ${taskApproval.rows.length}`);
console.log(`task_approval_patch rows merged: ${taskApprovalMergedRows}`);
console.log(`task_approval_patch rows outside compliance_task: ${unmatchedTaskApprovalIds.length}`);
console.log(`task_approval_patch duplicate task_id rows: ${taskApprovalDuplicateKeys}`);
console.log(`Manifest: ${relative(manifestPath)} (${manifestHash})`);
console.log(`Provenance: ${relative(provenancePath)} (${provenanceHash})`);

if (unmappedSourceTables.length) console.log(`Unmapped source tables: ${unmappedSourceTables.join(", ")}`);
if (counters.mappingIssues.length) console.log(`Mapping issues: ${counters.mappingIssues.join(" | ")}`);
if (counters.unmatchedPatchDetails.length) console.log(`Unmatched overlay patches: ${counters.unmatchedPatchDetails.join(", ")}`);
if (counters.orphanExcludedDetails.length) console.log(`Confirmed orphan exclusions: ${counters.orphanExcludedDetails.join(", ")}`);
if (auditMapping.errors.length) console.log(`Audit mapping errors: ${auditMapping.errors.join(" | ")}`);
if (unmatchedTaskApprovalIds.length) console.log(`Unmatched task_approval_patch rows: ${unmatchedTaskApprovalIds.join(", ")}`);

const blocked = pkDuplicateTotal > 0
  || overlayPatchOutsideTarget > 0
  || mappingMissingCount > 0
  || columnGapTableCount > 0
  || taskApprovalDuplicateKeys > 0
  || unmatchedTaskApprovalIds.length > 0
  || auditMapping.errors.length > 0
  || counters.orphanExcluded !== CONFIRMED_ORPHAN_TASK_PATCHES.size
  || provenancePreserved !== CONFIRMED_ORPHAN_TASK_PATCHES.size;
console.log(`Dry-run result: ${blocked ? "BLOCKED" : "READY"}`);
process.exitCode = blocked ? 2 : 0;
