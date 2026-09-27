/**
 * 데이터 접근 한 곳.
 *
 * 규칙 (메모리 adoms-ui-data-access-rule)
 *   · 화면은 이 파일의 공통 READ 함수만 쓴다.
 *   · 쓰기는 이 파일의 공통 경로(rpc*)로만 한다.
 *
 * 두 가지 READ 원천을 쓴다.
 *   ① PostgreSQL (ADOMS_DATA_BACKEND=postgres) — 스키마 adoms2 의 표·뷰
 *   ② CSV (기본값) — 데모 DB 판 폴더의 seed CSV 를 서버에서 읽어 같은 모양으로 만든다
 *      적재 전에도 화면을 만들 수 있게 하기 위한 것이고, 값은 같은 시드라 결과가 같다.
 */
import "server-only";
import fs from "node:fs";
import { readOverlay } from "./write";
import path from "node:path";
import { queryAuditLog, queryRows, withReadOperation } from "./db";
import { applyReadOrder } from "./read-order";
import { dataBackend, usesPostgresReads } from "./data-backend";
import { seedDirectories } from "./data-root";

export type Row = Record<string, any>;

export const useDb = usesPostgresReads();

/**
 * [400 · 교육자료 버전] 판 폴더 — 교육자료 버전 운영DB(`us_*`, 이 앱만 읽음)를 먼저, 그다음 공통 판(`ops_*`)을 새것부터.
 * 다른 앱(3100·3200·3300)은 `ops_*` 만 읽으므로 `us_*` 에 무엇을 넣어도 영향이 없다.
 */
function opsDirs(): string[] {
  return seedDirectories();
}

/** 아주 작은 CSV 파서 — 따옴표·줄바꿈·BOM 을 다룬다. */
export function parseCsv(text: string): Row[] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o: Row = {};
    head.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

const cache = new Map<string, Row[]>();

/** 시드 표 하나를 읽는다(캐시). 판 폴더를 새것부터 훑는다. */
/**
 * [매뉴얼 캡처용] 예시 자료 파일의 시연 표시(「예시 자료(시연용)」「가상 인물」「(가상)」 등)와
 * 의무 설명의 내부 작업 표시(「★」「검수 필요」)를 화면에 올리기 전에 걷는다. 원본 파일은 건드리지 않는다.
 */
const SKIP_SCRUB = new Set(["source_text", "badge"]);
function scrubText(k: string, v: string): string {
  let t = v
    .replace(/예시 데이터\(시연용\)|예시 자료\(시연용\)|가상 인물\(시연용\)|옮겨 온 행/g, "")
    .replace(/\(시연용\)/g, "")
    .replace(/\s*\(가상\)/g, "")
    .replace(/, 가상\)/g, ")");
  if (k === "note") t = t.replace(/^\s*예시 자료\s*$/, "").replace(/예시 자료/g, "");
  if (k === "why") t = t.replace(/^★\s*/, "").replace(/★사용자 검수 지정 자리 — /g, "").replace(/\(([^()]*?)\s*검수 필요\)/g, "");
  if (t !== v) t = t.replace(/\s+·(\s+·)+\s+/g, " · ").replace(/^\s*·\s+|\s+·\s*$/g, "").trim();
  return t;
}
function scrubRow(r: Row): Row {
  const o: Row = {};
  for (const [k, v] of Object.entries(r)) o[k] = typeof v === "string" && !SKIP_SCRUB.has(k) ? scrubText(k, v) : v;
  return o;
}

/**
 * 의무 표(duty_class) — 데이터 판 + 화면·법령 개정 확인에서 더하고 고친 것(덮개)을 겹친다(09-24 법령 개정 반영).
 * 법령 개정으로 「개정 — 재검토 필요」 표시(rev_state)·새 조문 의무·삭제 표시(retired)가 여기로 들어온다.
 */
export function dutyClassRows(includeRetired = false): Row[] {
  const o: any = readOverlay();
  const added: Row[] = (o.tables && o.tables.duty_class) || [];
  const patches: Record<string, Row> = (o.patches && o.patches.duty_class) || {};
  const rows = [...added, ...seed("duty_class")].map((r) => (patches[r.duty_key] ? { ...r, ...patches[r.duty_key] } : r));
  return includeRetired ? rows : rows.filter((r) => r.retired !== "Y");
}

