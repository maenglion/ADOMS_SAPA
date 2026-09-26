// [400 · 교육자료 버전] SCR-091 「⤓다운로드」 · SCR-094·096·102 「Export to」 xls/csv — 묶음 G 내려받기
import { OCC_COLS, occurRows, filterOcc } from "../_parts/data";
import { xlsxResponse } from "@/lib/xlsx";

/**
 * kind=chart — 차트의 원본 수치 표(라벨 · 값). d = {l:[…], v:[…]} JSON.
 * kind=occur — 발생통계 원장 20칸(화면과 같은 거르기: y·org·dept·acc·inj·base).
 * fmt=xls(또는 xlsx) — 엑셀(.xlsx). 09-25 사용자: 「엑셀로 바꾸자」 — 옛 HTML 표(.xls) 대신 진짜 엑셀 파일(lib/xlsx.ts).
 *   차트 팝업의 「xls」 글자는 그대로라도 받는 파일은 .xlsx 다.
 * fmt=csv — UTF-8 BOM CSV(엑셀에서 한글이 깨지지 않게). 차트 팝업에서 csv 를 고른 경우와 업로드 양식(tpl=1)만 쓴다
 *   — 업로드는 CSV 만 받으므로(occur/actions.ts) 양식도 CSV 그대로 둔다.
 */
const esc = (v: any) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function out(fmt: string, name: string, head: string[], rows: any[][]) {
  if (fmt === "xlsx") return xlsxResponse(name, [{ name: name.replace(/_/g, " ").slice(0, 31), rows: [head, ...rows] }]);
  const body = "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.csv`,
    },
  });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") || "chart";
  const f = u.searchParams.get("fmt") || "";
  // 09-26 사용자: 「일단 엑셀로만 하자」 — 기본값을 엑셀로(업로드 양식 tpl=1 만 CSV · 주소에 fmt=csv 를 직접 적으면 CSV)
  const fmt = f === "csv" ? "csv" : "xlsx";

  if (kind === "occur") {
    const g = (k: string) => u.searchParams.get(k) || "";
    const base = g("base");
    const rows = filterOcc(await occurRows(), { y: g("y"), org: g("org"), dept: g("dept"), acc: g("acc"), inj: g("inj"), base });
    if (u.searchParams.get("tpl") === "1") return out("csv", "중대재해_발생통계_업로드양식", OCC_COLS.map((c) => c.head), []);
    return out(fmt, `중대재해_발생통계_${base || "기준일"}`, OCC_COLS.map((c) => c.head), rows.map((r) => OCC_COLS.map((c) => r[c.key])));
  }

  let d: { l: string[]; v: number[] } = { l: [], v: [] };
  try { d = JSON.parse(u.searchParams.get("d") || "{}"); } catch { /* 빈 표 */ }
  const title = u.searchParams.get("title") || "차트";
  const unit = u.searchParams.get("unit") || "";
  return out(fmt, title, ["구분", unit ? `값(${unit})` : "값"], (d.l || []).map((l, i) => [l, d.v?.[i] ?? ""]));
}
