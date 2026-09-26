"use server";
import { revalidatePath } from "next/cache";
import { patchRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { ymd } from "@/lib/day";

/**
 * ② 의무 확인 — 배정 한 줄의 담당(정·부)·해당 여부·주기를 정한다. (2026-09-21)
 * 「확인필요」로 남은 배정을 사람이 「해당」 또는 「비해당」으로 닫는 자리다.
 * 비해당은 사유가 없으면 받지 않는다 — 이행률 분모에서 빠지므로 근거가 남아야 한다.
 */
export async function saveAssignment(form: FormData) {
  const role = String(form.get("role") || "gm");
  const id = String(form.get("assign_id") || "");
  const key = String(form.get("duty_key") || "");
  if (!id) return;
  const app = String(form.get("applicability") || "");
  const note = String(form.get("applicability_note") || "").trim();
  if (app === "비해당" && !note) throw new Error("비해당은 사유를 적어야 합니다.");

  const by = ROLE_STAFF[role] || "SD02-1";
  const patch: Record<string, string> = {
    owner_staff_id: String(form.get("owner_staff_id") || ""),
    deputy_staff_id: String(form.get("deputy_staff_id") || ""),
    cycle: String(form.get("cycle") || ""),
  };
  if (app) {
    patch.applicability = app;
    patch.applicability_note = note || (app === "해당" ? "담당 부서가 해당함을 확인" : "");
    patch.decided_by = by;
    patch.decided_at = ymd();
  }
  await patchRow("duty_assignment", "assign_id", id, patch, by, app ? `배정 확인 — ${app}` : "담당 변경");
  ["/duties", `/duties/${key}`, "/tasks", "/status", "/", "/inspections", "/review"].forEach((p) => revalidatePath(p));
}
