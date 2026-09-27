import { NextRequest, NextResponse } from "next/server";
import { SERVICE_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!validAdminSession(request.cookies.get(SERVICE_ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const response = await callReadServer("/api/read-server/health");
    return NextResponse.json({ ok: response.ok, status: response.ok ? "READY" : "NOT_READY" }, { status: response.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, status: "NOT_READY" }, { status: 503 });
  }
}
