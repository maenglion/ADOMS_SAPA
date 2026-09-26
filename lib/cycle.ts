/**
 * 점검 한 바퀴의 셈 — ③ 점검 계획 · ⑤ 점검 판정 · ⑥ 조치·재점검 · ⑦ 회차 결재가 **같은 숫자**를 보게 하는 한 곳. (2026-09-21)
 *
 * 화면마다 대상 산정을 따로 쓰면 같은 점검의 숫자가 화면마다 달라진다. 그래서 여기 한 곳에서만 센다.
 *
 * 점검 대상 = 점검이 정한 **의무조항(code36_list) × 부서(target_dept_ids) × 연도·반기**에 드는 과제.
 *
 * 과제 하나는 아래 네 칸 중 **정확히 한 칸**에 든다(네 칸의 합 = 대상).
 *   적합       — 마지막 판정이 적합
 *   조치 중    — 마지막 판정이 보완필요·부적합이고 아직 보완 제출 전
 *   판정 대기  — 부서가 제출했고 아직 판정 전(보완 제출해 다시 올라온 것은 「재점검」)
 *   미제출     — 아직 제출하지 않음
 *
 * 차수: 한 과제가 판정을 받은 횟수. 판정할 때 `inspection.round_no` 로 남기고,
 * 남긴 값이 없는 옛 기록은 날짜 순서로 센다.
 */
import "server-only";
import {
  tasks, approvals, inspections, readTable, depts, staff, evidences, type Row,
} from "./data";
import { readOverlay } from "./write";
import { idKo } from "./labels";
import { SECURE_AXES, secureAxisOf } from "./axes";
import { ymd } from "@/lib/day";

export type CycleState = "적합" | "조치중" | "판정대기" | "미제출";
export const FLAGGED = (r?: string) => r === "보완필요" || r === "부적합";

export type ActionState = "요구 전" | "요구" | "조치중" | "조치 완료" | "보완 제출" | "완료";

/** 점검(회차) 목록 — 화면에서 새로 만든 것과 상태 변경까지 겹쳐 읽는다. */
export async function batchList(): Promise<Row[]> {
  const rows = await readTable("inspection_batch", "batch_id");
  const seen = new Set<string>();
  return rows
    .filter((b) => (seen.has(b.batch_id) ? false : (seen.add(b.batch_id), true)))
    .sort((a, b) => (a.batch_id < b.batch_id ? -1 : 1));
}

/** 점검 번호가 없으면 진행 중인 것 가운데 가장 최근 것, 그것도 없으면 마지막 것. */
export function pickBatch(batches: Row[], id?: string): Row | undefined {
  return batches.find((b) => b.batch_id === id)
    || [...batches].reverse().find((b) => b.status === "진행중")
    || batches[batches.length - 1];
}

export const splitList = (s?: string) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

/** 다음 점검 번호 — BAT-003 다음은 BAT-004. */
export function nextBatchId(batches: Row[]): string {
  const n = batches.reduce((m, b) => Math.max(m, Number(String(b.batch_id).replace(/\D/g, "")) || 0), 0);
  return `BAT-${String(n + 1).padStart(3, "0")}`;
}

/** 모든 과제(결재 층까지 붙인 것). */
export async function allTasks(): Promise<Row[]> {
  const all = await tasks({ limit: 5000 });
  const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
  return all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }));
}

/** 과제가 이 점검의 대상인가 — 대상 산정은 여기 하나뿐이다. */
export function inScope(b: Row | undefined, t: Row): boolean {
  if (!b) return false;
  // 담당 부서가 비해당으로 확인한 배정은 점검 대상이 아니다(의무 상세 「담당 · 해당 여부」, 사유 필수).
  if (t.applicability === "비해당") return false;
  const codes = splitList(b.code36_list);
  const ds = splitList(b.target_dept_ids);
  const first = String(t.code36 || "").split(";")[0].trim();
  if (codes.length && !codes.includes(first) && !codes.includes(t.code36)) return false;
  if (ds.length && !ds.includes(t.dept_id)) return false;
  if (b.half_year && t.half_year && t.half_year !== b.half_year) return false;
  if (b.period_year && t.period_year && String(t.period_year) !== String(b.period_year)) return false;
  return true;
}

