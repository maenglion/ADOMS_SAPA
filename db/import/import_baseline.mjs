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

const mode = process.argv.includes("--apply-compat")
  ? "apply-compat"
  : process.argv.includes("--apply")
    ? "apply"
    : process.argv.includes("--dry-run")
      ? "dry-run"
      : "";

if (!mode) {
  console.error("Pass exactly one mode: --dry-run, --apply-compat, or --apply.");
  process.exit(64);
}

const dataRoot = path.resolve(
  repoRoot,
  argValue("--data-root") || process.env.ADOMS_OPS_DIR || "data/_데모_용인시_20260920",
);
const overlayPath = path.resolve(repoRoot, argValue("--overlay") || ".data/overlay.json");
const manifestPath = path.resolve(repoRoot, argValue("--manifest") || "db/import/import_manifest.csv");
const provenancePath = path.resolve(repoRoot, argValue("--provenance") || "db/import/migration_provenance.json");
const verifyCsvPath = path.resolve(repoRoot, argValue("--verify-csv") || "db/import/import_verify.csv");
const verifyMdPath = path.resolve(repoRoot, argValue("--verify-md") || "db/import/IMPORT_VERIFY.md");
const tablesSqlPath = path.join(repoRoot, "db/migrations/0001_tables.sql");
const constraintsSqlPath = path.join(repoRoot, "db/migrations/0002_constraints.sql");
const viewsSqlPath = path.join(repoRoot, "db/migrations/0003_views.sql");
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
    const identity = new Map();
    for (const line of match[2].split(/\r?\n/)) {
      const col = line.match(/^\s*"([^"]+)"\s+(.+?)(?:,)?\s*$/);
      if (!col) continue;
      columns.push(col[1]);
      if (/\bGENERATED\b/i.test(col[2])) generated.add(col[1]);
      const identityMatch = col[2].match(/\bGENERATED\s+(ALWAYS|BY DEFAULT)\s+AS IDENTITY\b/i);
      if (identityMatch) identity.set(col[1], identityMatch[1].toUpperCase());
    }
    tables.set(match[1], { columns, generated, identity });
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
    counters.appliedPatchRecords.push({
      table,
      keyColumns: [...keyColumns],
      rawKey: String(rawKey),
      patch: { ...patch },
    });
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
  appliedPatchRecords: [],
};

const selected = new Map();
for (const table of schema.keys()) selected.set(table, readSeed(table, dirs));
const taskApproval = readSeed("task_approval_patch", dirs);

const tables = new Map();
const overlayInsertRowsByTable = new Map();
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
overlayInsertRowsByTable.set("audit_log", auditMapping.rows);
counters.overlayInsertsByTable.set("audit_log", auditMapping.rows.length);

for (const [table, rows] of [["evidence", overlay.evidence || []], ["inspection", overlay.inspection || []]]) {
  tables.set(table, [...rows.map((row) => ({ ...row })), ...(tables.get(table) || [])]);
  overlayInsertRowsByTable.set(table, rows.map((row) => ({ ...row })));
  counters.overlayInsertsByTable.set(table, rows.length);
}

