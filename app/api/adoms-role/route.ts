import { NextRequest, NextResponse } from "next/server";
import { ADOMS_ROLE_COOKIE, ADOMS_ROLE_MAX_AGE } from "@/lib/adoms-role";
import { isRole } from "@/lib/perm";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = String(body.role || "");
  if (!isRole(role)) return NextResponse.json({ ok: false, error: "유효하지 않은 사용자 유형입니다." }, { status: 400 });
  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(ADOMS_ROLE_COOKIE, role, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADOMS_ROLE_MAX_AGE,
  });
  return response;
}
