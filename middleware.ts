import { NextResponse, type NextRequest } from "next/server";
import { ruleFor, canAccess, isRole, DEFAULT_ROLE } from "@/lib/perm";
import { ADOMS_ROLE_COOKIE, ADOMS_ROLE_MAX_AGE } from "@/lib/adoms-role";

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

function isDocumentNavigation(req: NextRequest) {
  if (req.method !== "GET") return false;
  if (req.nextUrl.pathname.startsWith("/api/")) return false;
  if (!(req.headers.get("accept") || "").toLowerCase().includes("text/html")) return false;
  if (req.headers.get("rsc") === "1" || req.headers.has("next-router-state-tree")) return false;
  const purpose = `${req.headers.get("purpose") || ""} ${req.headers.get("sec-purpose") || ""}`.toLowerCase();
  if (req.headers.get("next-router-prefetch") === "1" || purpose.includes("prefetch")) return false;
  return true;
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
    res.cookies.set(ADOMS_ROLE_COOKIE, role, {
      path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: ADOMS_ROLE_MAX_AGE,
    });
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
  // Railway keeps rendered HTML/RSC in process memory. Include the Netlify
  // source revision so a new deploy never receives HTML that points at the
  // previous deploy's immutable Next.js chunks.
  headers.set("x-adoms-deploy-version", process.env.COMMIT_REF || process.env.DEPLOY_ID || "unknown");

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
  const isReadServerAsset = url.pathname.startsWith("/_next/static/");
  const backend = (process.env.ADOMS_DATA_BACKEND || "csv").trim().toLowerCase();

  // Core screen HTML is rendered by the Railway build, so its immutable
  // Next.js chunks must come from that same build. The browser still calls
  // the Netlify origin; only this narrow static path is proxied server-side.
  if (isReadServerAsset) {
    if (readServerMode()) {
      const expected = readServerToken();
      if (!expected || bearerToken(req) !== expected) return new NextResponse("Unauthorized", { status: 401 });
      return NextResponse.next();
    }
    if (backend === "read-server" && (req.method === "GET" || req.method === "HEAD")) {
      try {
        const railwayAsset = await proxyReadServer(req);
        // Non-core pages are rendered by Netlify and therefore reference the
        // Netlify build's own chunk hashes. Fall back locally when the same
        // asset does not exist in the Railway build.
        return railwayAsset.status === 404 ? NextResponse.next() : railwayAsset;
      }
      catch (error) {
        console.error("[adoms-read-server-asset]", error instanceof Error ? error.message : String(error));
        return new NextResponse("READ server asset failed.", { status: 502 });
      }
    }
    return NextResponse.next();
  }
  if (readServerMode()) {
    const isHealth = url.pathname === READ_SERVER_HEALTH;
    const isControl = url.pathname === READ_SERVER_CONTROL;
    const isQa = url.pathname === READ_SERVER_QA;
    const allowed = isScreenRead || isHealth || isControl || isQa;
    if (!allowed) return new NextResponse("Not found", { status: 404 });
    const expected = readServerToken();
    if (!expected || bearerToken(req) !== expected) return new NextResponse("Unauthorized", { status: 401 });
    const methodAllowed = (isScreenRead || isHealth) ? (req.method === "GET" || req.method === "HEAD")
      : isControl ? req.method === "POST"
        : isQa && (req.method === "GET" || req.method === "POST");
    if (!methodAllowed) return new NextResponse("Method not allowed", { status: 405 });
  }
  const role = url.searchParams.get("role");
  const saved = req.cookies.get(ADOMS_ROLE_COOKIE)?.value;

  const isQaPath = url.pathname === "/demo-admin" || url.pathname.startsWith("/demo-admin/");
  const shouldRedirectRole = !isQaPath && isDocumentNavigation(req);
  if (!role && saved && isRole(saved) && shouldRedirectRole) {
    const to = url.clone();
    to.searchParams.set("role", saved);
    return NextResponse.redirect(to);
  }

  if (!role && shouldRedirectRole) {
    const to = url.clone();
    to.searchParams.set("role", DEFAULT_ROLE);
    return withRoleCookie(NextResponse.redirect(to), DEFAULT_ROLE, saved);
  }

  const eff = isRole(role) ? role : isRole(saved) ? saved : DEFAULT_ROLE;
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

export const config = { matcher: ["/((?!_next|favicon.ico).*)", "/_next/static/:path*"] };
