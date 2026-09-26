"use server";
/**
 * [400 · 교육자료 버전] 묶음 F — 기관장 예방활동 쓰기.
 *  · 활동 등록·수정·삭제 표시(기관장 예방활동 입력) → usf_ceo_activity — 경영책임자·총괄·관리자(09-24)
 *  · 서한문 저장·발송 → usf_letter(작성중/발송) · 발송 때 부서 정담당 알림(notification) + 활동기록(usf_ceo_log)
 *  · 서한문 수신 확인 → usf_letter_read
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable, staff, depts, type Row } from "@/lib/data";
import { ROLE_STAFF, deptOf } from "@/lib/roles";
import { attachOf } from "@/lib/attach";
import { ymd } from "@/lib/day";
import { newId, RECIPIENTS, ACT_TYPES } from "./_parts";

const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const v = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const CAN_WRITE = new Set(["ceo", "gm", "mgr"]);
/** 기관장 예방활동을 적는 역할 — 경영책임자 · 총괄 · 관리자(09-24 사용자 요청: 총괄부서 담당자가 입력). */
const ACT_WRITERS = new Set(["ceo", "gm", "mgr"]);
/** 이 화면에서 넣은 기록인가(번호 CEOF-). 처음부터 있던 예시 기록은 CEO-001 모양이다. */
const isScreenAct = (id: string) => String(id || "").startsWith("CEOF-");
const refreshAct = () => ["/ceo", "/exec", "/report", "/"].forEach((p) => revalidatePath(p));

/**
 * 기관장 예방활동 입력·수정(SCR-026 활동기록에 보인다).
 * 적는 사람: 경영책임자 본인(ceo) · 총괄(gm) · 관리자(mgr). 총괄·관리자가 적으면 「대리 기록」(proxy=Y).
 * activity_id 가 오면 수정 — 이 화면에서 넣은 기록(usf_ceo_activity · 번호 CEOF-)만 고친다. 처음부터 있던 예시 기록(ceo_activity)은 고치지 않는다.
 */
export async function addActivity(f: FormData) {
  const role = v(f, "role") || "gm";
  if (!ACT_WRITERS.has(role)) return;
  const edit = v(f, "activity_id");
  const title = v(f, "title");
  if (!title) redirect(`/ceo?role=${role}&modal=${edit ? `edit&id=${encodeURIComponent(edit)}` : "new"}&err=1`);
  const ev = await attachOf(f);
  const type = ACT_TYPES.includes(v(f, "activity_type")) ? v(f, "activity_type") : "기타";
  const x = {
    activity_date: v(f, "activity_date") || ymd(), activity_type: type,
    title, place: v(f, "place"), dept_id: v(f, "dept_id"), participants: v(f, "participants"),
    finding: v(f, "finding", 500), instruction: v(f, "instruction", 500),
  };
  if (edit) {
    const cur = (await readTable("usf_ceo_activity", "activity_id")).find((r) => r.activity_id === edit);
    if (!cur || !isScreenAct(edit) || cur.deleted === "Y") redirect(`/ceo?role=${role}&err=locked`);
    // 증빙 — 새 파일·이름을 넣었을 때만 바꾼다(비우면 전 것을 그대로 둔다)
    await patchRow("usf_ceo_activity", "activity_id", edit, {
      ...x, ...(ev.evidence_name ? { evidence_name: ev.evidence_name, evidence_url: ev.evidence_url || cur!.evidence_url || "" } : {}),
      updated_by: who(role), updated_at: new Date().toISOString(),
    }, who(role), "기관장 예방활동 수정");
    refreshAct();
    redirect(`/ceo?role=${role}&saved=2`);
  }
  await appendRow("usf_ceo_activity", {
    activity_id: newId("CEOF"), ...x,
    evidence_name: ev.evidence_name, evidence_url: ev.evidence_url,
    created_by: who(role), created_at: new Date().toISOString(), proxy: role === "ceo" ? "" : "Y", deleted: "",
  }, who(role), "기관장 예방활동 입력");
  refreshAct();
  redirect(`/ceo?role=${role}&saved=1`);
}

/** 삭제 표시 — 지우지 않고 deleted=Y 만 적는다(목록·보고 요약·보고서 숫자에서 빠진다). 이 화면에서 넣은 기록만. */
export async function removeActivity(f: FormData) {
  const role = v(f, "role") || "gm";
  if (!ACT_WRITERS.has(role)) return;
  const id = v(f, "activity_id");
  const cur = (await readTable("usf_ceo_activity", "activity_id")).find((r) => r.activity_id === id);
  if (!cur || !isScreenAct(id)) redirect(`/ceo?role=${role}&err=locked`);
  await patchRow("usf_ceo_activity", "activity_id", id, {
    deleted: "Y", deleted_by: who(role), deleted_at: new Date().toISOString(),
  }, who(role), "기관장 예방활동 삭제 표시");
  refreshAct();
  redirect(`/ceo?role=${role}&removed=1`);
}