export function seed(table: string): Row[] {
  if (cache.has(table)) return cache.get(table)!;
  for (const dir of opsDirs()) {
    const f = path.join(dir, `${table}.csv`);
    if (fs.existsSync(f)) {
      const rows = parseCsv(fs.readFileSync(f, "utf8")).map(scrubRow);
      cache.set(table, rows);
      return rows;
    }
  }
  cache.set(table, []);
  return [];
}

/** PostgreSQL 조회. 기존 내부 query contract는 canonical DB layer에서 parameterized SQL로 바꾼다. */
async function fromDb(relation: string, qs: string): Promise<Row[]> {
  return queryRows(relation, qs);
}

async function liveTable(table: string): Promise<Row[]> {
  return applyReadOrder(table, await fromDb(table, "select=*&limit=100000"), "live");
}

// `task_approval_patch` is intentionally merged into the physical PostgreSQL
// compliance_task table, but the frozen UI has two different logical reads:
// tasks() sees the base task plus overlay.taskPatch, while approvals() also
// sees task_approval_patch. Restore that distinction only for tasks().
const TASK_APPROVAL_PATCH_FIELDS = [
  "approval_status", "created_by", "submitted_at", "submitted_by", "approved_at", "approved_by",
  "rejected_at", "reject_reason", "created_at", "period_year", "half_year", "plan_date",
  "evidence_cnt", "check_result", "head_ok_at", "head_ok_by",
] as const;

function taskRowsForUi(rows: Row[]): Row[] {
  if (!useDb) return rows;
  const patches = readOverlay().taskPatch;
  return rows.map((source) => {
    const row = { ...source };
    for (const field of TASK_APPROVAL_PATCH_FIELDS) delete row[field];
    return patches[row.task_id] ? { ...row, ...patches[row.task_id] } : row;
  });
}

/* ── 화면이 쓰는 함수들 ─────────────────────────────────────── */

export type DutyRow = Row;

/** 의무(분류) — 3축 탐색·목록·상세의 원천. */
export async function duties(filter: {
  area?: string; code36?: string; target?: string; group?: string; law?: string;
  impl?: string; mark?: string; q?: string; limit?: number;
} = {}): Promise<DutyRow[]> {
  const lim = filter.limit ?? 500;
  let rows = useDb
    ? (await readTable("duty_class", "duty_key")).filter((r) => r.retired !== "Y")
    : dutyClassRows();
  const f = filter;
  if (f.area) rows = rows.filter((r) => r.area === f.area);
  if (f.code36) rows = rows.filter((r) => String(r.code36 || "").split(";")[0].trim() === f.code36); // 여러 조항에 걸린 행은 첫 조항으로 센다(의무조항별 카드와 같은 규칙)
  if (f.target) rows = rows.filter((r) => r.target_code === f.target);
  if (f.group) rows = rows.filter((r) => r.law_group === f.group);
  if (f.law) rows = rows.filter((r) => r.law === f.law);
  if (f.impl) rows = rows.filter((r) => r.impl_type === f.impl);
  if (f.mark) rows = rows.filter((r) => r.yongin_mark === f.mark);
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.duty_name, r.law, r.article_title, r.doc, r.task_name]
        .join(" ").toLowerCase().includes(q));
  }
  return rows.slice(0, lim);
}

export async function dutyByKey(key: string): Promise<DutyRow | null> {
  if (useDb) return (await readTable("duty_class", "duty_key")).find((r) => r.duty_key === key) ?? null;
  return dutyClassRows(true).find((r) => r.duty_key === key) ?? null;
}

/** 자산(관리대상). */
/**
 * [캡처 v2] 관리대상(자산) 대장 — 설정 › 관리대상 관리에서 더하고 뺀 것을 겹친다(2026-09-23).
 * 더한 자산은 덮개 `tables.asset`, 뺀 자산은 덮개 `patches.asset[id].deleted = "Y"`(지우지 않고 표시만).
 * 관리대상 유형 연결도 덮개 `tables.asset_target_map` 을 겹친다. 모든 자산 읽기는 이 두 함수를 쓴다.
 */
