// [400 · 교육자료 버전] SCR-056 「샘플다운」 — 법정교육 참석자 명부 양식.
// 09-25 사용자: CSV 대신 엑셀(.xlsx) 양식으로 — lib/xlsx.ts. 칸 너비는 쓰기 좋게 넓힌다.
import { xlsxResponse } from "@/lib/xlsx";

export const dynamic = "force-static";

export function GET() {
  const head = ["연번", "소속(부서)", "직위", "성명", "법정교육명", "교육 일자", "교육시간(시간)", "교육기관", "서명"];
  const blank = (n: number) => [n, "", "", "", "", "", "", "", ""];
  return xlsxResponse("법정교육_참석자명부_양식", [{
    name: "참석자 명부",
    rows: [head, blank(1), blank(2), blank(3)],
    widths: [8, 16, 10, 12, 28, 14, 14, 18, 14],
  }]);
}
