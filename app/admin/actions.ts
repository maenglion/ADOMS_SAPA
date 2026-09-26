"use server";
// [400 · 교육자료 버전] 묶음 B2 — 관리자(SCR-021~025) 저장. 모든 변경은 한 줄씩 쌓는다(가장 최근 줄을 읽는다).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { disOf, people, defaultLevel, grants, objects, assignedOf, basicOf, MGMT, lawRegistry, type Dis } from "./_lib";
import { HQ_NAME, HQ_ADDR } from "../law/_lib";
import { orgProfile, ORG_FIELDS } from "@/lib/org";
import { duties } from "@/lib/data";
// 09-25 사용자: 권한 제어 — 쓰기도 막는다. 각 액션 맨 앞 guard(메뉴 주소) — 권한이 없으면 저장하지 않고 안내 화면으로(규칙 lib/perm.ts)
import { guard } from "@/lib/perm_server";

const by = (f: FormData) => ROLE_STAFF[String(f.get("role") || "gm")] || "SD01-1";
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const now = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** 돌아갈 주소 — 폼이 넘긴 back(검색 조건 유지) */
const back = (f: FormData, extra = "") => {
  const b = s(f, "back") || "/admin/role";
  return b + (extra ? (b.includes("?") ? "&" : "?") + extra : "");
};

/* ── SCR-021 담당자 권한지정 ───────────────────────────────────────── */
async function grant(f: FormData, d: Dis, sid: string, kind: string, lvPick: string, action: string) {
  const ps = await people();
  const p = ps.find((x) => x.staff_id === sid);
  if (!p) return;
  const level = Number(lvPick) || defaultLevel(p, p.dept_role);
  await appendRow("usb2_role", { rid: `${d}|${sid}`, disaster: d, staff_id: sid, level, kind, state: "on", at: now(), by: by(f) }, by(f), action);
}

/** 좌측 「추가」(실·국·본부 담당자) · 「지정」(부담당자) */
export async function grantRole(f: FormData) {
  await guard("/admin/role", f);
  const d = disOf(s(f, "d"));
  const add = s(f, "add"), sub = s(f, "sub");
  if (add) await grant(f, d, add, "정", s(f, "lv"), "담당자 권한 지정");
  if (sub) await grant(f, d, sub, "부", s(f, "lv"), "부담당자 지정");
  revalidatePath("/admin", "layout");
  redirect(back(f, `ok=${add ? "add" : "sub"}`));
}

/** 우측 「제외」 */
export async function revokeRole(f: FormData) {
  await guard("/admin/role", f);
  const d = disOf(s(f, "d")), sid = s(f, "sid");
  const g = (await grants(d)).find((x) => x.staff_id === sid);
  await appendRow("usb2_role", { rid: `${d}|${sid}`, disaster: d, staff_id: sid, level: g?.level || "", kind: g?.kind || "", state: "off", at: now(), by: by(f) }, by(f), "담당자 권한 제외");
  revalidatePath("/admin", "layout");
  redirect(back(f, "ok=off"));
}

/** 권한인계 — 넘기는 사람의 권한·관리대상을 받는 사람에게 옮기고, 넘기는 사람은 제외한다. */
export async function handover(f: FormData) {
  await guard("/admin/role", f);
  const d = disOf(s(f, "d")), from = s(f, "from"), to = s(f, "to");
  if (!from || !to || from === to) redirect(back(f, "err=handover"));
  const gs = await grants(d);
  const g = gs.find((x) => x.staff_id === from);
  if (!g) redirect(back(f, "err=handover"));
  const objs = await objects(d);
  const { ids } = await assignedOf(d, g!, objs);
  await appendRow("usb2_role", { rid: `${d}|${to}`, disaster: d, staff_id: to, level: g!.level, kind: g!.kind, state: "on", at: now(), by: by(f) }, by(f), "권한인계(받음)");
  await appendRow("usb2_role", { rid: `${d}|${from}`, disaster: d, staff_id: from, level: g!.level, kind: g!.kind, state: "off", at: now(), by: by(f) }, by(f), "권한인계(넘김)");
  await appendRow("usb2_assign", { map_id: `${d}|${to}`, disaster: d, staff_id: to, targets: [...ids].join(";"), at: now(), by: by(f) }, by(f), "권한인계 관리대상");
  revalidatePath("/admin", "layout");
  redirect(back(f, "ok=handover"));
}

/* ── SCR-022 담당자 관리대상 지정 ──────────────────────────────────── */
/** 체크 하나(k) 또는 보이는 것 전체(all=on|off, ids=…) — 누르는 즉시 반영(명세: 저장 단추 없음) */
export async function toggleAssign(f: FormData) {
  await guard("/admin/assign", f);
  const d = disOf(s(f, "d")), sid = s(f, "sid");
  const g = (await grants(d)).find((x) => x.staff_id === sid);
  if (!g) redirect(back(f));
  const objs = await objects(d);
  const { ids } = await assignedOf(d, g!, objs);
  const k = s(f, "k"), all = s(f, "all");
  if (k) { if (ids.has(k)) ids.delete(k); else ids.add(k); }
  if (all) {
    const vis = s(f, "ids").split(";").filter(Boolean);
    for (const id of vis) { if (all === "on") ids.add(id); else ids.delete(id); }
  }
  await appendRow("usb2_assign", { map_id: `${d}|${sid}`, disaster: d, staff_id: sid, targets: [...ids].join(";"), at: now(), by: by(f) }, by(f), "담당자 관리대상 지정");
  revalidatePath("/admin/assign");
  redirect(back(f));
}

