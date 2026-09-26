import fs from "node:fs";
import path from "node:path";
import { caseContract } from "./read_signature.mjs";

const input = process.argv[2];
const output = process.argv[3] || "db/read-shadow/read_comparison_contract.json";
if (!input) throw new Error("CSV snapshot path is required");
const snapshot = JSON.parse(fs.readFileSync(input, "utf8"));
const cases = Object.fromEntries(snapshot.cases.map((item) => [item.name, caseContract(item.value)]));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ format: "adoms-read-comparison-v1", cases }, null, 2) + "\n");
console.log(JSON.stringify({ cases: Object.keys(cases).length, output }));
