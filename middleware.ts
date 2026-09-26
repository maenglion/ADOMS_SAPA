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

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const role = url.searchParams.get("role");
  const saved = req.cookies.get(COOKIE)?.value;

  if (!role && saved && isRole(saved) && req.method === "GET") {
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
    res = NextResponse.next({ request: { headers: h } });
  }
  if (role && isRole(role) && role !== saved) {
    res.cookies.set(COOKIE, role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

export const config = { matcher: ["/((?!_next|api|favicon.ico).*)"] };
