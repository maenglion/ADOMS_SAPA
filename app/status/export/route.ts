// [400 · 교육자료 버전] SCR-011 · 012 · 015 · 016 「엑셀다운로드」 — 화면과 같은 함수(buildBoard)로 센 표를 엑셀로 내린다.
// 09-25 사용자: CSV 대신 엑셀(.xlsx)로 — lib/xlsx.ts. 대분류 줄은 굵게, 머리 줄과 점검사항 칸은 틀 고정.
import { depts } from "@/lib/data";
import { buildBoard, listParam, pct0, thisYear, MARK_NAME } from "../_lib/calc";
import { ymd } from "@/lib/day";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const track = (["ws", "fc", "mt"].includes(u.searchParams.get("track") || "") ? u.searchParams.get("track") : "ws") as "ws" | "fc" | "mt";
  const year = u.searchParams.get("year") || thisYear();
  const gs = listParam(u.searchParams.get("g") || "1,2,3,4").map(Number);
  const ds = listParam(u.searchParams.get("d") || "");
  const wide = u.searchParams.get("view") === "all";
  const cols = (await depts()).filter((d: any) => ds.includes(d.dept_id));
  const B = await buildBoard(track, year, gs, cols);

  const head = ["점검사항", "이행률", "전체항목", "이행완료(O)", "보완필요(△)", "미이행(X)", "해당없음(-)", ...(wide ? cols.map((c: any) => c.dept_name) : [])];
  const rows: any[][] = B.lines.map((l) => [
    l.label,
    l.cnt ? pct0(l.rate) : "",
    l.cnt ? l.cnt.n : "", l.cnt ? l.cnt.O : "", l.cnt ? l.cnt.T : "", l.cnt ? l.cnt.X : "", l.cnt ? l.cnt.N : "",
    ...(wide ? (l.cells || cols.map(() => null)).map((m) => (m ? (m === "wait" ? MARK_NAME.wait : m) : "")) : []),
  ]);
  rows.push(["이행률", pct0(B.total), "", "", "", "", "", ...(wide ? B.colRate.map((r) => pct0(r)) : [])]);
  // 굵게: 대분류 줄(grp) · 맨 아래 이행률 줄. 머리 줄이 0번이라 순번 + 1.
  const boldRows = [...B.lines.map((l, i) => (l.kind === "grp" ? i + 1 : -1)).filter((i) => i > 0), rows.length];
  const name = `이행현황_${{ ws: "중대산업재해", fc: "중대시민재해_공중이용시설·공중교통수단", mt: "중대시민재해_원료·제조물" }[track]}_${year}_${ymd()}`;
  return xlsxResponse(name, [{ name: `이행현황 ${year}`, rows: [head, ...rows], boldRows, freezeCol: 1 }]);
}
