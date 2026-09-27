import { NextRequest, NextResponse } from "next/server";
import { SERVICE_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import { callReadServer } from "@/lib/read-server-admin";
import {
  classifyPerformanceRow, formatCacheState, overallPerformanceStatus,
  type PerformanceStatus,
} from "@/lib/demo-performance-status";

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
  let cacheReady = false;
  try {
    const health = await callReadServer("/api/read-server/health");
    const value = await health.json().catch(() => ({}));
    cacheReady = health.ok && value.ready === true && value.cacheState === "READY";
  } catch { /* 각 화면 결과에서 점검 필요 또는 재예열로 판정한다. */ }
  const results = [];
  for (const target of TARGETS) {
    const samples: number[] = [];
    const statuses: number[] = [];
    const cache: string[] = [];
    const dbQueries: Array<number | null> = [];
    const warmup = await fetch(new URL(target.path, request.nextUrl.origin), {
      headers: { accept: "text/html" }, cache: "no-store", redirect: "manual",
    });
    await warmup.arrayBuffer();
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
      const dbHeader = response.headers.get("x-adoms-db-query-count");
      dbQueries.push(dbHeader != null && /^\d+$/.test(dbHeader) ? Number(dbHeader) : null);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const hitCount = cache.filter((value) => value === "HIT").length;
    const dbQueryCount = dbQueries.every((value) => value != null)
      ? dbQueries.reduce<number>((total, value) => total + (value || 0), 0) : null;
    const verdict = classifyPerformanceRow({ screen: target.screen, statuses, hitCount, dbQueryCount, medianMs: sorted[1], cacheReady });
    results.push({
      ...target,
      http: statuses.every((value) => value === 200) ? 200 : Math.max(...statuses),
      cache: formatCacheState(cache),
      minMs: sorted[0],
      medianMs: sorted[1],
      maxMs: sorted[2],
      dbQueryCount,
      status: verdict.status,
      reasons: verdict.reasons,
    });
  }
  const overallStatus: PerformanceStatus = overallPerformanceStatus(results.map((item) => item.status));
  const reasons = results.flatMap((item) => item.reasons);
  const ok = overallStatus === "NORMAL";
  try {
    await callReadServer("/api/read-server/qa/events", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "performance_check", route: "5 core screens", success: ok, admin: true,
        detail: { overallStatus, reasons, results },
      }),
    });
  } catch { /* 측정 결과 반환은 리뷰 기록 장애와 분리한다. */ }
  return NextResponse.json({ ok, overallStatus, reasons, checkedAt: new Date().toISOString(), results });
}
