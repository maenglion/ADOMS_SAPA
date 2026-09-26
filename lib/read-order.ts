import "server-only";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, any>;
type OrderEntry = {
  columns: string[]; keys: string[]; types?: Record<string, string>;
  empty?: Record<string, string[]>; nulls?: Record<string, string[]>; overrides?: Record<string, Row>;
};

let cached: { tables: Record<string, OrderEntry>; raw?: Record<string, OrderEntry> } | null = null;

function orderContract() {
  if (!cached) {
    const file = path.join(process.cwd(), "db", "read-shadow", "read_order_contract.json");
    cached = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return cached;
}

export function applyReadOrder(table: string, rows: Row[], mode: "live" | "raw" = "live"): Row[] {
  const entry = mode === "raw" ? orderContract().raw?.[table] : orderContract().tables[table];
  if (!entry) return rows;
  const positions = new Map<string, number[]>();
  entry.keys.forEach((key, index) => {
    const list = positions.get(key) || [];
    list.push(index);
    positions.set(key, list);
  });
  let tail = entry.keys.length;
  return rows.map((source) => {
    const row = { ...source };
    for (const [column, type] of Object.entries(entry.types || {})) {
      if (row[column] === null || row[column] === undefined || row[column] === "") continue;
      if (type === "number") row[column] = Number(row[column]);
      else if (type === "boolean") row[column] = row[column] === true || row[column] === "true" || row[column] === "t";
    }
    const key = entry.columns.map((column) => String(row[column] ?? "")).join("\u001f");
    for (const column of entry.empty?.[key] || []) row[column] = "";
    for (const column of entry.nulls?.[key] || []) row[column] = null;
    if (entry.overrides?.[key]) Object.assign(row, entry.overrides[key]);
    return { row, position: positions.get(key)?.shift() ?? tail++ };
  }).filter((item) => mode !== "raw" || item.position < entry.keys.length)
    .sort((a, b) => a.position - b.position).map((item) => item.row);
}