/** 판정 기록 — 과제별로 최신이 앞. 차수(round_no)를 채운다. */
export async function inspectionsByTask(): Promise<Map<string, Row[]>> {
  const patches: Record<string, Row> = (readOverlay() as any).patches?.inspection || {};
  const rows = (await inspections()).map((x: any) => ({ ...x, ...(patches[x.insp_id] || {}) }));
  const m = new Map<string, Row[]>();
  // inspections() 는 화면에서 찍은 것(최신이 앞) → 원래 기록 순으로 온다. 그 순서를 지킨다.
  rows.forEach((x) => m.set(x.task_id, [...(m.get(x.task_id) || []), x]));
  for (const [, list] of m) {
    const n = list.length;
    list.forEach((x, i) => { if (!x.round_no) x.round_no = n - i; });
  }
  return m;
}

/** 조치 기록 — 판정 번호(insp_id)로 찾는다. 화면에서 만든 것과 상태 변경까지 겹친다. */
export async function actionsByInsp(): Promise<Map<string, Row>> {
  const m = new Map<string, Row>();
  (await readTable("action", "action_id")).forEach((a) => { if (!m.has(a.insp_id)) m.set(a.insp_id, a); });
  return m;
}

export type CycleRow = Row & {
  state: CycleState;
  last?: Row;            // 마지막 판정
  history: Row[];        // 판정 기록(최신이 앞)
  recheck: boolean;      // 보완 제출해 다시 올라온 것
  nextRound: number;     // 다음 판정이 몇 차인가
  action?: Row;          // 마지막 판정에 붙은 조치
  actionState?: ActionState;
};

export function stateOf(t: Row, hist: Row[]): CycleState {
  const last = hist[0];
  if (t.approval_status === "제출") return "판정대기";
  if (last || t.approval_status === "승인" || t.approval_status === "반려") {
    const r = last?.result || (t.approval_status === "승인" ? "적합" : "보완필요");
    return FLAGGED(r) ? "조치중" : "적합";
  }
  if (t.status === "이행완료") return "판정대기";
  return "미제출";
}

export function actionStateOf(t: Row, last: Row | undefined, a: Row | undefined, state: CycleState): ActionState | undefined {
  if (!last || !FLAGGED(last.result)) return undefined;
  if (state === "판정대기") return "보완 제출";
  if (state === "적합") return "완료";
  if (!a) return "요구 전";
  const r = String(a.result || "");
  if (r === "요구") return "요구";
  if (r === "완료") return "조치 완료";   // 조치는 끝냈다고 적혀 있으나 과제를 다시 올리지 않은 것
  return "조치중";                         // 「진행 중」·「조치중」
}

export type Cycle = {
  batches: Row[];
  batch?: Row;
  codes: string[];
  deptIds: string[];
  rows: CycleRow[];                 // 대상 전부
  count: {
    total: number; 적합: number; 보완필요: number; 부적합: number;
    조치중: number; 판정대기: number; 재점검: number; 미제출: number; 판정끝남: number;
  };
  canSubmit: boolean;               // 결재 상신 가능(판정 대기 0)
  /** 근거 주기 한 줄(점검에 적힌 rule_basis, 없으면 코드로 산정) — 09-21 추가 */
  ruleBasis: string;
  /** 대상 의무조항을 주기별로 — 반기 · 연 1회 · 법정 주기 없음 */
  byCycle: Record<CycleKind, string[]>;
};

/** 한 점검의 한 바퀴 — ③⑤⑥⑦ 이 모두 이것을 부른다. */
export async function loadCycle(batchId?: string): Promise<Cycle> {
  const batches = await batchList();
  const batch = pickBatch(batches, batchId);
  const [all, hist, acts] = await Promise.all([allTasks(), inspectionsByTask(), actionsByInsp()]);
  return cycleOf(batches, batch, all, hist, acts);
}

/** 여러 점검을 한 번에 셀 때(③ 카드) — 과제·판정은 한 번만 읽는다. */
export async function loadAllCycles(): Promise<Cycle[]> {
  const batches = await batchList();
  const [all, hist, acts] = await Promise.all([allTasks(), inspectionsByTask(), actionsByInsp()]);
  return batches.map((b) => cycleOf(batches, b, all, hist, acts));
}

