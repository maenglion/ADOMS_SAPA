/**
 * 법령 개정 확인(체크리스트 생성 작업 · CoCo) ↔ 앱 연결 — 2026-09-24.
 *
 * 파이썬 쪽(데이터 폴더 `_agent\coco.py`)이 매일 관계법령을 법제처에서 확인하고, 결과를 `law_sync\runs\RUN-…\` 에 쓴다.
 *   status.json  단계별 진행(① 개정 감시 ② 원문 대조 ③ 의무 판단 ④ 관리대상 연결 ⑤ 결과 정리)
 *   log.jsonl    작업 기록(관리 화면이 읽는다)
 *   items.csv    바뀐 조항호목 하나하나 — 갈래(갱신·신규 후보·분리 후보·병합 후보·폐지 후보·참고 …)
 *   law_change.csv  법령 개정 현황 한 줄씩
 * 앱은 그 결과를 **공용 쓰기 경로(appendRow·patchRow)로만** 우리 기관 표에 반영한다(쓰는 곳 하나 — 파이썬은 앱 표를 쓰지 않는다).
 *
 * 무엇을 자동으로 반영하나(정본 09-20 원칙과 같다 — 원문은 사실, 판정은 재검토)
 *   · 개정 현황(law_change)      → 자동
 *   · 기존 의무의 조문이 바뀜     → 의무에 「개정 — 재검토 필요」 표시 + 새 본문을 곁에 붙임(의무 판정은 그대로)
 *   · 새 의무 후보·삭제·분리·병합 → 자동으로 만들지 않는다. 총괄이 「자동 확인 작업 기록」에서 하나씩 확인해 반영(원칙 4)
 *   · 관련 부서 실무자에게 「법령 개정 — 확인 요청」 알림
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { appendRow, patchRow } from "@/lib/write";
import { readTable, parseCsv, staff, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";
import { DATA_ROOT } from "@/lib/data-root";
export { DATA_ROOT } from "@/lib/data-root";

const LS = path.join(DATA_ROOT, "law_sync");
const RUNS = path.join(LS, "runs");
const AGENT = path.join(DATA_ROOT, "_agent", "coco.py");
// 윈도에서는 창 없는 파이썬(pythonw)으로 띄운다 — 「오늘 개정 확인」을 눌러도 명령창이 뜨지 않게(09-24 사용자)
const PY = process.env.ADOMS_PYTHON || (process.platform === "win32" ? "pythonw" : "python");

export type RunStatus = {
  run_id: string; asof: string; trigger: string; by: string; started_at: string; ended_at: string; state: string;
  canon_release: string; steps: { key: string; name: string; state: string; started_at: string; ended_at: string; note: string; done: number; total: number }[];
  summary: Record<string, any>; lessons?: { 요약: string; 적용: string[] };
};

const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
const okId = (id: string) => /^RUN-[0-9A-Za-z-]+$/.test(id);

/** 실행 목록(새것부터). 시험 실행(TEST)도 보인다. */
export function listRuns(): RunStatus[] {
  const ds = safe(() => fs.readdirSync(RUNS).filter((d) => d.startsWith("RUN-")), [] as string[]);
  return ds.map((d) => safe(() => JSON.parse(fs.readFileSync(path.join(RUNS, d, "status.json"), "utf8")) as RunStatus, null as any))
    .filter(Boolean).sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}
