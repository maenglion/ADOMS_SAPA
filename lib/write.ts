/**
 * 쓰기 공통 경로 — 화면은 표를 직접 고치지 않는다(메모리 adoms-ui-data-access-rule).
 *
 * 두 가지 원천을 같은 모양으로 다룬다.
 *   ① Supabase 가 붙어 있으면 → 그 표에 INSERT/PATCH (뒤에 RPC 로 바꿀 자리)
 *   ② 없으면(기본) → **덮개 파일** `.data/overlay.json` 에 쌓는다.
 *
 * ★ 덮개인 이유: 데모 DB 판 폴더(`ops_v0.1_…`)의 seed CSV 는 **발행된 판**이라 덮어쓰지 않는다
 *   (메모리 adoms-canon-versioning-protocol · 판 덮어쓰기 금지). 시연 중 입력한 값은 덮개에만 쌓이고,
 *   화면은 「판 + 덮개」를 겹쳐 읽는다. 덮개를 지우면 처음 상태로 돌아온다.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ymd } from "@/lib/day";

export type Row = Record<string, any>;

const OVERLAY = path.join(process.cwd(), ".data", "overlay.json");

export type Overlay = {
  taskPatch: Record<string, Row>;
  evidence: Row[];
  inspection: Row[];
  log: Row[];
  /** 그 밖의 표 — 화면이 새로 생기면 여기에 표 이름으로 쌓는다(`appendRow`). */
  tables?: Record<string, Row[]>;
  /** 표 이름 → { 기본키값 → 바뀐 칸 } (`patchRow`). */
  patches?: Record<string, Record<string, Row>>;
};
const EMPTY: Overlay = { taskPatch: {}, evidence: [], inspection: [], log: [] };

/**
 * [400] 읽기 실패를 「빈 덮개」로 보지 않는다(09-24).
 * 전에는 파일이 잠깐 잠기거나(윈도 EBUSY) 쓰는 도중이면 빈 덮개를 돌려주고, 그 위에 한 줄만 저장해 **쌓인 기록이 통째로 사라질 수 있었다.**
 * 이제 파일이 없을 때(ENOENT)만 빈 덮개, 그 밖의 실패는 잠깐 쉬었다 다시 읽고 끝내 안 되면 오류를 낸다(저장을 막는다).
 */
function sleepSync(ms: number) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
export function readOverlay(): Overlay {
  for (let i = 0; i < 8; i++) {
    try {
      return { ...EMPTY, ...JSON.parse(fs.readFileSync(OVERLAY, "utf8")) };
    } catch (e: any) {
      if (e && e.code === "ENOENT") return { ...EMPTY };
      sleepSync(60);
    }
  }
  throw new Error("덮개 파일을 읽지 못했다 — 저장하지 않는다(기록 보호)");
}

/** 임시 파일에 쓰고 이름을 바꾼다 — 쓰는 도중에 다른 요청이 반쯤 쓴 파일을 읽지 않게. 직전 판은 overlay.bak.json 으로 남긴다. */
function saveOverlay(o: Overlay) {
  fs.mkdirSync(path.dirname(OVERLAY), { recursive: true });
  const tmp = OVERLAY + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(o, null, 2), "utf8");
  try { if (fs.existsSync(OVERLAY)) fs.copyFileSync(OVERLAY, OVERLAY.replace(/\.json$/, ".bak.json")); } catch {}
  for (let i = 0; i < 8; i++) {
    try { fs.renameSync(tmp, OVERLAY); return; } catch { sleepSync(60); }
  }
  fs.copyFileSync(tmp, OVERLAY); try { fs.unlinkSync(tmp); } catch {}
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_ = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const useDb = Boolean(URL_ && KEY_);

