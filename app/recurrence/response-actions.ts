"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { saveFile } from "@/lib/storage";
import { readTable } from "@/lib/data";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { ACT_KINDS, CEO_KINDS, REPORT_STAGES, RECIPIENTS, nowStr } from "./response";

/**
 * 재해 발생 직후 대응의 쓰기 — 공용 appendRow·patchRow 로만 한다(2026-09-22).
 * 표: incident_response · incident_report · incident_response_setting.
 * 사진·문서는 lib/storage saveFile 로 실제로 올린다(파일이 없으면 파일 이름만 적어도 받는다).
 */
const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const newId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const dt = (s: string) => s.replace("T", " ").slice(0, 16);

function back(f: FormData, anchor: string, msg?: { err?: string; ok?: string }): never {
  const p = new URLSearchParams();
  p.set("role", v(f, "role") || "gm");
  for (const k of ["ic", "is", "os", "oa", "on"]) if (v(f, k)) p.set(k, v(f, k));
  if (msg?.err) p.set("err", msg.err);
  if (msg?.ok) p.set("ok", msg.ok);
  redirect(`/recurrence?${p.toString()}#${anchor}`);
}
function refresh() {
  ["/recurrence", "/exec", "/report"].forEach((p) => revalidatePath(p));
}
/** 올린 파일이 있으면 저장하고 이름·주소를, 없으면 적어 둔 파일 이름만 돌려준다. */
async function evidenceOf(f: FormData) {
  const file = f.get("evidence_upload");
  if (file instanceof File && file.size > 0) {
    const sv = await saveFile(file);
    return { evidence_name: file.name, evidence_url: sv.url };
  }
  return { evidence_name: v(f, "evidence_name"), evidence_url: "" };
}
async function incidentOf(f: FormData) {
  const id = v(f, "incident_id");
  const inc = (await readTable("incident", "incident_id")).find((r) => r.incident_id === id);
  if (!inc) back(f, "inc-list", { err: "사고를 찾지 못했습니다" });
  if (inc!.event_class === "아차사고") back(f, id, { err: "아차사고에는 발생 직후 대응 기록을 두지 않습니다" });
  return inc!;
}

/** 보고 — 최초·직후·수시. */
export async function addReport(f: FormData) {
  const role = v(f, "role") || "gm";
  const inc = await incidentOf(f);
  const id = inc.incident_id;
  const stage = v(f, "report_stage");
  if (!(REPORT_STAGES as readonly string[]).includes(stage)) back(f, id, { err: "보고 단계를 고르십시오" });
  const recips = f.getAll("recipients").map(String).filter((x) => (RECIPIENTS as readonly string[]).includes(x));
  const miss = [
    !v(f, "reported_at") && "보고 시각", !v(f, "reporter_staff_id") && "보고자", !recips.length && "수신",
    !v(f, "overview") && "개요",
    recips.includes("관계 행정기관") && !v(f, "agency_name") && "관계 행정기관 이름",
  ].filter(Boolean);
  if (miss.length) back(f, id, { err: `빠진 칸: ${miss.join(" · ")}` });
  const at = dt(v(f, "reported_at"));
  if (at > nowStr()) back(f, id, { err: "보고 시각이 지금보다 늦습니다" });
  if (at.slice(0, 10) < String(inc.occurred_at)) back(f, id, { err: "보고 시각이 사고 발생일보다 빠릅니다" });
  const prev = (await readTable("incident_report", "report_id")).filter((r) => r.incident_id === id);
  if (stage === "최초보고" && prev.some((r) => r.report_stage === "최초보고"))
    back(f, id, { err: "최초보고는 한 번만 기록합니다 — 이어지는 보고는 직후보고·수시보고로 올리십시오" });
  if (stage !== "최초보고" && !prev.some((r) => r.report_stage === "최초보고"))
    back(f, id, { err: "최초보고를 먼저 기록하십시오" });
  if (stage === "직후보고" && prev.some((r) => r.report_stage === "직후보고"))
    back(f, id, { err: "직후보고는 이미 있습니다 — 수시보고로 올리십시오" });
  const seq = stage === "수시보고" ? String(prev.filter((r) => r.report_stage === "수시보고").length + 1) : "";
  const ev = await evidenceOf(f);
  await appendRow("incident_report", {
    report_id: newId("IRP"), incident_id: id, report_stage: stage, seq, reported_at: at,
    reporter_staff_id: v(f, "reporter_staff_id"), recipients: recips.join(" · "), agency_name: v(f, "agency_name"),
    channel: v(f, "channel"), overview: v(f, "overview"), damage: v(f, "damage"), rescue: v(f, "rescue"),
    recovery: v(f, "recovery"), support: v(f, "support"), next_plan: v(f, "next_plan"), ...ev,
    ceo_ack_at: "", ceo_ack_by: "", ceo_ack_proxy: "", ceo_ack_recorded_by: "",
    recorded_by: who(role), recorded_at: nowStr(), note: "화면에서 기록",
  }, who(role), `재해 ${stage} 기록`);
  refresh();
  back(f, id, { ok: `${stage}${seq ? ` ${seq}차` : ""}를 기록했습니다` });
}