function cycleOf(batches: Row[], batch: Row | undefined, all: Row[], hist: Map<string, Row[]>, acts: Map<string, Row>): Cycle {
  const rows: CycleRow[] = all.filter((t) => inScope(batch, t)).map((t) => {
    const h = hist.get(t.task_id) || [];
    const state = stateOf(t, h);
    const last = h[0];
    const action = last ? acts.get(last.insp_id) : undefined;
    return {
      ...t, state, last, history: h, action,
      recheck: state === "판정대기" && h.length > 0,
      nextRound: h.length + 1,
      actionState: actionStateOf(t, last, action, state),
    };
  });
  const res = (r: string) => rows.filter((x) => x.state !== "판정대기" && x.state !== "미제출"
    && (x.last?.result || (x.state === "적합" ? "적합" : "보완필요")) === r).length;
  const count = {
    total: rows.length,
    적합: rows.filter((x) => x.state === "적합").length,
    보완필요: res("보완필요"),
    부적합: res("부적합"),
    조치중: rows.filter((x) => x.state === "조치중").length,
    판정대기: rows.filter((x) => x.state === "판정대기").length,
    재점검: rows.filter((x) => x.recheck).length,
    미제출: rows.filter((x) => x.state === "미제출").length,
    판정끝남: 0,
  };
  count.판정끝남 = count.적합 + count.조치중;
  return {
    batches, batch, rows, count,
    codes: splitList(batch?.code36_list),
    deptIds: splitList(batch?.target_dept_ids),
    canSubmit: count.판정대기 === 0 && count.total > 0,
    ruleBasis: ruleBasisOfBatch(batch),
    byCycle: codesByCycle(splitList(batch?.code36_list)),
  };
}

/** ③ 회차 만들기 — 고른 범위의 대상 과제 수를 미리 센다(점검을 만들기 전). */
export async function previewScope(v: { year: string; half: string; codes: string[]; deptIds: string[] }) {
  const b = { period_year: v.year, half_year: v.half, code36_list: v.codes.join(","), target_dept_ids: v.deptIds.join(",") };
  const all = await allTasks();
  const hit = all.filter((t) => inScope(b, t));
  return {
    total: hit.length,
    byDept: v.deptIds.map((d) => ({ id: d, n: hit.filter((t) => t.dept_id === d).length })),
  };
}

/** 의무조항 36 — 확보의무 대분류별로 묶는다. 이름은 과제 자료에서 읽는다. */
export async function codeCatalog(): Promise<{ axis: string; codes: { code: string; name: string; n: number }[] }[]> {
  const all = await allTasks();
  const m = new Map<string, { name: string; n: number }>();
  all.forEach((t) => {
    const c = String(t.code36 || "").split(";")[0].trim();
    if (!c) return;
    const hit = m.get(c) || { name: t.code36_name || "", n: 0 };
    hit.n++;
    if (!hit.name && t.code36_name) hit.name = t.code36_name;
    m.set(c, hit);
  });
  return SECURE_AXES.map((axis) => ({
    axis,
    codes: [...m.entries()]
      .filter(([c]) => secureAxisOf(c) === axis)
      .map(([code, v]) => ({ code, name: v.name, n: v.n }))
      .sort((a, b) => (a.code < b.code ? -1 : 1)),
  }));
}

/** 이름표 — 부서·직원·증빙. */
export async function lookups() {
  const [ds, ss, evs] = await Promise.all([depts(), staff(), evidences()]);
  const evByTask = new Map<string, Row[]>();
  evs.forEach((e: any) => evByTask.set(e.task_id, [...(evByTask.get(e.task_id) || []), e]));
  return {
    deptList: ds,
    deptName: new Map<string, string>(ds.map((d: any) => [d.dept_id, d.dept_name])),
    staffName: new Map<string, string>(ss.map((s: any) => [s.staff_id, s.display_name])),
    evByTask,
  };
}

/* ── 점검 주기 규칙 (2026-09-21) ────────────────────────────────────────
 * 의무조항 코드 → 법정 점검 주기. **이 표 하나만 쓴다**(③ 회차 만들기 · 카드 · ⑦ 결재 · 연간 일정).
 * 근거는 중대재해처벌법 시행령(DOC-000005) 원문을 법령DB 에서 읽어 확인했다(2026-09-21):
 *   제4조제3호·제5호나목·제7호·제8호·제9호  반기 1회 이상 점검(평가)          — 중대산업재해 체계
 *   제5조제2항제1호·제3호                   관계법령 의무이행·교육 반기 1회 이상 점검 — 중대산업재해
 *   제8조제5호                              제1호·제2호(인력·예산) 반기 1회 이상 점검 — 원료·제조물
 *   제9조제2항제1호·제3호                   관계법령 의무이행·교육 반기 1회 이상 점검 — 원료·제조물
 *   제10조제5호                             제1호부터 제4호까지 반기 1회 이상 점검 — 공중이용시설·교통수단
 *   제10조제8호                             도급·용역·위탁 기준·절차 이행 연 1회 이상 점검
 *   제11조제2항제1호·제3호                  관계법령 의무이행·교육 **연 1회** 이상 점검 — 공중이용시설·교통수단
 * 위 조문에 주기가 적혀 있지 않은 코드는 「상시」(법정 점검 주기 없음)로 두고 **넘겨짚지 않는다**.
 * (제10조제4호 안전계획은 「연 1회 이상 수립」이고 그 점검은 제10조제5호의 반기 1회다.)
 */
