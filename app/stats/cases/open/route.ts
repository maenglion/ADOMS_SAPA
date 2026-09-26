// [400 · 교육자료 버전] SCR-097 → SCR-098 「행 선택시 상세페이지로 이동」 — 조회수를 하나 올리고 상세 팝업으로 보낸다
import { NextResponse } from "next/server";
import { patchRow } from "@/lib/write";
import { caseRows } from "../../_parts/data";
import { ROLE_STAFF } from "@/lib/roles";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "";
  const role = u.searchParams.get("role") || "gm";
  const row = (await caseRows()).find((r) => String(r.case_no) === id);
  if (row) await patchRow("usg_case", "case_no", id, { views: String((Number(row.views) || 0) + 1) }, ROLE_STAFF[role] || "SD01-1", "사고사례 조회");
  // 서버가 0.0.0.0 에 떠 있어 절대 주소로 보내면 브라우저가 못 연다 — 상대 주소로 보낸다
  return new NextResponse(null, { status: 303, headers: { Location: `/stats/cases?${u.searchParams.toString()}` } });
}
