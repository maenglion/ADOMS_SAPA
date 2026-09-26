import crypto from "node:crypto";

const hash = (parts) => crypto.createHash("sha256").update(parts.join("\n")).digest("hex");
const typeOf = (value) => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const nullState = (value) => value === null ? "NULL" : value === "" ? "EMPTY" : value === undefined ? "MISSING" : "VALUE";

export function caseContract(value) {
  if (!Array.isArray(value)) {
    const columns = value && typeof value === "object" ? Object.keys(value).sort() : [];
    return { kind: "single", columns, expected: caseSignature(value, { kind: "single", columns }) };
  }
  const column_sets = [];
  const indexes = new Map();
  const row_column_set = value.map((row) => {
    const columns = row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row).sort() : [];
    const key = JSON.stringify(columns);
    if (!indexes.has(key)) { indexes.set(key, column_sets.length); column_sets.push(columns); }
    return indexes.get(key);
  });
  return { kind: "array", column_sets, row_column_set, expected: caseSignature(value, { kind: "array", column_sets, row_column_set }) };
}

export function caseSignature(value, contract) {
  const rows = contract.kind === "array" ? (Array.isArray(value) ? value : []) : [value];
  const columnsFor = (index) => contract.kind === "array" ? (contract.column_sets?.[contract.row_column_set?.[index]] || []) : contract.columns;
  const valueRows = rows.map((row, index) => columnsFor(index).length
    ? columnsFor(index).map((column) => `${column}=${JSON.stringify(row?.[column])}`).join("\u001e")
    : JSON.stringify(row));
  const typeRows = rows.map((row, index) => columnsFor(index).length
    ? columnsFor(index).map((column) => `${column}=${typeOf(row?.[column])}`).join("\u001e")
    : typeOf(row));
  const nullRows = rows.map((row, index) => columnsFor(index).length
    ? columnsFor(index).map((column) => `${column}=${nullState(row?.[column])}`).join("\u001e")
    : nullState(row));
  return {
    row_count: contract.kind === "array" ? rows.length : 1,
    value_hash: hash(valueRows),
    unordered_value_hash: hash([...valueRows].sort()),
    type_hash: hash(typeRows),
    null_empty_hash: hash(nullRows),
  };
}