export type CycleKind = "반기" | "연" | "상시";
export type CodeCycle = { cycle: CycleKind; article: string; basis: string };

export const CYCLE_LABEL: Record<CycleKind, string> = { 반기: "반기 1회", 연: "연 1회", 상시: "법정 주기 없음" };

const 반 = (article: string, basis: string): CodeCycle => ({ cycle: "반기", article, basis });
const 연 = (article: string, basis: string): CodeCycle => ({ cycle: "연", article, basis });
const 상 = (basis: string): CodeCycle => ({ cycle: "상시", article: "", basis });

export const CODE_CYCLE: Record<string, CodeCycle> = {
  I01: 상("시행령 제4조제1호 — 점검 주기 규정 없음"),
  I02: 상("시행령 제4조제2호 — 점검 주기 규정 없음"),
  I03: 반("시행령 제4조", "시행령 제4조제3호 — 유해·위험요인 확인·개선 반기 1회 이상 점검"),
  I04: 상("시행령 제4조제4호 — 점검 주기 규정 없음"),
  I05: 반("시행령 제4조", "시행령 제4조제5호나목 — 안전보건관리책임자등 반기 1회 이상 평가"),
  I06: 상("시행령 제4조제6호 — 점검 주기 규정 없음"),
  I07: 반("시행령 제4조", "시행령 제4조제7호 — 종사자 의견 개선방안 이행 반기 1회 이상 점검"),
  I08: 반("시행령 제4조", "시행령 제4조제8호 — 매뉴얼대로 조치하는지 반기 1회 이상 점검"),
  I09: 반("시행령 제4조", "시행령 제4조제9호 — 도급·용역·위탁 기준·절차 반기 1회 이상 점검"),
  I10: 상("법 제4조제1항제2호 — 재해 발생 시"),
  I11: 상("법 제4조제1항제3호 — 명령을 받은 때"),
  I12: 반("시행령 제5조", "시행령 제5조제2항제1호 — 관계법령 의무이행 반기 1회 이상 점검"),
  I13: 반("시행령 제5조", "시행령 제5조제2항제3호 — 유해·위험작업 교육 실시 반기 1회 이상 점검"),
  I14: 상("법 제5조 — 점검 주기 규정 없음"),
  F01: 반("시행령 제10조", "시행령 제10조제5호 — 제1호(인력) 반기 1회 이상 점검"),
  F02: 반("시행령 제10조", "시행령 제10조제5호 — 제2호(예산) 반기 1회 이상 점검"),
  F03: 반("시행령 제10조", "시행령 제10조제5호 — 제3호(안전점검 계획·수행) 반기 1회 이상 점검"),
  F04: 반("시행령 제10조", "시행령 제10조제5호 — 제4호(안전계획, 수립은 연 1회) 반기 1회 이상 점검"),
  F05: 반("시행령 제10조", "시행령 제10조제5호 — 제1호부터 제4호까지 반기 1회 이상 점검"),
  F06: 상("시행령 제10조제6호 — 제5호 점검 결과에 따른 조치"),
  F07: 상("시행령 제10조제7호 — 점검 주기 규정 없음"),
  F08: 연("시행령 제10조", "시행령 제10조제8호 — 도급·용역·위탁 기준·절차 이행 연 1회 이상 점검"),
  F09: 상("법 제9조제2항제2호 — 재해 발생 시"),
  F10: 상("법 제9조제2항제3호 — 명령을 받은 때"),
  F11: 연("시행령 제11조", "시행령 제11조제2항제1호 — 관계법령 의무이행 연 1회 이상 점검"),
  F12: 연("시행령 제11조", "시행령 제11조제2항제3호 — 관계법령 교육 이수 연 1회 이상 점검"),
  F13: 상("법 제9조제3항 — 점검 주기 규정 없음"),
  M01: 반("시행령 제8조", "시행령 제8조제5호 — 제1호(인력) 반기 1회 이상 점검"),
  M02: 반("시행령 제8조", "시행령 제8조제5호 — 제2호(예산) 반기 1회 이상 점검"),
  M03: 상("시행령 제8조제3호 — 점검 주기 규정 없음"),
  M04: 상("시행령 제8조제4호 — 점검 주기 규정 없음"),
  M05: 반("시행령 제8조", "시행령 제8조제5호 — 점검 결과에 따른 조치, 점검은 반기 1회 이상"),
  M06: 상("법 제9조제1항제2호 — 재해 발생 시"),
  M07: 상("법 제9조제1항제3호 — 명령을 받은 때"),
  M08: 반("시행령 제9조", "시행령 제9조제2항제1호 — 관계법령 의무이행 반기 1회 이상 점검"),
  M09: 반("시행령 제9조", "시행령 제9조제2항제3호 — 관계법령 교육 실시 반기 1회 이상 점검"),
};

