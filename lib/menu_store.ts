/**
 * 메뉴 관리 설정 읽기·쓰기(09-25 사용자: 시스템 관리 › 메뉴 관리).
 * 표 sys_menu 에 설정 전체를 한 줄(JSON)로 쌓고 가장 최근 줄을 읽는다 — 지우지 않으므로 이력이 남는다.
 * 「기본값으로 되돌리기」 = 빈 설정({}) 한 줄을 더 쌓는다. 정의 원천(lib/menu.ts US_GROUPS)은 건드리지 않는다.
 */
import "server-only";
import { readTable } from "@/lib/data";
import { appendRow } from "@/lib/write";
import { ALL_ROLES } from "@/lib/perm";
import { usGroupsFor, sideHideCss, type MenuSettings, type MenuGroup } from "@/lib/menu";

export const MENU_TABLE = "sys_menu";

const stamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** 가장 최근 설정 + 저장 시각·저장한 사람 */
export async function menuSettingsRow(): Promise<{ set: MenuSettings; at: string; by: string; n: number }> {
  let rows: any[] = [];
  try { rows = await readTable(MENU_TABLE); } catch { rows = []; }
  const last = rows.find((r) => r.menu_rid === "ALL");
  let set: MenuSettings = {};
  try { set = last?.data ? (typeof last.data === "string" ? JSON.parse(last.data) : last.data) : {}; } catch { set = {}; }
  return { set, at: String(last?.at || ""), by: String(last?.by || ""), n: rows.filter((r) => r.menu_rid === "ALL").length };
}

export async function menuSettings(): Promise<MenuSettings> {
  return (await menuSettingsRow()).set;
}

export async function saveMenuSettings(set: MenuSettings, by: string, action: string) {
  await appendRow(MENU_TABLE, { menu_rid: "ALL", data: JSON.stringify(set), at: stamp(), by }, by, action);
}

/** 역할마다의 머리 메뉴와 좌측 숨김 글자 — 셸이 한 번 만들어 머리 메뉴 부품에 넘긴다. */
export async function menusForAllRoles(): Promise<{ menus: Record<string, MenuGroup[]>; css: Record<string, string> }> {
  const set = await menuSettings();
  const menus: Record<string, MenuGroup[]> = {};
  const css: Record<string, string> = {};
  for (const r of ALL_ROLES) { menus[r] = usGroupsFor(r, set); css[r] = sideHideCss(r, set); }
  return { menus, css };
}
