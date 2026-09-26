"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable } from "@/lib/data";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { today, halfOf, periodOf, courseArea, areaOfParam, FRAMES } from "./model";
import { attachOf } from "@/lib/attach";

/**
 * 교육 실시 점검의 쓰기 — 공용 appendRow·patchRow 로만 한다.
 *   · 이행 지시(각 제4호): 교육 기록에 지시 표시 + 담당자 알림(notification). 근거 조문은 과정의 재해 구분을 따른다.
 *   · 이수 등록: 미실시 기록을 이수로 바꾸거나 새 이수 기록을 더한다(증빙 파일 이름)
 *   · 점검 기록(각 제3호): 재해 구분 · 기간(반기 또는 연)별 점검 결과 한 줄(training_check)
 *     「점검 결과 보고받음」은 경영책임자만 — 총괄이 적으면 대리 기록으로 표시(lib/roles ceoConfirm)
 */
const who = (role: string) => ROLE_STAFF[role] || "SM01-1";
const newId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const back = (role: string, area: string, extra = "") => {
  revalidatePath("/training");
  redirect(`/training?role=${role}&area=${area}${extra}`);
};

export async function instruct(form: FormData) {
  const role = String(form.get("role") || "gm");
  const id = String(form.get("training_id") || "");
  const rec = (await readTable("training_record", "training_id")).find((r) => r.training_id === id);
  const course = rec ? (await readTable("training_course", "course_id")).find((c) => c.course_id === rec.course_id) : undefined;
  const area = courseArea(course || { course_id: rec?.course_id });
  if (!rec || rec.status === "이수") return back(role, area);
  const by = who(role);
  const due = String(form.get("due") || "") || rec.due_date || "";
  const memo = String(form.get("memo") || "").trim();
  const basis = FRAMES[area].n4;
  await patchRow("training_record", "training_id", id,
    { instructed_at: today(), instructed_by: by, instruct_due: due, instruct_basis: basis }, by, "교육 이행 지시");
  await appendRow("notification", {
    notif_id: newId("NTF"), task_id: "", notif_type: "교육 이행 지시",
    to_staff_id: rec.staff_id, from_staff_id: by, sent_at: today(),
    message: `[교육 이행 지시] ${rec.course_name}${due ? ` — ${due}까지 이수` : ""}${memo ? ` · ${memo}` : ""}`,
    read_at: "", note: `${id} · ${basis}`,
  }, by, "교육 이행 지시 알림");
  back(role, area, `&done=order#todo`);
}

export async function registerTraining(form: FormData) {
  const role = String(form.get("role") || "gm");
  const area = areaOfParam(String(form.get("area") || ""));
  const by = who(role);
  const pending = String(form.get("pending") || "");
  const at = String(form.get("trained_at") || "") || today();
  const hours = String(form.get("hours") || "").replace(/[^\d.]/g, "");
  // [캡처 v2] K03 — 이수증 파일을 올리면 저장(이름 칸이 비면 파일 이름으로 채움). 파일이 없으면 이름 글자만.
  const ev = await attachOf(form, "certificate_file");
  const file = ev.evidence_name;
  if (!file) return back(role, area, "&err=file#register");

  if (pending) {
    await patchRow("training_record", "training_id", pending,
      { status: "이수", trained_at: at, hours, certificate_file: file, evidence_url: ev.evidence_url, done_by: by }, by, "교육 이수 등록");
    return back(role, area, "&done=reg#register");
  }
  const cid = String(form.get("course_id") || "");
  const dept = String(form.get("dept_id") || "");
  const sid = String(form.get("staff_id") || "");
  if (!cid || !dept || !sid) return back(role, area, "&err=need#register");
  const c = (await readTable("training_course", "course_id")).find((x) => x.course_id === cid);
  await appendRow("training_record", {
    training_id: newId("TRN"), staff_id: sid, dept_id: dept, course_id: cid,
    course_name: c?.course_name || "", law: c?.law || "", hours, period: halfOf(at), due_date: "",
    trained_at: at, status: "이수", certificate_file: file, evidence_url: ev.evidence_url, duty_key: "", note: "화면에서 등록",
  }, by, "교육 이수 등록");
  back(role, courseArea(c || { course_id: cid }), "&done=reg#register");
}

/** 점검 결과 기록 — 재해 구분별(산업·원료·제조물 반기 / 시설·교통 연 1회). */
export async function recordCheck(form: FormData) {
  const role = String(form.get("role") || "gm");
  const area = areaOfParam(String(form.get("area") || ""));
  const f = FRAMES[area];
  const method = String(form.get("method") || "직접 점검") === "점검 결과 보고받음" ? "점검 결과 보고받음" : "직접 점검";
  let proxy = false;
  if (method === "점검 결과 보고받음") {
    const c = ceoConfirm(role);
    if (!c.ok) return back(role, area, "&err=role#check");      // 경영책임자(또는 총괄 대리)만
    proxy = c.proxy;
  }
  const by = role === "ceo" ? "경영책임자" : who(role);
  const d = today();
  await appendRow("training_check", {
    check_id: newId("TCK"), area, period: periodOf(area, d), half: halfOf(d), checked_at: d, checked_by: by,
    method, proxy: proxy ? "Y" : "",
    summary: String(form.get("summary") || ""),
    note: `${f.n3} ${f.cycle === "연" ? "연 1회" : "반기"} 점검${proxy ? " · 총괄 대리 기록" : ""}`,
  }, by, `교육 실시 점검 기록 — ${f.tab}${proxy ? "(대리)" : ""}`);
  back(role, area, "&done=check#check");
}

/** 예전 이름 — 산업(시행령 제5조) 반기 점검. */
export async function recordHalfCheck(form: FormData) {
  if (!form.get("area")) form.set("area", "I");
  return recordCheck(form);
}
