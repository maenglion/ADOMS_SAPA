// [캡처 v2] K08(2026-09-24) — 재해 구분 · 재해 구분별 용도 근거 · 집행 기록 건수·합계를 함께 낸다.
import { loadBudget, FRAMES } from "../model";
import { xlsxResponse } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

/**
 * 예산 표 내려받기 — 화면과 같은 자료(원 단위).
 * 09-25 사용자: 엑셀 내려받기를 CSV 대신 엑셀(.xlsx)로 — 금액 칸은 숫자(천 단위 쉼표)로 넣는다.
 */
export async function GET() {
  const { rows, execs, deptName } = await loadBudget();
  const head = ["예산번호", "회계연도", "부서", "재해 구분", "항목", "용도", "편성액(원)", "집행액(원)", "집행률(%)", "집행 기록(건)", "집행 기록 합(원)", "위험요인", "메모"];
  const body = rows.map((r) => {
    const f = FRAMES[r.tab];
    const xs = execs.filter((x) => x.budget_id === r.budget_id);
    return [
      r.budget_id, r.fiscal_year, deptName.get(r.dept_id) || r.dept_id,
      r.area ? f.tab : `${f.tab}(구분 전)`, r.item, f.uses.find((u) => u.k === r.use)?.label || r.use,
      r.p, r.e, r.p ? Math.round((r.e / r.p) * 100) : "", xs.length, xs.reduce((a, x) => a + x.amt, 0),
      r.risk_item_id || "", String(r.note || "").replace(/\(시연용\)/g, ""),
    ];
  });
  return xlsxResponse("안전보건예산", [{ name: "안전보건예산", rows: [head, ...body], commaCols: [6, 7, 10] }]);
}
