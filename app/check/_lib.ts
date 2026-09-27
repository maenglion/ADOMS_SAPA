/**
 * [400 · 교육자료 버전] 묶음 F — 이행점검 공용 계산(SCR-088·089·090).
 *
 *  · 점검 항목 = 트랙별 의무 단계(lib/us/tracks.ts STEPS). 사업장 트랙은 참고 명세 SCR-089 의 「10. 법정교육 이수」를
 *    우리 의무조항 I13(관계법령 교육이수)으로 뒤에 붙인다.
 *  · 판정 근거(자료 기준 제안) = ① 의무이행 화면이 저장한 기록(usc_record · usd_record · use_record)
 *                              ② 없으면 우리 과제(tasks()) 이행 상태 + 증빙(evidences())
 *  · 점검자 판정은 표 usf_judge 에 한 줄씩 더한다(고칠 때마다 새 줄 — 가장 최근 줄이 현재 판정, 이력은 남는다).
 *  · 취합 회차는 표 usf_round(취합 시작 → 점검중 → 결재완료).
 */
import { floor1 } from "@/lib/num";   // 09-26 사용자: 이행률 소수점은 모두 버림(lib/num.ts)
import "server-only";
import { tasks, evidences, readTable, depts, staff, type Row } from "@/lib/data";
import { withReadOperation } from "@/lib/db";
import { STEPS, trackOf, type TrackKey } from "@/lib/us/tracks";
import { deptOf } from "@/lib/roles";
import { ymd } from "@/lib/day";
// 09-26 사용자: 옛 점검 화면 합치기 — 옛 과제 단위 점검의 셈(lib/cycle.ts)을 읽기만 한다
import {
  allTasks, inspectionsByTask, actionsByInsp, actionStateOf, stateOf, loadAllCycles, splitList, codeCycle,
  CYCLE_LABEL, halfEnd, type Cycle,
} from "@/lib/cycle";
// 09-26 사용자: 옛 점검 화면 합치기 2차 — 과제 단위 이행률은 이행현황표와 같은 함수로
import { buildBoard } from "@/app/status/_lib/calc";

export const ST_LIST = ["이행완료", "보완필요", "미이행", "해당없음"] as const;
export type St = (typeof ST_LIST)[number];
export const SYM: Record<St, string> = { 이행완료: "O", 보완필요: "△", 미이행: "X", 해당없음: "-" };
export const SYM_CLS: Record<St, string> = { 이행완료: "O", 보완필요: "T", 미이행: "X", 해당없음: "N" };

/** 좌측 메뉴·제목에 쓰는 트랙 이름(참고 명세 SCR-088~090 LNB 원문). */
// 대상 명칭은 법적 명칭 「공중이용시설·공중교통수단」(09-24 사용자 지시 — 명세 원문보다 우선).
export const NAME: Record<TrackKey, string> = { ws: "사업장", fc: "공중이용시설·공중교통수단", mt: "원료·제조물" };
// 09-25 사용자: 하위 메뉴에 「이행점검」을 다시 쓸 필요 없음 — 대상 이름만
export const LNB: { key: TrackKey; label: string }[] = [
  { key: "ws", label: "사업장" },
  { key: "fc", label: "공중이용시설·공중교통수단" },
  { key: "mt", label: "원료·제조물" },
];
/** 의무이행(실적증빙) 화면이 저장하는 기록 표 — 묶음 C·D·E. */
export const REC_TABLE: Record<TrackKey, string> = { ws: "usc_record", fc: "usd_record", mt: "use_record" };

export const isTrack = (t: string): t is TrackKey => t === "ws" || t === "fc" || t === "mt";

export type Item = { key: string; no: number; label: string; code36?: string; codes: string[] };

// 09-26 사용자: 옛 점검 화면 합치기 — 항목(의무 단계) ↔ 과제(의무조항 코드).
//   단계의 code36 하나에 더해 아래 코드도 그 항목의 과제로 본다. 근거:
//   · fc 안전계획(plan) ← F05·F06 : 이행현황표(app/status/_lib/calc.ts ITEMS)가 시행령 제10조제5호·제6호를 4) 안전계획 줄에 모은다.
//   · mt 절차(proc)     ← M03·M05 : 이행현황표가 시행령 제8조제3호·제5호를 절차 줄에 모은다.
//   · fc·mt 관계 법령(law) ← F12·M09 : 단계 제목이 「시행령 제11조제2항제1호·제3호」「제9조제2항제1호·제3호」 — 제3호(교육)가 같은 단계다
//     (lib/us/links.ts codeOfStep 도 law 단계의 교육 칸을 F12·M09 로 센다). 사업장은 교육이 따로 「법정교육 이수」(I13) 항목이다.
//   이 표에 없는 코드(F08 도급 기준 연 1회 점검)는 어느 항목에도 넣지 않고 항목별 점검 화면 끝 「점검 항목 밖 과제 판정」에 보인다.
const ITEM_EXTRA: Partial<Record<TrackKey, Record<string, string[]>>> = {
  fc: { plan: ["F05", "F06"], law: ["F12"] },
  mt: { proc: ["M03", "M05"], law: ["M09"] },
};
export function itemsOf(t: TrackKey): Item[] {
  const base: Item[] = STEPS[t].map((s, i) => ({
    key: s.key, no: i + 1, label: s.label, code36: s.code36,
    codes: [s.code36 || "", ...(ITEM_EXTRA[t]?.[s.key] || [])].filter(Boolean),
  }));
  // 참고 명세 SCR-089·090 사업장 항목 「10. 법정교육 이수」 — 의무 단계에는 없어 우리 의무조항 I13 으로 붙인다.
  if (t === "ws") base.push({ key: "edu", no: base.length + 1, label: "법정교육 이수", code36: "I13", codes: ["I13"] });
  return base;
}
/** 09-26 사용자: 옛 점검 화면 합치기 — 의무조항 코드가 드는 항목(없으면 undefined). */
export const firstCode = (c: any) => String(c || "").split(";")[0].trim();
export function itemOfCode(t: TrackKey, code: string): Item | undefined {
  const c = firstCode(code);
  return itemsOf(t).find((i) => i.codes.includes(c));
}

/**
 * 사업장 — 용인시의 「사업장」(중대산업재해)은 용인시청 본청 청사 하나다(09-24 사용자 지시).
 * 사업장 트랙은 본청 소속 부서만 열로 쓴다. 시민재해 트랙은 소관 부서가 사업소(상수도사업소·보건소·농업기술센터)일 수 있다.
 */
export const HQ = "용인시청 본청";
const SITE: Record<string, string> = { D04: "상수도사업소", D05: "하수도사업소", D06: "푸른공원사업소", D11: "보건소", D14: "농업기술센터" };
export const siteOf = (deptId: string) => SITE[deptId] || HQ;

