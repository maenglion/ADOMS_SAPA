"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { saveFile } from "@/lib/storage";
import { ROLE_STAFF } from "@/lib/roles";
import { joinFix, type FixItem } from "./codes";

/**
 * 유해·위험요인 신고·조치 — 쓰기는 공용 경로(appendRow·patchRow)만 쓴다.
 * 한 단계를 처리할 때마다 신고 행을 고치고(hazard_report) 처리 기록을 한 줄 남긴다(hazard_step).
 */
// 경영책임자(시장)는 직원 대장에 없다 — 총괄 담당자 이름으로 남던 것을 역할 이름으로 남긴다(09-21 대본 점검).
const who = (role: string) => (role === "ceo" ? "경영책임자(시장)" : ROLE_STAFF[role] || "SD01-1");
const s = (f: FormData, k: string) => String(f.get(k) || "").trim();
function now() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const today = () => now().slice(0, 10);

async function step(hz: string, kind: string, by: string, memo = "", at = now()) {
  await appendRow("hazard_step", {
    step_id: `HZS-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
    hz_id: hz, step: kind, at, by, memo, note: "",
  }, by, `유해·위험요인 ${kind}`);
}
async function patch(hz: string, p: Record<string, any>, by: string, kind: string) {
  await patchRow("hazard_report", "hz_id", hz, p, by, `유해·위험요인 ${kind}`);
}
function done(role: string, hz: string) {
  revalidatePath("/hazards");
  revalidatePath(`/hazards/${hz}`);
  redirect(`/hazards/${hz}?role=${role}`);
}

/** 접수 — 사진 두 장(전경·근접)을 함께 받는다. */
export async function createReport(form: FormData) {
  const role = s(form, "role") || "gm";
  const by = who(role);
  const asset_id = s(form, "asset_id");
  const description = s(form, "description");
  if (!asset_id || !description) return;

  const pics: Record<string, string> = { photo_wide: "", photo_close: "" };
  for (const k of ["photo_wide", "photo_close"]) {
    const f = form.get(k);
    if (f instanceof File && f.size > 0) pics[k] = (await saveFile(f)).url;
  }
  const hz = `HZR-${Date.now().toString(36).toUpperCase()}`;
  const at = s(form, "received_at").replace("T", " ") || now();
  await appendRow("hazard_report", {
    hz_id: hz, received_at: at, channel: s(form, "channel"), channel_detail: s(form, "channel_detail"),
    reporter: s(form, "reporter"), received_by: s(form, "received_by") || by,
    asset_id, asset_name: s(form, "asset_name"), asset_gbn: s(form, "asset_gbn"), asset_class: s(form, "asset_class"),
    dept_id: s(form, "dept_id"), location: s(form, "location"), description,
    code_group: s(form, "code_group"), code: s(form, "code"), accident_type: s(form, "accident_type"),
    possible_accident: s(form, "possible_accident"), ...pics, note: "화면에서 접수",
  }, by, "유해·위험요인 접수");
  await step(hz, "접수", by, s(form, "channel"), at);
  done(role, hz);
}

/** 피해방지조치 — 대피·접근차단·통제. */
export async function recordProtect(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const what = [...form.getAll("protect_kind").map(String), s(form, "protect_memo")].filter(Boolean).join(" · ");
  if (!hz || !what) return;
  await patch(hz, { protect_action: what, protect_at: now(), protect_by: by }, by, "피해방지조치");
  await step(hz, "피해방지조치", by, what);
  done(role, hz);
}

/** 1차 판단 — 경미 / 심각, 판단한 사람과 시각. */
export async function judgeReport(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const sev = s(form, "severity");
  if (!hz || (sev !== "경미" && sev !== "심각")) return;
  const judge = s(form, "judged_by") || by;
  await patch(hz, { severity: sev, judged_by: judge, judged_at: now(), judge_memo: s(form, "judge_memo") }, by, "1차 판단");
  await step(hz, "1차 판단", judge, sev + (s(form, "judge_memo") ? ` · ${s(form, "judge_memo")}` : ""));
  done(role, hz);
}

/** 경미 — 즉시 조치하고 종결, 신고자에게 결과 통보. */
export async function closeMinor(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const act = s(form, "minor_action");
  if (!hz || !act) return;
  const notify = s(form, "notify") === "Y";
  await patch(hz, {
    minor_action: act, closed_at: today(), closed_by: by, done_at: today(),
    notified_reporter: notify ? "Y" : "N", notified_at: notify ? today() : "",
  }, by, "즉시 조치·종결");
  await step(hz, "즉시 조치·종결", by, act);
  if (notify) await step(hz, "신고자 통보", by, "처리 결과 통보");
  done(role, hz);
}

/** 심각 — 경영책임자 보고. */
export async function reportCeo(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  if (!hz) return;
  const mode = s(form, "mode") || "서면";
  const at = s(form, "reported_at").replace("T", " ") || now();
  await patch(hz, { ceo_reported_at: at, ceo_report_mode: mode, ceo_reported_by: by, ceo_instruction: s(form, "instruction") }, by, "경영책임자 보고");
  await step(hz, "경영책임자 보고", by, `${mode}${s(form, "instruction") ? ` · 지시: ${s(form, "instruction")}` : ""}`, at);
  done(role, hz);
}

/** 긴급안전점검 결과. */
export async function recordInspection(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const res = s(form, "insp_result");
  if (!hz || !res) return;
  const at = s(form, "insp_at") || today();
  await patch(hz, { insp_at: at, insp_by: s(form, "insp_by") || by, insp_result: res }, by, "긴급안전점검");
  await step(hz, "긴급안전점검", s(form, "insp_by") || by, res, at);
  done(role, hz);
}

/** 개선 지시 — 이용제한·보수·보강·정밀안전진단 등. 시설물안전법 기한 적용 여부와 기준일을 함께 정한다. */
export async function orderFix(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const types = form.getAll("order_type").map(String).filter(Boolean);
  if (!hz || types.length === 0) return;
  await patch(hz, {
    order_types: types.join(" · "), order_at: today(), order_memo: s(form, "order_memo"),
    fsam_applies: s(form, "fsam_applies") === "Y" ? "Y" : "N", basis_date: s(form, "basis_date") || today(),
  }, by, "개선 지시");
  await step(hz, "개선 지시", by, types.join(" · "));
  done(role, hz);
}

/** 보수·보강 계획 — 항목·물량·비용·기간. */
export async function savePlan(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const keys = s(form, "row_keys").split(",").filter(Boolean);
  const items: FixItem[] = keys.map((k) => ({
    item: s(form, `item_${k}`), qty: s(form, `qty_${k}`), cost: s(form, `cost_${k}`), period: s(form, `period_${k}`),
  }));
  const text = joinFix(items);
  if (!hz || !text) return;
  await patch(hz, { fix_items: text, fix_budget: s(form, "fix_budget") }, by, "보수·보강 계획");
  await step(hz, "보수·보강 계획", by, s(form, "fix_budget"));
  done(role, hz);
}

/** 보수·보강 착수·완료. */
export async function markFix(form: FormData) {
  const role = s(form, "role"), hz = s(form, "hz_id"), by = who(role);
  const what = s(form, "what");
  const at = s(form, "at") || today();
  if (!hz) return;
  if (what === "start") {
    await patch(hz, { fix_started_at: at }, by, "보수·보강 착수");
    await step(hz, "보수·보강 착수", by, "", at);
  } else if (what === "done") {
    await patch(hz, { fix_done_at: at, done_at: at }, by, "완료");
    await step(hz, "완료", by, s(form, "memo") || "보수·보강 완료", at);
  }
  done(role, hz);
}
