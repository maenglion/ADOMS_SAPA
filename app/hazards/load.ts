import "server-only";
import { readTable, depts, staff, assets, type Row } from "@/lib/data";
import { accType } from "@/lib/acc_types";
import { stageOf, fsamDeadline, hoursBetween, REPORT_LIMIT_H, isOpen } from "./codes";

/** 반복 신고 기준 — 같은 시설 · 같은 사고유형 3회 이상(안내서 p.53 「같은 결함 신고 3회 이상 = 반복민원」). */
export const REPEAT_N = 3;

export type Hz = Row & {
  stage: string; open: boolean; repeatN: number;
  deadline: ReturnType<typeof fsamDeadline>;
  reportH: number | null; reportLate: boolean;
};

export async function loadHazards() {
  const [raw0, steps, dl, st] = await Promise.all([
    readTable("hazard_report", "hz_id"), readTable("hazard_step", "step_id"), depts(), staff(),
  ]);
  // 09-26 사용자: 재해유형 한 벌 — 옛 값(「맞음」「기관 내 교통사고」 등)은 읽을 때 새 이름으로(저장 값은 그대로)
  const raw: Row[] = raw0.map((r: Row) => ({ ...r, accident_type: accType(r.accident_type) }));
  const deptName = new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name]));
  const staffName = new Map<string, string>(st.map((x: Row) => [x.staff_id, x.display_name]));

  const key = (r: Row) => `${r.asset_id}|${r.accident_type}`;
  const cnt = new Map<string, number>();
  raw.forEach((r) => cnt.set(key(r), (cnt.get(key(r)) || 0) + 1));

  const rows: Hz[] = raw.map((r): Hz => {
    const reportH = r.severity === "심각" ? hoursBetween(r.judged_at, r.ceo_reported_at || undefined) : null;
    return {
      ...r,
      stage: stageOf(r), open: isOpen(r), repeatN: cnt.get(key(r)) || 1,
      deadline: fsamDeadline(r),
      reportH, reportLate: reportH !== null && reportH > REPORT_LIMIT_H,
    };
  }).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)));

  return { rows, steps, deptName, staffName, staff: st, depts: dl };
}

/** 접수 창의 시설 목록 — 관리대상 대장 전체(이름·구분·종별·부서). */
export async function assetOptions(deptName: Map<string, string>) {
  const all = await assets({ limit: 5000 });
  return all.map((a: Row) => ({
    asset_id: a.asset_id, asset_name: a.asset_name, asset_gbn: a.asset_gbn || "", asset_class: a.asset_class || "",
    dept_id: a.dept_id || "", dept_name: deptName.get(a.dept_id) || a.dept_id || "",
  }));
}

/** 직원 선택 창용. */
export const staffOpts = (st: Row[], deptName: Map<string, string>) =>
  st.map((x) => ({ staff_id: x.staff_id, display_name: x.display_name, dept_name: deptName.get(x.dept_id) || x.dept_id, duty_role: x.duty_role }));