for (const [table, added] of Object.entries(overlay.tables || {})) {
  if (!schema.has(table)) {
    counters.mappingIssues.push(`overlay.tables.${table}: target table does not exist`);
    continue;
  }
  tables.set(table, [...added.map((row) => ({ ...row })), ...(tables.get(table) || [])]);
  overlayInsertRowsByTable.set(table, [
    ...(overlayInsertRowsByTable.get(table) || []),
    ...added.map((row) => ({ ...row })),
  ]);
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
const dryRunIdentityDecisions = [];
for (const [table, target] of schema) {
  for (const [column, identityGeneration] of target.identity) {
    const rows = tables.get(table) || [];
    const sourceRowsWithValue = rows.filter((row) => Object.hasOwn(row, column)).length;
    dryRunIdentityDecisions.push({
      table,
      column,
      identityGeneration,
      sourceRows: rows.length,
      sourceRowsWithValue,
      action: sourceRowsWithValue === 0 ? "EXCLUDE_FROM_INSERT" : "PRESERVE_SOURCE_IDENTITY",
    });
  }
}

function quoteIdent(value) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function requireDatabaseUrl() {
  const value = process.env.DATABASE_PUBLIC_URL || "";
  if (!/^postgres(?:ql)?:\/\//.test(value)) {
    fail("DATABASE_PUBLIC_URL must be a complete PostgreSQL URI.");
  }
  return value;
}

async function openDatabase() {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: requireDatabaseUrl(),
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}

async function readStructure(client) {
  const [schemas, tablesResult, viewsResult, columnsResult, pkResult, fkResult, objectsResult] = await Promise.all([
    client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'adoms2'"),
    client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'adoms2' AND table_type = 'BASE TABLE' ORDER BY table_name"),
    client.query("SELECT table_name FROM information_schema.views WHERE table_schema = 'adoms2' ORDER BY table_name"),
    client.query("SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_generated, is_identity, identity_generation FROM information_schema.columns WHERE table_schema = 'adoms2' ORDER BY table_name, ordinal_position"),
    client.query("SELECT c.relname AS table_name, array_agg(a.attname ORDER BY k.ordinality) AS columns FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_index i ON i.indrelid = c.oid AND i.indisprimary CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum WHERE n.nspname = 'adoms2' GROUP BY c.relname ORDER BY c.relname"),
    client.query("SELECT count(*)::int AS count FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'adoms2' AND c.contype = 'f'"),
    client.query("SELECT relkind, count(*)::int AS count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'adoms2' GROUP BY relkind ORDER BY relkind"),
  ]);
  const columns = new Map();
  for (const row of columnsResult.rows) {
    if (!columns.has(row.table_name)) columns.set(row.table_name, []);
    columns.get(row.table_name).push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      generated: row.is_generated === "ALWAYS",
      identity: row.is_identity === "YES",
      identityGeneration: row.identity_generation || "",
    });
  }
  return {
    schemaExists: schemas.rowCount === 1,
    tables: tablesResult.rows.map((row) => row.table_name),
    views: viewsResult.rows.map((row) => row.table_name),
    columns,
    primaryKeys: new Map(pkResult.rows.map((row) => [row.table_name, row.columns])),
    pkCount: pkResult.rowCount,
    fkCount: fkResult.rows[0].count,
    objects: Object.fromEntries(objectsResult.rows.map((row) => [row.relkind, row.count])),
    columnCount: columnsResult.rowCount,
  };
}

async function readCounts(client, tableNames) {
  const counts = new Map();
  for (const table of tableNames) {
    const result = await client.query("SELECT count(*)::int AS count FROM adoms2." + quoteIdent(table));
    counts.set(table, result.rows[0].count);
  }
  return counts;
}

function sumCounts(counts) {
  return [...counts.values()].reduce((sum, value) => sum + Number(value), 0);
}