export function assetSeed(includeDeleted = false): Row[] {
  const o: any = readOverlay();
  const added: Row[] = (o.tables && o.tables.asset) || [];
  const patches: Record<string, Row> = (o.patches && o.patches.asset) || {};
  const rows = [...added, ...seed("asset")].map((r) => (patches[r.asset_id] ? { ...r, ...patches[r.asset_id] } : r));
  return includeDeleted ? rows : rows.filter((r) => r.deleted !== "Y");
}
export function assetMapSeed(): Row[] {
  const o: any = readOverlay();
  const live = new Set(assetSeed().map((a) => a.asset_id));
  return [...((o.tables && o.tables.asset_target_map) || []), ...seed("asset_target_map")].filter((m) => live.has(m.asset_id));
}

export async function assets(filter: { target?: string; dept?: string; q?: string; limit?: number } = {}) {
  const lim = filter.limit ?? 300;
  let rows = useDb
    ? (await readTable("asset", "asset_id")).filter((r) => r.deleted !== "Y")
    : assetSeed();
  if (filter.dept) rows = rows.filter((r) => r.dept_id === filter.dept);
  if (filter.q) rows = rows.filter((r) => (r.asset_name || "").includes(filter.q!));
  if (filter.target) {
    const map = useDb ? await readTable("asset_target_map") : assetMapSeed();
    const ids = new Set(map.filter((m) => m.target_code === filter.target).map((m) => m.asset_id));
    rows = rows.filter((r) => ids.has(r.asset_id));
  }
  return rows.slice(0, lim);
}

export async function assetById(id: string) {
  if (useDb) return (await readTable("asset", "asset_id")).find((r) => r.asset_id === id) ?? null;
  return assetSeed().find((r) => r.asset_id === id) ?? null;
}

/** 자산 하나에 걸리는 관리대상 코드들. */
export async function assetTargets(id: string): Promise<string[]> {
  if (useDb) return (await readTable("asset_target_map")).filter((r) => r.asset_id === id).map((r) => r.target_code);
  return assetMapSeed().filter((r) => r.asset_id === id).map((r) => r.target_code);
}

/** 과제(내 업무·이행 현황). */
async function tasksInner(filter: { dept?: string; staff?: string; status?: string; limit?: number } = {}): Promise<Row[]> {
  const lim = filter.limit ?? 400;
  // CSV 대체 — 과제 × 배정 × 의무를 이어 붙인다(뷰와 같은 모양).
  const asg = new Map((await assignments()).map((a) => [a.assign_id, a]));
  const dutyRows = useDb ? await readTable("duty_class", "duty_key") : dutyClassRows(true);
  const deptRows = useDb ? await readTable("org_dept", "dept_id") : seed("org_dept");
  const assetRows = useDb ? (await readTable("asset", "asset_id")).filter((a) => a.deleted !== "Y") : assetSeed();
  const taskRows = useDb ? taskRowsForUi(await liveTable("compliance_task")) : seed("compliance_task");
  const duty = new Map(dutyRows.map((d) => [d.duty_key, d]));
  const dept = new Map(deptRows.map((d) => [d.dept_id, d]));
  const asset = new Map(assetRows.map((a) => [a.asset_id, a]));
  let rows: Row[] = taskRows.map((t): Row => {
    const a = asg.get(t.assign_id) || {};
    const c = duty.get(a.duty_key) || {};
    return {
      ...t, ...a,
      dept_name: dept.get(a.dept_id)?.dept_name || "",
      asset_name: asset.get(a.asset_id)?.asset_name || "",
      code36: c.code36, code36_name: c.code36_name, area: c.area,
      impl_type: c.impl_type, impl_type_name: c.impl_type_name,
      target_code: c.target_code, target_name: c.target_name,
      law: c.law, doc: c.doc, unit_label_ko: c.unit_label_ko,
      duty_name: c.duty_name, article_title: c.article_title, evidence_kind: c.evidence_kind,
      badge: c.badge, yongin_mark: c.yongin_mark, duty_key: a.duty_key,
      days_left: Math.round((+new Date(t.due_date) - Date.now()) / 86400000),
    };
  });
  // 시연 중 입력한 값(덮개)을 판 위에 겹친다.
  if (!useDb) {
    const patch = readOverlay().taskPatch;
    rows = rows.map((r) => (patch[r.task_id] ? { ...r, ...patch[r.task_id] } : r));
  }
  if (filter.dept) rows = rows.filter((r) => r.dept_id === filter.dept);
  if (filter.staff) rows = rows.filter((r) => r.owner_staff_id === filter.staff);
  if (filter.status) rows = rows.filter((r) => r.status === filter.status);
  return rows.slice(0, lim);
}

