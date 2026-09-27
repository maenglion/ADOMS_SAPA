import { NextRequest, NextResponse } from "next/server";
import { callReadServer } from "@/lib/read-server-admin";

const PUBLIC_EVENTS = new Set(["demo_session_start", "page_visit", "role_change"]);
const ROLES = new Set(["ceo", "gm", "mgr", "road", "water", "road_head", "water_head"]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (!PUBLIC_EVENTS.has(String(body.eventType || ""))) return NextResponse.json({ ok: false }, { status: 400 });
  const route = String(body.route || "").slice(0, 240);
  if (!route.startsWith("/") || route.startsWith("//")) return NextResponse.json({ ok: false }, { status: 400 });
  const role = ROLES.has(String(body.role || "")) ? String(body.role) : undefined;
  const detail = body.eventType === "role_change" && ROLES.has(String(body.from || "")) && ROLES.has(String(body.to || ""))
    ? { from: String(body.from), to: String(body.to) } : {};
  try {
    const response = await callReadServer("/api/read-server/qa/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: body.eventType, route, role, success: true, detail }),
    });
    return NextResponse.json({ ok: response.ok }, { status: response.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
