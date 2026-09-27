import { NextRequest, NextResponse } from "next/server";
import { SERVICE_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";

export const dynamic = "force-dynamic";

const TARGETS = [
  { screen: "dashboard", path: "/?role=gm" },
  { screen: "actions", path: "/actions?role=gm" },
  { screen: "duties/list", path: "/duties/list?role=gm" },
  { screen: "evidence", path: "/evidence?role=gm" },
  { screen: "tasks", path: "/tasks?role=gm" },
];

const round = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: NextRequest) {
  if (!validAdminSession(request.cookies.get(SERVICE_ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  const results = [];
  for (const target of TARGETS) {
    const samples: number[] = [];
    const statuses: number[] = [];
    const cache: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const startedAt = performance.now();
      const response = await fetch(new URL(target.path, request.nextUrl.origin), {
        headers: { accept: "text/html" },
        cache: "no-store",
        redirect: "manual",
      });
      await response.arrayBuffer();
      samples.push(round(performance.now() - startedAt));
      statuses.push(response.status);
      cache.push((response.headers.get("x-adoms-response-cache") || "UNKNOWN").toUpperCase());
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const allHit = cache.every((value) => value === "HIT");
    results.push({
      ...target,
      http: statuses.every((value) => value === 200) ? 200 : Math.max(...statuses),
      cache: allHit ? "HIT" : [...new Set(cache)].join("/"),
      minMs: sorted[0],
      medianMs: sorted[1],
      maxMs: sorted[2],
      dbQueryCount: allHit ? 0 : null,
    });
  }
  const ok = results.every((item) => item.http === 200 && item.cache === "HIT"
    && item.medianMs <= (item.screen === "actions" ? 2500 : 2000) && item.dbQueryCount === 0);
  try {
    await callReadServer("/api/read-server/qa/events", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "performance_check", route: "5 core screens", success: ok, admin: true, detail: { results } }),
    });
  } catch { /* 측정 결과 반환은 리뷰 기록 장애와 분리한다. */ }
  return NextResponse.json({ ok, checkedAt: new Date().toISOString(), results });
}