export async function tasks(filter: { dept?: string; staff?: string; status?: string; limit?: number } = {}): Promise<Row[]> {
  return withReadOperation("tasks", filter, () => tasksInner(filter), {
    memo: true,
    work: { normalization: 1, filter: 4, merge: 5 },
  });
}

export async function depts() {
  if (useDb) return readTable("org_dept", "dept_id");
  return seed("org_dept");
}
/** 경영책임자 — 직원 명부 밖이지만 결재·보고받음 기록의 주체다(ROLE_STAFF.ceo). */
const CEO_ROW = { staff_id: "CEO-1", display_name: "경영책임자(시장)", dept_id: "", duty_role: "경영책임자", note: "기록 주체 표시용" };
export async function staff() {
  return withReadOperation("staff", {}, async () => {
    const rows = useDb ? await readTable("staff", "staff_id") : seed("staff");
    return rows.some((r: Row) => r.staff_id === CEO_ROW.staff_id) ? rows : [...rows, CEO_ROW];
  }, { memo: true, work: { filter: 1, merge: 1 } });
}
export async function forms() {
  if (useDb) return readTable("form_template", "form_id");
  return seed("form_template");
}
export async function contracts() {
  if (useDb) return readTable("contract", "contract_id");
  return seed("contract");
}
export async function ceoActivities() {
  // [400] 기관장 예방활동 화면(/ceo)이 쓰는 표(usf_ceo_activity)도 함께 — 경영책임자 보고 요약·보고서·대시보드가 같은 기록을 본다
  const rows = [...(await readTable("usf_ceo_activity", "activity_id")), ...(await readTable("ceo_activity", "activity_id"))];
  return rows.sort((a, b) => (a.activity_date < b.activity_date ? 1 : -1));
}
export async function lawChanges() {
  // 법령 개정 확인(CoCo)이 반영한 개정 현황까지 — 공포일 최신순
  return (await readTable("law_change", "change_id")).sort((a, b) => (String(a.promulgated_at) < String(b.promulgated_at) ? 1 : -1));
}
export async function inspectionBatches() {
  if (useDb) return readTable("inspection_batch", "batch_id");
  return seed("inspection_batch");
}

/** 결재 층(승인 상태·제출일·승인일) — 과제 id 로 붙인다. */
export async function approvalRows() {
  return withReadOperation("approvalRows", {}, async (): Promise<Row[]> => useDb
    ? liveTable("compliance_task")
    : (() => {
        const patch = new Map(seed("task_approval_patch").map((r) => [r.task_id, r]));
        const ov = readOverlay().taskPatch;
        return seed("compliance_task").map((t) => ({ ...t, ...(patch.get(t.task_id) || {}), ...(ov[t.task_id] || {}) }));
      })(), { memo: true, work: { normalization: 1, merge: 1 } });
}