const firstCode = (c?: string) => String(c || "").split(";")[0].trim();

/** 의무조항 코드 → 주기. 모르는 코드는 「상시」(넘겨짚지 않음). */
export function codeCycle(code?: string): CodeCycle {
  return CODE_CYCLE[firstCode(code)] || 상("주기 표에 없는 코드");
}

/** 코드 목록을 주기별로 나눈다. */
export function codesByCycle(codes: string[]): Record<CycleKind, string[]> {
  const o: Record<CycleKind, string[]> = { 반기: [], 연: [], 상시: [] };
  [...new Set(codes.map(firstCode))].filter(Boolean).sort().forEach((c) => o[codeCycle(c).cycle].push(c));
  return o;
}

/** 점검의 근거 주기 한 줄 — 예: 「시행령 제5조 반기 · 시행령 제10조 반기 · 시행령 제11조 연 1회」. */
export function ruleBasisOf(codes: string[]): string {
  const parts: string[] = [];
  const g = codesByCycle(codes);
  (["반기", "연"] as CycleKind[]).forEach((k) => {
    [...new Set(g[k].map((c) => codeCycle(c).article))].sort((a, b) => artNo(a) - artNo(b))
      .forEach((a) => parts.push(`${a} ${k === "반기" ? "반기" : "연 1회"}`));
  });
  if (g.상시.length) parts.push(`법정 주기 없음 ${g.상시.length}개`);
  return parts.join(" · ");
}
const artNo = (a: string) => Number((a.match(/제(\d+)조/) || [])[1] || 0);

/** 반기 끝날 — 상반기 6.30. · 하반기 12.31. */
export const halfEnd = (year: string | number, half: string) => `${year}-${half === "상반기" ? "06-30" : "12-31"}`;

export type RuleCheck = {
  code: string;
  cycle: CycleKind;
  basis: string;
  period: string;          // 「2026년」 또는 「2026년 상반기」
  due: string;             // 기한(YYYY-MM-DD)
  approved: Row[];         // 그 기간에 이 코드를 넣고 결재완료된 점검
  open: Row[];             // 그 기간에 이 코드를 넣었으나 아직 결재 전인 점검
  state: "충족" | "진행 중" | "없음";
  tone: "ok" | "warn" | "bad" | "none";
  message: string;
};

const todayStr = (d = new Date()) => ymd(d);
const daysTo = (due: string, today: Date) => Math.round((+new Date(`${due}T00:00:00`) - +new Date(`${todayStr(today)}T00:00:00`)) / 86400000);

function judgeRule(code: string, period: string, due: string, inPeriod: Row[], today: Date): RuleCheck {
  const cc = codeCycle(code);
  const has = inPeriod.filter((b) => splitList(b.code36_list).includes(code));
  const approved = has.filter((b) => b.status === "결재완료");
  const open = has.filter((b) => b.status !== "결재완료");
  const left = daysTo(due, today);
  const state: RuleCheck["state"] = approved.length ? "충족" : open.length ? "진행 중" : "없음";
  let tone: RuleCheck["tone"] = "none";
  let message = "";
  if (state === "충족") { tone = "ok"; message = `결재완료 — ${approved.map((b) => idKo(b.batch_id)).join("·")}`; }
  else if (left < 0) { tone = "bad"; message = `기한(${due}) 지남 — 결재된 점검 없음`; }
  else if (left <= 31) {   // 연 1회는 12월, 반기는 6월·12월에 들어서면 경고
    tone = "bad"; message = `기한까지 ${left}일 — 결재된 점검 없음${open.length ? ` (진행 중 ${open.map((b) => idKo(b.batch_id)).join("·")})` : ""}`;
  } else if (left <= 92) {
    tone = "warn"; message = `기한까지 ${left}일${open.length ? ` — 진행 중 ${open.map((b) => idKo(b.batch_id)).join("·")}` : " — 아직 점검을 열지 않음"}`;
  } else {
    message = open.length ? `진행 중 ${open.map((b) => idKo(b.batch_id)).join("·")}` : "아직 기한 전";
  }
  return { code, cycle: cc.cycle, basis: cc.basis, period, due, approved, open, state, tone, message };
}