export type Dept = { dept_id: string; dept_name: string; site: string; label: string; short: string; taskN: number };

/**
 * 이 트랙에서 점검할 수 있는 사업장·부서.
 *  사업장 트랙 = 본청 소속 부서 전부(사업소 제외) · 시민재해 트랙 = 이 트랙 과제가 배정됐거나 의무이행 기록이 있는 부서
 *  (없으면 현업 부서 전부).
 */
export async function deptsOf(t: TrackKey): Promise<Dept[]> {
  const area = trackOf(t).area;
  const all = (await tasks({ limit: 100000 })).filter((x) => x.area === area);
  const n = new Map<string, number>();
  all.forEach((x) => n.set(x.dept_id, (n.get(x.dept_id) || 0) + 1));
  // 의무이행 화면에 기록을 남긴 부서도 넣는다(과제가 없어도 점검 대상)
  for (const r of await readTable(REC_TABLE[t], "rec_id")) {
    if (r.deleted !== "Y" && r.dept_id) n.set(String(r.dept_id), (n.get(String(r.dept_id)) || 0) + 1);
  }
  const dl = (await depts()).filter((d: Row) => d.dept_id !== "D99");
  let pick: Row[];
  if (t === "ws") pick = dl.filter((d: Row) => !SITE[d.dept_id]);
  else {
    pick = dl.filter((d: Row) => n.has(d.dept_id));
    if (!pick.length) pick = dl.filter((d: Row) => d.dept_role === "현업");
  }
  return pick.map((d: Row) => {
    const site = siteOf(d.dept_id);
    return {
      dept_id: d.dept_id, dept_name: d.dept_name, site,
      label: `${site} : ${d.dept_name}`, short: `${site}:${d.dept_name}`,
      taskN: n.get(d.dept_id) || 0,
    };
  });
}

/* ── 취합 회차 ─────────────────────────────────────────── */
export const splitIds = (s: any) => String(s || "").split(";").map((x) => x.trim()).filter(Boolean);