async function db(table: string, method: "POST" | "PATCH", body: any, qs = "") {
  const r = await fetch(`${URL_}/rest/v1/${table}${qs ? `?${qs}` : ""}`, {
    method,
    headers: {
      apikey: KEY_, Authorization: `Bearer ${KEY_}`,
      "Content-Profile": "adoms2", "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${table} ${method}: ${r.status} ${await r.text()}`);
  return r.json();
}

/** 한 줄 기록 — 누가 언제 무엇을 했는지(감사로그 자리). */
function log(o: Overlay, action: string, target: string, by: string, note = "") {
  o.log.unshift({ at: new Date().toISOString(), action, target, by, note });
  o.log = o.log.slice(0, 300);
}

/* ── 화면이 부르는 것 ─────────────────────────────────────────── */

/** 증빙 등록. 파일을 실제로 올렸으면 `file_url`·`file_size`·`file_type` 이 함께 들어온다. */
export async function addEvidence(v: {
  task_id: string; evidence_kind: string; file_name: string; form_id?: string; note?: string; by: string;
  file_url?: string; file_size?: number; file_type?: string;
}) {
  const row: Row = {
    evidence_id: `EVD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    task_id: v.task_id, evidence_kind: v.evidence_kind, file_name: v.file_name,
    file_url: v.file_url || "", form_id: v.form_id || "", uploaded_by: v.by,
    uploaded_at: ymd(), note: v.note || "",
    file_size: v.file_size || "", file_type: v.file_type || "",
  };
  if (useDb) { await db("evidence", "POST", row); return row; }
  const o = readOverlay();
  o.evidence.unshift(row);
  log(o, "증빙 등록", v.task_id, v.by, v.file_name);
  saveOverlay(o);
  return row;
}

/** 이행 상태·결재 상태 바꾸기. 두 축을 한 곳에서만 만진다. */
export async function patchTask(task_id: string, patch: Row, by: string, action: string) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const full: Row = { ...patch };
  // 다시 제출하면 부서장 확인을 새로 받는다(결재선: 실무자 → 부서장 → 총괄 → 경영책임자)
  if (patch.approval_status === "제출") { full.submitted_at = now; full.submitted_by = by; full.head_ok_at = ""; full.head_ok_by = ""; }
  if (patch.approval_status === "승인") { full.approved_at = now; full.approved_by = by; full.status = patch.status || "점검완료"; }
  if (patch.approval_status === "반려") { full.rejected_at = now; }
  if (patch.status === "이행완료" && !full.done_at) { full.done_at = today; full.done_by = by; }

  if (useDb) { await db("compliance_task", "PATCH", full, `task_id=eq.${task_id}`); return full; }
  const o = readOverlay();
  o.taskPatch[task_id] = { ...(o.taskPatch[task_id] || {}), ...full };
  log(o, action, task_id, by, patch.reject_reason || patch.status || patch.approval_status || "");
  saveOverlay(o);
  return full;
}


/**
 * 점검 판정 — 총괄이 부서 제출분을 보고 **적합 · 보완필요 · 부적합** 중 하나를 찍는다.
 * 판정 한 번에 세 가지가 같이 움직인다: 점검 기록이 생기고, 과제의 점검 결과와 결재 상태가 바뀐다.
 *   적합     → 점검완료 · 승인
 *   보완필요 → 조치필요 · 반려(사유는 점검 의견)
 *   부적합   → 조치필요 · 반려
 */
export async function judge(v: {
  task_id: string; result: "적합" | "보완필요" | "부적합"; finding?: string; by: string;
}) {
  const today = ymd();
  const row: Row = {
    insp_id: `INS-${Date.now().toString(36).toUpperCase()}`,
    task_id: v.task_id, inspector_staff_id: v.by, insp_date: today,
    result: v.result, finding: v.finding || "", note: "화면에서 판정",
  };
  if (useDb) await db("inspection", "POST", row);
  else {
    const o = readOverlay();
    o.inspection.unshift(row);
    log(o, `점검 판정 — ${v.result}`, v.task_id, v.by, v.finding || "");
    saveOverlay(o);
  }

  const ok = v.result === "적합";
  await patchTask(
    v.task_id,
    ok ? { status: "점검완료", approval_status: "승인", check_result: "이행완료" }
       : { status: "조치필요", approval_status: "반려",
           check_result: v.result === "보완필요" ? "보완필요" : "미이행",
           reject_reason: v.finding || v.result },
    v.by,
    `점검 판정 ${v.result}`,
  );
  return row;
}


/* ── 공용 쓰기 — 새 화면이 쓰는 길 (2026-09-21) ────────────────────
 * 화면마다 쓰기 함수를 따로 만들면 덮개 구조가 갈라진다(T10).
 * 어떤 표든 이 두 함수로만 쓴다. Supabase 가 붙으면 같은 이름의 표에 바로 쓴다. */

/** 표에 행 하나를 더한다. */
export async function appendRow(table: string, row: Row, by: string, action = "등록") {
  if (useDb) { await db(table, "POST", row); return row; }
  const o = readOverlay();
  o.tables = o.tables || {};
  o.tables[table] = [row, ...(o.tables[table] || [])];
  log(o, action, `${table}:${Object.values(row)[0] ?? ""}`, by, "");
  saveOverlay(o);
  return row;
}

/** 표의 한 행을 고친다(기본키 칸 이름과 값으로 찾는다). */
export async function patchRow(table: string, keyCol: string, keyVal: string, patch: Row, by: string, action = "수정") {
  if (useDb) { await db(table, "PATCH", patch, `${keyCol}=eq.${encodeURIComponent(keyVal)}`); return patch; }
  const o = readOverlay();
  o.patches = o.patches || {};
  o.patches[table] = o.patches[table] || {};
  o.patches[table][keyVal] = { ...(o.patches[table][keyVal] || {}), ...patch };
  log(o, action, `${table}:${keyVal}`, by, "");
  saveOverlay(o);
  return patch;
}

/** 시연 초기화 — 덮개만 비운다(판은 그대로). */
export async function resetOverlay(by: string) {
  if (useDb) throw new Error("Supabase 모드에서는 덮개 초기화를 쓰지 않는다");
  saveOverlay({ ...EMPTY, log: [{ at: new Date().toISOString(), action: "덮개 초기화", target: "-", by, note: "" }] });
}
