/**
 * 권한 — 서버 쪽 도우미(09-25 사용자: 권한 제어). 규칙은 lib/perm.ts 한 곳, 여기는 「지금 누구인가」를 읽고 막기만 한다.
 *  · 지금 역할 = 미들웨어가 실어 준 x-adoms-role(주소의 role → 쿠키 → 총괄 순)
 *  · 쓰기(서버 액션)는 폼이 넘긴 role 과 미들웨어 역할을 **둘 다** 본다 — 어느 하나라도 권한이 없으면 막는다.
 */
import "server-only";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canAccess, isRole, normRole, type Role } from "./perm";

export const ROLE_HEADER = "x-adoms-role";

/** 지금 요청의 역할 */
export async function currentRole(): Promise<Role> {
  try {
    const h = (await headers()).get(ROLE_HEADER);
    if (isRole(h)) return h;
    const c = (await cookies()).get("adoms-role")?.value;
    if (isRole(c)) return c;
  } catch {}
  return "gm";
}

/**
 * 쓰기 막기 — 서버 액션 맨 앞에서 부른다. 권한이 없으면 저장하지 않고 안내 화면으로 보낸다.
 * @param path 이 쓰기가 속한 메뉴 주소(예: "/admin/role")
 */
export async function guard(path: string, f?: FormData): Promise<Role> {
  const now = await currentRole();
  const formRole = f ? String(f.get("role") || "") : "";
  const roles = [now, ...(isRole(formRole) ? [formRole] : [])];
  const bad = roles.find((r) => !canAccess(r, path));
  if (bad) redirect(`/denied?path=${encodeURIComponent(path)}&role=${bad}&w=1`);
  return normRole(isRole(formRole) ? formRole : now);
}