/** 발송 — 부서 정담당마다 알림 한 줄 + 경영책임자 활동기록. */
async function sendNotice(id: string, title: string, by: string) {
  const st = await staff();
  for (const d of (await depts()).filter((x: Row) => x.dept_id !== "D99")) {
    const p = st.find((s: Row) => s.dept_id === d.dept_id && s.duty_role === "정담당");
    if (!p) continue;
    await appendRow("notification", {
      notif_id: newId("NTF"), task_id: "", notif_type: "서한문",
      to_staff_id: p.staff_id, from_staff_id: by, sent_at: ymd(),
      message: `[기관장 서한문] ${title} — 읽고 수신 확인해 주십시오.`,
      read_at: "", action_id: "", batch_id: id, note: "기관장 서한문",
    }, by, "알림 보냄 — 기관장 서한문");
    await new Promise((r) => setTimeout(r, 2));
  }
  await appendRow("usf_ceo_log", {
    log_id: newId("CLOG"), at: new Date().toISOString(), activity: "기관장 서한문 발송",
    detail: `「${title}」 서한문 발송`, by: ROLE_STAFF.ceo,
  }, by, "경영책임자 활동기록");
}

/** 서한문 저장 — mode=draft 임시저장 / mode=send 발송. id 가 있으면(작성중인 것) 고친다. */
export async function saveLetter(f: FormData) {
  const role = v(f, "role") || "gm";
  if (!CAN_WRITE.has(role)) return;
  const send = v(f, "mode") === "send";
  const title = v(f, "title");
  const body = String(f.get("body") ?? "").trim().slice(0, 8000);
  const id0 = v(f, "id");
  if (!title || !body) redirect(`/ceo/letter/new?role=${role}${id0 ? `&id=${id0}` : ""}&err=1`);
  const ev = await attachOf(f);
  const recipients = f.getAll("recipients").map(String).filter((x) => RECIPIENTS.includes(x)).join(";");
  const row = {
    title, recipients: recipients || "전 직원", related_duty: v(f, "related_duty"), body,
    sent_at: send ? (v(f, "sent_at") || ymd()) : v(f, "sent_at"), status: send ? "발송" : "작성중",
    sender: "용인특례시장", written_by: who(role),
  };
  let id = id0;
  const cur = id0 ? (await readTable("usf_letter", "letter_id")).find((r) => r.letter_id === id0) : null;
  if (cur && cur.status === "작성중") {
    await patchRow("usf_letter", "letter_id", id0, {
      ...row, ...(ev.evidence_name ? { evidence_name: ev.evidence_name, evidence_url: ev.evidence_url } : {}),
    }, who(role), send ? "기관장 서한문 발송" : "기관장 서한문 수정");
  } else {
    id = newId("LTR");
    await appendRow("usf_letter", {
      letter_id: id, ...row, created_at: new Date().toISOString(),
      evidence_name: ev.evidence_name, evidence_url: ev.evidence_url,
    }, who(role), send ? "기관장 서한문 발송" : "기관장 서한문 임시저장");
  }
  if (send) await sendNotice(id, title, who(role));
  revalidatePath("/ceo/letter");
  redirect(`/ceo/letter/${id}?role=${role}&${send ? "sent" : "saved"}=1`);
}

/** 작성중인 서한문을 상세 화면에서 바로 발송. */
export async function sendLetter(f: FormData) {
  const role = v(f, "role") || "gm";
  const id = v(f, "id");
  if (!CAN_WRITE.has(role)) return;
  const cur = (await readTable("usf_letter", "letter_id")).find((r) => r.letter_id === id);
  if (!cur || cur.status !== "작성중") return;
  await patchRow("usf_letter", "letter_id", id, { status: "발송", sent_at: cur.sent_at || ymd() }, who(role), "기관장 서한문 발송");
  await sendNotice(id, String(cur.title), who(role));
  revalidatePath("/ceo/letter");
  redirect(`/ceo/letter/${id}?role=${role}&sent=1`);
}

/** 부서 수신 확인 — 담당자·관리자 역할이 자기 부서 이름으로 남긴다. */
export async function readLetter(f: FormData) {
  const role = v(f, "role") || "gm";
  const id = v(f, "id");
  const dept = deptOf(role);
  if (!dept) return;
  const done = (await readTable("usf_letter_read", "read_id")).some((r) => r.letter_id === id && r.dept_id === dept);
  if (!done) {
    await appendRow("usf_letter_read", {
      read_id: newId("LRD"), letter_id: id, dept_id: dept, staff_id: who(role), read_at: new Date().toISOString(),
    }, who(role), "기관장 서한문 수신 확인");
  }
  revalidatePath(`/ceo/letter/${id}`);
  redirect(`/ceo/letter/${id}?role=${role}&read=1`);
}
