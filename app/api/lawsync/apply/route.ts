/**
 * 법령 개정 확인(CoCo) 끝 단계가 부르는 반영 요청 — 같은 컴퓨터(localhost)에서만 받는다(2026-09-24).
 * 반영 규칙은 lib/lawsync.ts applyRun 한 곳. 여러 번 불러도 한 번만 반영된다.
 */
import { NextResponse } from "next/server";
import { applyRun } from "@/lib/lawsync";

export async function POST(req: Request) {
  const host = req.headers.get("host") || "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return NextResponse.json({ ok: false, msg: "로컬에서만" }, { status: 403 });
  const { run_id } = await req.json().catch(() => ({ run_id: "" }));
  const r = await applyRun(String(run_id || ""), "CoCo");
  return NextResponse.json(r);
}
