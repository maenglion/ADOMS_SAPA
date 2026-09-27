import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_ADMIN_COOKIE,
  adminAuthConfigured,
  adminCookieOptions,
  createAdminSession,
  validAdminCredentials,
} from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";

async function logLogin(success: boolean) {
  try {
    await callReadServer("/api/read-server/qa/events", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "qa_login", route: "/demo-admin", success, admin: true }),
    });
  } catch { /* 로그인 자체는 QA 기록 장애와 분리한다. */ }
}

export async function POST(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ ok: false, error: "관리자 로그인이 아직 설정되지 않았습니다." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  if (!validAdminCredentials(String(body.user || ""), String(body.password || ""))) {
    await logLogin(false);
    return NextResponse.json({ ok: false, error: "아이디 또는 비밀번호를 확인해 주세요." }, { status: 401 });
  }
  await logLogin(true);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_ADMIN_COOKIE, createAdminSession(), adminCookieOptions());
  return response;
}
