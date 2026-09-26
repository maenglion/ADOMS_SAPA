"use server";
// 09-25 사용자: 「시스템 관리(메뉴, 코드)와 메일 발송은 포함하자」 — 메뉴 관리 · 코드 관리 저장. 총괄만(lib/perm.ts · guard).
// 모든 변경은 한 줄씩 쌓는다(appendRow) — 지우지 않고, 가장 최근 줄을 읽는다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { guard } from "@/lib/perm_server";
import { ALL_ROLES, canAccess } from "@/lib/perm";
import { US_GROUPS, gKey, iKey, isLocked, LOCKED_GROUP, type MenuSettings, type MenuItemSet } from "@/lib/menu";
import { saveMenuSettings } from "@/lib/menu_store";
import { CODE_SETS, CODE_TABLE, codesOf } from "@/lib/codes";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const now = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* ── 메뉴 관리 ─────────────────────────────────────────────── */

/** 화면의 칸 → 설정(기본값과 다른 것만 남긴다) */
export async function saveMenu(f: FormData) {
  const role = await guard("/admin/system/menu", f);
  const by = ROLE_STAFF[role] || "SD01-1";
  const set: MenuSettings = { groups: {}, items: {} };
  US_GROUPS.forEach((g, gi) => {
    const gk = gKey(g.label);
    const gl = s(f, `g${gi}_label`), go = Number(s(f, `g${gi}_order`)), gh = s(f, `g${gi}_hide`) === "Y";
    const gs: { label?: string; hide?: boolean; order?: number } = {};
    if (gl && gl !== gk) gs.label = gl;
    if (Number.isFinite(go) && s(f, `g${gi}_order`) && go !== (gi + 1) * 10) gs.order = go;
    if (gh && gk !== LOCKED_GROUP) gs.hide = true;
    if (Object.keys(gs).length) set.groups![gk] = gs;
    g.items.forEach((m, ii) => {
      const p = `i${gi}_${ii}`;
      const it: MenuItemSet = {};
      const l = s(f, `${p}_label`), o = Number(s(f, `${p}_order`));
      if (l && l !== m.label) it.label = l;
      if (Number.isFinite(o) && s(f, `${p}_order`) && o !== (ii + 1) * 10) it.order = o;
      if (!isLocked(m.href)) {
        if (s(f, `${p}_hide`) === "Y") it.hide = true;
        if (!m.heading) {
          // 체크 = 보임. 권한표가 막은 역할은 칸이 없으므로 여기서 다루지 않는다(켤 수 없다)
          const off = ALL_ROLES.filter((r) => canAccess(r, m.href) && s(f, `${p}_seen`).includes(`|${r}|`) && !f.getAll(`${p}_r`).includes(r));
          if (off.length) it.off = off;
        }
      }
      if (Object.keys(it).length) set.items![iKey(g.label, m)] = it;
    });
  });
  await saveMenuSettings(set, by, "메뉴 관리 저장");
  revalidatePath("/", "layout");
  redirect(`/admin/system/menu?ok=save${s(f, "pv") ? `&pv=${s(f, "pv")}` : ""}`);
}

/** 기본값으로 되돌리기 — 빈 설정 한 줄을 더 쌓는다(이력은 남는다) */
export async function resetMenu(f: FormData) {
  const role = await guard("/admin/system/menu", f);
  await saveMenuSettings({}, ROLE_STAFF[role] || "SD01-1", "메뉴 관리 기본값으로 되돌리기");
  revalidatePath("/", "layout");
  redirect("/admin/system/menu?ok=reset");
}

/* ── 코드 관리 ─────────────────────────────────────────────── */

/** op = save(고치기) · off(사용 중지) · on(다시 사용) · add(추가) */
export async function saveCode(f: FormData) {
  const role = await guard("/admin/system/code", f);
  const by = ROLE_STAFF[role] || "SD01-1";
  const set = s(f, "set");
  if (!CODE_SETS.some((x) => x.id === set)) redirect("/admin/system/code");
  const op = s(f, "op");
  const cur = await codesOf(set);
  const back = (q: string) => redirect(`/admin/system/code?set=${set}&${q}`);
  if (op === "add") {
    const value = s(f, "value");
    if (!value) back("err=empty");
    if (cur.some((c) => c.value === value)) back("err=dup");
    const sort = Number(s(f, "sort")) || (Math.max(0, ...cur.map((c) => c.sort)) + 10);
    await appendRow(CODE_TABLE, { code_id: `${set}-N${Date.now().toString(36).toUpperCase()}`, set_id: set, value, sort, state: "on", note: s(f, "note"), at: now(), by }, by, "코드 추가");
    revalidatePath("/admin/system/code");
    back("ok=add");
  }
  const id = s(f, "code_id");
  const c = cur.find((x) => x.code_id === id);
  if (!c) back("err=none");
  const value = op === "save" ? s(f, "value") || c!.value : c!.value;
  if (op === "save" && cur.some((x) => x.code_id !== id && x.value === value)) back("err=dup");
  await appendRow(CODE_TABLE, {
    code_id: id, set_id: set, value,
    sort: op === "save" ? Number(s(f, "sort")) || c!.sort : c!.sort,
    state: op === "off" ? "off" : op === "on" ? "on" : c!.state,
    note: op === "save" ? s(f, "note") : c!.note, at: now(), by,
  }, by, op === "off" ? "코드 사용 중지" : op === "on" ? "코드 다시 사용" : "코드 수정");
  revalidatePath("/", "layout");
  back(`ok=${op}`);
}
