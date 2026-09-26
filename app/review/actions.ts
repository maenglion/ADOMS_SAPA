"use server";
import { revalidatePath } from "next/cache";
import { judge, patchRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { inspectionsByTask, actionsByInsp, FLAGGED } from "@/lib/cycle";
import { actionTypeOf } from "@/lib/remedy";
import { ymd } from "@/lib/day";

const who = (role: string) => ROLE_STAFF[role] || "SD02-1";
type Result = "적합" | "보완필요" | "부적합";

/**
 * 판정 한 건 — 판정 기록을 남기고, 그것이 몇 번째 판정인지(round_no)를 적는다.
 * 앞 판정이 보완필요·부적합이었고 이번에 적합이면 그 조치를 「완료」로 닫는다(⑥ 재점검 루프의 끝).
 */
export async function judgeWithRound(task_id: string, result: Result, finding: string, by: string, need = "") {
  const before = (await inspectionsByTask()).get(task_id) || [];
  const prev = before[0];
  const row = await judge({ task_id, result, finding, by });
  // 보완·부적합이면 판정자가 고른 「필요한 조치」(인력 배치·예산 추가 편성·집행 등)를 판정 기록에 남긴다 → ⑥ 조치 요구의 기본값.
  const action_need = FLAGGED(result) ? actionTypeOf(need, result) : "";
  await patchRow("inspection", "insp_id", row.insp_id,
    { round_no: before.length + 1, ...(action_need ? { action_need } : {}) }, by, `판정 차수 ${before.length + 1}차`);
  if (prev && FLAGGED(prev.result)) {
    const a = (await actionsByInsp()).get(prev.insp_id);
    if (a) {
      const today = ymd();
      await patchRow("action", "action_id", a.action_id,
        result === "적합"
          ? { result: "완료", done_at: a.done_at || today, rejudged_insp_id: row.insp_id }
          : { result: "재조치", rejudged_insp_id: row.insp_id },
        by, `재판정 ${result}`);
    }
  }
  return row;
}

function refresh() {
  ["/review", "/inspections", "/actions", "/status", "/evidence", "/"].forEach((p) => revalidatePath(p));
}

/** 한 건 판정. */
export async function judgeOne(form: FormData) {
  const role = String(form.get("role") || "mgr");
  const task_id = String(form.get("task_id") || "");
  const result = String(form.get("result") || "") as Result;
  if (!task_id || !result) return;
  await judgeWithRound(task_id, result, String(form.get("finding") || ""), who(role), String(form.get("need") || ""));
  refresh();
}

/** 골라 놓은 것을 한꺼번에 판정 — 반기 점검에서 수십 건을 한 번에 치운다. */
export async function judgeMany(form: FormData) {
  const role = String(form.get("role") || "mgr");
  const result = String(form.get("result") || "") as Result;
  const ids = form.getAll("pick").map(String).filter(Boolean);
  if (!result || ids.length === 0) return;
  const finding = String(form.get("finding") || "");
  const need = String(form.get("need") || "");
  for (const task_id of ids) {
    await judgeWithRound(task_id, result, finding, who(role), need);
    // 판정 번호가 시각(밀리초)으로 만들어지므로 같은 번호가 나지 않게 한 틈을 둔다.
    await new Promise((r) => setTimeout(r, 3));
  }
  refresh();
}
