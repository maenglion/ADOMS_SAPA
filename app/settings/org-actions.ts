"use server";
// [캡처 v2] 설정 › 기관 정보 · 관리대상 관리 — 저장(2026-09-23)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { ORG_FIELDS, orgProfile } from "@/lib/org";
import { assetSeed } from "@/lib/data";

const by = (f: FormData) => ROLE_STAFF[String(f.get("role") || "gm")] || "SD01-1";

/** 기관 기본 정보 저장 — 새 행을 쌓는다(가장 최근 행을 읽는다). */
export async function saveOrg(f: FormData) {
  const cur = await orgProfile();
  const row: Record<string, string> = { ...cur, updated_at: new Date().toISOString().slice(0, 16).replace("T", " "), updated_by: by(f) };
  for (const x of ORG_FIELDS) row[x.key] = String(f.get(x.key) ?? cur[x.key] ?? "").trim();
  await appendRow("org_profile", row, by(f), "기관 정보 수정");
  revalidatePath("/settings/org");
  redirect(`/settings/org?role=${f.get("role") || "gm"}&saved=1`);
}

/** 관리대상(자산) 하나 더하기 — 관리대상 유형을 고르면 그 유형의 의무가 저절로 걸린다. */
export async function addAsset(f: FormData) {
  const name = String(f.get("asset_name") || "").trim();
  const target = String(f.get("target_code") || "").trim();
  if (!name) redirect(`/settings/assets?role=${f.get("role") || "gm"}&err=name`);
  const n = assetSeed(true).filter((a) => String(a.asset_id).startsWith("NEW-")).length + 1;
  const id = `NEW-${String(n).padStart(4, "0")}`;
  await appendRow("asset", {
    asset_id: id, asset_name: name, asset_gbn: String(f.get("asset_gbn") || ""), asset_kind: String(f.get("asset_kind") || ""),
    asset_class: String(f.get("asset_class") || ""), safety_grade: "", completed_ymd: String(f.get("completed_ymd") || "").replace(/-/g, ""),
    addr: String(f.get("addr") || ""), dept_id: String(f.get("dept_id") || ""), source: "기관 입력", sapa_l2_result: "", sapa_basis: "",
    need_data: "", verified: "N",
  }, by(f), "관리대상 추가");
  if (target) await appendRow("asset_target_map", { asset_id: id, target_code: target, basis: "기관 입력", confidence: "manual" }, by(f), "관리대상 유형 연결");
  revalidatePath("/", "layout");
  redirect(`/settings/assets?role=${f.get("role") || "gm"}&added=${id}`);
}

/** 관리대상 빼기 — 지우지 않고 「뺌」 표시만 한다(되살릴 수 있다). */
export async function removeAsset(f: FormData) {
  const id = String(f.get("asset_id") || "");
  const undo = f.get("undo") === "1";
  await patchRow("asset", "asset_id", id, { deleted: undo ? "" : "Y" }, by(f), undo ? "관리대상 되살림" : "관리대상 뺌");
  revalidatePath("/", "layout");
  redirect(`/settings/assets?role=${f.get("role") || "gm"}${undo ? "" : `&removed=${encodeURIComponent(id)}`}`);
}
