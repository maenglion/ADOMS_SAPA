import { loadTraining, FRAMES, type Area } from "../model";
import { xlsxResponse } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/**
 * 교육 기록 내려받기 — 화면과 같은 상태(기한 초과 계산 포함).
 * 09-25 사용자: 엑셀 내려받기를 CSV 대신 엑셀(.xlsx)로 — lib/xlsx.ts.
 */
export async function GET() {
  const { recs, courses, deptName, staffName } = await loadTraining();
  const cById = new Map(courses.map((c) => [c.course_id, c]));
  const head = ["교육번호", "재해 구분", "부서", "대상자", "교육 과정", "근거", "주기", "구분", "기한", "이수일", "시간", "상태", "이수증", "이행 지시일"];
  const rows = recs.map((r) => {
    const c: any = cById.get(r.course_id) || {};
    return [
      r.training_id, FRAMES[(r.area as Area) || "I"]?.tab || "", deptName.get(r.dept_id) || r.dept_id, staffName.get(r.staff_id) || r.staff_id,
      r.course_name, c.basis || r.law, c.cycle || "", r.period || "", r.due_date || "", r.trained_at || "",
      r.hours || "", r.st, r.certificate_file || "", r.instructed_at || "",
    ];
  });
  return xlsxResponse("교육실시점검", [{ name: "교육실시점검", rows: [head, ...rows] }]);
}