export async function approvals() {
  return withReadOperation("approvals", {}, async () => {
    const rows = await approvalRows();
    // 09-26 사용자: 옛 점검 화면 합치기 2차 — 제출 뒤 과제 판정 전인 과제는 그 항목의 이행점검 판정이 「이행완료」면 승인으로 읽는다(쓰지 않음).
    //   규칙·스위치는 lib/check_merge.ts(applyItemApproval · ITEM_APPROVAL_ON). 순환 참조를 피하려고 부를 때 불러온다.
    const { applyItemApproval } = await import("./check_merge");
    return applyItemApproval(rows);
  }, { memo: true, work: { normalization: 1, merge: 2 } });
}
export async function contractDuties() {
  if (useDb) return readTable("contract_duty", "cduty_id");
  return seed("contract_duty");
}
export async function contractHazards() {
  if (useDb) return fromDb("contract_hazard", "select=*&limit=2000");
  return seed("contract_hazard");
}
export async function budgets() {
  return readTable("safety_budget", "budget_id");
}
export async function trainings() {
  return readTable("training_record", "training_id");
}
export async function voices() {
  // 화면(/system 기록 입력·/budget·/training)에서 넣은 것까지 — 대시보드·보고서·기관장 화면이 같은 숫자를 낸다.
  return readTable("worker_voice", "voice_id");
}
export async function incidents() {
  // 화면(/recurrence)에서 등록·진행한 것까지 겹쳐 읽는다.
  return readTable("incident", "incident_id");
}
export async function orders() {
  return readTable("order_received", "order_id");
}
export async function evidences() {
  return withReadOperation("evidences", {}, async () => {
    if (useDb) return liveTable("evidence");
    return [...readOverlay().evidence, ...seed("evidence")];
  }, { memo: true, work: { merge: 1 } });
}
/** 시연 중 일어난 일(덮개 기록) — 감사로그 자리. */
export async function activityLog() {
  if (useDb) return queryAuditLog();
  return readOverlay().log;
}
export async function inspections() {
  return withReadOperation("inspections", {}, async () => {
    if (useDb) return liveTable("inspection");
    return [...readOverlay().inspection, ...seed("inspection")];
  }, { memo: true, work: { merge: 1 } });
}

/**
 * 같은 조문에 우산 의무가 여러 개 붙어 행이 겹치는 것을 화면에서만 한 줄로 묶는다.
 * (정본 쪽 중복이 아니라 「조문 1 : 의무 n」 구조에서 오는 것이라 데이터는 건드리지 않는다.)
 * 묶인 수는 `dup_n` 으로 남겨 화면이 밝힐 수 있게 한다.
 */
/**
 * [캡처 v2] 의무 한 건의 정체 — 숫자 체계 통일(09-24 사용자 지시 · 비교 문서 2장).
 * 같은 재해 구분 안에서 조항호목·별표 항목·의무명·원문이 같으면 같은 의무로 센다.
 * (예: 수도법 조항이 공중이용시설과 원료·제조물에 한 번씩 → 의무 2 — 09-24 사용자 원칙으로 바뀜, 앞서는 「의무 1 · 배정 2」로 셌다).
 */
// ★ 원칙(09-24 사용자): 같은 조항이 두 재해 구분에 걸리면 **서로 다른 의무**다 — 중대산업재해(종사자)와
//   중대시민재해(시설 이용자)는 법이 구분한다. 그래서 재해 구분(area)을 정체에 넣는다.
export const dutyIdentity = (r: Row) =>
  [r.area || "", r.unit_id || "", r.schedule_id || "", r.obl_id || "", r.duty_name || "", String(r.source_text || "").slice(0, 80)].join("|");
/** 서로 다른 의무 수 */
export const distinctDuties = (rows: Row[]) => new Set(rows.map(dutyIdentity)).size;

/** 목록·계층표 — 같은 의무의 재해 구분별 줄을 하나로 접는다(접힌 재해 구분은 areas 에). */
export function foldByUnit(rows: Row[]): Row[] {
  const m = new Map<string, Row>();
  for (const r of rows) {
    const k = dutyIdentity(r);
    const hit = m.get(k);
    if (hit) {
      hit.dup_n = (hit.dup_n || 1) + 1;
      if (!String(hit.areas || "").includes(r.area)) hit.areas = `${hit.areas}${r.area}`;
    } else m.set(k, { ...r, dup_n: 1, areas: r.area || "" });
  }
  return [...m.values()];
}

