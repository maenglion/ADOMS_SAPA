"use server";
// [캡처 v2] K08(2026-09-24) — 재해 구분 탭의 틀로 새 줄을 만들고, 줄마다 집행 기록(일자·내역·금액·증빙 이름)을 받는다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable } from "@/lib/data";
import { ROLE_STAFF } from "@/lib/roles";
import { FRAMES, isArea, type AreaKey } from "./model";
import { ymd } from "@/lib/day";
import { attachOf } from "@/lib/attach";

/**
 * 입력 단위는 천원(참고 명세 「편성액 (천원)」) — 저장은 원 단위.
 */
const won = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  return s === "" ? null : Number(s) * 1000;
};
const today = () => ymd();
const back = (role: string, area: string, dept: string, extra: string, hash = "form") =>
  `/budget?role=${role}&area=${area}&dept=${dept}${extra}#${hash}`;
const refresh = () => ["/budget", "/system", "/exec", "/evidence", "/ceo", "/report"].forEach((p) => revalidatePath(p));

/**
 * 예산 편성·집행 저장 — 지금 탭(재해 구분)의 고정 6행.
 *   · 이미 있는 행은 바뀐 칸만 patchRow
 *   · 빈 행(n0~n5)에 금액을 넣으면 appendRow 로 새 행 — 재해 구분은 탭 값, 용도·근거는 그 탭의 틀
 */
export async function saveBudget(form: FormData) {
  const role = String(form.get("role") || "gm");
  const dept = String(form.get("dept_id") || "");
  const year = String(form.get("fiscal_year") || "2026");
  const a = String(form.get("area") || "");
  const by = ROLE_STAFF[role] || "SM01-1";
  if (!dept) return;
  if (!isArea(a)) redirect(back(role, "I", dept, `&err=${encodeURIComponent("재해 구분이 없습니다")}`));
  const area = a as AreaKey;
  const f = FRAMES[area];

  let changed = 0;
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("o_")) continue;
    const id = k.slice(2);
    const [op, oe] = String(v).split("|").map(Number);
    const p = won(form.get(`p_${id}`));
    const e = won(form.get(`e_${id}`));
    const patch: Record<string, any> = {};
    if (p !== null && p !== op) patch.planned_amount = String(p);
    if (e !== null && e !== oe) patch.executed_amount = String(e);
    const na = String(form.get(`a_${id}`) || "");
    if (isArea(na) && na !== String(form.get(`oa_${id}`) || "")) patch.area = na;
    if (Object.keys(patch).length) {
      patch.updated_at = today();
      await patchRow("safety_budget", "budget_id", id, patch, by, "예산 편성·집행 수정");
      changed++;
    }
  }

  for (let i = 0; i < f.items.length; i++) {
    const p = won(form.get(`np_${i}`));
    const e = won(form.get(`ne_${i}`));
    if (!p && !e) continue;
    const it = f.items[i];
    const risk = String(form.get(`nr_${i}`) || "");
    const memo = String(form.get(`nm_${i}`) || "").trim();
    await appendRow("safety_budget", {
      budget_id: `BUD-${Date.now().toString(36).toUpperCase()}${i}`,
      fiscal_year: year, dept_id: dept, target_code: "",
      budget_kind: "", budget_item: it.item, budget_use: it.use, area,
      use_basis: it.use === "밖" ? "" : `${f.basis}${it.use}목`,
      planned_amount: String(p || 0), executed_amount: String(e || 0),
      risk_item_id: area === "I" && it.use === "나" ? risk : "", duty_key: "", updated_at: today(),
      note: `화면에서 등록${memo ? " · " + memo : ""}`,
    }, by, `예산 편성 등록 — ${it.item}`);
    changed++;
  }

  refresh();
  redirect(back(role, area, dept, `&saved=${changed}`));
}

/**
 * 집행 기록 한 건 — budget_exec 에 쌓고, 그 줄의 집행액(executed_amount)에 더한다.
 * 집행액을 함께 올려야 경영책임자 보고·체계 화면의 집행률도 같이 움직인다.
 * 증빙은 파일 첨부(evidence_file → lib/attach.ts) 또는 파일 이름 글자(evidence_name). 행에 evidence_url 을 함께 남긴다(K03, 09-24).
 */
export async function addExec(form: FormData) {
  const role = String(form.get("role") || "gm");
  const area = String(form.get("area") || "I");
  const dept = String(form.get("dept_id") || "");
  const id = String(form.get("budget_id") || "");
  const by = ROLE_STAFF[role] || "SM01-1";
  const date = String(form.get("exec_date") || "").trim();
  const desc = String(form.get("exec_desc") || "").trim();
  const amt = won(form.get("amount"));
  const evid = String(form.get("evidence_name") || "").trim();
  const err = (m: string) => redirect(back(role, area, dept, `&line=${id}&xerr=${encodeURIComponent(m)}`, "line"));

  const row = (await readTable("safety_budget", "budget_id")).find((r) => r.budget_id === id);
  if (!row) err("예산 줄을 찾지 못했습니다");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) err("집행 일자를 넣습니다");
  if (!desc) err("집행 내역을 넣습니다");
  if (!amt) err("금액을 넣습니다");

  const ev = await attachOf(form); // [캡처 v2] K03
  await appendRow("budget_exec", {
    exec_id: `BEX-${Date.now().toString(36).toUpperCase()}`,
    budget_id: id, exec_date: date, exec_desc: desc, amount: String(amt),
    evidence_name: ev.evidence_name || evid, evidence_url: ev.evidence_url, created_by: by, created_at: today(),
  }, by, `예산 집행 기록 — ${row!.budget_item || id}`);
  await patchRow("safety_budget", "budget_id", id, {
    executed_amount: String(Number(row!.executed_amount || 0) + (amt as number)), updated_at: today(),
  }, by, "예산 집행액 더함");

  refresh();
  redirect(back(role, area, dept, `&line=${id}&xsaved=1`, "line"));
}