export async function roundsOf(t: TrackKey): Promise<Row[]> {
  return withReadOperation("roundsOf", { t }, async () => {
    const rows = await readTable("usf_round", "round_id");
    return rows.filter((r) => r.track === t).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, { memo: true, work: { filter: 1, sort: 1 } });
}
export async function roundOf(t: TrackKey, id?: string): Promise<Row | null> {
  const rs = await roundsOf(t);
  return (id && rs.find((r) => r.round_id === id)) || rs[0] || null;
}

/** 점검자 판정 — (항목|부서) 마다 가장 최근 줄. */
export async function judgesOf(roundId: string): Promise<Map<string, Row>> {
  return withReadOperation("judgesOf", { roundId }, async () => {
    const rows = (await readTable("usf_judge", "judge_id")).filter((r) => r.round_id === roundId)
      .sort((a, b) => String(b.judged_at).localeCompare(String(a.judged_at)));
    const m = new Map<string, Row>();
    for (const r of rows) { const k = `${r.item_key}|${r.dept_id}`; if (!m.has(k)) m.set(k, r); }
    return m;
  }, { memo: true, work: { filter: 1, sort: 1, merge: 1 } });
}

/* ── 칸 계산 ───────────────────────────────────────────── */
export type Cell = {
  item: string; dept: string;
  proposed: St; basis: string;          // 자료 기준 제안과 그 근거(비고 칸)
  date: string; evName: string; evUrl: string;
  judged: Row | null; status: St; comment: string;
  // 09-26 사용자: 옛 점검 화면 합치기 — 이 칸의 판정이 어디서 왔는가(src)와, 옛 과제 단위 판정 모음(old · 참고 값)
  src: Src; old: OldAgg | null;
  // 09-26 사용자: 옛 점검 화면 합치기 2차 — 이 회차에 판정이 없어 지난 회차 판정을 물려받았으면 그 회차(없으면 null)
  inherited: { round_id: string; title: string; at: string } | null;
};

/* ── 09-26 사용자: 옛 점검 화면 합치기 — 한 대상·한 항목에는 판정 하나 ─────────────────
 * 이행점검(항목 단위 · usf_judge)과 옛 과제 단위 점검(과제 단위 · inspection)은 저장하는 표가 다르다.
 * 자료는 옮기지 않고 **읽을 때** 한 칸(대상 × 항목)에 판정 하나만 남긴다. 먼저 있는 것이 이긴다:
 *   ① 이행점검 판정   — 이 회차에서 점검자가 그 칸에 찍은 가장 최근 판정(usf_judge)
 *   ② 과제 판정 모음  — 그 부서·그 항목 과제 중 이 회차 기간(연도·반기)에 든 과제의 가장 최근 과제 판정(inspection)을 모은 값
 *                        부적합이 하나라도 있으면 미이행 · 보완필요가 하나라도 있으면 보완필요 ·
 *                        전부 적합이고 기한이 온 과제가 모두 판정을 받았으면 이행완료 ·
 *                        적합만 있으나 판정 받지 않은 기한 도래 과제가 남았으면 값을 내지 않는다(③·④로 — 한 건 적합으로 칸 전체를 이행완료로 만들지 않는다)
 *   ③ 의무이행 기록   — 부서가 의무이행 화면에 남긴 기록
 *   ④ 과제 이행 상태  — 과제 이행 상태와 증빙
 * ①이 있어도 ②는 「과제 판정 참고」로 함께 보인다(서로 다르면 화면에 둘 다 드러난다).
 * 09-26 사용자 확정 원칙: 「항목 판정은 이행점검 표에, 과제 결재는 과제 결재 기록에」.
 *   · 항목 판정(대상 × 점검 항목 · 반기 회차) → ① 표(usf_judge)
 *   · 과제 결재(과제 하나 · 실무자 제출 → 부서장 확인 → 총괄 승인, 증빙 등록·결재 화면) → 과제 결재 기록(옛 과제 판정 표 inspection)
 *   두 업무는 다르다(대상·때·흐름·묻는 것). 화면 이름도 「과제 판정」 → 「과제 결재 기록」.
 * 이행현황표(app/status/_lib/calc.ts)도 칸 표시에서 점검자 판정(①)을 앞세운다 — 같은 방향이다.
 */
export type Src = "judge" | "old" | "record" | "task" | "none";
export const SRC_LABEL: Record<Src, string> = {
  judge: "이행점검 판정", old: "과제 결재 기록", record: "의무이행 기록", task: "과제 이행 상태", none: "자료 없음",
};
export const RULE_TEXT = "한 칸에 판정 하나 — ① 이행점검 판정 ② 과제 결재 기록(과제마다 내린 결재·판정) ③ 의무이행 기록 ④ 과제 이행 상태 순으로 먼저 있는 것을 씁니다.";

export type OldRow = {
  task_id: string; dept_id: string; code: string; duty: string; target: string;
  result: string; round_no: number; date: string; finding: string; inspector: string;
  state: string; actionState: string;
};
export type OldAgg = {
  judged: number; ok: number; fix: number; bad: number;
  wait: number;            // 부서가 (다시) 제출해 과제 판정을 기다리는 과제
  dueUnjudged: number;     // 기한이 왔는데 과제 판정이 없는 과제
  value: St | null;        // 모은 값(②) — 낼 수 없으면 null
  text: string;            // 「적합 3 · 보완필요 1 · 부적합 0」
  rows: OldRow[];          // 판정 받은 과제(최근 판정이 앞)
};

/** 회차의 기간 — 이름의 연도·반기(이름에 없으면 만든 날의 연도·반기 — 취합 시작 때 이름을 그렇게 붙인다). */
export function periodOfRound(r: Row): { year: string; half: string } {
  const title = String(r.title || "");
  const at = String(r.created_at || "");
  const year = title.match(/(20\d\d)/)?.[1] || at.slice(0, 4);
  const d = at ? new Date(at) : null;
  const half = title.includes("상반기") ? "상반기" : title.includes("하반기") ? "하반기" : d && !isNaN(+d) ? halfOf(d) : "";
  return { year, half };
}
/** 과제가 그 기간에 드는가 — 과제의 연도·반기(결재 층)로 본다. 반기를 모르면 연도만 본다. */
export function taskInPeriod(t: Row, year: string, half: string): boolean {
  const y = String(t.period_year || String(t.due_date || "").slice(0, 4));
  if (year && y !== year) return false;
  if (half && t.half_year && t.half_year !== half) return false;
  return true;
}

const OLD_RESULT_ST = (r: string): St => (r === "부적합" ? "미이행" : r === "보완필요" ? "보완필요" : "이행완료");

/** ② 과제 판정 모음 — (항목|부서) → OldAgg. 판정 받은 과제가 없는 칸은 넣지 않는다. */
export async function oldAggOf(t: TrackKey, deptIds: string[], itemKeys: string[], year: string, half: string): Promise<Map<string, OldAgg>> {
  return withReadOperation("oldAggOf", { t, deptIds, itemKeys, year, half }, async () => {
  const area = trackOf(t).area;
  const today = ymd();
  const items = itemsOf(t).filter((i) => itemKeys.includes(i.key));
  const [all, hist, acts, st] = await Promise.all([allTasks(), inspectionsByTask(), actionsByInsp(), staff()]);
  const nm = new Map(st.map((s: Row) => [s.staff_id, String(s.display_name || "")]));
  const pool = all.filter((x) => x.area === area && deptIds.includes(x.dept_id) && x.applicability !== "비해당" && taskInPeriod(x, year, half));
  const out = new Map<string, OldAgg>();
  for (const it of items) {
    for (const d of deptIds) {
      const ts = pool.filter((x) => x.dept_id === d && it.codes.includes(firstCode(x.code36)));
      const rows: OldRow[] = [];
      let ok = 0, fix = 0, bad = 0, wait = 0, dueUnjudged = 0;
      for (const x of ts) {
        const h = hist.get(x.task_id) || [];
        const state = stateOf(x, h);
        if (state === "판정대기") wait++;
        if (!h.length) {
          const due = x.status === "이행완료" || x.status === "점검완료" || String(x.due_date || "") <= today || x.status === "기간초과" || x.status === "조치필요";
          if (due) dueUnjudged++;
          continue;
        }
        const last = h[0];
        if (last.result === "부적합") bad++; else if (last.result === "보완필요") fix++; else ok++;
        rows.push({
          task_id: x.task_id, dept_id: x.dept_id, code: firstCode(x.code36),
          duty: String(x.duty_name || x.article_title || x.code36_name || ""), target: String(x.asset_name || x.target_name || ""),
          result: String(last.result || ""), round_no: Number(last.round_no || h.length), date: String(last.insp_date || ""),
          finding: String(last.finding || ""), inspector: nm.get(last.inspector_staff_id) || String(last.inspector_staff_id || ""),
          state, actionState: String(actionStateOf(x, last, acts.get(last.insp_id), state) || ""),
        });
      }
      if (!rows.length) continue;
      rows.sort((a, b) => b.date.localeCompare(a.date));
      const value: St | null = bad ? "미이행" : fix ? "보완필요" : ok && !dueUnjudged ? "이행완료" : null;
      out.set(`${it.key}|${d}`, {
        judged: rows.length, ok, fix, bad, wait, dueUnjudged, value, rows,
        text: `적합 ${ok} · 보완필요 ${fix} · 부적합 ${bad}${dueUnjudged ? ` · 판정 전 ${dueUnjudged}` : ""}`,
      });
    }
  }
  return out;
  }, { memo: true, work: { filter: 2 + itemKeys.length * deptIds.length, sort: itemKeys.length * deptIds.length, merge: 3 } });
}

async function oldAggFromContext(
  t: TrackKey, deptIds: string[], itemKeys: string[], year: string, half: string, ctx: ActionCheckReadContext,
): Promise<Map<string, OldAgg>> {
  const cacheKey = actionContextKey(t, deptIds, itemKeys, year, half);
  const cached = ctx.oldAggCache.get(cacheKey);
  if (cached) return cached;
  ctx.stats.oldAggCalculations++;

  const area = trackOf(t).area;
  const today = ymd();
  const items = itemsOf(t).filter((i) => itemKeys.includes(i.key));
  const out = new Map<string, OldAgg>();
  for (const it of items) {
    for (const d of deptIds) {
      const ts = taskRowsFromContext(ctx, area, d, it.codes, true)
        .filter((x) => x.applicability !== "비해당" && taskInPeriod(x, year, half));
      const rows: OldRow[] = [];
      let ok = 0, fix = 0, bad = 0, wait = 0, dueUnjudged = 0;
      for (const x of ts) {
        const h = ctx.inspectionsByTask.get(String(x.task_id)) || [];
        const state = stateOf(x, h);
        if (state === "판정대기") wait++;
        if (!h.length) {
          const due = x.status === "이행완료" || x.status === "점검완료" || String(x.due_date || "") <= today || x.status === "기간초과" || x.status === "조치필요";
          if (due) dueUnjudged++;
          continue;
        }
        const last = h[0];
        if (last.result === "부적합") bad++; else if (last.result === "보완필요") fix++; else ok++;
        rows.push({
          task_id: x.task_id, dept_id: x.dept_id, code: firstCode(x.code36),
          duty: String(x.duty_name || x.article_title || x.code36_name || ""), target: String(x.asset_name || x.target_name || ""),
          result: String(last.result || ""), round_no: Number(last.round_no || h.length), date: String(last.insp_date || ""),
          finding: String(last.finding || ""), inspector: ctx.staffName.get(String(last.inspector_staff_id)) || String(last.inspector_staff_id || ""),
          state, actionState: String(actionStateOf(x, last, ctx.actionsByInspection.get(String(last.insp_id)), state) || ""),
        });
      }
      if (!rows.length) continue;
      rows.sort((a, b) => b.date.localeCompare(a.date));
      const value: St | null = bad ? "미이행" : fix ? "보완필요" : ok && !dueUnjudged ? "이행완료" : null;
      out.set(`${it.key}|${d}`, {
        judged: rows.length, ok, fix, bad, wait, dueUnjudged, value, rows,
        text: `적합 ${ok} · 보완필요 ${fix} · 부적합 ${bad}${dueUnjudged ? ` · 판정 전 ${dueUnjudged}` : ""}`,
      });
    }
  }
  ctx.oldAggCache.set(cacheKey, out);
  return out;
}
export const oldResultSt = OLD_RESULT_ST;

// 의무이행 기록 표(묶음 C·D·E) — rec_id · dept_id · year · step · status · deleted · data(JSON, date 등) · files(JSON [{name,url,at}]) · updated_at.
// (app/perform/ws/_lib/usc.ts toRec 와 같은 읽기. 모양이 다른 행도 흔한 칸 이름으로 받아 준다.)
function js<T>(v: any, d: T): T {
  if (v && typeof v === "object") return v as T;
  try { return v ? (JSON.parse(String(v)) as T) : d; } catch { return d; }
}
const recStep = (r: Row) => String(r.step || r.step_key || r.item_key || "");
const recData = (r: Row) => js<Record<string, any>>(r.data, {});
const recFiles = (r: Row): Row[] => {
  const v = js<any>(r.files, []);
  const a: any[] = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v).flat() : [];
  return a.filter((f) => f && typeof f === "object" && f.name);
};
const recDate = (r: Row) => String(recData(r).date || r.done_date || r.date || r.updated_at || "").slice(0, 10);
const recEvName = (r: Row) => String(recFiles(r)[0]?.name || r.evidence_name || r.file_name || "");
const recEvUrl = (r: Row) => String(recFiles(r)[0]?.url || r.evidence_url || r.file_url || "");

