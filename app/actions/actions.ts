"use server";
import { revalidatePath } from "next/cache";
import { appendRow, patchRow, patchTask } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { loadCycle } from "@/lib/cycle";
import { actionTypeOf, remedyBasis, STATUTORY_TYPES } from "@/lib/remedy";
import { ymd } from "@/lib/day";

/**
 * ⑥ 조치·재점검의 쓰기.
 *   총괄  — 조치 요구 보내기: 조치 행(action) + 부서 담당자 알림(notification)
 *   부서  — 조치 시작 / 보완 제출: 과제를 「이행완료·제출」로 되돌려 ⑤ 판정 대기에 다시 올린다(재점검 루프)
 * 쓰기는 공용 appendRow·patchRow·patchTask 로만 한다.
 */
const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const today = () => ymd();
const newId = (p: string) =>
  `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

function refresh() {
  ["/actions", "/review", "/inspections", "/evidence", "/tasks", "/status", "/"].forEach((p) => revalidatePath(p));
}

/** 과제 하나를 이 점검 안에서 찾는다(최신 판정·조치까지 붙은 것). */
async function findRow(batchId: string, task_id: string) {
  const cy = await loadCycle(batchId || undefined);
  return { cy, t: cy.rows.find((r) => r.task_id === task_id) };
}

async function sendRequest(role: string, batchId: string, task_id: string, due: string, msg: string, type = "") {
  const { cy, t } = await findRow(batchId, task_id);
  if (!t || !t.last || t.state !== "조치중" || t.action) return false;   // 이미 요구했거나 대상이 아니면 건너뛴다
  const by = who(role);
  const action_id = newId("ACT");
  // 조치 구분 — 화면에서 고른 것 → 판정 때 고른 「필요한 조치」 → 예전 기본(부적합 시정 · 보완필요 보완)
  const action_type = actionTypeOf(type || t.last.action_need, t.last.result);
  const basis = STATUTORY_TYPES.has(action_type) ? remedyBasis(t.area) : "";
  await appendRow("action", {
    action_id, insp_id: t.last.insp_id, task_id,
    action_type, action_basis: basis,
    due_date: due, done_at: "", result: "요구",
    requested_by: by, requested_at: today(), batch_id: cy.batch?.batch_id || "",
    note: "조치 요구",
  }, by, `조치 요구 — ${action_type}`);
  const name = t.duty_name || t.article_title || t.code36_name || "";
  await appendRow("notification", {
    notif_id: newId("NTF"), task_id, notif_type: "조치요구",
    to_staff_id: t.owner_staff_id || "", from_staff_id: by, sent_at: today(),
    message: msg || `[조치요구 · ${action_type}] ${name} — ${t.last.result}${t.last.finding ? `: ${t.last.finding}` : ""} · 기한 ${due}${basis ? ` · ${basis}` : ""}`,
    read_at: "", action_id, batch_id: cy.batch?.batch_id || "", note: "",
  }, by, "알림 보냄 — 조치요구");
  return true;
}

/** 총괄 — 한 건 조치 요구. */
export async function requestAction(form: FormData) {
  const role = String(form.get("role") || "gm");
  await sendRequest(role, String(form.get("b") || ""), String(form.get("task_id") || ""),
    String(form.get("due_date") || today()), String(form.get("message") || "").trim(), String(form.get("action_type") || ""));
  refresh();
}

/** 총괄 — 고른 것 한꺼번에 조치 요구. */
export async function requestMany(form: FormData) {
  const role = String(form.get("role") || "gm");
  const b = String(form.get("b") || "");
  const due = String(form.get("due_date") || today());
  const ids = form.getAll("pick").map(String).filter(Boolean);
  const type = String(form.get("action_type") || "");   // 비우면 건마다 판정 때 고른 것(없으면 기본)
  for (const id of ids) {
    await sendRequest(role, b, id, due, "", type);
    await new Promise((r) => setTimeout(r, 2));
  }
  refresh();
}

/** 총괄 — 이미 보낸 조치 요구의 구분을 바꾼다(예: 보완 → 예산 추가 편성·집행). 이전 값은 prev_action_type 에 남긴다. */
export async function changeActionType(form: FormData) {
  const role = String(form.get("role") || "gm");
  if (role !== "gm" && role !== "mgr") return;
  const { t } = await findRow(String(form.get("b") || ""), String(form.get("task_id") || ""));
  if (!t?.action || !t.last) return;
  const next = actionTypeOf(form.get("action_type"), t.last.result);
  if (next === t.action.action_type) return;
  await patchRow("action", "action_id", t.action.action_id, {
    action_type: next, prev_action_type: t.action.action_type || "",
    action_basis: STATUTORY_TYPES.has(next) ? remedyBasis(t.area) : "",
  }, who(role), `조치 구분 변경 — ${t.action.action_type || "-"} → ${next}`);
  refresh();
}

/** 부서 — 조치 시작(요구 → 조치중). */
export async function startAction(form: FormData) {
  const role = String(form.get("role") || "road");
  const { t } = await findRow(String(form.get("b") || ""), String(form.get("task_id") || ""));
  if (!t?.action) return;
  await patchRow("action", "action_id", t.action.action_id, { result: "조치중", started_at: today() }, who(role), "조치 시작");
  refresh();
}

/**
 * 부서 — 보완 제출. 과제가 「이행완료·제출」로 돌아가 ⑤ 판정 대기에 **재점검**으로 다시 뜬다.
 * 다음 판정이 몇 차인지(resubmit_round)를 과제에 적어 둔다.
 */
export async function resubmit(form: FormData) {
  const role = String(form.get("role") || "road");
  const note = String(form.get("note") || "").trim();
  const { cy, t } = await findRow(String(form.get("b") || ""), String(form.get("task_id") || ""));
  if (!t || t.state !== "조치중" || !t.last) return;
  const by = who(role);
  const proxy = String(form.get("proxy") || "") === "1";

  if (t.action) {
    await patchRow("action", "action_id", t.action.action_id,
      { result: "보완 제출", done_at: today(), resubmit_note: note, resubmitted_by: by }, by, "보완 제출");
  } else {
    await appendRow("action", {
      action_id: newId("ACT"), insp_id: t.last.insp_id, task_id: t.task_id,
      action_type: actionTypeOf(t.last.action_need, t.last.result),
      due_date: "", done_at: today(), result: "보완 제출", resubmit_note: note, resubmitted_by: by,
      batch_id: cy.batch?.batch_id || "", note: "요구 전에 부서가 먼저 보완",
    }, by, "보완 제출");
  }
  await patchTask(t.task_id, {
    status: "이행완료", approval_status: "제출",
    resubmit_round: t.nextRound, resubmit_note: note,
  }, by, proxy ? "보완 제출(담당자 대신 입력)" : "보완 제출");

  // 판정한 사람에게 재점검을 알린다.
  if (t.last.inspector_staff_id) {
    await appendRow("notification", {
      notif_id: newId("NTF"), task_id: t.task_id, notif_type: "재점검요청",
      to_staff_id: t.last.inspector_staff_id, from_staff_id: by, sent_at: today(),
      message: `[재점검요청] ${t.duty_name || t.article_title || t.code36_name || ""} — 보완 제출(${t.nextRound}차 판정 대기)${note ? `: ${note}` : ""}`,
      read_at: "", batch_id: cy.batch?.batch_id || "", note: "",
    }, by, "알림 보냄 — 재점검요청");
  }
  refresh();
}
