"use server";
import { revalidatePath } from "next/cache";
import { resetOverlay } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";

/**
 * 화면에서 입력한 것 모두 지우기 — 시연을 처음 상태로 되돌린다(2026-09-21).
 * 원래 자료(예시 자료 판)는 그대로이고, 화면에서 쌓인 입력·판정·조치·사진 기록만 비운다.
 * 누르기 전에 화면에서 한 번 더 확인을 받는다(ResetButton).
 */
export async function resetInputs(form: FormData) {
  const role = String(form.get("role") || "gm");
  await resetOverlay(ROLE_STAFF[role] || "SD01-1");
  revalidatePath("/", "layout");
}