function sameStringSet(actual, expected) {
  return actual.length === expected.length && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function canonicalValue(value, meta) {
  if (value === null || value === undefined) return null;
  if (meta.dataType === "json" || meta.dataType === "jsonb") {
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  }
  if (meta.dataType === "boolean") {
    if (typeof value === "boolean") return value;
    const lowered = String(value).toLowerCase();
    if (["true", "t", "1", "yes", "y", "on"].includes(lowered)) return true;
    if (["false", "f", "0", "no", "n", "off"].includes(lowered)) return false;
  }
  if (meta.dataType.includes("timestamp")) {
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => item === null ? null : String(item));
  if (typeof value === "object") return value;
  return String(value);
}

function canonicalRows(rows, columnMeta, keyColumns = [], excludedColumns = new Set()) {
  const included = columnMeta.filter((column) => !column.generated && !excludedColumns.has(column.name));
  const metaByName = new Map(columnMeta.map((column) => [column.name, column]));
  const serialized = rows.map((row) => {
    const values = included.map((column) => canonicalValue(row[column.name], column));
    const payload = JSON.stringify(values);
    const usableKeys = keyColumns.filter((column) => !metaByName.get(column)?.generated && !excludedColumns.has(column));
    const key = usableKeys.length
      ? JSON.stringify(usableKeys.map((column) => canonicalValue(row[column], metaByName.get(column))))
      : payload;
    return { key, payload };
  });
  serialized.sort((a, b) => a.key.localeCompare(b.key) || a.payload.localeCompare(b.payload));
  const text = serialized.map((item) => item.payload).join("\n");
  return {
    hash: crypto.createHash("sha256").update(text, "utf8").digest("hex"),
    text,
  };
}

function normalizedSubset(row, columns, metaByName) {
  return JSON.stringify(columns.map((column) => canonicalValue(row[column], metaByName.get(column))));
}

function countSignatures(rows, columns, metaByName) {
  const counts = new Map();
  for (const row of rows) {
    const signature = normalizedSubset(row, columns, metaByName);
    counts.set(signature, (counts.get(signature) || 0) + 1);
  }
  return counts;
}

async function fetchAllRows(client, structure) {
  const rowsByTable = new Map();
  for (const table of structure.tables) {
    const columns = structure.columns.get(table) || [];
    const selectList = columns.map((column) => quoteIdent(column.name)).join(", ");
    const result = await client.query("SELECT " + selectList + " FROM adoms2." + quoteIdent(table));
    rowsByTable.set(table, result.rows);
  }
  return rowsByTable;
}

function prepareDbValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function analyzeIdentityColumns(structure) {
  const decisions = [];
  for (const table of structure.tables) {
    const rows = tables.get(table) || [];
    for (const column of structure.columns.get(table) || []) {
      if (!column.identity) continue;
      const sourceRowsWithValue = rows.filter((row) => Object.hasOwn(row, column.name)).length;
      let action = "EXCLUDE_FROM_INSERT";
      let reason = "source rows do not contain this identity column; database generates the surrogate key";
      if (sourceRowsWithValue > 0 && sourceRowsWithValue < rows.length) {
        action = "BLOCK_PARTIAL_SOURCE_IDENTITY";
        reason = "only some source rows contain an identity value; NULL or arbitrary regeneration is prohibited";
      } else if (sourceRowsWithValue === rows.length && rows.length > 0) {
        action = column.identityGeneration === "BY DEFAULT"
          ? "INSERT_SOURCE_IDENTITY"
          : "BLOCK_ALWAYS_IDENTITY";
        reason = column.identityGeneration === "BY DEFAULT"
          ? "every source row contains an identity value, so existing identifiers must be preserved"
          : "source identifiers exist but the database identity is ALWAYS; explicit override requires a separate decision";
      }
      decisions.push({
        schema: "adoms2",
        table,
        column: column.name,
        identityGeneration: column.identityGeneration,
        sourceRows: rows.length,
        sourceRowsWithValue,
        action,
        reason,
      });
    }
  }
  return decisions;
}

function identityExclusionsForTable(decisions, table) {
  return new Set(decisions
    .filter((decision) => decision.table === table && decision.action === "EXCLUDE_FROM_INSERT")
    .map((decision) => decision.column));
}

async function insertAllTables(client, structure) {
  const identityDecisions = analyzeIdentityColumns(structure);
  const blocked = identityDecisions.filter((decision) => decision.action.startsWith("BLOCK_"));
  if (blocked.length) {
    fail("Identity handling is unresolved: " + blocked.map((item) => item.table + "." + item.column + "=" + item.action).join(", "));
  }
  for (const table of structure.tables) {
    const target = schema.get(table);
    const rows = tables.get(table) || [];
    if (!target || rows.length === 0) continue;
    const excludedIdentity = identityExclusionsForTable(identityDecisions, table);
    const columns = (structure.columns.get(table) || [])
      .filter((column) => !column.generated && !excludedIdentity.has(column.name));
    const names = columns.map((column) => column.name);
    const chunkSize = Math.max(1, Math.min(100, Math.floor(60000 / Math.max(1, names.length))));
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const values = [];
      const groups = chunk.map((row) => {
        const slots = names.map((name) => {
          values.push(prepareDbValue(row[name]));
          return "$" + values.length;
        });
        return "(" + slots.join(", ") + ")";
      });
      const sql = "INSERT INTO adoms2." + quoteIdent(table)
        + " (" + names.map(quoteIdent).join(", ") + ") VALUES " + groups.join(", ");
      await client.query(sql, values);
    }
  }
}