export async function actions_() {
  if (useDb) return liveTable("action");
  return seed("action");
}
// 09-25 사용자: 명세 오기 단계 이름을 고쳤다(「예산·편성·집행」→「예산 편성·집행」 · 「관계법령상의무이행」→「관계 법령상 의무이행」).
// 그 전에 저장된 알림 글(message)은 저장 값 그대로 두고, 읽을 때만 새 이름으로 보인다(표시용 변환 · 몫 Y).
const OLD_STEP_TEXT: [RegExp, string][] = [[/예산·편성·집행/g, "예산 편성·집행"], [/관계법령상의무이행/g, "관계 법령상 의무이행"]];
export const fixNotifText = (rows: Row[]): Row[] => rows.map((r) => {
  const m = String(r.message ?? "");
  const f = OLD_STEP_TEXT.reduce((s, [a, b]) => s.replace(a, b), m);
  return f === m ? r : { ...r, message: f };
});
export async function notifications(staffId?: string) {
  // 화면에서 보낸 알림(조치 요구·재점검 요청·교육 이행 지시 등)도 함께 — 받는 사람의 「내 업무」에 떠야 한다.
  let rows = await readTable("notification", "notif_id");
  if (staffId) rows = rows.filter((r) => r.to_staff_id === staffId);
  return fixNotifText([...rows].sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)).slice(0, 300));
}
export async function riskAssessments() {
  if (useDb) return liveTable("risk_assessment");
  return readTable("risk_assessment", "risk_id");
}
export async function riskItems() {
  if (useDb) return liveTable("risk_assessment_item");
  return readTable("risk_assessment_item", "item_id");
}

/** 설명 경로용 — 의무 한 건의 배정(자산이 있으면 그 자산 것을 먼저). */
/**
 * 배정(duty_assignment) — 화면에서 바꾼 담당·해당 여부(덮개의 patches)를 겹친 것. (2026-09-21)
 * 과제 목록도 이것을 쓰므로 담당을 바꾸면 「내 업무」에도 바로 반영된다.
 */
export async function assignments(): Promise<Row[]> {
  return readTable("duty_assignment", "assign_id");
}

/** 한 의무의 배정 전부(자산별로 여러 줄일 수 있다). */
export async function assignmentsFor(dutyKey: string): Promise<Row[]> {
  if (useDb) return fromDb("duty_assignment", `duty_key=eq.${dutyKey}&select=*&limit=200`);
  return (await assignments()).filter((r) => r.duty_key === dutyKey);
}

export async function assignmentFor(dutyKey: string, assetId?: string) {
  const rows = useDb
    ? await fromDb("duty_assignment", `duty_key=eq.${dutyKey}&select=*&limit=50`)
    : (await assignments()).filter((r) => r.duty_key === dutyKey);
  return (assetId && rows.find((r: any) => r.asset_id === assetId)) || rows[0] || null;
}

/** 설명 경로용 — 자산이 그 관리대상에 걸린 근거. */
export async function mappingFor(assetId: string, targetCode: string) {
  const rows = useDb
    ? await fromDb("asset_target_map", `asset_id=eq.${assetId}&select=*`)
    : assetMapSeed().filter((r) => r.asset_id === assetId);
  return rows.find((r: any) => r.target_code === targetCode) || rows[0] || null;
}

/**
 * 공용 읽기 — 표 이름 하나로 「데이터 판 + 덮개」를 겹쳐 읽는다(2026-09-21).
 * 새 화면은 이 함수로 읽는다. 새 표도 최신 ops 판 폴더에 CSV 만 두면 바로 읽힌다.
 * `keyCol` 을 주면 덮개의 수정분(patchRow)을 그 칸 기준으로 덮어쓴다.
 */
export async function readTable(table: string, keyCol?: string): Promise<Row[]> {
  return withReadOperation(`readTable:${table}`, { keyCol: keyCol || "" }, async () => {
    if (useDb) return applyReadOrder(table, await fromDb(table, "select=*&limit=100000"), keyCol ? "live" : "raw");
    const o: any = readOverlay();
    const added: Row[] = (o.tables && o.tables[table]) || [];
    const patches: Record<string, Row> = (o.patches && o.patches[table]) || {};
    let rows = [...added, ...seed(table)];
    if (keyCol && Object.keys(patches).length) {
      rows = rows.map((r) => (patches[r[keyCol]] ? { ...r, ...patches[r[keyCol]] } : r));
    }
    return rows;
  }, { memo: true, work: { normalization: 1, merge: 1 } });
}

/** 원천 표시 — 화면 하단에 PostgreSQL인지 예시 자료 파일(CSV)인지 밝힌다. 화면 말에 「판」을 쓰지 않는다. */
export function source(): string {
  if (useDb) return "PostgreSQL · adoms2 스키마(READ)";
  const dirs = opsDirs();
  return dirs.length ? `예시 자료 파일(CSV) · ${path.basename(path.dirname(dirs[0])).replace(/^ops_/, "")}` : `데이터 원천 없음 (${dataBackend()})`;
}
