/**
 * 교육 실시 점검 — 재해 구분별 틀 3개(2026-09-21).
 *   산업          시행령 제5조제2항제3호·제4호  반기 1회 이상
 *   시설·교통     시행령 제11조제2항제3호·제4호 연 1회 이상
 *   원료·제조물   시행령 제9조제2항제3호·제4호  반기 1회 이상
 * (법령DB DOC-000005 a5/p2 · a9/p2 · a11/p2 원문 대조)
 * 교육 과정의 법정 이름·근거·주기·시간은 법령DB 원문에서 확인한 것만 training_course 에 둔다.
 */
import { readTable, depts, staff, type Row } from "@/lib/data";
import { ymd } from "@/lib/day";

export type Area = "I" | "F" | "M";
export const AREAS: Area[] = ["I", "F", "M"];

export type Frame = {
  area: Area; tab: string; name: string; cycle: "반기" | "연";
  n3: string; n4: string; n3Text: string; n4Text: string; target: string; budget: boolean;
};

/** 재해 구분별 틀 — 근거 조문·주기·원문. */
export const FRAMES: Record<Area, Frame> = {
  I: {
    area: "I", tab: "중대산업재해", name: "중대산업재해", cycle: "반기",
    n3: "시행령 제5조제2항제3호", n4: "시행령 제5조제2항제4호",
    n3Text: "안전ㆍ보건 관계 법령에 따라 의무적으로 실시해야 하는 유해ㆍ위험한 작업에 관한 안전ㆍ보건에 관한 교육이 실시되었는지를 반기 1회 이상 점검하고, 직접 점검하지 않은 경우에는 점검이 끝난 후 지체 없이 점검 결과를 보고받을 것",
    n4Text: "제3호에 따른 점검 또는 보고 결과 실시되지 않은 교육에 대해서는 지체 없이 그 이행의 지시, 예산의 확보 등 교육 실시에 필요한 조치를 할 것",
    target: "유해·위험한 작업에 관한 안전·보건 교육(안전·보건 관계 법령상 의무 교육)", budget: true,
  },
  F: {
    area: "F", tab: "중대시민재해(공중이용시설·공중교통수단)", name: "중대시민재해(공중이용시설·공중교통수단)", cycle: "연",
    n3: "시행령 제11조제2항제3호", n4: "시행령 제11조제2항제4호",
    n3Text: "안전ㆍ보건 관계 법령에 따라 공중이용시설의 안전을 관리하는 자나 공중교통수단의 시설 및 설비를 정비ㆍ점검하는 종사자가 의무적으로 이수해야 하는 교육을 이수했는지를 연 1회 이상 점검하고, 직접 점검하지 않은 경우에는 점검이 끝난 후 지체 없이 점검 결과를 보고받을 것",
    n4Text: "제3호에 따른 점검 또는 보고 결과 실시되지 않은 교육에 대해서는 지체 없이 그 이행의 지시 등 교육 실시에 필요한 조치를 할 것",
    target: "공중이용시설 안전관리자 · 공중교통수단 시설·설비 정비·점검 종사자의 의무 이수 교육", budget: false,
  },
  M: {
    area: "M", tab: "중대시민재해(원료·제조물)", name: "중대시민재해(원료·제조물)", cycle: "반기",
    n3: "시행령 제9조제2항제3호", n4: "시행령 제9조제2항제4호",
    n3Text: "안전ㆍ보건 관계 법령에 따라 의무적으로 실시해야 하는 교육이 실시되는지를 반기 1회 이상 점검하고, 직접 점검하지 않은 경우에는 점검이 끝난 후 지체 없이 점검 결과를 보고받을 것",
    n4Text: "제3호에 따른 점검 또는 보고 결과 실시되지 않은 교육에 대해서는 지체 없이 그 이행의 지시, 예산의 확보 등 교육 실시에 필요한 조치를 할 것",
    target: "원료·제조물 관련 안전·보건 관계 법령상 의무 교육", budget: true,
  },
};

export const areaOfParam = (v?: string): Area => (v === "F" || v === "M" ? v : "I");

/** 예전 이름(시행령 제5조 틀) — 다른 화면이 부를 수 있어 남겨 둔다. */
export const N3_TEXT = FRAMES.I.n3Text;
export const N4_TEXT = FRAMES.I.n4Text;