/**
 * 연 1회 항목 — 「그 해 안에 이 코드를 넣고 **결재완료**된 점검이 하나 이상 있는가」로 **따로** 센다.
 * 반기 점검에 F11·F12 가 들어 있어도, 반기마다 요건이 채워지는 것이 아니라 그 해에 한 번 채워진다.
 * 그래서 같은 해 두 번째 점검에 든 F11·F12 는 연 1회 요건에 다시 세지 않는다(카드에 그렇게 적는다).
 * 12월(또는 기한 31일 안)까지 결재된 점검이 없으면 경고(bad).
 */
export function annualChecks(batches: Row[], year: string | number, codes?: string[], today = new Date()): RuleCheck[] {
  const y = String(year);
  const list = codes ?? Object.keys(CODE_CYCLE).filter((c) => CODE_CYCLE[c].cycle === "연");
  const inYear = batches.filter((b) => String(b.period_year) === y);
  return list.filter((c) => codeCycle(c).cycle === "연").map((c) => judgeRule(c, `${y}년`, `${y}-12-31`, inYear, today));
}

/** 반기 항목 — 그 반기 안에 이 코드를 넣고 결재완료된 점검이 있는가. 기한은 반기 끝날. */
export function halfChecks(batches: Row[], year: string | number, half: string, codes?: string[], today = new Date()): RuleCheck[] {
  const y = String(year);
  const list = codes ?? Object.keys(CODE_CYCLE).filter((c) => CODE_CYCLE[c].cycle === "반기");
  const inHalf = batches.filter((b) => String(b.period_year) === y && b.half_year === half);
  return list.filter((c) => codeCycle(c).cycle === "반기").map((c) => judgeRule(c, `${y}년 ${half}`, halfEnd(y, half), inHalf, today));
}

/**
 * 점검 하나가 연 1회 요건에 어떻게 세이는가 — 카드·결재 화면 표시용.
 *   이 점검으로 채움 · 올해 이미 다른 점검으로 채움(다시 세지 않음) · 이 점검이 결재되면 채워짐
 */
export function annualRoleOf(b: Row, batches: Row[]): { code: string; text: string; tone: "ok" | "warn" | "none" }[] {
  const annual = codesByCycle(splitList(b.code36_list)).연;
  const sameYear = batches.filter((x) => String(x.period_year) === String(b.period_year) && x.status === "결재완료");
  return annual.map((code) => {
    const done = sameYear.filter((x) => splitList(x.code36_list).includes(code)).sort((p, q) =>
      String(p.approved_at || p.started_at || p.batch_id) < String(q.approved_at || q.started_at || q.batch_id) ? -1 : 1);
    const y = `${b.period_year}년`;
    if (!done.length) return { code, text: `이 점검이 결재되면 ${y} 연 1회 요건이 채워짐`, tone: "warn" as const };
    if (done[0].batch_id === b.batch_id) return { code, text: `이 점검으로 ${y} 연 1회 요건 채움`, tone: "ok" as const };
    return { code, text: `${y}에 이미 ${idKo(done[0].batch_id)}로 채움 — 이 점검은 연 1회 요건에 다시 세지 않음`, tone: "none" as const };
  });
}

/** 점검에 적힌 근거 주기(없으면 코드로 산정). 옛 점검에는 rule_basis 칸이 없다. */
export const ruleBasisOfBatch = (b?: Row) => (b ? String(b.rule_basis || "") || ruleBasisOf(splitList(b.code36_list)) : "");

/** 오늘 날짜(YYYY-MM-DD)에 날수를 더한다. */
export function addDays(n: number, from = new Date()): string {
  const d = new Date(from.getTime() + n * 86400000);
  return ymd(d);
}