/** `/actions` 한 요청에서 이행점검 계산이 공유하는 정규화·색인 결과. */
export type ActionCheckReadContext = {
  baseTasks: Row[];
  allTasks: Row[];
  inspectionsByTask: Map<string, Row[]>;
  actionsByInspection: Map<string, Row>;
  staffRows: Row[];
  staffName: Map<string, string>;
  staffDept: Map<string, string>;
  evidenceByTask: Map<string, Row>;
  baseTasksByAreaDeptCode: Map<string, Row[]>;
  approvedTasksByAreaDeptCode: Map<string, Row[]>;
  baseTaskOrder: Map<Row, number>;
  approvedTaskOrder: Map<Row, number>;
  recordsByTrackYearStepDept: Map<string, Row[]>;
  roundsByTrack: Map<TrackKey, Row[]>;
  judgesByRound: Map<string, Map<string, Row>>;
  judgesNewest: Row[];
  notifications: Row[];
  buildCellsCache: Map<string, { items: Item[]; cells: Map<string, Cell> }>;
  oldAggCache: Map<string, Map<string, OldAgg>>;
  cellsCache: Map<string, Awaited<ReturnType<typeof cellsOfRound>>>;
  stats: {
    taskMaterializations: number;
    approvalMaterializations: number;
    datasetNormalizations: number;
    buildCellsCalculations: number;
    oldAggCalculations: number;
    cellsCalculations: number;
  };
};

export type ActionCheckTaskSources = {
  baseTasks: Row[];
  allTasks: Row[];
  roundRows: Row[];
  judgeRows: Row[];
};

const actionContextKey = (...parts: unknown[]) => parts.map((v) => Array.isArray(v) ? v.join(";") : String(v ?? "")).join("|");

/**
 * `/actions` 전용 preload. 서로 독립적인 기초 READ를 병렬로 끝낸 뒤 이후 회차 계산은
 * 이 context의 Map/Set만 사용한다. context는 호출 request를 벗어나 저장되지 않는다.
 */
