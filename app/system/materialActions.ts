"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable } from "@/lib/data";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { ACTS, BYEOLPYO5, checkInput } from "@/lib/material";
import { ymd } from "@/lib/day";
import { attachOf } from "@/lib/attach";

/**
 * 원료·제조물 대장 — 품목 등록·판단 고치기·경영책임자 확인 (2026-09-22)
 * 모두 appendRow / patchRow 로만 쓴다. 검사는 lib/material.ts checkInput 한 곳(화면과 같은 검사).
 */
const today = () => ymd();
const v = (f: FormData, k: string) => String(f.get(k) || "").trim();
const byOf = (f: FormData) => ROLE_STAFF[v(f, "role") || "gm"] || "SM01-1";
const ACT_KEYS: string[] = ACTS.map((a) => a.key);
const B5_NOS: string[] = BYEOLPYO5.map((b) => b.no);

function back(role: string, q: string, hash = "mat"): never {
  redirect(`/system?area=M&role=${role}${q ? `&${q}` : ""}#${hash}`);
}

/** 품목 한 줄 저장 — item_id 가 있으면 고치고, 없으면 새로 올린다. */
export async function saveMaterial(f: FormData) {
  const role = v(f, "role") || "gm";
  const id = v(f, "item_id");
  const acts = f.getAll("acts").map(String).filter((a) => ACT_KEYS.includes(a));
  const b5mode = v(f, "b5mode"); // unk · no · yes
  const b5nos = f.getAll("b5").map(String).filter((n) => B5_NOS.includes(n));
  const byeolpyo5 = b5mode === "no" ? "N" : b5mode === "yes" ? b5nos.join(";") : "";
  const input = {
    name: v(f, "item_name"), dept: v(f, "dept_id"), acts, verdict: v(f, "verdict"),
    reason: v(f, "reason"), basis: v(f, "basis_ref"),
  };
  const err = checkInput(input) || (b5mode === "yes" && !b5nos.length ? "별표 5 「해당」이면 호를 하나 이상 고릅니다." : "");
  if (err) back(role, `merr=${encodeURIComponent(err)}${id ? `&medit=${id}` : "&madd=1"}`);

  const by = byOf(f);
  const decided = input.verdict !== "확인 필요";
  const row: Record<string, string> = {
    item_name: input.name, dept_id: input.dept, owner_staff_id: v(f, "owner_staff_id"),
    acts: acts.join(";"), byeolpyo5, related_law: v(f, "related_law"),
    verdict: input.verdict, reason: input.reason, basis_ref: input.basis,
    updated_at: today(),
  };

  if (id) {
    const old = (await readTable("material_item", "item_id")).find((r: any) => r.item_id === id);
    if (!old) back(role, `merr=${encodeURIComponent("고칠 품목을 찾지 못했습니다.")}`);
    // 판단이나 사유가 바뀌면 판단자·판단일을 새로 적고, 경영책임자 확인은 다시 받는다.
    const changed = old.verdict !== row.verdict || old.reason !== row.reason || old.acts !== row.acts || old.byeolpyo5 !== row.byeolpyo5;
    if (changed) {
      Object.assign(row, decided ? { judged_by: by, judged_at: today() } : { judged_by: "", judged_at: "" });
      Object.assign(row, { ceo_confirmed_at: "", ceo_confirmed_by: "", ceo_proxy: "" });
    }
    await patchRow("material_item", "item_id", id, row, by, `원료·제조물 판단 ${row.verdict}`);
  } else {
    const nid = `MAT-${Date.now().toString(36).toUpperCase()}`;
    await appendRow("material_item", {
      item_id: nid, ...row,
      judged_by: decided ? by : "", judged_at: decided ? today() : "",
      ceo_confirmed_at: "", ceo_confirmed_by: "", ceo_proxy: "", created_by: by, note: "화면에서 등록",
    }, by, `원료·제조물 품목 등록 · ${row.verdict}`);
  }
  revalidatePath("/system"); revalidatePath("/exec"); revalidatePath("/evidence");
  back(role, "msaved=1");
}

/**
 * 시행령 제8조제5호 — 제1호(인력)·제2호(예산) 반기 점검 기록. 체계 기록 표(system_record)에 clause_no 「M8-5」로 한 줄.
 * 경영책임자 보고받음은 경영책임자 본인 또는 총괄의 대리 기록만 받는다(제4조 기록과 같은 규칙).
 */
export async function recordMaterialHalf(f: FormData) {
  const role = v(f, "role") || "gm";
  const d = v(f, "done_at") || today();
  const c = ceoConfirm(role);
  const rep = c.ok && v(f, "ceo_reported") === "Y";
  if (!v(f, "content")) back(role, `merr=${encodeURIComponent("점검 내용을 적습니다(인력·예산을 무엇으로 점검했는지).")}`, "m5rec");
  const ev = await attachOf(f, "doc_name"); // [캡처 v2] K03 — 점검 기록 파일 첨부
  await appendRow("system_record", {
    record_id: `SYR-${Date.now().toString(36).toUpperCase()}`, clause_no: "M8-5", mok: "", record_kind: "반기 점검",
    title: "원료·제조물 인력·예산 반기 점검(시행령 제8조제5호)", target_role: "", target_ref: "", target_staff_id: "",
    dept_id: "", done_at: d, half: `${d.slice(0, 4)} ${+d.slice(5, 7) <= 6 ? "상반기" : "하반기"}`,
    checker_staff_id: byOf(f), content: v(f, "content"), action_needed: v(f, "action_needed"), action_done_at: "",
    covers: "", score: "", item_scores: "", substitute: "", budget_amount: "", doc_name: ev.evidence_name, evidence_url: ev.evidence_url,
    ceo_reported: rep ? "Y" : "", reported_at: rep ? today() : "", report_method: rep ? "대면 보고" : "", report_proxy: rep && c.proxy ? "Y" : "",
    created_by: byOf(f), note: "화면에서 등록",
  }, byOf(f), "원료·제조물 제8조제5호 반기 점검");
  revalidatePath("/system"); revalidatePath("/exec");
  back(role, "msaved=1", "m5rec");
}

/** 경영책임자 확인 —「해당」「비해당」으로 정한 품목만. 경영책임자 본인 또는 총괄의 대리 기록. */
export async function confirmMaterial(f: FormData) {
  const role = v(f, "role") || "gm";
  const id = v(f, "item_id");
  const c = ceoConfirm(role);
  if (!c.ok) back(role, `merr=${encodeURIComponent("경영책임자 확인은 경영책임자 또는 총괄 부서만 적습니다.")}`);
  const old = (await readTable("material_item", "item_id")).find((r: any) => r.item_id === id);
  if (!old || old.verdict === "확인 필요") back(role, `merr=${encodeURIComponent("「해당」「비해당」으로 정한 품목만 확인합니다.")}`);
  await patchRow("material_item", "item_id", id, {
    ceo_confirmed_at: today(), ceo_confirmed_by: ROLE_STAFF[role] || "", ceo_proxy: c.proxy ? "Y" : "",
  }, byOf(f), `원료·제조물 판단 경영책임자 확인 · ${old.verdict}`);
  revalidatePath("/system"); revalidatePath("/exec");
  back(role, "msaved=1");
}