/**
 * 과정의 재해 구분 — area 칸이 있으면 그것, 없으면(예전 과정 표) 과정 번호로 정한다.
 * 과정 번호 표는 ops_v0.7 training_course.csv 의 area 칸과 같다(_build/build_training_v07.py).
 */
const AREA_BY_COURSE: Record<string, Area> = {
  TC01: "I", TC02: "I", TC03: "I", TC04: "I", TC05: "I", TC06: "I", TC07: "I", TC11: "I",
  TC08: "F", TC09: "F", TC10: "F", TC12: "F", TC13: "M",
};
export function courseArea(c?: Row): Area {
  const a = String(c?.area || "").trim();
  if (a === "I" || a === "F" || a === "M") return a;
  return AREA_BY_COURSE[String(c?.course_id || "")] || "I";
}

export type St = "이수" | "미이수" | "기한 초과" | "기록 없음" | "발생 시" | "해당 없음";
export const ST_TONE: Record<St, string> = {
  이수: "ok", 미이수: "warn", "기한 초과": "bad", "기록 없음": "bad", "발생 시": "none", "해당 없음": "none",
};

export const today = () => ymd();
export const halfOf = (d: string) => `${d.slice(0, 4)} ${Number(d.slice(5, 7)) <= 6 ? "상반기" : "하반기"}`;
/** 점검 기간 — 반기 틀은 「2026 하반기」, 연 1회 틀은 「2026년」. */
export const periodOf = (area: Area, d: string) => (FRAMES[area].cycle === "연" ? `${d.slice(0, 4)}년` : halfOf(d));

/** 점검 기록의 재해 구분 — 칸이 없는 예전 기록은 시행령 제5조(산업) 반기 점검이다. */
export const checkArea = (c: Row): Area => areaOfParam(String(c.area || "I"));
/** 점검 기록의 기간 — period 칸이 없으면 예전 칸(half). */
export const checkPeriod = (c: Row) => String(c.period || c.half || "");

/** 기록 한 줄의 상태 — 미실시인데 기한이 지났으면 「기한 초과」. */
export function recState(r: Row, now = today()): St {
  if (r.status === "이수") return "이수";
  if (r.due_date && r.due_date < now) return "기한 초과";
  return "미이수";
}

const RANK: Record<St, number> = { "기한 초과": 5, "기록 없음": 4, 미이수: 3, 이수: 2, "발생 시": 1, "해당 없음": 0 };

export async function loadTraining() {
  const coursesRaw = await readTable("training_course", "course_id");
  const courses: Row[] = coursesRaw.map((c): Row => ({ ...c, area: courseArea(c) }));
  const areaByCourse = new Map<string, Area>(courses.map((c) => [c.course_id, c.area as Area]));
  const recsRaw = await readTable("training_record", "training_id");
  const now = today();
  const recs: Row[] = recsRaw.map((r): Row => ({ ...r, st: recState(r, now), area: areaByCourse.get(r.course_id) || "I" }));
  const dl = (await depts()).filter((d: Row) => d.dept_id !== "D99");
  const st = await staff();
  const deptName = new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const staffName = new Map<string, string>(st.map((x: Row) => [x.staff_id, x.display_name]));
  const applies = (c: Row, d: string) => String(c.applies_depts || "").split(/\s+/).includes(d);

  /** 과정 × 부서 한 칸의 상태 — 가장 나쁜 기록이 칸을 대표한다. */
  function cell(c: Row, d: string): { st: St; rs: Row[]; ap: boolean } {
    const rs = recs.filter((r) => r.course_id === c.course_id && r.dept_id === d);
    const ap = applies(c, d);
    if (!rs.length) return { st: !ap ? "해당 없음" : c.cycle_months ? "기록 없음" : "발생 시", rs, ap };
    const worst = rs.reduce<St>((w, r) => (RANK[r.st as St] > RANK[w] ? (r.st as St) : w), "이수");
    return { st: worst, rs, ap };
  }
  return { courses, recs, dl, st, deptName, staffName, applies, cell, now, areaByCourse };
}

/** 부서 이름을 표 머리에 맞게 줄인다 — 괄호 속 설명을 뗀다. */
export const shortDept = (n: string) => n.replace(/\(.*\)/, "");