async function verifyDatabase(client) {
  const errors = [];
  const structure = await readStructure(client);
  const expectedTables = [...schema.keys()].sort();
  const expectedViews = [...fs.readFileSync(viewsSqlPath, "utf8").matchAll(/CREATE VIEW adoms2\."([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  if (!structure.schemaExists) errors.push("schema adoms2 is missing");
  if (!sameStringSet(structure.tables, expectedTables)) errors.push("physical table set differs from the 91-table migration target");
  if (!sameStringSet(structure.views, expectedViews)) errors.push("view set differs from the 4-view migration target");
  if (structure.pkCount !== 52) errors.push("primary key count is " + structure.pkCount + ", expected 52");
  if (structure.fkCount !== 0) errors.push("active foreign key count is " + structure.fkCount + ", expected 0");

  const counts = await readCounts(client, structure.tables);
  const rowsByTable = await fetchAllRows(client, structure);
  const identityDecisions = analyzeIdentityColumns(structure);
  const verifyRows = [];
  let pkDuplicateTotalActual = 0;
  let overlayInsertVerified = 0;
  let overlayPatchVerified = 0;

  for (const row of manifest) {
    const table = row.table;
    const actualRows = rowsByTable.get(table) || [];
    const actualCount = counts.get(table) || 0;
    const expectedRows = tables.get(table) || [];
    const columnMeta = structure.columns.get(table) || [];
    const excludedIdentity = identityExclusionsForTable(identityDecisions, table);
    const generated = new Set(columnMeta
      .filter((column) => column.generated || excludedIdentity.has(column.name))
      .map((column) => column.name));
    const pk = structure.primaryKeys.get(table) || [];
    const actualDuplicate = duplicates(actualRows, pk, generated);
    const expectedCanonical = canonicalRows(expectedRows, columnMeta, pk, excludedIdentity);
    const actualCanonical = canonicalRows(actualRows, columnMeta, pk, excludedIdentity);
    const insertSource = overlayInsertRowsByTable.get(table) || [];
    let tableInsertVerified = 0;
    if (insertSource.length) {
      const metaByName = new Map(columnMeta.map((column) => [column.name, column]));
      const insertColumns = [...sourceColumns(insertSource)].sort();
      const needed = countSignatures(insertSource, insertColumns, metaByName);
      const available = countSignatures(actualRows, insertColumns, metaByName);
      const allPresent = [...needed].every(([signature, count]) => (available.get(signature) || 0) >= count);
      if (allPresent) tableInsertVerified = insertSource.length;
      else errors.push(table + ": one or more overlay INSERT rows are not present with all mapped values");
    }
    const expectedCount = Number(row.final_expected_rows);
    const difference = actualCount - expectedCount;
    if (difference !== 0) errors.push(table + ": row count " + actualCount + ", expected " + expectedCount);
    if (actualDuplicate.count !== 0) errors.push(table + ": " + actualDuplicate.count + " duplicate primary-key rows");
    if (expectedCanonical.hash !== actualCanonical.hash) errors.push(table + ": canonical content checksum mismatch");
    pkDuplicateTotalActual += actualDuplicate.count;
    overlayInsertVerified += tableInsertVerified;
    verifyRows.push({
      table,
      expected_rows: expectedCount,
      actual_rows: actualCount,
      difference,
      pk_columns: pk.join("+"),
      pk_duplicate_rows: actualDuplicate.count,
      overlay_insert_expected: insertSource.length,
      overlay_insert_verified: tableInsertVerified,
      overlay_patch_expected: counters.overlayPatchesByTable.get(table) || 0,
      overlay_patch_verified: 0,
      expected_checksum_sha256: expectedCanonical.hash,
      actual_checksum_sha256: actualCanonical.hash,
      checksum_match: expectedCanonical.hash === actualCanonical.hash ? "YES" : "NO",
      status: difference === 0 && actualDuplicate.count === 0 && expectedCanonical.hash === actualCanonical.hash && tableInsertVerified === insertSource.length ? "PASS" : "FAIL",
    });
  }

  for (const record of counters.appliedPatchRecords) {
    const columnMeta = structure.columns.get(record.table) || [];
    const metaByName = new Map(columnMeta.map((column) => [column.name, column]));
    const rows = rowsByTable.get(record.table) || [];
    const expectedKey = record.keyColumns.length === 1
      ? String(record.rawKey)
      : String(record.rawKey).split("|").join("\u001f");
    const actual = rows.find((row) => keyFor(row, record.keyColumns) === expectedKey);
    const patchColumns = Object.keys(record.patch).sort();
    const matches = actual
      && normalizedSubset(actual, patchColumns, metaByName) === normalizedSubset(record.patch, patchColumns, metaByName);
    if (matches) {
      overlayPatchVerified += 1;
      const verifyRow = verifyRows.find((item) => item.table === record.table);
      verifyRow.overlay_patch_verified += 1;
    } else errors.push(record.table + ":" + record.rawKey + ": overlay PATCH values do not match");
  }

  const orphanResult = await client.query("SELECT count(*)::int AS count FROM adoms2.\"compliance_task\" WHERE \"task_id\" = $1", ["TSK-000782"]);
  const orphanAbsent = orphanResult.rows[0].count === 0;
  if (!orphanAbsent) errors.push("TSK-000782 exists in compliance_task");

  const auditRows = rowsByTable.get("audit_log") || [];
  const auditMeta = new Map((structure.columns.get("audit_log") || []).map((column) => [column.name, column]));
  const auditColumns = ["changed_at", "changed_by", "action", "note", "target", "what"];
  const auditExpected = countSignatures(auditMapping.rows, auditColumns, auditMeta);
  const auditActual = countSignatures(auditRows, auditColumns, auditMeta);
  const auditLossless = auditRows.length === auditMapping.rows.length
    && [...auditExpected].every(([signature, count]) => auditActual.get(signature) === count);
  if (!auditLossless) errors.push("audit_log overlay rows are not losslessly preserved");

  let viewSelectSuccess = 0;
  for (const view of expectedViews) {
    try {
      await client.query("SELECT * FROM adoms2." + quoteIdent(view) + " LIMIT 0");
      viewSelectSuccess += 1;
    } catch (error) {
      errors.push(view + ": SELECT failed: " + error.message);
    }
  }

  for (const verifyRow of verifyRows) {
    if (verifyRow.overlay_patch_expected !== verifyRow.overlay_patch_verified) verifyRow.status = "FAIL";
    if (verifyRow.overlay_insert_expected !== verifyRow.overlay_insert_verified) verifyRow.status = "FAIL";
  }

  const totalRows = sumCounts(counts);
  if (totalRows !== 25022) errors.push("total physical row count is " + totalRows + ", expected 25022");
  if (overlayInsertVerified !== 354) errors.push("verified overlay INSERT rows are " + overlayInsertVerified + ", expected 354");
  if (overlayPatchVerified !== 49) errors.push("verified overlay PATCH rows are " + overlayPatchVerified + ", expected 49");
  if (mappingMissingCount !== 0) errors.push("source mapping missing count is " + mappingMissingCount + ", expected 0");
  if (counters.orphanExcluded !== 1 || provenancePreserved !== 1) errors.push("orphan exclusion/provenance count differs from 1/1");

  return {
    structure,
    counts,
    rowsByTable,
    verifyRows,
    totalRows,
    pkDuplicateTotalActual,
    overlayInsertVerified,
    overlayPatchVerified,
    orphanAbsent,
    auditRows: auditRows.length,
    auditLossless,
    viewSelectSuccess,
    sourceMappingMissing: mappingMissingCount,
    identityDecisions,
    errors,
  };
}

function writeVerificationArtifacts(result) {
  writeCsv(verifyCsvPath, result.verifyRows);
  const checksumMatches = result.verifyRows.filter((row) => row.checksum_match === "YES").length;
  const tableMatches = result.verifyRows.filter((row) => row.difference === 0).length;
  const lines = [
    "# ADOMS SAPA Baseline Import Verification",
    "",
    "## Result",
    "",
    "- Status: PASS",
    "- PostgreSQL schema: adoms2",
    "- Physical tables: " + result.structure.tables.length,
    "- Views: " + result.structure.views.length,
    "- Primary keys: " + result.structure.pkCount,
    "- Active foreign keys: " + result.structure.fkCount,
    "- Expected/actual physical rows: 25,022 / " + result.totalRows,
    "- Tables with expected == actual rows: " + tableMatches + " / 91",
    "- Canonical content checksum matches: " + checksumMatches + " / 91",
    "- Primary-key duplicate rows: " + result.pkDuplicateTotalActual,
    "- Overlay INSERT rows verified: " + result.overlayInsertVerified + " / 354",
    "- Overlay PATCH records verified: " + result.overlayPatchVerified + " / 49",
    "- Confirmed orphan excluded: " + counters.orphanExcluded + " / 1",
    "- Provenance records preserved: " + provenancePreserved + " / 1",
    "- TSK-000782 absent from compliance_task: " + (result.orphanAbsent ? "YES" : "NO"),
    "- audit_log rows: " + result.auditRows,
    "- overlay.log lossless mapping: " + (result.auditLossless ? "241 / 241" : "FAILED"),
    "- Views accepting SELECT: " + result.viewSelectSuccess + " / 4",
    "- Source table mapping missing: " + result.sourceMappingMissing,
    "- Identity columns handled from database catalog: " + result.identityDecisions.length,
    "",
    "## Identity handling",
    "",
    ...result.identityDecisions.map((item) => "- " + item.schema + "." + item.table + "." + item.column
      + ": " + item.identityGeneration + ", source values " + item.sourceRowsWithValue + "/" + item.sourceRows
      + ", action " + item.action),
    "",
    "## Transaction and rollback",
    "",
    "- 0004_import_compat.sql was applied in its own transaction before import.",
    "- The baseline data load and all pre-commit content checks ran in one transaction.",
    "- No seed or overlay source file was modified.",
    "- No foreign key was activated.",
    "",
    "## Orphan handling",
    "",
    "- TSK-000782 was not inserted or patched into compliance_task.",
    "- Its original patch and lifecycle evidence remain in migration_provenance.json.",
    "",
    "## Adapter transition condition",
    "",
    "- The deployed app still reads CSV + overlay data; this import does not switch application code to PostgreSQL.",
    "- When the database adapter is introduced, audit_log.changed_at must be returned as at and changed_by as by.",
    "- The existing activity feed behavior must be reproduced with ORDER BY changed_at DESC LIMIT 100; all 241 audit rows remain stored.",
    "",
    "## Per-table evidence",
    "",
    "- Full expected/actual row counts and order-independent canonical SHA-256 checksums are in import_verify.csv.",
    "",
  ];
  fs.writeFileSync(verifyMdPath, lines.join("\n"), "utf8");
}

async function applyCompatibilityMigration() {
  const client = await openDatabase();
  try {
    const before = await readStructure(client);
    const beforeCounts = await readCounts(client, before.tables);
    if (before.tables.length !== 91 || before.views.length !== 4 || before.pkCount !== 52 || before.fkCount !== 0) {
      fail("Pre-migration structure differs from TABLE 91 / VIEW 4 / PK 52 / FK 0.");
    }
    if (sumCounts(beforeCounts) !== 0) fail("Pre-migration database is not empty.");
    const auditBefore = new Set((before.columns.get("audit_log") || []).map((column) => column.name));
    const missingBefore = ["target", "what"].filter((column) => !auditBefore.has(column)).length;
    try {
      await client.query(fs.readFileSync(compatibilitySqlPath, "utf8"));
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    }
    const after = await readStructure(client);
    const afterCounts = await readCounts(client, after.tables);
    const auditAfter = new Set((after.columns.get("audit_log") || []).map((column) => column.name));
    if (!auditAfter.has("target") || !auditAfter.has("what")) fail("0004 completed without both audit_log.target and audit_log.what.");
    if (!sameStringSet(after.tables, before.tables) || !sameStringSet(after.views, before.views)) fail("0004 changed the table/view object set.");
    if (JSON.stringify(after.objects) !== JSON.stringify(before.objects)) fail("0004 changed schema object counts outside its two columns.");
    if (after.columnCount - before.columnCount !== missingBefore) fail("0004 column-count delta is not the expected " + missingBefore + ".");
    if (after.pkCount !== 52 || after.fkCount !== 0) fail("0004 changed PK/FK counts.");
    if (sumCounts(afterCounts) !== 0) fail("Rows appeared while applying 0004.");
    console.log("0004 import compatibility migration: PASS");
    console.log("audit_log.target: PRESENT");
    console.log("audit_log.what: PRESENT");
    console.log("Tables/views/PK/FK: " + after.tables.length + "/" + after.views.length + "/" + after.pkCount + "/" + after.fkCount);
    console.log("Total rows after 0004: " + sumCounts(afterCounts));
  } finally {
    await client.end();
  }
}

async function applyBaselineImport() {
  const client = await openDatabase();
  let committed = false;
  try {
    const pre = await readStructure(client);
    const preCounts = await readCounts(client, pre.tables);
    const auditColumns = new Set((pre.columns.get("audit_log") || []).map((column) => column.name));
    if (pre.tables.length !== 91 || pre.views.length !== 4 || pre.pkCount !== 52 || pre.fkCount !== 0) {
      fail("Import preflight structure differs from TABLE 91 / VIEW 4 / PK 52 / FK 0.");
    }
    if (!auditColumns.has("target") || !auditColumns.has("what")) fail("0004 import compatibility columns are missing.");
    if (sumCounts(preCounts) !== 0) fail("Import preflight requires all 91 tables to be empty.");
    const identityDecisions = analyzeIdentityColumns(pre);
    console.log("Identity handling targets:");
    for (const item of identityDecisions) {
      console.log("- " + item.schema + "." + item.table + "." + item.column
        + " | generation=" + item.identityGeneration
        + " | source_values=" + item.sourceRowsWithValue + "/" + item.sourceRows
        + " | action=" + item.action);
    }
    const identityBlocked = identityDecisions.filter((item) => item.action.startsWith("BLOCK_"));
    if (identityBlocked.length) {
      fail("Import preflight found unresolved identity columns: "
        + identityBlocked.map((item) => item.table + "." + item.column).join(", "));
    }
    await client.query("BEGIN");
    try {
      await insertAllTables(client, pre);
      const inside = await verifyDatabase(client);
      if (inside.errors.length) fail("Pre-commit verification failed: " + inside.errors.join(" | "));
      await client.query("COMMIT");
      committed = true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    const result = await verifyDatabase(client);
    if (result.errors.length) {
      fail("Post-commit verification failed; application transition is prohibited: " + result.errors.join(" | "));
    }
    writeVerificationArtifacts(result);
    console.log("Baseline import: PASS");
    console.log("Physical rows: " + result.totalRows);
    console.log("Per-table row matches: " + result.verifyRows.filter((row) => row.difference === 0).length + "/91");
    console.log("Canonical checksum matches: " + result.verifyRows.filter((row) => row.checksum_match === "YES").length + "/91");
    console.log("PK duplicates: " + result.pkDuplicateTotalActual);
    console.log("Overlay INSERT verified: " + result.overlayInsertVerified + "/354");
    console.log("Overlay PATCH verified: " + result.overlayPatchVerified + "/49");
    console.log("Confirmed orphan excluded/provenance preserved: " + counters.orphanExcluded + "/" + provenancePreserved);
    console.log("audit_log lossless: " + (result.auditLossless ? "241/241" : "FAILED"));
    console.log("Views SELECT: " + result.viewSelectSuccess + "/4");
    console.log("Active FK: " + result.structure.fkCount);
    console.log("Verify report: " + relative(verifyMdPath));
    console.log("Verify matrix: " + relative(verifyCsvPath));
  } catch (error) {
    if (!committed) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    throw error;
  } finally {
    await client.end();
  }
}

console.log("ADOMS baseline import preparation (mode=" + mode + ")");
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
console.log("Identity handling targets:");
for (const item of dryRunIdentityDecisions) {
  console.log("- adoms2." + item.table + "." + item.column
    + " | generation=" + item.identityGeneration
    + " | source_values=" + item.sourceRowsWithValue + "/" + item.sourceRows
    + " | action=" + item.action);
}

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
if (blocked) {
  process.exitCode = 2;
} else if (mode === "apply-compat") {
  await applyCompatibilityMigration();
} else if (mode === "apply") {
  await applyBaselineImport();
}
