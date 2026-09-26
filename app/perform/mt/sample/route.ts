// [400 · 교육자료 버전] SCR-087 「샘플다운」 — 법정교육 이수자 명부 양식.
// 09-25 사용자: CSV 대신 엑셀(.xlsx) 양식으로 — lib/xlsx.ts. 칸 너비는 쓰기 좋게 넓힌다.
import { xlsxResponse } from "@/lib/xlsx";

export const dynamic = "force-static";

export function GET() {
  const head = ["순번", "성명", "소속(부서)", "직급", "법정교육명", "근거 법령", "교육기관", "교육 일자", "이수 시간", "비고"];
  const ex = ["1", "", "", "", "", "", "", "2026-00-00", "", ""];
  return xlsxResponse("법정교육_이수자_명부_양식", [{
    name: "이수자 명부",
    rows: [head, ex],
    widths: [8, 12, 16, 10, 28, 24, 18, 14, 12, 16],
  }]);
}
