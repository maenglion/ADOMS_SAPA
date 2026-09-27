import { NextRequest, NextResponse } from "next/server";
import { DEMO_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validAdminSession(request.cookies.get(DEMO_ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const response = await callReadServer("/api/read-server/control/cache-reset", { method: "POST" });
    const result = await response.json().catch(() => ({ ok: false }));
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, error: "캐시 초기화 요청에 실패했습니다." }, { status: 502 });
  }
}