/** 긴급 조치 한 가지 — 했음 또는 해당 없음(사유). */
export async function recordAct(f: FormData) {
  const role = v(f, "role") || "gm";
  const inc = await incidentOf(f);
  const id = inc.incident_id;
  const kind = v(f, "kind");
  if (!ACT_KINDS.some((k) => k.key === kind)) back(f, id, { err: "알 수 없는 조치" });
  const status = v(f, "status") === "해당 없음" ? "해당 없음" : "완료";
  const miss = status === "해당 없음"
    ? [!v(f, "detail") && "해당 없는 이유"]
    : [!v(f, "done_at") && "시각", !v(f, "done_by") && "누가"];
  if (kind === "agency" && status === "완료" && !v(f, "target_org")) miss.push("신고한 기관");
  if (miss.filter(Boolean).length) back(f, id, { err: `빠진 칸: ${miss.filter(Boolean).join(" · ")}` });
  const at = v(f, "done_at") ? dt(v(f, "done_at")) : "";
  if (at && at > nowStr()) back(f, id, { err: "시각이 지금보다 늦습니다" });
  const ev = await evidenceOf(f);
  await appendRow("incident_response", {
    resp_id: newId("IRS"), incident_id: id, kind, status, done_at: at, done_by: v(f, "done_by"),
    target_org: v(f, "target_org"), detail: v(f, "detail"), ...ev, proxy: "",
    recorded_by: who(role), recorded_at: nowStr(), note: "화면에서 기록",
  }, who(role), `재해 긴급 조치 — ${kind} ${status}`);
  refresh();
  back(f, id, { ok: status === "해당 없음" ? "「해당 없음」과 이유를 기록했습니다" : "조치를 기록했습니다" });
}

/** 경영책임자 — 최초보고 받음. 경영책임자만, 총괄은 대리 기록. */
export async function ceoAck(f: FormData) {
  const role = v(f, "role") || "gm";
  const c = ceoConfirm(role);
  const id = v(f, "incident_id");
  if (!c.ok) back(f, id, { err: "최초보고 받음은 경영책임자만 기록합니다(총괄은 대리 기록)" });
  const rid = v(f, "report_id");
  const rep = (await readTable("incident_report", "report_id")).find((r) => r.report_id === rid);
  if (!rep) back(f, id, { err: "보고를 찾지 못했습니다" });
  if (rep!.ceo_ack_at) back(f, id, { err: "이미 받음으로 기록되어 있습니다" });
  const at = v(f, "ack_at") ? dt(v(f, "ack_at")) : nowStr();
  if (at < String(rep!.reported_at)) back(f, id, { err: "받은 시각이 보고 시각보다 빠릅니다" });
  await patchRow("incident_report", "report_id", rid, {
    ceo_ack_at: at, ceo_ack_by: "CEO-1", ceo_ack_proxy: c.proxy ? "Y" : "", ceo_ack_recorded_by: who(role),
  }, who(role), c.proxy ? "최초보고 받음 — 총괄 대리 기록" : "최초보고 받음 — 경영책임자");
  refresh();
  back(f, id, { ok: c.proxy ? "최초보고 받음을 대리로 기록했습니다" : "최초보고 받음을 기록했습니다" });
}

/** 경영책임자 지시 — 추가 피해 방지 · 원인 조사. 원인 조사 지시는 원인 조사 기한을 함께 정할 수 있다. */
export async function ceoDirect(f: FormData) {
  const role = v(f, "role") || "gm";
  const c = ceoConfirm(role);
  const inc = await incidentOf(f);
  const id = inc.incident_id;
  if (!c.ok) back(f, id, { err: "지시 기록은 경영책임자만 합니다(총괄은 대리 기록)" });
  const kind = v(f, "kind");
  if (!CEO_KINDS.some((k) => k.key === kind)) back(f, id, { err: "알 수 없는 지시" });
  if (!v(f, "detail")) back(f, id, { err: "빠진 칸: 지시 내용" });
  const at = v(f, "done_at") ? dt(v(f, "done_at")) : nowStr();
  await appendRow("incident_response", {
    resp_id: newId("IRS"), incident_id: id, kind, status: "지시", done_at: at, done_by: "CEO-1",
    target_org: v(f, "target_staff_id"), detail: v(f, "detail"), evidence_name: "", evidence_url: "",
    proxy: c.proxy ? "Y" : "", recorded_by: who(role), recorded_at: nowStr(), note: "화면에서 기록",
  }, who(role), `경영책임자 ${kind === "ceo_cause" ? "원인 조사" : "추가 피해 방지"} 지시${c.proxy ? " — 대리 기록" : ""}`);
  if (kind === "ceo_cause" && v(f, "cause_due") && !inc.investigated_at) {
    await patchRow("incident", "incident_id", id, { cause_due: v(f, "cause_due") }, who(role), "원인 조사 기한 — 경영책임자 지시");
  }
  refresh();
  back(f, id, { ok: kind === "ceo_cause" ? "원인 조사 지시를 기록했습니다 — 원인 조사 단계로 이어집니다" : "추가 피해 방지 지시를 기록했습니다" });
}

/** 기관 설정 — 최초보고 기한(분). 총괄·관리자만. */
export async function saveResponseSetting(f: FormData) {
  const role = v(f, "role") || "gm";
  if (!["gm", "mgr"].includes(role)) back(f, "resp-setting", { err: "설정은 총괄·관리자만 바꿉니다" });
  const m = Number(v(f, "first_report_limit_min"));
  if (!(m > 0 && m <= 24 * 60)) back(f, "resp-setting", { err: "최초보고 기한은 1분~24시간 사이로 정하십시오" });
  await appendRow("incident_response_setting", {
    set_id: newId("IRT"), first_report_limit_min: String(m), set_at: nowStr(), set_by: who(role),
    memo: v(f, "memo"), note: "화면에서 설정",
  }, who(role), "최초보고 기한 설정");
  refresh();
  back(f, "resp-setting", { ok: `최초보고 기한을 ${m}분으로 정했습니다` });
}
