/**
 * 09-26 사용자: 옛 점검 화면 합치기 — 「옛 점검화면 합치자.」
 *
 * 이행점검(항목 단위 · usf_round·usf_judge)과 옛 과제 단위 점검(inspection_batch·inspection·action)을
 * **하나의 이행점검 흐름**으로 보이게 하는 읽기 도움. 자료는 옮기지도 지우지도 않는다(읽을 때 합친다).
 * 칸 판정 규칙(한 대상·한 항목 판정 하나)은 app/check/_lib.ts 한 곳에 있다 — 여기서는 그것을 부른다.
 *
 *   · OLD_CHECK_MERGED — 되돌리기 스위치. false 로 바꾸면 /inspections·/review 가 옛 화면으로 다시 열리고,
 *     이행점검 첫 화면에 옛 점검으로 들어가는 줄(CheckOldLinks)이 다시 보인다.
 *   · oldTarget        — 옛 주소 → 합친 새 자리
 *   · checkFlagged     — /actions(미이행 조치·재점검)에 이행점검 판정의 보완필요·미이행을 한 목록으로 더하기
 *   · laterJudge       — 옛 과제 판정 뒤에 같은 부서·같은 항목에 내린 이행점검 판정(옛 조치가 그 판정으로 끝났는가)
 *   · roundsAsBatches  — 이행점검 회차를 옛 점검 회차 모양으로(연간 일정·체계 수립 현황이 두 회차를 함께 세도록 — 메인 채팅 요청용)
 */
import "server-only";
import { readTable, staff, tasks, approvals, type Row } from "@/lib/data";   // 09-26 사용자: 옛 점검 화면 합치기 2차 — tasks(항목 판정으로 승인)
import { withDbReadScope } from "@/lib/db";
import type { TrackKey } from "@/lib/us/tracks";
import { batchList } from "@/lib/cycle";
import {
  itemsOf, itemOfCode, roundsOf, cellsOfRound, periodOfRound, splitIds, NAME, type Item, type Cell, type St,
} from "@/app/check/_lib";

/** 되돌리기 스위치 — true = 합침(옛 주소는 새 자리로 넘긴다). */
export const OLD_CHECK_MERGED = true;