/* ── SCR-023 기본정보 ─────────────────────────────────────────────── */
export async function saveBasic(f: FormData) {
  await guard("/admin/basic", f);
  // 본청은 부서별(dept_id = 부서) · 나머지 사업장은 사업장 단위(dept_id 칸에 사업장 번호) — 09-24 사업장 20곳
  const dept = s(f, "dept_id");
  const wp = s(f, "wp_id") || "WP-01";
  const siteName = s(f, "site_name") || HQ_NAME;
  const siteAddr = s(f, "site_addr") || HQ_ADDR;
  const del = s(f, "delete") === "Y";
  const cur = (await basicOf(dept)) || {};
  const row: Record<string, string> = {
    dept_id: dept, wp_id: wp, site_name: siteName, addr: s(f, "addr") || cur.addr || siteAddr,
    ind_class: s(f, "ind_class"), ind_code: s(f, "ind_code"), deleted: del ? "Y" : "", at: now(), by: by(f),
  };
  for (const m of MGMT) row[m.key] = del ? "" : s(f, m.key);
  if (del) { row.ind_class = ""; row.ind_code = ""; row.addr = siteAddr; }
  await appendRow("usb2_basic", row, by(f), del ? "사업장 기본정보 삭제처리" : "사업장 기본정보 수정");
  revalidatePath("/admin/basic");
  redirect(`/admin/basic?d=ind&wp=${wp}${wp === "WP-01" ? `&dept=${dept}` : ""}&ok=${del ? "del" : "save"}`);
}

/** 중대시민재해 기본정보 = 기관 정보(설정 › 기관 정보와 같은 표 org_profile 을 쓴다) */
export async function saveOrgBasic(f: FormData) {
  await guard("/admin/basic", f);
  const cur = await orgProfile();
  const row: Record<string, string> = { ...cur, updated_at: now(), updated_by: by(f) };
  for (const x of ORG_FIELDS) row[x.key] = String(f.get(x.key) ?? cur[x.key] ?? "").trim();
  await appendRow("org_profile", row, by(f), "기관 정보 수정");
  revalidatePath("/admin/basic");
  revalidatePath("/settings/org");
  redirect(`/admin/basic?d=civ&ok=save`);
}

/* ── SCR-024·025 관계 법령 관리 ───────────────────────────────────── */
/** 신규 등록 — 우리 의무 목록의 문서를 이 재해구분·대상 유형에 등록한다. */
export async function registerLaw(f: FormData) {
  await guard("/admin/law", f);
  const d = disOf(s(f, "d")), doc = s(f, "doc");
  const [ta, tt] = s(f, "tsel").split("|");            // 중대시민재해: 「영역|관리대상 유형 코드」
  const area = d === "ind" ? "I" : ta || "F";
  const tc = d === "ind" ? "" : tt || "";
  const src = (await duties({ limit: 1000000 })).filter((r) => r.doc === doc);
  const one = src[0] || {};
  const tn = tc ? String((await duties({ target: tc, limit: 1 }))[0]?.target_name || "") : "";
  await appendRow("usb2_law", {
    law_rid: `${area}|${tc}|${doc}`, disaster: d, area, target_code: tc, target_name: tn, doc, law: one.law || "", layer: one.layer || "",
    n: src.filter((r) => r.area === area && (!tc || r.target_code === tc)).length, y: src.filter((r) => r.area === area && (!tc || r.target_code === tc) && r.yongin_mark === "Y").length,
    apply: s(f, "apply") || "중대재해처벌법 의무사항", state: "on", at: now(), by: by(f),
  }, by(f), "관계 법령 등록");
  revalidatePath("/admin/law");
  redirect(`/admin/law?d=${d}&ok=reg`);
}

/** 목록에서 제외 / 다시 등록 */
export async function toggleLaw(f: FormData) {
  await guard("/admin/law", f);
  const d = disOf(s(f, "d")), key = s(f, "key"), state = s(f, "state") === "on" ? "on" : "off";
  const reg = (await lawRegistry(d)).find((r) => r.key === key);
  if (reg) {
    await appendRow("usb2_law", {
      law_rid: key, disaster: d, area: reg.area, target_code: reg.target_code, target_name: reg.target_name, doc: reg.doc, law: reg.law,
      layer: reg.layer, n: reg.n, y: reg.y, apply: s(f, "apply") || reg.apply, state, at: now(), by: by(f),
    }, by(f), state === "on" ? "관계 법령 다시 등록" : "관계 법령 목록에서 제외");
  }
  revalidatePath("/admin/law");
  redirect(back(f, `ok=${state}`));
}
