import { NextRequest, NextResponse } from "next/server";
import { ADOMS_ROLE_COOKIE, roleRedirectPath } from "@/lib/adoms-role";
import { SERVICE_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import { DEFAULT_ROLE } from "@/lib/perm";
import { callReadServer } from "@/lib/read-server-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!validAdminSession(request.cookies.get(SERVICE_ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const event = await callReadServer("/api/read-server/qa/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "demo_reset",
        route: "/demo-admin",
        success: true,
        admin: true,
        detail: { roleReset: true, dataReset: false, cacheReset: false },
      }),
    });
    if (!event.ok) return NextResponse.json({ ok: false, error: "시연 초기화 기록에 실패했습니다." }, { status: 502 });
    const response = NextResponse.json({ ok: true, defaultRole: DEFAULT_ROLE, redirectTo: roleRedirectPath(DEFAULT_ROLE) });
    response.cookies.set(ADOMS_ROLE_COOKIE, "", {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "시연 초기화에 실패했습니다." }, { status: 502 });
  }
}
