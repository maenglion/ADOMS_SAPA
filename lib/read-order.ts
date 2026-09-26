import "server-only";
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, any>;
type OrderEntry = { columns: string[]; keys: string[] };

let cached: { tables: Record<string, OrderEntry> } | null = null;

function orderContract() {
  if (!cached) {
    const file = path.join(process.cwd(), "db", "read-shadow", "read_order_contract.json");
    cached = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return cached;
}

export function applyReadOrder(table: string, rows: Row[]): Row[] {
  const entry = orderContract().tables[table];
  if (!entry) return rows;
  const positions = new Map<string, number[]>();
  entry.keys.forEach((key, index) => {
    const list = positions.get(key) || [];
    list.push(index);
    positions.set(key, list);
  });
  let tail = entry.keys.length;
  return rows.map((row) => {
    const key = entry.columns.map((column) => String(row[column] ?? "")).join("\u001f");
    return { row, position: positions.get(key)?.shift() ?? tail++ };
  }).sort((a, b) => a.position - b.position).map((item) => item.row);
}
