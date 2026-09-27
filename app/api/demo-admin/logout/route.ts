import { NextRequest, NextResponse } from "next/server";
import { DEMO_ADMIN_COOKIE } from "@/lib/demo-admin-auth";
import { validAdminSession } from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";

export async function POST(request: NextRequest) {
  if (validAdminSession(request.cookies.get(DEMO_ADMIN_COOKIE)?.value)) {
    try {
      await callReadServer("/api/read-server/qa/events", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "qa_logout", route: "/demo-admin", success: true, admin: true }),
      });
    } catch { /* 로그아웃은 기록 장애와 무관하게 완료한다. */ }
  }
  const response = NextResponse.redirect(new URL("/?role=gm", request.url), 303);
  response.cookies.set(DEMO_ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NETLIFY === "true" || Boolean(process.env.URL),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