export async function createActionCheckReadContext(
  preloaded?: Promise<ActionCheckTaskSources>,
): Promise<ActionCheckReadContext> {
  return withReadOperation("actionCheckContext", {}, async () => {
    const taskSources = preloaded || (async () => {
      const [baseTasks, mergedTasks, roundRows, judgeRows] = await Promise.all([
        tasks({ limit: 100000 }), allTasks(), readTable("usf_round", "round_id"), readTable("usf_judge", "judge_id"),
      ]);
      return { baseTasks, allTasks: mergedTasks, roundRows, judgeRows };
    })();
    const [{ baseTasks, allTasks: all, roundRows, judgeRows }, [hist, acts, staffRows, evidenceRows, notifications, ws, fc, mt]] = await Promise.all([
      taskSources,
      Promise.all([
        inspectionsByTask(), actionsByInsp(), staff(), evidences(), readTable("notification", "notif_id"),
        readTable(REC_TABLE.ws, "rec_id"), readTable(REC_TABLE.fc, "rec_id"), readTable(REC_TABLE.mt, "rec_id"),
      ]),
    ]);

    const staffName = new Map<string, string>();
    const staffDept = new Map<string, string>();
    for (const s of staffRows) {
      staffName.set(String(s.staff_id), String(s.display_name || ""));
      staffDept.set(String(s.staff_id), String(s.dept_id || ""));
    }

    const evidenceByTask = new Map<string, Row>();
    for (const e of evidenceRows) {
      const cur = evidenceByTask.get(String(e.task_id));
      if (!cur || String(e.uploaded_at) > String(cur.uploaded_at)) evidenceByTask.set(String(e.task_id), e);
    }

    const indexTasks = (rows: Row[]) => {
      const index = new Map<string, Row[]>();
      for (const task of rows) {
        const key = actionContextKey(task.area, task.dept_id, firstCode(task.code36));
        const list = index.get(key);
        if (list) list.push(task); else index.set(key, [task]);
      }
      return index;
    };
    const baseTasksByAreaDeptCode = indexTasks(baseTasks);
    const approvedTasksByAreaDeptCode = indexTasks(all);
    const baseTaskOrder = new Map(baseTasks.map((task, index) => [task, index]));
    const approvedTaskOrder = new Map(all.map((task, index) => [task, index]));

    const recordsByTrackYearStepDept = new Map<string, Row[]>();
    const addRecords = (track: TrackKey, rows: Row[]) => {
      for (const r of rows) {
        if (r.deleted === "Y") continue;
        const dept = String(r.dept_id || r.dept || (r.role ? deptOf(r.role) : "")
          || staffDept.get(String(r.by || r.created_by || r.saved_by || r.written_by)) || "");
        const normalized = { ...r, _dept: dept };
        const key = actionContextKey(track, r.year || "", recStep(r), dept);
        const list = recordsByTrackYearStepDept.get(key);
        if (list) list.push(normalized); else recordsByTrackYearStepDept.set(key, [normalized]);
      }
    };
    addRecords("ws", ws); addRecords("fc", fc); addRecords("mt", mt);

    const roundsByTrack = new Map<TrackKey, Row[]>();
    for (const track of ["ws", "fc", "mt"] as TrackKey[]) {
      roundsByTrack.set(track, roundRows.filter((r) => r.track === track)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    }

    const judgesNewest = [...judgeRows].sort((a, b) => String(b.judged_at).localeCompare(String(a.judged_at)));
    const judgesByRound = new Map<string, Map<string, Row>>();
    for (const j of judgesNewest) {
      const roundId = String(j.round_id);
      let byCell = judgesByRound.get(roundId);
      if (!byCell) { byCell = new Map(); judgesByRound.set(roundId, byCell); }
      const key = `${j.item_key}|${j.dept_id}`;
      if (!byCell.has(key)) byCell.set(key, j);
    }

    return {
      baseTasks, allTasks: all, inspectionsByTask: hist, actionsByInspection: acts, staffRows, staffName, staffDept,
      evidenceByTask, baseTasksByAreaDeptCode, approvedTasksByAreaDeptCode, baseTaskOrder, approvedTaskOrder,
      recordsByTrackYearStepDept, roundsByTrack, judgesByRound,
      judgesNewest, notifications,
      buildCellsCache: new Map(), oldAggCache: new Map(), cellsCache: new Map(),
      stats: {
        taskMaterializations: 1, approvalMaterializations: 1, datasetNormalizations: 1,
        buildCellsCalculations: 0, oldAggCalculations: 0, cellsCalculations: 0,
      },
    };
  }, { work: { normalization: 1, merge: 9 } });
}

function taskRowsFromContext(
  ctx: ActionCheckReadContext, area: string, dept: string, codes: string[], approved: boolean,
): Row[] {
  const out: Row[] = [];
  const index = approved ? ctx.approvedTasksByAreaDeptCode : ctx.baseTasksByAreaDeptCode;
  for (const code of codes) out.push(...(index.get(actionContextKey(area, dept, code)) || []));
  const order = approved ? ctx.approvedTaskOrder : ctx.baseTaskOrder;
  return out.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

async function buildCellsFromContext(
  t: TrackKey, deptIds: string[], itemKeys: string[], year: string, ctx: ActionCheckReadContext,
): Promise<{ items: Item[]; cells: Map<string, Cell> }> {
  const cacheKey = actionContextKey(t, deptIds, itemKeys, year);
  const cached = ctx.buildCellsCache.get(cacheKey);
  if (cached) return cached;
  ctx.stats.buildCellsCalculations++;

  const area = trackOf(t).area;
  const today = ymd();
  const items = itemsOf(t).filter((i) => itemKeys.includes(i.key));
  const cells = new Map<string, Cell>();
  for (const it of items) {
    for (const d of deptIds) {
      let proposed: St = "해당없음", basis = "", date = "", evName = "", evUrl = "";
      let src: Src = "none";
      const rs = [
        ...(ctx.recordsByTrackYearStepDept.get(actionContextKey(t, year, it.key, d)) || []),
        ...(ctx.recordsByTrackYearStepDept.get(actionContextKey(t, "", it.key, d)) || []),
      ].sort((a, b) => recDate(b).localeCompare(recDate(a)));
      if (rs.length) {
        const withEv = rs.filter((r) => recEvName(r) || recEvUrl(r));
        const allDone = rs.every((r) => !r.status || r.status === "이행완료");
        const allNot = rs.every((r) => r.status === "미이행");
        const top = withEv[0] || rs[0];
        proposed = allNot ? "미이행" : allDone && withEv.length === rs.length ? "이행완료" : "보완필요";
        basis = `의무이행 기록 ${rs.length}건${withEv.length < rs.length ? ` · 증빙 없음 ${rs.length - withEv.length}` : ""}`;
        src = "record";
        date = recDate(top); evName = recEvName(top); evUrl = recEvUrl(top);
        const more = recFiles(top).length - 1;
        if (more > 0) evName = `${evName} 외 ${more}`;
      } else {
        const ts = taskRowsFromContext(ctx, area, d, it.codes, false);
        const isDone = (x: Row) => x.status === "이행완료" || x.status === "점검완료";
        const due = ts.filter((x) => isDone(x) || String(x.due_date || "") <= today || x.status === "기간초과" || x.status === "조치필요");
        const done = due.filter(isDone);
        if (!ts.length) basis = "배정된 과제 없음";
        else if (!due.length) basis = `기한 도래 전 과제 ${ts.length}건`;
        else {
          const fix = due.some((x) => x.status === "조치필요");
          proposed = done.length === due.length && !fix ? "이행완료" : done.length > 0 || fix ? "보완필요" : "미이행";
          basis = `과제 이행 ${done.length}/${due.length}건`;
          src = "task";
        }
        date = done.map((x) => String(x.done_at || "")).filter(Boolean).sort().pop() || "";
        const e = ts.map((x) => ctx.evidenceByTask.get(String(x.task_id))).filter(Boolean)
          .sort((a, b) => String(b!.uploaded_at).localeCompare(String(a!.uploaded_at)))[0];
        if (e) { evName = String(e.file_name || ""); evUrl = String(e.file_url || ""); }
      }
      cells.set(`${it.key}|${d}`, {
        item: it.key, dept: d, proposed, basis, date, evName, evUrl,
        judged: null, status: proposed, comment: "", src, old: null, inherited: null,
      });
    }
  }
  const result = { items, cells };
  ctx.buildCellsCache.set(cacheKey, result);
  return result;
}

export async function buildCells(t: TrackKey, deptIds: string[], itemKeys: string[], year = ymd().slice(0, 4)) {
  return withReadOperation("buildCells", { t, deptIds, itemKeys, year }, async () => {
  const area = trackOf(t).area;
  const today = ymd();
  const items = itemsOf(t).filter((i) => itemKeys.includes(i.key));
  const all = (await tasks({ limit: 100000 })).filter((x) => x.area === area && deptIds.includes(x.dept_id));
  const ev = await evidences();
  const evBy = new Map<string, Row>();
  for (const e of ev) {
    const cur = evBy.get(e.task_id);
    if (!cur || String(e.uploaded_at) > String(cur.uploaded_at)) evBy.set(e.task_id, e);
  }
  // 의무이행 기록 — 부서는 dept_id → 역할 → 적은 사람의 부서 순으로 찾는다
  const st = await staff();
  const staffDept = new Map(st.map((s: Row) => [s.staff_id, s.dept_id]));
  const recs: Row[] = (await readTable(REC_TABLE[t], "rec_id")).filter((r) => r.deleted !== "Y" && (!r.year || String(r.year) === year)).map((r) => ({
    ...r,
    _dept: String(r.dept_id || r.dept || (r.role ? deptOf(r.role) : "") || staffDept.get(r.by || r.created_by || r.saved_by || r.written_by) || ""),
  }));

  const cells = new Map<string, Cell>();
  for (const it of items) {
    for (const d of deptIds) {
      let proposed: St = "해당없음", basis = "", date = "", evName = "", evUrl = "";
      let src: Src = "none";   // 09-26 사용자: 옛 점검 화면 합치기 — 근거 표시
      const rs = recs.filter((r) => recStep(r) === it.key && r._dept === d)
        .sort((a, b) => recDate(b).localeCompare(recDate(a)));
      if (rs.length) {
        // 기록이 있으면 기록으로 — 전부 이행완료·증빙 있음 = 이행완료, 미이행 표시만 있으면 미이행, 그 밖 = 보완필요
        const withEv = rs.filter((r) => recEvName(r) || recEvUrl(r));
        const allDone = rs.every((r) => !r.status || r.status === "이행완료");
        const allNot = rs.every((r) => r.status === "미이행");
        const top = withEv[0] || rs[0];
        proposed = allNot ? "미이행" : allDone && withEv.length === rs.length ? "이행완료" : "보완필요";
        basis = `의무이행 기록 ${rs.length}건${withEv.length < rs.length ? ` · 증빙 없음 ${rs.length - withEv.length}` : ""}`;
        src = "record";
        date = recDate(top); evName = recEvName(top); evUrl = recEvUrl(top);
        const more = recFiles(top).length - 1;
        if (more > 0) evName = `${evName} 외 ${more}`;
      } else {
        // 09-26 사용자: 옛 점검 화면 합치기 — 항목의 코드 전부(itemsOf codes)로 과제를 모은다(이행현황표와 같은 묶음)
        const ts = all.filter((x) => x.dept_id === d && it.codes.includes(firstCode(x.code36)));
        const isDone = (x: Row) => x.status === "이행완료" || x.status === "점검완료";
        const due = ts.filter((x) => isDone(x) || String(x.due_date || "") <= today || x.status === "기간초과" || x.status === "조치필요");
        const done = due.filter(isDone);
        if (!ts.length) basis = "배정된 과제 없음";
        else if (!due.length) basis = `기한 도래 전 과제 ${ts.length}건`;
        else {
          const fix = due.some((x) => x.status === "조치필요");
          proposed = done.length === due.length && !fix ? "이행완료" : done.length > 0 || fix ? "보완필요" : "미이행";
          basis = `과제 이행 ${done.length}/${due.length}건`;
          src = "task";
        }
        const lastDone = done.map((x) => String(x.done_at || "")).filter(Boolean).sort().pop() || "";
        date = lastDone;
        const e = ts.map((x) => evBy.get(x.task_id)).filter(Boolean)
          .sort((a, b) => String(b!.uploaded_at).localeCompare(String(a!.uploaded_at)))[0];
        if (e) { evName = String(e.file_name || ""); evUrl = String(e.file_url || ""); }
      }
      cells.set(`${it.key}|${d}`, {
        item: it.key, dept: d, proposed, basis, date, evName, evUrl,
        judged: null, status: proposed, comment: "", src, old: null, inherited: null,
      });
    }
  }
  return { items, cells };
  }, { memo: true, work: { normalization: 1, filter: 4 + itemKeys.length * deptIds.length * 4, sort: itemKeys.length * deptIds.length * 3, merge: 3 } });
}

/** 판정을 겹친 칸. */
// 09-26 사용자: 옛 점검 화면 합치기 — ① 이행점검 판정 > ② 과제 판정 모음 > ③·④ 자료 기준(위 규칙). 칸마다 판정 하나.
export async function cellsOfRound(t: TrackKey, round: Row) {
  return withReadOperation("cellsOfRound", { t, roundId: round.round_id }, async () => {
  const deptIds = splitIds(round.dept_ids), itemKeys = splitIds(round.item_keys);
  const { items, cells } = await buildCells(t, deptIds, itemKeys, String(round.created_at || "").slice(0, 4) || undefined);
  const per = periodOfRound(round);
  const olds = await oldAggOf(t, deptIds, itemKeys, per.year, per.half);
  for (const [k, c] of cells) {
    const o = olds.get(k) || null;
    c.old = o;
    if (o && o.value) {
      c.proposed = o.value; c.status = o.value; c.src = "old";
      c.basis = `과제 결재 기록 ${o.text}`;   // 09-26 사용자: 이름 「과제 판정」 → 「과제 결재 기록」
      if (!c.date) c.date = o.rows[0]?.date || "";
    }
  }
  const jm = await judgesOf(round.round_id);
  // 09-26 사용자: 옛 점검 화면 합치기 2차 — 「물려받게 하자」. 이 회차에 판정이 없는 칸은 지난 회차의 가장 최근 판정을 물려받는다.
  const inh = INHERIT_ON ? await inheritedJudges(t, round) : new Map<string, { j: Row; r: Row }>();
  for (const [k, c] of cells) {
    const own = jm.get(k);
    const hit = own ? null : inh.get(k);
    const j = own || hit?.j;
    if (j) {
      c.judged = j; c.status = (ST_LIST as readonly string[]).includes(j.status) ? (j.status as St) : c.proposed;
      c.comment = String(j.comment || ""); c.src = "judge";
      if (hit) c.inherited = { round_id: String(hit.r.round_id), title: String(hit.r.title || ""), at: String(j.judged_at || "") };
    }
  }
  return { items, deptIds, cells, period: per };
  }, { memo: true, work: { merge: 4 } });
}

/** `/actions` request context를 사용하는 회차 계산. 기초 dataset은 다시 읽거나 정규화하지 않는다. */
export async function cellsOfRoundFromContext(t: TrackKey, round: Row, ctx: ActionCheckReadContext) {
  const cached = ctx.cellsCache.get(String(round.round_id));
  if (cached) return cached;
  ctx.stats.cellsCalculations++;

  const deptIds = splitIds(round.dept_ids), itemKeys = splitIds(round.item_keys);
  const year = String(round.created_at || "").slice(0, 4) || ymd().slice(0, 4);
  const base = await buildCellsFromContext(t, deptIds, itemKeys, year, ctx);
  const cells = new Map<string, Cell>([...base.cells].map(([key, cell]) => [key, { ...cell }]));
  const per = periodOfRound(round);
  const olds = await oldAggFromContext(t, deptIds, itemKeys, per.year, per.half, ctx);
  for (const [k, c] of cells) {
    const o = olds.get(k) || null;
    c.old = o;
    if (o && o.value) {
      c.proposed = o.value; c.status = o.value; c.src = "old";
      c.basis = `과제 결재 기록 ${o.text}`;
      if (!c.date) c.date = o.rows[0]?.date || "";
    }
  }
  const jm = ctx.judgesByRound.get(String(round.round_id)) || new Map<string, Row>();
  const inh = INHERIT_ON ? inheritedJudgesFromContext(t, round, ctx) : new Map<string, { j: Row; r: Row }>();
  for (const [k, c] of cells) {
    const own = jm.get(k);
    const hit = own ? null : inh.get(k);
    const j = own || hit?.j;
    if (j) {
      c.judged = j; c.status = (ST_LIST as readonly string[]).includes(j.status) ? (j.status as St) : c.proposed;
      c.comment = String(j.comment || ""); c.src = "judge";
      if (hit) c.inherited = { round_id: String(hit.r.round_id), title: String(hit.r.title || ""), at: String(j.judged_at || "") };
    }
  }
  const result = { items: base.items, deptIds, cells, period: per };
  ctx.cellsCache.set(String(round.round_id), result);
  return result;
}

/* ── 09-26 사용자: 옛 점검 화면 합치기 2차 — 지난 회차 판정 물려받기 ─────────────────────
 * 새 회차를 열면 같은 대상·항목·부서의 **가장 최근 회차 판정**이 초깃값으로 보인다(「지난 회차에서 물려받음」 표시).
 * 사람이 이 회차에서 판정을 저장하면 그 판정이 이긴다(이 회차 판정이 먼저).
 * · usf_judge 에 새로 쓰지 않고 **읽을 때 채운다.** 이유: 물려받은 줄을 새로 쓰면 판정 시각이 오늘로 바뀌어
 *   이행현황표(lib/us/links.ts judgeMap — 가장 최근 판정)와 「항목 판정으로 승인」(판정일 ≥ 제출일)이 옛 판정을 새 판정으로 잘못 읽는다.
 *   원래 판정 줄(누가·언제)이 그대로 근거로 남는다.
 * · 이 회차보다 **먼저 만든** 회차만 본다. INHERIT_SAME_PERIOD = true 면 **같은 연도·반기** 회차에서만 물려받는다 —
 *   반기마다 다시 점검해야 하는 항목(중대재해처벌법 시행령 제4조제3호 등 반기 1회 이상)이 지난 반기 판정으로 채워져 보이지 않게.
 */
export const INHERIT_ON = true;
export const INHERIT_SAME_PERIOD = true;
async function inheritedJudges(t: TrackKey, round: Row): Promise<Map<string, { j: Row; r: Row }>> {
  const per = periodOfRound(round);
  const at = String(round.created_at || "");
  const prev = (await roundsOf(t)).filter((r) => r.round_id !== round.round_id && String(r.created_at || "") < at
    && (!INHERIT_SAME_PERIOD || (periodOfRound(r).year === per.year && periodOfRound(r).half === per.half)));
  const byId = new Map(prev.map((r) => [r.round_id, r]));
  const rows = (await readTable("usf_judge", "judge_id")).filter((j) => byId.has(j.round_id))
    .sort((a, b) => String(b.judged_at).localeCompare(String(a.judged_at)));
  const m = new Map<string, { j: Row; r: Row }>();
  for (const j of rows) { const k = `${j.item_key}|${j.dept_id}`; if (!m.has(k)) m.set(k, { j, r: byId.get(j.round_id)! }); }
  return m;
}

function inheritedJudgesFromContext(t: TrackKey, round: Row, ctx: ActionCheckReadContext): Map<string, { j: Row; r: Row }> {
  const per = periodOfRound(round);
  const at = String(round.created_at || "");
  const prev = (ctx.roundsByTrack.get(t) || []).filter((r) => r.round_id !== round.round_id && String(r.created_at || "") < at
    && (!INHERIT_SAME_PERIOD || (periodOfRound(r).year === per.year && periodOfRound(r).half === per.half)));
  const byId = new Map(prev.map((r) => [String(r.round_id), r]));
  const out = new Map<string, { j: Row; r: Row }>();
  for (const j of ctx.judgesNewest) {
    const prior = byId.get(String(j.round_id));
    if (!prior) continue;
    const key = `${j.item_key}|${j.dept_id}`;
    if (!out.has(key)) out.set(key, { j, r: prior });
  }
  return out;
}

/* ── 09-26 사용자: 옛 점검 화면 합치기 2차 — 과제 단위 이행률(이행현황표와 같은 계산) ─────────
 * 「과제 단위 이행율까지 보여줘 보자」. app/status/_lib/calc.ts buildBoard 를 그대로 불러 부서별 이행률을 낸다(대상 전체 점검사항 · 그 해).
 * 칸 단위(이 화면의 rateOf) = 칸(부서 × 항목) 하나를 한 번 센다 — 칸 안 과제가 하나라도 미흡하면 그 칸은 이행완료가 아니다.
 * 과제 단위 = 과제(의무 × 시설 × 기간) 하나하나를 센다 — 이행 시기 전(예정) 과제는 뺀다. 소수 첫째 자리에서 버린다.
 */
export const RATE_NOTE = "칸 단위 = 항목 하나를 한 칸으로 셉니다(칸 안 과제가 하나라도 미흡하면 그 칸은 이행완료가 아닙니다). 과제 단위 = 이행현황표와 같이 과제 하나하나를 셉니다(이행 시기 전 과제는 뺍니다).";
export async function taskRatesOf(t: TrackKey, deptIds: string[], year: string): Promise<{ byDept: Map<string, string>; total: string }> {
  const b = await buildBoard(t, year, [1, 2, 3, 4], deptIds.map((d) => ({ dept_id: d })));
  const f = (p: number | null | undefined) => (p === null || p === undefined ? "-" : `${floor1(p).toFixed(1)}%`);
  return { byDept: new Map(deptIds.map((d, i) => [d, f(b.colRate[i])])), total: f(b.total) };
}
/** 칸 단위 전체 이행률(이 회차 칸 전부). */
export function cellRateAll(cells: Map<string, Cell>, deptIds: string[], itemKeys: string[]): string {
  const sts: St[] = [];
  for (const d of deptIds) for (const k of itemKeys) sts.push(cells.get(`${k}|${d}`)?.status || "해당없음");
  return rateOf(sts);
}

/** 09-26 사용자: 옛 점검 화면 합치기 — 이 회차 부서·기간의 과제 판정 중 어느 항목에도 들지 않는 의무조항의 것(화면 끝에 따로 보인다). */
export async function oldOutside(t: TrackKey, round: Row): Promise<OldRow[]> {
  const area = trackOf(t).area;
  const deptIds = splitIds(round.dept_ids);
  const per = periodOfRound(round);
  const inItem = new Set(itemsOf(t).flatMap((i) => i.codes));
  const [all, hist] = await Promise.all([allTasks(), inspectionsByTask()]);
  const out: OldRow[] = [];
  for (const x of all) {
    if (x.area !== area || !deptIds.includes(x.dept_id) || inItem.has(firstCode(x.code36)) || !taskInPeriod(x, per.year, per.half)) continue;
    const h = hist.get(x.task_id) || [];
    if (!h.length) continue;
    const last = h[0];
    out.push({
      task_id: x.task_id, dept_id: x.dept_id, code: firstCode(x.code36),
      duty: String(x.duty_name || x.article_title || x.code36_name || ""), target: String(x.asset_name || x.target_name || ""),
      result: String(last.result || ""), round_no: Number(last.round_no || h.length), date: String(last.insp_date || ""),
      finding: String(last.finding || ""), inspector: String(last.inspector_staff_id || ""), state: stateOf(x, h), actionState: "",
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** 이행률 = 이행완료 ÷ (전체 − 해당없음). 참고 명세 관측치(88.8%·77.7%)대로 소수 첫째 자리에서 버린다. */
export function rateOf(sts: St[]): string {
  const base = sts.filter((s) => s !== "해당없음").length;
  if (!base) return "-";
  const o = sts.filter((s) => s === "이행완료").length;
  return `${floor1((o / base) * 100).toFixed(1)}%`; // 09-25 사용자: 이행률 소수점은 버림
}

export const newId = (p: string) =>
  `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

/** 저장된 시각(ISO · UTC 또는 +09:00) → 「YYYY-MM-DD HH:MM」(서버 지역 시각 = 한국 시각). */
export function fmtAt(v: any): string {
  const s = String(v || "");
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(+d)) return s.slice(0, 16).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ymd(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** 반기 이름 — 1~6월 상반기 · 7~12월 하반기. */
export const halfOf = (d = new Date()) => (d.getMonth() < 6 ? "상반기" : "하반기");

/* ── 09-26 사용자: 옛 점검 화면 합치기 — 옛 점검 회차(과제 단위 · inspection_batch)를 이 대상 화면에서 읽기 ── */
export type OldBatch = {
  batch: Row; cycle: Cycle;
  /** 이 대상(재해 구분)에 드는 과제만 센 숫자 */
  n: { total: number; ok: number; fix: number; bad: number; wait: number; open: number; unsub: number };
  codes: string[];
};
/** 이 대상(재해 구분)의 의무조항이 든 옛 점검 회차 — 최근 것이 앞. */
export async function oldBatchesOf(t: TrackKey): Promise<OldBatch[]> {
  const area = trackOf(t).area;
  const cycles = await loadAllCycles();
  const out: OldBatch[] = [];
  for (const c of cycles) {
    const b = c.batch;
    if (!b) continue;
    const codes = splitList(b.code36_list).filter((x) => x.startsWith(area));
    if (!codes.length) continue;
    const rows = c.rows.filter((r) => r.area === area);
    const res = (r: string) => rows.filter((x) => (x.state === "적합" || x.state === "조치중") && (x.last?.result || (x.state === "적합" ? "적합" : "보완필요")) === r).length;
    out.push({
      batch: b, cycle: c, codes,
      n: {
        total: rows.length, ok: rows.filter((x) => x.state === "적합").length, fix: res("보완필요"), bad: res("부적합"),
        wait: rows.filter((x) => x.state === "판정대기").length, open: rows.filter((x) => x.state === "조치중").length,
        unsub: rows.filter((x) => x.state === "미제출").length,
      },
    });
  }
  return out.sort((a, b) => String(b.batch.batch_id).localeCompare(String(a.batch.batch_id)));
}

/**
 * 법정 점검 주기 — 항목마다 이 기간에 결재까지 끝난 점검이 있는가(옛 점검 계획의 「점검 주기」를 이 화면으로).
 * 이행점검 회차(usf_round · 그 항목을 넣고 결재완료)와 옛 점검 회차(inspection_batch · 그 코드를 넣고 결재완료)를 **둘 다** 센다.
 * 주기는 lib/cycle.ts CODE_CYCLE(중대재해처벌법 시행령 원문 확인) 그대로 — 항목의 대표 코드(code36)로 본다.
 */
export type PeriodCheck = {
  item: Item; cycle: string; basis: string; period: string; due: string;
  state: "충족" | "진행 중" | "없음" | "주기 없음"; by: string;
};
export async function periodChecks(t: TrackKey, year = ymd().slice(0, 4), half = halfOf()): Promise<PeriodCheck[]> {
  const rounds = (await roundsOf(t)).map((r) => ({ r, p: periodOfRound(r) }));
  const olds = await oldBatchesOf(t);
  return itemsOf(t).map((it) => {
    const cc = codeCycle(it.code36);
    if (cc.cycle === "상시") return { item: it, cycle: CYCLE_LABEL.상시, basis: cc.basis, period: "", due: "", state: "주기 없음", by: "" };
    const isHalf = cc.cycle === "반기";
    const inP = (y: string, h: string) => y === year && (!isHalf || !h || h === half);
    const rs = rounds.filter((x) => inP(x.p.year, x.p.half) && splitIds(x.r.item_keys).includes(it.key));
    const bs = olds.filter((o) => inP(String(o.batch.period_year), String(o.batch.half_year || "")) && it.codes.some((c) => o.codes.includes(c)));
    const done = [...rs.filter((x) => x.r.status === "결재완료").map((x) => String(x.r.title)), ...bs.filter((o) => o.batch.status === "결재완료").map((o) => String(o.batch.title))];
    const open = [...rs.filter((x) => x.r.status !== "결재완료").map((x) => String(x.r.title)), ...bs.filter((o) => o.batch.status !== "결재완료").map((o) => String(o.batch.title))];
    return {
      item: it, cycle: CYCLE_LABEL[cc.cycle], basis: cc.basis,
      period: isHalf ? `${year}년 ${half}` : `${year}년`, due: isHalf ? halfEnd(year, half) : `${year}-12-31`,
      state: done.length ? "충족" : open.length ? "진행 중" : "없음",
      by: done[0] || open[0] || "",
    };
  });
}
