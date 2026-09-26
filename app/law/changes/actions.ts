"use server";
/** 법령 개정 현황 — 「오늘 개정 확인」 · 반영 · 항목 확인(총괄·관리자만). 쓰기는 lib/lawsync.ts 를 거쳐 공용 쓰기 경로로. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROLE_STAFF } from "@/lib/roles";
import { startRun, applyRun, decideItem } from "@/lib/lawsync";

const CAN = new Set(["gm", "mgr"]);

export async function startCheck(fd: FormData) {
  const role = String(fd.get("role") || "gm");
  const back = String(fd.get("back") || "/law/changes");
  if (!CAN.has(role)) redirect(back);
  const id = startRun(ROLE_STAFF[role] || "SD01-1");
  redirect(`/law/changes?role=${role}&run=${id}`);
}

export async function applyNow(fd: FormData) {
  const role = String(fd.get("role") || "gm");
  const id = String(fd.get("run") || "");
  if (CAN.has(role)) await applyRun(id, ROLE_STAFF[role] || "SD01-1");
  ["/law/changes", "/admin/runs", "/"].forEach((p) => revalidatePath(p));
  redirect(`/admin/runs?role=${role}&run=${id}&ok=apply`);
}

export async function decide(fd: FormData) {
  const role = String(fd.get("role") || "gm");
  const run = String(fd.get("run") || "");
  const item = String(fd.get("item") || "");
  const dec = String(fd.get("decision") || "") === "반영" ? "반영" : "반영 안 함";
  const back = String(fd.get("back") || `/admin/runs?run=${run}`);
  if (CAN.has(role)) await decideItem(run, item, dec, ROLE_STAFF[role] || "SD01-1", String(fd.get("note") || ""));
  ["/law/changes", "/admin/runs", "/duties", "/"].forEach((p) => revalidatePath(p));
  redirect(back);
}