export function runStatus(id: string): RunStatus | null {
  if (!okId(id)) return null;
  return safe(() => JSON.parse(fs.readFileSync(path.join(RUNS, id, "status.json"), "utf8")), null);
}
export function runLog(id: string): Row[] {
  if (!okId(id)) return [];
  return safe(() => fs.readFileSync(path.join(RUNS, id, "log.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)), []);
}
function runCsv(id: string, name: string): Row[] {
  if (!okId(id)) return [];
  return safe(() => parseCsv(fs.readFileSync(path.join(RUNS, id, name), "utf8")), []);
}
export const runItems = (id: string) => runCsv(id, "items.csv");
export const runLawChanges = (id: string) => runCsv(id, "law_change.csv");
export const runWatch = (id: string) => [...runCsv(id, "watch_law.csv"), ...runCsv(id, "watch_admin.csv")];

/** 진행 중인 실행(3시간 안에 시작했는데 끝나지 않은 것). */
export function runningRun(): RunStatus | null {
  const r = listRuns().find((x) => x.state === "진행 중");
  if (!r) return null;
  const age = Date.now() - +new Date(r.started_at.replace(" ", "T"));
  return age < 3 * 3600 * 1000 ? r : null;
}

/** 「오늘 개정 확인」 — 파이썬 총괄 작업을 뒤에서 띄운다(앱은 기다리지 않는다). */
export function startRun(by: string, trigger = "화면 단추"): string {
  const cur = runningRun();
  if (cur) return cur.run_id;
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const id = `RUN-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  fs.mkdirSync(path.join(RUNS, id), { recursive: true });
  const out = fs.openSync(path.join(RUNS, id, "_console.log"), "a");
  const port = process.env.PORT || "3400";
  const child = spawn(PY, [AGENT, "--run-id", id, "--by", by, "--trigger", trigger, "--app", `http://localhost:${port}`], {
    cwd: path.dirname(AGENT), detached: true, windowsHide: true, stdio: ["ignore", out, out],
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  child.unref();
  return id;
}

/* ── 앱 반영 ────────────────────────────────────────────────────── */

/** 이미 반영한 실행 */
export async function appliedRuns(): Promise<Set<string>> {
  return new Set((await readTable("law_sync_applied")).map((r) => r.run_id));
}
/** 항목별 사람 결정 */
export async function decisions(): Promise<Map<string, Row>> {
  return new Map((await readTable("law_sync_decision", "item_id")).map((r) => [r.item_id, r]));
}

/**
 * 실행 결과를 우리 기관 표에 반영한다(여러 번 불러도 한 번만). 파이썬이 끝에 부르고, 앱이 꺼져 있었으면 관리 화면 「반영」으로 다시 부른다.
 */
export async function applyRun(id: string, by = "CoCo"): Promise<{ ok: boolean; msg: string }> {
  const st = runStatus(id);
  if (!st) return { ok: false, msg: "실행 없음" };
  if (st.state !== "완료") return { ok: false, msg: `아직 ${st.state}` };
  if ((await appliedRuns()).has(id)) return { ok: true, msg: "이미 반영함" };
  const lcs = runLawChanges(id);
  const items = runItems(id);
  const have = new Set((await readTable("law_change")).map((r) => r.change_id));
  let nLc = 0, nMark = 0, nNote = 0;
  for (const c of lcs) {
    if (have.has(c.change_id)) continue;
    await appendRow("law_change", { ...c, notice_sent_at: ymd() }, by, "법령 개정 확인");
    nLc++;
  }
  // 기존 의무의 조문이 바뀐 것 — 판정은 그대로 두고 「개정 — 재검토 필요」 표시만
  const today = ymd();
  const marked = new Set<string>();
  for (const it of items.filter((x) => x.action === "갱신" && x.duty_keys)) {
    for (const k of String(it.duty_keys).split(";").filter(Boolean)) {
      if (marked.has(k)) continue;
      marked.add(k);
      await patchRow("duty_class", "duty_key", k, {
        rev_state: "재검토 필요", rev_at: today, rev_run: id, rev_item: it.item_id, rev_text: String(it.new_text || "").slice(0, 2000),
        rev_note: `${it.title} ${it.label} 개정(시행 ${it.effective || "-"})`,
      }, by, "법령 개정 표시");
      nMark++;
    }
  }
  // 관련 부서 실무자에게 확인 요청(부서마다 한 번)
  const st2 = await staff();
  const owner = (dept: string) => st2.find((s: any) => s.dept_id === dept && s.duty_role === "정담당") || st2.find((s: any) => s.dept_id === dept && s.approval_level === "1");
  const byDept = new Map<string, Row[]>();
  for (const it of items.filter((x) => x.needs_human === "Y")) {
    // 배정된 부서가 없으면(그 법령에 아직 담당이 없음) 총괄(중대재해예방팀)이 먼저 받는다
    for (const d of String(it.depts || it.prop_depts || "D01").split(";").filter(Boolean)) byDept.set(d, [...(byDept.get(d) || []), it]);
  }
  for (const [dept, its] of byDept) {
    const o = owner(dept);
    if (!o) continue;
    const laws = [...new Set(its.map((x) => x.title))];
    await appendRow("notification", {
      notif_id: `NTF-LS-${id.slice(4)}-${dept}`, task_id: "", notif_type: "법령 개정", to_staff_id: o.staff_id, sent_at: today,
      message: `[법령 개정] ${laws.slice(0, 2).join(" · ")}${laws.length > 2 ? ` 외 ${laws.length - 2}건` : ""} — 조문 ${its.length}곳 확인 요청`,
      read_at: "", note: `법령 개정 확인 ${id}`,
    }, by, "법령 개정 알림");
    nNote++;
  }
  await appendRow("law_sync_applied", { run_id: id, applied_at: new Date().toISOString(), by, law_change_n: nLc, duty_marked_n: nMark, notified_n: nNote }, by, "법령 개정 반영");
  return { ok: true, msg: `개정 현황 ${nLc} · 재검토 표시 ${nMark} · 알림 ${nNote}` };
}

/* ── 항목 하나 확인(총괄) ───────────────────────────────────────── */

async function nextDutyKey(): Promise<string> {
  const rows = await readTable("duty_class");
  const n = rows.reduce((m, r) => Math.max(m, Number(String(r.duty_key || "").replace(/\D/g, "")) || 0), 0);
  return `DTY-${String(n + 1).padStart(5, "0")}`;
}

/**
 * 반영 / 반영 안 함. 반영이면 갈래에 따라:
 *   신규 후보·분리 후보 → 의무 한 줄(가까운 기존 의무의 분류를 본뜸) + 제시된 부서마다 배정 「확인필요」
 *   폐지 후보·병합 후보 → 그 의무를 「개정으로 삭제」 표시(지우지 않음) + 배정을 비해당(사유 적음)
 *   갱신 → 새 본문을 의무 원문으로 올리고 「개정 반영」
 *   판 겹침 확인·고시 개정 확인 → 확인 기록만
 */
export async function decideItem(runId: string, itemId: string, decision: "반영" | "반영 안 함", by: string, note = "") {
  const it = runItems(runId).find((x) => x.item_id === itemId);
  if (!it) return;
  const done = await decisions();
  if (done.has(itemId)) return;
  const today = ymd();
  const made: string[] = [];
  if (decision === "반영") {
    if (it.action === "신규 후보" || it.action === "분리 후보") {
      const tpl = safe(() => JSON.parse(it.tpl || "{}"), {} as Row);
      const key = await nextDutyKey();
      await appendRow("duty_class", {
        ...tpl, duty_key: key, doc: it.title, unit_label_ko: it.label, article_title: "", duty_name: `${it.title} ${it.label}`,
        verdict: "obligation", source_text: it.new_text, unit_id: it.unit_id, doc_id: it.doc_id, schedule_id: "", obl_id: "",
        review_status: "pending", badge: "법령 개정 — 새 조문", why: `법령 개정 확인 ${runId} · ${it.action} · 총괄 확인 ${today}`,
        rev_state: "개정 반영", rev_at: today, rev_run: runId, rev_item: itemId,
      }, by, "법령 개정 — 의무 추가");
      made.push(key);
      const depts = String(it.prop_depts || "").split(";").filter(Boolean);
      const st2 = await staff();
      let n = (await readTable("duty_assignment")).length;
      for (const d of depts) {
        const o = st2.find((s: any) => s.dept_id === d && s.duty_role === "정담당");
        const dep = st2.find((s: any) => s.dept_id === d && s.duty_role === "부담당");
        n++;
        await appendRow("duty_assignment", {
          assign_id: `ASG-LS${String(n).padStart(6, "0")}`, duty_key: key, asset_id: "", scope: ["TG24", "TG26"].includes(tpl.target_code) ? "기관" : "유형",
          target_code: tpl.target_code || "", dept_id: d, owner_staff_id: o?.staff_id || "", deputy_staff_id: dep?.staff_id || "",
          applicability: "확인필요", applicability_note: "법령 개정으로 새로 생긴 조문 — 우리 관리대상 해당 여부 확인", cycle: "수시", cycle_days: "180",
          decided_by: "", decided_at: "", badge: "법령 개정",
        }, by, "법령 개정 — 배정");
      }
    } else if (it.action === "폐지 후보" || it.action === "병합 후보") {
      for (const k of String(it.duty_keys || "").split(";").filter(Boolean)) {
        await patchRow("duty_class", "duty_key", k, { retired: "Y", rev_state: "개정으로 삭제", rev_at: today, rev_run: runId, rev_item: itemId }, by, "법령 개정 — 의무 삭제 표시");
        for (const a of (await readTable("duty_assignment", "assign_id")).filter((x) => x.duty_key === k)) {
          await patchRow("duty_assignment", "assign_id", a.assign_id, {
            applicability: "비해당", applicability_note: `법령 개정으로 조문 ${it.action === "병합 후보" ? "통합" : "삭제"}(${it.title} ${it.label})`, decided_by: by, decided_at: today,
          }, by, "법령 개정 — 비해당");
        }
        made.push(k);
      }
    } else if (it.action === "갱신") {
      for (const k of String(it.duty_keys || "").split(";").filter(Boolean)) {
        await patchRow("duty_class", "duty_key", k, { source_text: it.new_text, rev_state: "개정 반영", rev_at: today, rev_run: runId, rev_item: itemId }, by, "법령 개정 — 원문 갱신");
        made.push(k);
      }
    }
  }
  await appendRow("law_sync_decision", { item_id: itemId, run_id: runId, action: it.action, decision, by, at: new Date().toISOString(), note, duty_keys: made.join(";") }, by, `법령 개정 — ${decision}`);
}
