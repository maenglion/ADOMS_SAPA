/**
 * [400 · 교육자료 버전] 화면 사이 연결 — 한 곳(2026-09-24).
 *
 * 따로 쌓이던 기록을 다른 화면이 읽도록 잇는다(사용자 질문 「업무 처리 과정이 연결되고 테이블에 반영돼 있나」에 따라).
 *  ① 이행점검 판정(usf_judge) → 이행현황 표(칸) · 대시보드·이행현황 이행률. 판정은 같은 단위(부서 × 단계)인
 *     의무이행 기록보다 앞서고, 기록 없이 판정만 있으면 한 건으로 센다. ★ 과제(의무 × 시설 × 기간)는 건드리지 않는다
 *     — 판정 한 줄이 부서의 같은 의무조항 과제 수백 건을 바꾸면 숫자가 틀린다(09-24 점검에서 발견: 도로과 재해예방절차 168건).
 *  ② 법 의무사항 이행 시기(usb2_timing) → 대시보드 시기도래 · 기한 초과. 해당 대상·단계에 「이행완료」 기록이나 판정이 생기면 빠진다
 *     (공중이용시설은 시설 번호로, 사업장·원료·제조물은 부서로 맞춘다).
 *  ③ 담당자 관리대상 지정(usb2_assign) → 담당자(현업 역할)가 보는 대상 목록
 *  (⑤ 기관장 활동 입력은 lib/data.ts ceoActivities 가 함께 읽는다)
 * 모든 표는 「가장 최근 줄이 현재 값」 규칙(쌓기만 하고 지우지 않음)을 따른다.
 */
import "server-only";
import { readTable, type Row } from "@/lib/data";
import { STEPS, type TrackKey } from "@/lib/us/tracks";
import { ROLE_STAFF, canApprove } from "@/lib/roles";
import { ymd } from "@/lib/day";

export type Mark = "O" | "△" | "X" | "-" | "wait";
const MARK: Record<string, Mark> = { 이행완료: "O", 보완필요: "△", 미이행: "X", 해당없음: "-" };
const EDU: Record<TrackKey, string> = { ws: "I13", fc: "F12", mt: "M09" };
const REC: Record<TrackKey, string> = { ws: "usc_record", fc: "usd_record", mt: "use_record" };
export const TRACK_OF_AREA: Record<string, TrackKey> = { I: "ws", F: "fc", M: "mt" };

/** 단계 key → 의무조항 36 코드(법정교육 칸은 교육이수 코드). */
export function codeOfStep(t: TrackKey, step: string, section = ""): string {
  if (step === "edu" || (step === "law" && section === "edu")) return EDU[t];
  return STEPS[t].find((s) => s.key === step)?.code36 || "";
}

/* ── ① 점검 판정 ─────────────────────────────────────────────── */
/**
 * 트랙·연도의 점검 판정 — (부서|의무조항 코드) 마다 가장 최근 판정.
 * 연도는 회차 이름·만든 날에서 읽는다(회차는 반기 단위라 한 해에 둘 — 뒤의 것이 앞선다).
 */
export async function judgeMap(t: TrackKey, year: string): Promise<Map<string, Mark>> {
  const [rounds, judges] = await Promise.all([readTable("usf_round", "round_id"), readTable("usf_judge", "judge_id")]);
  const yOf = new Map(rounds.map((r) => [r.round_id, String(r.title || "").match(/(20\d\d)/)?.[1] || String(r.created_at || "").slice(0, 4)]));
  const rows = judges
    .filter((j) => (j.track || "") === t && (!year || yOf.get(j.round_id) === year || String(j.judged_at || "").slice(0, 4) === year) && MARK[String(j.status)])
    .sort((a, b) => String(b.judged_at).localeCompare(String(a.judged_at)));
  // 09-26: 판정이 든 회차의 반기도 함께 적는다(withJudges 가 「하반기」로 고정하던 것 — 상반기 판정이 상반기 막대에 들어가게)
  const hOf = new Map(rounds.map((r) => {
    const s = String(r.title || "");
    const h = s.includes("상반기") ? "상반기" : s.includes("하반기") ? "하반기" : Number(String(r.created_at || "").slice(5, 7)) <= 6 ? "상반기" : "하반기";
    return [r.round_id, h];
  }));
  const m = new Map<string, Mark>();
  const half = new Map<string, string>();
  for (const j of rows) {
    const k = `${j.dept_id}|${codeOfStep(t, String(j.item_key))}`;
    if (!m.has(k)) { m.set(k, MARK[String(j.status)]); half.set(k, hOf.get(j.round_id) || "하반기"); }
  }
  return Object.assign(m, { half });
}

/**
 * 판정 반영 — 과제는 그대로, 의무이행 기록(from = record)은 같은 (부서|코드) 판정으로 바꾸고,
 * 기록이 없는 판정은 한 건(from = judge)으로 더한다.
 */
export function withJudges<T extends Row>(rows: T[], jm: Map<string, Mark>): Row[] {
  if (!jm.size) return rows;
  const hasRec = new Set<string>();
  const out: Row[] = rows.map((r) => {
    if (r.from !== "record") return r;
    const k = `${r.dept_id}|${r.code}`;
    hasRec.add(k);
    const j = jm.get(k);
    return j ? { ...r, mark: j, judged: "Y" } : r;
  });
  for (const [k, m] of jm) {
    if (hasRec.has(k)) continue;
    const [dept_id, code] = k.split("|");
    out.push({ dept_id, code, mark: m, from: "judge", half: (jm as Map<string, Mark> & { half?: Map<string, string> }).half?.get(k) || "하반기", area: code.slice(0, 1) === "I" ? "I" : code.slice(0, 1) === "M" ? "M" : "F" });
  }
  return out;
}