const AREA_TRACK: Record<string, TrackKey> = { I: "ws", F: "fc", M: "mt" };
export const trackOfCode = (code: string): TrackKey => AREA_TRACK[String(code || "").slice(0, 1)] || "ws";
/** 옛 점검 회차의 대표 대상 — 의무조항 코드 중 가장 많은 재해 구분(같으면 사업장 → 공중이용시설 → 원료·제조물). */
export function trackOfBatch(b?: Row | null): TrackKey | "" {
  if (!b) return "";
  const n: Record<string, number> = {};
  String(b.code36_list || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((c) => (n[c[0]] = (n[c[0]] || 0) + 1));
  const best = ["I", "F", "M"].sort((a, z) => (n[z] || 0) - (n[a] || 0))[0];
  return n[best] ? AREA_TRACK[best] : "";
}
const isTk = (v: any): v is TrackKey => v === "ws" || v === "fc" || v === "mt";

/**
 * 옛 주소 → 합친 새 자리. role 은 그대로 넘긴다.
 *   /inspections                 → 이행점검 › 대상 › 취합 대상 설정(#old-plan : 법정 점검 주기 · 취합 이력에 옛 회차)
 *   /inspections?view=approve&b= → 이행점검 › 대상 › 점검 총괄표(#old : 옛 회차 결재 기록)
 *   /review                      → 이행점검 › 대상 › 항목별 점검(항목마다 과제별 판정 세부)
 * 대상은 tk(몫 C 가 붙인 돌아갈 대상) → 회차 b 의 의무조항 → 사업장 순으로 정한다.
 */
export async function oldTarget(kind: "inspections" | "review", sp: Record<string, any>): Promise<string> {
  const role = String(sp.role || (kind === "review" ? "mgr" : "gm"));
  let tk: TrackKey = isTk(sp.tk) ? sp.tk : "ws";
  const b = String(sp.b || "");
  if (!isTk(sp.tk) && b) {
    const t = trackOfBatch((await batchList()).find((x) => x.batch_id === b));
    if (t) tk = t;
  }
  const q = `role=${encodeURIComponent(role)}${b ? `&b=${encodeURIComponent(b)}` : ""}`;
  if (kind === "review") return `/check/${tk}/review?${q}`;
  if (sp.view === "approve") return `/check/${tk}/summary?${q}#old`;
  return `/check/${tk}?${q}#old-plan`;
}

/* ── 이행점검 판정 — (항목|부서) 마다 올해 가장 최근 회차의 칸 ─────────────────── */
export type CheckFlag = {
  track: TrackKey; round: Row; item: Item; dept_id: string; cell: Cell;
  status: St; notified: boolean; href: string;
};

/**
 * /actions 한 목록에 더할 이행점검 칸 — 올해 회차 전부에서 (항목|부서) 마다 하나만 고른다.
 *   · 이행점검 판정(①)이 있으면 **가장 최근 판정**(어느 회차든 — 이행현황표 lib/us/links.ts judgeMap 과 같은 기준)이 보완필요·미이행인 칸
 *   · 판정이 없으면, 결재완료 회차(가장 최근)에서 자료 기준으로 보완필요·미이행이 된 칸(결재 때 조치 요구가 나간 칸)
 * 과제 판정(②)이 이긴 칸은 옛 목록에 과제 줄로 이미 있으므로 넣지 않는다(두 번 세지 않게).
 */
export async function checkFlagged(year: string, role: string): Promise<CheckFlag[]> {
  return withDbReadScope("checkFlagged", () => checkFlaggedInner(year, role));
}

async function checkFlaggedInner(year: string, role: string): Promise<CheckFlag[]> {
  const notif = (await readTable("notification", "notif_id")).filter((n) => n.note === "이행점검" && n.notif_type === "조치요구");
  const st = await staff();
  const owner = (d: string) => (st.find((s: Row) => s.dept_id === d && s.duty_role === "정담당") || st.find((s: Row) => s.dept_id === d))?.staff_id || "";
  const out: CheckFlag[] = [];
  for (const t of ["ws", "fc", "mt"] as TrackKey[]) {
    const rounds = (await roundsOf(t)).filter((r) => periodOfRound(r).year === year);   // 최근 것이 앞
    const judged = new Map<string, { r: Row; c: Cell; items: Item[] }>();
    const approved = new Map<string, { r: Row; c: Cell; items: Item[] }>();
    for (const r of rounds) {
      const { items, cells } = await cellsOfRound(t, r);
      for (const [k, c] of cells) {
        if (c.judged) {
          const cur = judged.get(k);
          if (!cur || String(c.judged.judged_at) > String(cur.c.judged?.judged_at)) judged.set(k, { r, c, items });
        } else if (r.status === "결재완료" && !approved.has(k)) approved.set(k, { r, c, items });
      }
    }
    const pick = new Map(approved);
    for (const [k, v] of judged) pick.set(k, v);
    for (const { r, c, items } of pick.values()) {
      if (c.status !== "보완필요" && c.status !== "미이행") continue;
      if (c.src === "old") continue;
      const it = items.find((i) => i.key === c.item)!;
      const to = owner(c.dept);
      // 09-26: 물려받은 칸은 원래 판정을 내린 회차에서 조치 요구가 나갔다 — 그 회차로도 찾는다
      const rids = new Set([r.round_id, c.inherited?.round_id].filter(Boolean) as string[]);
      const notified = notif.some((n) => rids.has(String(n.batch_id)) && (!to || n.to_staff_id === to) && String(n.message || "").includes(it.label));
      out.push({
        track: t, round: r, item: it, dept_id: c.dept, cell: c, status: c.status, notified,
        href: `/check/${t}/review?role=${role}&r=${r.round_id}&open=${it.key}#${it.key}`,
      });
    }
  }
  return out;
}

/**
 * 옛 과제 판정 뒤에 같은 부서·같은 항목에 내린 이행점검 판정(가장 최근). 없으면 null.
 * 옛 조치(보완 제출 → 재점검)는 이제 과제 판정이 아니라 이행점검 판정으로 닫힌다 — 그 판정이 「이행완료」면 끝난 것으로 본다.
 */
export async function laterJudgeIndex() {
  const judges = (await readTable("usf_judge", "judge_id")).sort((a, b) => String(b.judged_at).localeCompare(String(a.judged_at)));
  return (dept: string, code: string, after: string): Row | null => {
    const t = trackOfCode(code);
    const it = itemOfCode(t, code);
    if (!it) return null;
    return judges.find((j) => j.track === t && j.item_key === it.key && j.dept_id === dept && String(j.judged_at || "").slice(0, 10) >= String(after || "").slice(0, 10)) || null;
  };
}

/** 과제의 의무조항 → 합친 항목별 점검 화면(그 항목을 펼친 자리). */
export function reviewHrefOfCode(code: string, role: string): string {
  const t = trackOfCode(code);
  const it = itemOfCode(t, code);
  return `/check/${t}/review?role=${role}${it ? `&open=${it.key}#${it.key}` : ""}`;
}

/**
 * 이행점검 회차를 옛 점검 회차(inspection_batch) 모양으로 — period_year·half_year·code36_list·status.
 * 연간 일정(app/calendar)·체계 수립 현황(lib/system.ts)·경영책임자 보고(app/exec)가 옛 회차만 세고 있어,
 * 합친 뒤 새로 여는 이행점검 회차가 법정 점검 주기 충족에 안 잡힌다. 메인 채팅이 거기에 이것을 더하면 된다(요청).
 */
export async function roundsAsBatches(): Promise<Row[]> {
  const out: Row[] = [];
  for (const t of ["ws", "fc", "mt"] as TrackKey[]) {
    const items = itemsOf(t);
    for (const r of await roundsOf(t)) {
      const p = periodOfRound(r);
      const keys = splitIds(r.item_keys);
      out.push({
        batch_id: r.round_id, title: r.title, period_year: p.year, half_year: p.half,
        code36_list: items.filter((i) => keys.includes(i.key)).flatMap((i) => i.codes).join(","),
        target_dept_ids: splitIds(r.dept_ids).join(","), status: r.status, approved_at: r.approved_at || "",
        started_at: String(r.created_at || "").slice(0, 10), from: "이행점검", track: t, track_name: NAME[t],
      });
    }
  }
  return out;
}


/**
 * 09-26 사용자: 옛 점검 화면 합치기 — 옛 점검 회차 + 이행점검 회차(옛 회차 모양)를 한 목록으로.
 * 연간 일정(법정 점검 주기)·원료·제조물 체계 수립 현황이 이것을 읽어, 앞으로 여는 이행점검 회차도 점검 주기 충족으로 센다.
 * 이행점검 회차 줄은 from = "이행점검", track = 대상(ws·fc·mt).
 */
export async function batchListWithRounds(): Promise<Row[]> {
  return [...(await batchList()), ...(await roundsAsBatches())];
}

/* ── 09-26 사용자: 옛 점검 화면 합치기 2차 — 「항목 판정으로 승인」(사용자 답 「그렇게 해」) ─────────────
 * 부서가 제출했지만 과제 판정 전인 과제(결재 층 approval_status = 제출)는, 그 과제가 속한 이행점검 항목의 판정이
 * 「이행완료」면 **승인된 것으로 읽는다.** 자료는 쓰지 않는다 — lib/data.ts approvals() 가 읽을 때 이것을 거친다.
 * 그래서 결재 층을 읽는 곳(이행현황·대시보드·처리 현황·증빙 결재·옛 회차 셈)이 모두 같은 값을 본다.
 *
 * 규칙
 *   · 항목 = 과제 의무조항 코드가 드는 이행점검 항목(app/check/_lib.ts itemsOf codes) · 부서 = 과제 배정 부서
 *   · 판정 = 그 대상·항목·부서의 이행점검 판정(usf_judge) 가운데 **과제 기간(연도·반기)과 같은 기간 회차**의 가장 최근 줄
 *            (과제에 반기가 없으면 그 해 두 반기 중 가장 최근). 물려받은 판정은 원래 줄이므로 따로 셀 것이 없다.
 *   · 그 판정이 「이행완료」이고, 판정일이 과제 제출일 이후(같은 날 포함)일 때만 — 판정 뒤에 제출한 과제는 그 판정이 보지 않았다.
 *   · 해당 여부 「비해당」 과제는 건드리지 않는다.
 * 읽은 값: approval_status 승인 · status 점검완료 · check_result 이행완료 · approved_at/by = 판정 시각·판정자 ·
 *          approved_via = 「항목 판정으로 승인」 · approved_round = 회차 이름 (화면이 근거로 보인다)
 * ITEM_APPROVAL_ON = false 로 끈다.
 */
export const ITEM_APPROVAL_ON = true;
export const ITEM_APPROVAL_LABEL = "항목 판정으로 승인";

export async function applyItemApproval(rows: Row[]): Promise<Row[]> {
  if (!ITEM_APPROVAL_ON || !rows.some((r) => r.approval_status === "제출")) return rows;
  const [tk, judges, rounds] = await Promise.all([
    tasks({ limit: 100000 }), readTable("usf_judge", "judge_id"), readTable("usf_round", "round_id"),
  ]);
  const info = new Map(tk.map((t) => [t.task_id, t]));
  const per = new Map(rounds.map((r) => [r.round_id, { ...periodOfRound(r), title: String(r.title || "") }]));
  const latest = new Map<string, Row>();   // 대상|항목|부서|연도|반기 → 가장 최근 판정
  for (const j of [...judges].sort((a, b) => String(b.judged_at).localeCompare(String(a.judged_at)))) {
    const p = per.get(j.round_id);
    if (!p) continue;
    const k = `${j.track}|${j.item_key}|${j.dept_id}|${p.year}|${p.half}`;
    if (!latest.has(k)) latest.set(k, j);
  }
  return rows.map((r) => {
    if (r.approval_status !== "제출") return r;
    const t = info.get(r.task_id);
    if (!t || t.applicability === "비해당") return r;
    // 09-26 사용자: 「부서장 확인이 있는 과제만 승인으로 보자」 — 부서장 확인(head_ok_at) 없는 제출 과제는 그대로 「제출」
    if (!r.head_ok_at) return r;
    const tr = AREA_TRACK[String(t.area || "")];
    if (!tr) return r;
    const it = itemOfCode(tr, String(t.code36 || ""));
    if (!it) return r;
    const y = String(r.period_year || String(t.due_date || "").slice(0, 4));
    const halves = r.half_year ? [String(r.half_year)] : ["상반기", "하반기"];
    const j = halves.map((h) => latest.get(`${tr}|${it.key}|${t.dept_id}|${y}|${h}`)).filter(Boolean)
      .sort((a, b) => String(b!.judged_at).localeCompare(String(a!.judged_at)))[0];
    if (!j || j.status !== "이행완료") return r;
    if (r.submitted_at && String(j.judged_at || "").slice(0, 10) < String(r.submitted_at).slice(0, 10)) return r;
    return {
      ...r, approval_status: "승인", status: "점검완료", check_result: "이행완료",
      approved_at: j.judged_at, approved_by: j.judged_by,
      approved_via: ITEM_APPROVAL_LABEL, approved_round: per.get(j.round_id)?.title || j.round_id,
    };
  });
}

/** 09-26 사용자: 옛 점검 화면 합치기 2차 — 이 대상·기간에서 「항목 판정으로 승인」으로 읽힌 과제 수(부서별). 항목별 점검 화면 표시용. */
export async function itemApprovedByDept(t: TrackKey, deptIds: string[], year: string, half: string): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!ITEM_APPROVAL_ON) return m;
  const via = (await approvals()).filter((a) => a.approved_via === ITEM_APPROVAL_LABEL
    && String(a.period_year || "") === year && (!half || !a.half_year || a.half_year === half));
  if (!via.length) return m;
  const info = new Map((await tasks({ limit: 100000 })).map((x) => [x.task_id, x]));
  for (const a of via) {
    const x = info.get(a.task_id);
    if (!x || AREA_TRACK[String(x.area || "")] !== t || !deptIds.includes(x.dept_id)) continue;
    m.set(x.dept_id, (m.get(x.dept_id) || 0) + 1);
  }
  return m;
}
