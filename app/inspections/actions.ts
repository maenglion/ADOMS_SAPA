"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { batchList, nextBatchId, loadCycle, codeCatalog, ruleBasisOf } from "@/lib/cycle";

/**
 * ③ 점검 계획 · ⑦ 회차 결재의 쓰기. 공용 appendRow·patchRow 로만 쓴다.
 *   ③ 취합 시작  → inspection_batch 새 행(진행중 · rule_basis 자동)
 *   ⑦ 결재 상신  → 결재요청 (판정 대기 0 일 때만)
 *   ⑦ 결재 확정  → 결재완료 (경영책임자만)
 *   ⑦ 돌려보내기 → 진행중
 */
const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const now = () => new Date().toISOString();
const all = (f: FormData, k: string) => f.getAll(k).map(String).filter(Boolean);

function refresh() {
  ["/inspections", "/review", "/actions", "/report", "/status", "/calendar", "/"].forEach((p) => revalidatePath(p));
}

/** ③ 취합 시작 — 고른 확보의무 대분류·의무조항 × 부서 × 연도·반기로 점검을 연다. */
export async function createBatch(form: FormData) {
  const role = String(form.get("role") || "gm");
  const year = String(form.get("year") || "");
  const half = String(form.get("half") || "");
  const deptIds = all(form, "d");
  const cat = await codeCatalog();
  const axes = all(form, "ax").map(Number);
  const codes = new Set(all(form, "c"));
  axes.forEach((i) => cat[i]?.codes.forEach((c) => codes.add(c.code)));
  if (!year || !half || codes.size === 0 || deptIds.length === 0) return;

  const batches = await batchList();
  const batch_id = nextBatchId(batches);
  const by = who(role);
  await appendRow("inspection_batch", {
    batch_id,
    title: String(form.get("title") || "").trim() || `${year}년 ${half} 안전보건 의무이행 점검`,
    period_year: year, half_year: half, scope_dept_id: "D02",
    target_dept_ids: deptIds.join(","), code36_list: [...codes].sort().join(","),
    // 근거 주기 — 의무조항 코드 → 주기 표(lib/cycle.ts CODE_CYCLE)로 자동으로 채운다(09-21).
    rule_basis: ruleBasisOf([...codes]),
    status: "진행중", started_by: by, started_at: now().slice(0, 10), approved_by: "",
    note: "화면에서 연 점검",
  }, by, "점검 취합 시작");
  refresh();
  redirect(`/inspections?role=${role}&b=${batch_id}&made=1`);
}

/**
 * ⑦ 결재 상신 — 판정 대기가 0 이어야 한다. 상신할 때의 숫자를 함께 적어 둔다.
 * 조치 중인 건이 남아 있어도 상신할 수 있되 **사유를 적어야 한다**(사용자 결정 2026-09-21 · 나중에 바꿀 수 있음).
 * 사유는 open_reason 에 남아 경영책임자 결재 화면에 보인다.
 */
export async function submitBatch(form: FormData) {
  const role = String(form.get("role") || "gm");
  const b = String(form.get("b") || "");
  const cy = await loadCycle(b);
  if (!cy.batch || cy.batch.batch_id !== b || cy.batch.status !== "진행중" || !cy.canSubmit) return;
  const c = cy.count;
  const open_reason = String(form.get("open_reason") || "").trim();
  const open_kind = String(form.get("open_kind") || "").trim();
  if (c.조치중 > 0 && !open_reason) throw new Error("조치 중인 건이 있으면 상신 사유를 적어야 합니다.");
  // 위탁 점검이면 결과를 보고받은 날이 있어야 상신한다(시행령 제5조·제9조·제11조 각 제2항제1호 「지체 없이 보고받을 것」).
  if (cy.batch.insp_method === "위탁 점검" && !cy.batch.report_received_at) {
    redirect(`/inspections?role=${role}&view=approve&b=${b}&err=report#method`);
  }
  await patchRow("inspection_batch", "batch_id", b, {
    open_reason, open_kind,
    status: "결재요청", requested_by: who(role), requested_at: now(),
    n_total: c.total, n_ok: c.적합, n_fix: c.보완필요, n_bad: c.부적합, n_open: c.조치중, n_unsubmitted: c.미제출,
    return_reason: "",
  }, who(role), "점검 결재 상신");
  refresh();
  redirect(`/inspections?role=${role}&view=approve&b=${b}`);
}

