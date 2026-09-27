import { NextRequest, NextResponse } from "next/server";
import { DEMO_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!validAdminSession(request.cookies.get(DEMO_ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const [healthResponse, eventsResponse] = await Promise.all([
      callReadServer("/api/read-server/health"),
      callReadServer("/api/read-server/qa/events"),
    ]);
    const health = await healthResponse.json().catch(() => ({}));
    const events = await eventsResponse.json().catch(() => ({}));
    const { ok: _eventsOk, ...eventData } = events;
    return NextResponse.json({ ok: healthResponse.ok && eventsResponse.ok, health, ...eventData }, {
      status: healthResponse.ok && eventsResponse.ok ? 200 : 503,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "QA 상태를 불러오지 못했습니다." }, { status: 502 });
  }
}
