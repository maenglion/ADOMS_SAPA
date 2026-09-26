"use client";
/**
 * 역할별 메뉴 전달(09-25 사용자: 권한 제어 · 메뉴 관리).
 * 셸(서버)이 역할마다의 메뉴(lib/menu.ts usGroupsFor = 정의 + 메뉴 관리 설정 + 권한)를 한 번 만들어 여기에 싣고,
 * 머리 메뉴·좌측 메뉴는 지금 역할(주소의 role)에 맞는 것을 꺼내 쓴다.
 * 셸은 역할을 바꿔도 다시 그려지지 않으므로(레이아웃) 일곱 역할 것을 모두 싣고 브라우저에서 고른다 — UserBox 와 같은 방식.
 *
 * 좌측 공용 부품(components/us/MenuSide.tsx)이 useMenuGroups() 를 쓰면 이름 바꾸기·순서까지 좌측에 반영된다(「요청」).
 */
import { createContext, useContext } from "react";
import { useSearchParams } from "next/navigation";
import { US_GROUPS, type MenuGroup } from "@/lib/menu";
import { normRole } from "@/lib/perm";

type Ctx = { menus: Record<string, MenuGroup[]>; css: Record<string, string> } | null;
const C = createContext<Ctx>(null);

export function MenuProvider({ menus, css, children }: { menus: Record<string, MenuGroup[]>; css: Record<string, string>; children: React.ReactNode }) {
  return <C.Provider value={{ menus, css }}>{children}</C.Provider>;
}

/** 지금 역할 — 주소의 role(없으면 총괄) */
export function useRole(): string {
  const sp = useSearchParams();
  return normRole(sp?.get("role"));
}

/** 지금 역할의 머리 메뉴 묶음들. 셸 밖(휴대폰 화면 등)에서는 정의 그대로. */
export function useMenuGroups(): MenuGroup[] {
  const ctx = useContext(C);
  const role = useRole();
  return ctx?.menus[role] || US_GROUPS;
}

/** 지금 역할의 좌측 숨김 글자(CSS) */
export function useSideCss(): string {
  const ctx = useContext(C);
  const role = useRole();
  return ctx?.css[role] || "";
}
