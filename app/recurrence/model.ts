/**
 * 재발방지·개선명령 — 읽기 모형 (2026-09-21)
 *
 * 법 제4조제1항제2호 · 제9조제1항·제2항 제2호 — 재해 발생 시 재발방지 대책의 수립 및 그 이행
 * 법 제4조제1항제3호 · 제9조제1항·제2항 제3호 — 중앙행정기관ㆍ지방자치단체가 명한 개선ㆍ시정 사항의 이행
 * (법 제4조제2항 · 제9조제4항은 제1호·제4호만 시행령에 맡긴다 — 제2호·제3호는 시행령 세부 기준이 없다.)
 *
 * 읽기는 공용 readTable 로만 한다(데이터 판 + 화면 입력분).
 *   incident            — 사고 1건 = 1행. 단계는 날짜 칸으로 판단한다(따로 상태 칸을 두지 않는다).
 *   order_received      — 명령 1건 = 1행.
 *   incident_nil_check  — 반기마다 부서가 「재해 발생 이력 없음」을 확인한 기록.
 */
import { readTable, staff as staffRows, depts as deptRows, assets as assetRows, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";

export const today = () => ymd();
export const addDays = (n: number, from = today()) => {
  const d = new Date(from + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((+new Date(b + "T00:00:00Z") - +new Date(a + "T00:00:00Z")) / 86400000);

/** 반기 — 「2026-H1」(1~6월) · 「2026-H2」(7~12월). */
export const halfOf = (d: string) => (d ? `${d.slice(0, 4)}-H${+d.slice(5, 7) <= 6 ? 1 : 2}` : "");
export const halfLabel = (h: string) => (h ? `${h.slice(0, 4)}년 ${h.endsWith("1") ? "상반기" : "하반기"}` : "");
export const prevHalf = (h: string) => {
  const y = +h.slice(0, 4);
  return h.endsWith("2") ? `${y}-H1` : `${y - 1}-H2`;
};

/* ── 재해 · 재발방지 ─────────────────────────────────────────── */

export const INC_STEPS = ["발생", "원인 조사", "대책 수립", "이행", "효과 확인"] as const;
export const INC_CLASSES = ["산업재해", "시민재해", "아차사고"] as const;
/** 화면 표시 — 데이터 값은 그대로(09-22 정정: 「시민재해」는 법령 용어가 아니다). */
export const INC_CLASS_LABEL: Record<string, string> = { 산업재해: "산업재해(종사자)", 시민재해: "공중이용시설·공중교통수단 등 이용자 피해 사고", 아차사고: "아차사고" };
export const incClassLabel = (c?: string) => (c ? INC_CLASS_LABEL[c] || c : "");
// 09-26 사용자: 재해유형 한 벌로 — 발생통계 원장 이름 기준(lib/acc_types.ts). 옛 값은 읽을 때 accType()으로 맞춘다.
export { ACC_TYPES as ACCIDENT_TYPES } from "@/lib/acc_types";
import { accType } from "@/lib/acc_types";

export type IncStep = {
  label: string; done: boolean; date?: string; by?: string; evidence?: string; url?: string /* [캡처 v2] K03 첨부 주소 */; due?: string; late?: boolean; note?: string;
};
export type IncView = Row & {
  steps: IncStep[];
  cur: number;            // 지금 해야 할 단계(1~4) · 5 = 끝남
  curLabel: string;
  due?: string; overdue: boolean; daysLeft?: number;
  prior: Row[];           // 같은 시설에서 먼저 난 사고
  repeat: Row[];          // 그중 같은 유형
  repeatAfterEffect: boolean; // 앞 사고의 효과 확인을 「유효」로 끝낸 뒤 같은 유형이 또 남
  half: string;
};

const baseType = (t?: string) => String(t || "").replace(/\(.*\)$/, "").trim();

function incView(r: Row, all: Row[], t: string): IncView {
  const late = (done?: string, due?: string) => Boolean(done && due && done > due);
  const steps: IncStep[] = [
    { label: "발생", done: true, date: r.occurred_at, by: r.reported_by },
    { label: "원인 조사", done: Boolean(r.investigated_at), date: r.investigated_at, by: r.investigated_by,
      evidence: r.cause_evidence, url: r.cause_evidence_url, due: r.cause_due, late: late(r.investigated_at, r.cause_due) },
    { label: "대책 수립", done: Boolean(r.plan_set_at), date: r.plan_set_at, by: r.plan_set_by,
      evidence: r.plan_evidence, url: r.plan_evidence_url, due: r.plan_set_due, late: late(r.plan_set_at, r.plan_set_due) },
    { label: "이행", done: Boolean(r.plan_done_at), date: r.plan_done_at, by: r.done_by,
      evidence: r.done_evidence || r.evidence_file, url: r.done_evidence_url, due: r.plan_due, late: late(r.plan_done_at, r.plan_due) },
    { label: "효과 확인", done: Boolean(r.effect_checked_at) && r.effect_result === "유효", date: r.effect_checked_at,
      by: r.effect_checked_by, evidence: r.effect_evidence, url: r.effect_evidence_url, due: r.effect_due, late: late(r.effect_checked_at, r.effect_due),
      note: r.effect_result },
  ];
  let cur = steps.findIndex((s) => !s.done);
  if (cur < 0) cur = 5;
  const due = cur < 5 ? steps[cur].due : undefined;
  const overdue = Boolean(due && due < t);
  const prior = r.asset_id
    ? all.filter((x) => x.incident_id !== r.incident_id && x.asset_id === r.asset_id && x.occurred_at < r.occurred_at)
    : [];
  const repeat = prior.filter((x) => baseType(x.accident_type) === baseType(r.accident_type));
  return {
    ...r, steps, cur, curLabel: cur < 5 ? INC_STEPS[cur] : "끝남",
    due, overdue, daysLeft: due ? daysBetween(t, due) : undefined,
    prior, repeat,
    repeatAfterEffect: repeat.some((x) => x.effect_result === "유효" && x.effect_checked_at && x.effect_checked_at < r.occurred_at),
    half: halfOf(r.occurred_at),
  };
}

/* ── 개선·시정명령 ─────────────────────────────────────────────── */

export const ORD_STEPS = ["접수", "담당 지정", "이행", "결과 보고", "종결"] as const;

/**
 * 명령의 재해 구분 — 어느 확보의무의 이행 기록인지 가른다(2026-09-21).
 *   산업 = 법 제4조제1항제3호 · 시민(시설·교통) = 법 제9조제2항제3호 · 원료·제조물 = 법 제9조제1항제3호
 * 옮겨 온 옛 행은 칸이 비어 있다 — 넘겨짚지 않고 「구분 전」으로 두고 대장에서 고르게 한다.
 */
export const ORD_AREAS = ["산업", "시민", "원료·제조물"] as const;
export const ORD_AREA_BASIS: Record<string, string> = {
  산업: "법 제4조제1항제3호", 시민: "법 제9조제2항제3호", "원료·제조물": "법 제9조제1항제3호",
};
export const ORD_AREA_LABEL: Record<string, string> = {
  산업: "중대산업재해", 시민: "중대시민재해(공중이용시설·공중교통수단)", "원료·제조물": "중대시민재해(원료·제조물)",
};
/**
 * 문서 성격 (2026-09-21) — 법 제4조제1항제3호의 「명한 사항」은 관계 법령에 따른 **서면 행정처분**만이다.
 * 행정지도·권고·조언은 들어가지 않는다(교육자료 p.71). 섞어 세면 대상이 부풀고, 서면 명령을 놓치면 이 호 위반이 된다.
 * 칸이 빈 옛 행은 넘겨짚어 빼지 않는다 — 「성격 확인 전」으로 두고 대장 수에는 넣는다(빠뜨리는 쪽보다 안전).
 */
export const ORD_NATURES = ["서면 행정처분", "지도·권고·조언"] as const;
export const isAdvice = (r: Row) => r.doc_nature === "지도·권고·조언";

export type OrdView = Row & {
  cur: number; curLabel: string;
  effDue: string; daysLeft: number; overdue: boolean; soon: boolean; lateDone: boolean;
};

function ordView(r: Row, t: string): OrdView {
  const done = [true, Boolean(r.owner_staff_id), Boolean(r.done_at), Boolean(r.reported_at), Boolean(r.closed_at)];
  let cur = done.findIndex((x) => !x);
  if (cur < 0) cur = 5;
  const effDue = r.extended_due || r.due_date || "";
  const daysLeft = effDue ? daysBetween(t, effDue) : 999;
  return {
    ...r, cur, curLabel: cur < 5 ? ORD_STEPS[cur] : "종결",
    effDue, daysLeft,
    overdue: !r.done_at && Boolean(effDue) && effDue < t,
    soon: !r.done_at && Boolean(effDue) && daysLeft >= 0 && daysLeft <= 7,
    lateDone: Boolean(r.done_at && effDue && r.done_at > effDue),
  };
}

/* ── 반기 「재해 발생 이력 없음」 확인 ─────────────────────────── */

export type NilCell = {
  period: string; dept_id: string;
  incs: IncView[];          // 그 반기 그 부서의 재해(아차사고는 빼고 센다)
  check?: Row;              // 가장 최근 확인
  state: "확인함" | "재해 있음" | "비어 있음" | "확인 뒤 발생" | "확인과 맞지 않음";
};

function nilCell(period: string, dept_id: string, incs: IncView[], checks: Row[]): NilCell {
  const mine = incs.filter((i) => i.half === period && i.dept_id === dept_id && i.event_class !== "아차사고");
  const check = checks.filter((c) => c.period === period && c.dept_id === dept_id)
    .sort((a, b) => String(b.confirmed_at).localeCompare(String(a.confirmed_at)))[0];
  let state: NilCell["state"];
  if (!mine.length) state = check ? "확인함" : "비어 있음";
  else if (!check) state = "재해 있음";
  else state = mine.some((i) => i.occurred_at <= check.confirmed_at) ? "확인과 맞지 않음" : "확인 뒤 발생";
  return { period, dept_id, incs: mine, check, state };
}

/* ── 한 번에 읽기 ─────────────────────────────────────────────── */

export async function loadRecurrence(deptScope = "") {
  const t = today();
  const [incRaw, ordRaw, nilRaw, st, dl, as] = await Promise.all([
    readTable("incident", "incident_id"),
    readTable("order_received", "order_id"),
    readTable("incident_nil_check", "nil_id"),
    staffRows(), deptRows(), assetRows({ limit: 5000 }),
  ]);
  const deptName = new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const staffName = new Map<string, string>(st.map((s: Row) => [s.staff_id, s.display_name]));
  const assetName = new Map<string, string>(as.map((a: Row) => [a.asset_id, a.asset_name]));

  const incAll = incRaw.filter((r) => r.incident_id && r.occurred_at).map((r) => ({ ...r, accident_type: accType(r.accident_type) }));
  let incs = incAll.map((r) => incView(r, incAll, t));
  let ordAll = ordRaw.filter((r) => r.order_id).map((r) => ordView(r, t));
  if (deptScope) {
    incs = incs.filter((r) => r.dept_id === deptScope);
    ordAll = ordAll.filter((r) => r.dept_id === deptScope);
  }
  // 대장(수·기한·할 일)은 서면 행정처분만 센다. 지도·권고·조언은 참고 기록으로 따로 둔다.
  const ords = ordAll.filter((r) => !isAdvice(r));
  const advice = ordAll.filter((r) => isAdvice(r));

  const curHalf = halfOf(t);
  const periods = [prevHalf(curHalf), curHalf];
  const nilDepts = dl.filter((d: Row) => /^D\d\d$/.test(d.dept_id) && d.dept_id !== "D99"
    && (!deptScope || d.dept_id === deptScope));
  const allIncViews = incAll.map((r) => incView(r, incAll, t));
  const nil = nilDepts.map((d: Row) => ({
    dept: d,
    cells: periods.map((p) => nilCell(p, d.dept_id, allIncViews, nilRaw)),
  }));

  const staffOpts = st
    .filter((s: Row) => String(s.staff_id).startsWith("S"))
    .map((s: Row) => ({ staff_id: s.staff_id, display_name: s.display_name,
      dept_name: deptName.get(s.dept_id) || s.dept_id, duty_role: s.duty_role, dept_id: s.dept_id }));

  return { t, incs, ords, advice, nil, periods, curHalf, deptName, staffName, assetName, staffOpts,
    assetList: as.map((a: Row) => ({ id: a.asset_id, name: a.asset_name, dept: a.dept_id })),
    depts: dl.filter((d: Row) => d.dept_id !== "D99") };
}
