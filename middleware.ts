import { NextResponse, type NextRequest } from "next/server";
import { ruleFor, canAccess, isRole } from "@/lib/perm";

/**
 * 1) 지금 주소를 헤더에 실어 준다.
 *    루트 레이아웃(서버 컴포넌트)은 주소를 알 수 없어서, 휴대폰 화면(/m)에서
 *    데스크톱 머리띠·메뉴를 빼려면 이 값이 필요하다.
 * 2) 역할을 기억한다(2026-09-21). 역할은 주소의 `role` 값인데, 메뉴 링크에는 그 값이 없어
 *    메뉴를 누르면 총괄로 돌아갔다. 주소에 role 이 있으면 쿠키에 적고, 없으면 쿠키 값을 붙여 다시 보낸다.
 * 3) 09-25 사용자: 권한 제어 — 권한이 없는 역할이 주소로 들어오면 안내 화면(/denied)을 보여 주고,
 *    쓰기(POST · 서버 액션)는 받지 않는다. 규칙은 lib/perm.ts 한 곳(되돌리기 = PERM_ENFORCE=false).
 *    지금 역할은 x-adoms-role 헤더로 서버 화면·액션에 넘긴다(lib/perm_server.ts currentRole).
 */
const COOKIE = "adoms-role";

const READ_SERVER_ROUTES = new Set(["/", "/actions", "/duties/list", "/evidence", "/tasks"]);
const READ_SERVER_HEALTH = "/api/read-server/health";
const READ_SERVER_CONTROL = "/api/read-server/control/cache-reset";
const READ_SERVER_QA = "/api/read-server/qa/events";

function readServerMode() {
  return process.env.ADOMS_READ_SERVER_SERVICE === "1";
}

function readServerToken() {
  return (process.env.ADOMS_READ_SERVER_TOKEN || "").trim();
}

function bearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function readServerBaseUrl() {
  const raw = (process.env.ADOMS_READ_SERVER_URL || "").trim();
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("ADOMS_READ_SERVER_URL must be a complete HTTPS URL"); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("ADOMS_READ_SERVER_URL must be an HTTPS URL without credentials");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

function withRoleCookie(res: NextResponse, role: string | null, saved: string | undefined) {
  if (role && isRole(role) && role !== saved) {
    res.cookies.set(COOKIE, role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

async function proxyReadServer(req: NextRequest): Promise<NextResponse> {
  const token = readServerToken();
  if (!token) return new NextResponse("READ server token is not configured.", { status: 503 });

  let base: URL;
  try { base = readServerBaseUrl(); } catch (error) {
    console.error("[adoms-read-server-proxy]", error instanceof Error ? error.message : String(error));
    return new NextResponse("READ server URL is not configured.", { status: 503 });
  }

  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, base);
  const headers = new Headers();
  for (const name of ["accept", "cookie", "next-router-prefetch", "next-router-state-tree", "next-url", "purpose", "rsc", "user-agent"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${token}`);
  headers.set("x-adoms-proxy-host", req.nextUrl.host);

  const startedAt = performance.now();
  const upstream = await fetch(target, { method: req.method, headers, redirect: "manual", cache: "no-store" });
  const body = await upstream.arrayBuffer();
  const elapsed = performance.now() - startedAt;
  if (upstream.status >= 500) {
    try {
      await fetch(new URL("/api/read-server/qa/events", base), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          eventType: "read_error", route: req.nextUrl.pathname, role: req.nextUrl.searchParams.get("role") || "gm",
          success: false, httpStatus: upstream.status, durationMs: elapsed,
          cacheState: upstream.headers.get("x-adoms-response-cache") || undefined,
          detail: { kind: "READ server response", message: `HTTP ${upstream.status}` },
        }),
        cache: "no-store",
      });
    } catch { /* 원래 READ 오류 응답을 QA 기록 장애로 바꾸지 않는다. */ }
  }
  const outHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!["connection", "content-encoding", "content-length", "set-cookie", "transfer-encoding"].includes(name.toLowerCase())) {
      outHeaders.set(name, value);
    }
  });
  const location = outHeaders.get("location");
  if (location) {
    try {
      const redirected = new URL(location, target);
      if (redirected.origin === base.origin) outHeaders.set("location", `${req.nextUrl.origin}${redirected.pathname}${redirected.search}`);
    } catch { /* keep a valid relative Location unchanged */ }
  }
  outHeaders.set("content-length", String(body.byteLength));
  outHeaders.set("x-adoms-data-backend", "read-server");
  outHeaders.set("server-timing", `read-server;dur=${elapsed.toFixed(1)}`);
  console.info("[adoms-read-server-proxy]", JSON.stringify({
    path: req.nextUrl.pathname,
    status: upstream.status,
    upstreamMs: Math.round(elapsed * 100) / 100,
    payloadBytes: body.byteLength,
  }));
  return new NextResponse(body, { status: upstream.status, headers: outHeaders });
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const isScreenRead = READ_SERVER_ROUTES.has(url.pathname);
  if (readServerMode()) {
    const allowed = isScreenRead || url.pathname === READ_SERVER_HEALTH
      || url.pathname === READ_SERVER_CONTROL || url.pathname === READ_SERVER_QA;
    if (!allowed) return new NextResponse("Not found", { status: 404 });
    if (req.method !== "GET" && req.method !== "HEAD") return new NextResponse("Method not allowed", { status: 405 });
    const expected = readServerToken();
    if (!expected || bearerToken(req) !== expected) return new NextResponse("Unauthorized", { status: 401 });
  }
  const role = url.searchParams.get("role");
  const saved = req.cookies.get(COOKIE)?.value;

  const isQaPath = url.pathname === "/demo-admin" || url.pathname.startsWith("/demo-admin/") || url.pathname.startsWith("/api/demo-admin/");
  if (!role && saved && isRole(saved) && req.method === "GET" && !isQaPath) {
    const to = url.clone();
    to.searchParams.set("role", saved);
    return NextResponse.redirect(to);
  }

  const eff = isRole(role) ? role : isRole(saved) ? saved : "gm";
  const h = new Headers(req.headers);
  h.set("x-pathname", url.pathname);
  h.set("x-adoms-role", eff);

  let res: NextResponse;
  const rule = ruleFor(url.pathname);
  if (rule && !canAccess(eff, url.pathname)) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      // 쓰기 막기 — 저장하지 않는다
      return new NextResponse("이 메뉴는 권한이 필요합니다.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    const to = url.clone();
    to.pathname = "/denied";
    to.search = "";
    to.searchParams.set("path", url.pathname);
    to.searchParams.set("role", eff);
    res = NextResponse.rewrite(to, { request: { headers: h } });
  } else {
    const backend = (process.env.ADOMS_DATA_BACKEND || "csv").trim().toLowerCase();
    if (!readServerMode() && backend === "read-server" && isScreenRead && (req.method === "GET" || req.method === "HEAD")) {
      try {
        res = await proxyReadServer(req);
      } catch (error) {
        console.error("[adoms-read-server-proxy]", error instanceof Error ? error.message : String(error));
        res = new NextResponse("READ server request failed.", { status: 502 });
      }
    } else {
      res = NextResponse.next({ request: { headers: h } });
      if (readServerMode()) res.headers.set("x-adoms-read-server", "railway");
    }
  }
  return withRoleCookie(res, role, saved);
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
