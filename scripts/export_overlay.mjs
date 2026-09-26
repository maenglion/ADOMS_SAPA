/**
 * 덮개(.data/overlay.json) → SQL 내보내기 (2026-09-21)
 *
 * 왜 필요한가
 *   CSV 로 돌 때 시연 중 화면에서 등록한 증빙·결재는 **덮개 파일**에만 쌓인다.
 *   Supabase 로 옮기거나 다른 곳(Railway 등)에 배포하면 그 입력이 따라가지 않는다.
 *   이 스크립트가 덮개를 INSERT/UPDATE 문으로 바꿔 놓아, 옮긴 뒤에도 그대로 살릴 수 있다.
 *
 * 쓰는 법
 *   node scripts/export_overlay.mjs               → 화면에 뿌린다
 *   node scripts/export_overlay.mjs out.sql       → 파일로 저장한다
 *   그 SQL 을 Supabase SQL Editor 에 붙여 넣고 실행한다.
 *
 * ★ 덮개는 지우지 않는다. 내보내기만 한다.
 */
import fs from "node:fs";
import path from "node:path";

const OVERLAY = path.join(process.cwd(), ".data", "overlay.json");
const out = process.argv[2];

const q = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);

let o;
try {
  o = JSON.parse(fs.readFileSync(OVERLAY, "utf8"));
} catch {
  console.error("덮개 파일이 없습니다 — 시연 중 입력한 것이 없다는 뜻입니다.");
  console.error(`  찾은 자리: ${OVERLAY}`);
  process.exit(0);
}

const L = [];
L.push("-- ADOMS 데모 2차 — 시연 중 입력분(덮개) 옮기기");
L.push(`-- 만든 때 ${new Date().toISOString().slice(0, 19).replace("T", " ")}`);
L.push("-- 이 SQL 은 덮개 파일에 쌓인 증빙 등록·결재만 담는다. 시드는 CSV 로 따로 넣는다.");
L.push("set search_path to adoms2, public;");
L.push("begin;");
L.push("");

const ev = o.evidence || [];
L.push(`-- 1. 증빙 ${ev.length}건`);
for (const e of ev) {
  L.push(
    `insert into evidence (evidence_id, task_id, evidence_kind, file_name, file_url, form_id, uploaded_by, uploaded_at, note, entered_in_demo)\n` +
    `values (${q(e.evidence_id)}, ${q(e.task_id)}, ${q(e.evidence_kind)}, ${q(e.file_name)}, ${q(e.file_url)}, ` +
    `${q(e.form_id)}, ${q(e.uploaded_by)}, ${q(e.uploaded_at)}::date, ${q(e.note || "시연 중 입력")}, true)\n` +
    `on conflict (evidence_id) do nothing;`
  );
}
L.push("");

const tp = Object.entries(o.taskPatch || {});
L.push(`-- 2. 과제 상태·결재 ${tp.length}건`);
for (const [id, p] of tp) {
  const sets = [];
  const put = (col, val, cast = "") => {
    if (val !== undefined && val !== null && val !== "") sets.push(`${col} = ${q(val)}${cast}`);
  };
  put("status", p.status);
  put("done_at", p.done_at, "::date");
  put("done_by", p.done_by);
  put("approval_status", p.approval_status);
  put("submitted_at", p.submitted_at, "::timestamptz");
  put("submitted_by", p.submitted_by);
  put("approved_at", p.approved_at, "::timestamptz");
  put("approved_by", p.approved_by);
  put("rejected_at", p.rejected_at, "::timestamptz");
  put("reject_reason", p.reject_reason);
  sets.push("entered_in_demo = true");
  L.push(`update compliance_task set ${sets.join(", ")} where task_id = ${q(id)};`);
}
L.push("");

const log = o.log || [];
L.push(`-- 3. 시연 중 일어난 일 ${log.length}건 (audit_log 가 있을 때만)`);
for (const g of log) {
  L.push(
    `insert into audit_log (at, action, target, actor, note)\n` +
    `select ${q(g.at)}::timestamptz, ${q(g.action)}, ${q(g.target)}, ${q(g.by)}, ${q(g.note)}\n` +
    `where to_regclass('adoms2.audit_log') is not null;`
  );
}
L.push("");
L.push("commit;");
L.push("");
L.push(`-- 확인: select count(*) from evidence where entered_in_demo;`);
L.push(`-- 확인: select count(*) from compliance_task where entered_in_demo;`);

const sql = L.join("\n");
if (out) {
  fs.writeFileSync(out, sql, "utf8");
  console.log(`${out} 에 저장했습니다 — 증빙 ${ev.length}건 · 과제 ${tp.length}건 · 기록 ${log.length}건`);
  console.log("Supabase SQL Editor 에 붙여 넣고 실행하십시오. 덮개 파일은 그대로 둡니다.");
} else {
  console.log(sql);
}