/**
 * ⑦ 점검 방식 — 직접 점검 / 위탁 점검(위탁 기관) · 위탁이면 결과 보고받은 날·보고받은 사람.
 * 시행령 제5조제2항제1호 · 제9조제2항제1호 · 제11조제2항제1호: 위탁 점검을 포함하고,
 * 「직접 점검하지 않은 경우에는 점검이 끝난 후 지체 없이 점검 결과를 보고받을 것」.
 * 방식·기관은 총괄·관리자·경영책임자가 적는다. 「보고받음」 칸은 경영책임자가 적고, 총괄이 적으면 대리 기록으로 표시한다(lib/roles ceoConfirm).
 */
export async function saveMethod(form: FormData) {
  const role = String(form.get("role") || "gm");
  const b = String(form.get("b") || "");
  const back = (q = "") => redirect(`/inspections?role=${role}&view=approve&b=${b}${q}#method`);
  if (!["gm", "mgr", "ceo"].includes(role)) return back("&err=role");
  const cy = await loadCycle(b);
  if (!cy.batch || cy.batch.batch_id !== b || cy.batch.status === "결재완료") return back();
  const method = String(form.get("insp_method") || "직접 점검") === "위탁 점검" ? "위탁 점검" : "직접 점검";
  const org = String(form.get("outsource_org") || "").trim();
  const at = String(form.get("report_received_at") || "").trim();
  const recvBy = String(form.get("report_received_by") || "").trim();
  if (method === "위탁 점검" && !org) return back("&err=org");
  const by = role === "ceo" ? "경영책임자" : who(role);

  const patch: Record<string, string> = { insp_method: method, outsource_org: method === "위탁 점검" ? org : "" };
  if (method === "직접 점검") {
    Object.assign(patch, { report_received_at: "", report_received_by: "", report_recorded_by: "", report_proxy: "" });
  } else if (at || recvBy) {
    const c = ceoConfirm(role);
    if (!c.ok) return back("&err=role");                      // 관리자는 「보고받음」을 적지 못한다
    if (!at) return back("&err=date");
    Object.assign(patch, {
      report_received_at: at,
      report_received_by: recvBy || "경영책임자(시장)",
      report_recorded_by: by,
      report_proxy: c.proxy ? "Y" : "",
    });
  }
  await patchRow("inspection_batch", "batch_id", b, patch, by,
    method === "위탁 점검" ? (patch.report_received_at ? "위탁 점검 결과 보고받음 기록" : "위탁 점검으로 표시") : "직접 점검으로 표시");
  refresh();
  back("&done=method");
}

/** ⑦ 결재 확정 — 경영책임자만. */
export async function approveBatch(form: FormData) {
  const role = String(form.get("role") || "");
  const b = String(form.get("b") || "");
  if (role !== "ceo") return;
  const cy = await loadCycle(b);
  if (!cy.batch || cy.batch.batch_id !== b || cy.batch.status !== "결재요청") return;
  await patchRow("inspection_batch", "batch_id", b, {
    status: "결재완료", approved_by: "경영책임자", approved_at: now(),
    approve_note: String(form.get("note") || "").trim(),
  }, "경영책임자", "점검 결재 확정");
  refresh();
  redirect(`/inspections?role=${role}&view=approve&b=${b}`);
}

/** ⑦ 돌려보내기 — 경영책임자가 사유를 달아 진행중으로 되돌린다. */
export async function returnBatch(form: FormData) {
  const role = String(form.get("role") || "");
  const b = String(form.get("b") || "");
  if (role !== "ceo") return;
  const cy = await loadCycle(b);
  if (!cy.batch || cy.batch.batch_id !== b || cy.batch.status !== "결재요청") return;
  await patchRow("inspection_batch", "batch_id", b, {
    status: "진행중", return_reason: String(form.get("note") || "").trim() || "보완 후 다시 상신", returned_at: now(),
  }, "경영책임자", "점검 결재 돌려보냄");
  refresh();
  redirect(`/inspections?role=${role}&view=approve&b=${b}`);
}