/* ── 이행이 끝난 (부서|코드) · (시설|코드) — 이행 시기에만 쓴다 ─────────── */
/** 의무이행 기록 「이행완료」(부서 키 + 공중이용시설은 시설 키) 또는 점검 판정 「이행완료」(부서 키). */
export async function doneKeys(year: string): Promise<Set<string>> {
  const s = new Set<string>();
  for (const t of ["ws", "fc", "mt"] as TrackKey[]) {
    for (const r of await readTable(REC[t], "rec_id")) {
      if (r.deleted === "Y" || String(r.status) !== "이행완료") continue;
      if (year && String(r.year || "") !== year) continue;
      const c = codeOfStep(t, String(r.step || ""), String(r.section || ""));
      if (!c) continue;
      if (t === "fc") { if (r.scope) s.add(`T:${r.scope}|${c}`); }   // 공중이용시설은 시설 단위 — 부서 전체를 닫지 않는다
      else if (r.dept_id) s.add(`${r.dept_id}|${c}`);
    }
    for (const [k, m] of await judgeMap(t, year)) if (m === "O") s.add(k);
  }
  return s;
}

/* ── ② 이행 시기 ─────────────────────────────────────────────── */
export type Due = { track: TrackKey; target_id: string; item: string; label: string; due: string; dept_id: string; code: string };

/** 이행 시기 입력값 → 마감일. 「2026-05」 → 그 달 말일 · 「상반기」 → 06-30 · 「하반기」 → 12-31. */
function dueOf(v: string, year: string): string {
  const m = String(v || "").match(/^(\d{4})-(\d{2})$/);
  if (m) { const d = new Date(Number(m[1]), Number(m[2]), 0); return ymd(d); }
  if (v === "상반기") return `${year}-06-30`;
  if (v === "하반기") return `${year}-12-31`;
  return "";
}
/** 이행 시기 항목 id → 의무 단계 key(법 의무사항 _lib ITEMS 의 순서와 같다). */
const ITEM_STEP: Record<string, string> = {
  f1: "staff", f2: "budget", f3a: "inspect", f3b: "inspect", f3c: "inspect", f3d: "inspect", f3e: "inspect", f3f: "inspect",
  f4a: "plan", f4b: "plan", f5a: "proc", f5b: "proc", f5c: "proc", f5d: "proc", f6: "recur", f7: "order", f8a: "law", f8b: "edu",
  w1: "goal", w2: "org", w3: "staff", w4a: "risk", w4b: "risk", w5: "budget", w6a: "work", w6b: "work", w7a: "opinion", w7b: "opinion",
  w8a: "emergency", w8b: "emergency", w9: "recur", w10: "order", w11a: "law", w11b: "edu",
  m1: "staff", m2: "budget", m3a: "proc", m3b: "proc", m3c: "proc", m3d: "proc", m4: "recur", m5: "order", m6a: "law", m6b: "edu",
};
const tOf = (id: string): TrackKey => (id.startsWith("w") ? "ws" : id.startsWith("m") ? "mt" : "fc");

/**
 * 법 의무사항에서 정한 이행 시기 중 아직 끝나지 않은 것(대상별 가장 최근 저장).
 * 대상의 부서는 targetDept(대상 id → 부서 id)로 찾는다. 끝났는지는 doneKeys 로 본다.
 */
export async function openDues(year: string, targetDept: (t: TrackKey, id: string) => string): Promise<Due[]> {
  const rows = await readTable("usb2_timing", "rec_id");
  const seen = new Set<string>();
  const done = await doneKeys(year);
  const out: Due[] = [];
  for (const r of rows) {
    const k = `${r.track}|${r.target_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    let vals: Record<string, string> = {};
    try { vals = JSON.parse(String(r.vals || "{}")); } catch { vals = {}; }
    const hidden = new Set(String(r.hidden || "").split(";").filter(Boolean));
    for (const [id, v] of Object.entries(vals)) {
      if (!v || hidden.has(id) || !ITEM_STEP[id]) continue;
      const t = tOf(id);
      const due = dueOf(v, year);
      if (!due || due.slice(0, 4) !== year) continue;
      const dept = targetDept(t, String(r.target_id));
      const code = codeOfStep(t, ITEM_STEP[id]);
      if (!dept || !code) continue;
      if (t === "fc" ? done.has(`T:${r.target_id}|${code}`) || done.has(`${dept}|${code}`) : done.has(`${dept}|${code}`)) continue;
      out.push({ track: t, target_id: String(r.target_id), item: id, label: ITEM_STEP[id], due, dept_id: dept, code });
    }
  }
  return out;
}

/* ── ③ 담당자 관리대상 지정 ─────────────────────────────────────── */
/**
 * 현업 역할(담당자)이 지정받은 관리대상 id. 저장된 지정이 없거나 총괄·관리자 역할이면 null(= 부서 기준 그대로).
 * dis: 중대산업재해 ind(부서 id) · 중대시민재해 civ(시설 id).
 */
export async function assignedIds(role: string, dis: "ind" | "civ"): Promise<Set<string> | null> {
  if (canApprove(role)) return null;
  const sid = ROLE_STAFF[role];
  if (!sid) return null;
  const hit = (await readTable("usb2_assign", "map_id")).find((r) => r.map_id === `${dis}|${sid}`);
  return hit ? new Set(String(hit.targets || "").split(";").filter(Boolean)) : null;
}
