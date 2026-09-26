"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable } from "@/lib/data";
import { ROLE_STAFF } from "@/lib/roles";
import { ymd } from "@/lib/day";
import { attachOf } from "@/lib/attach";
import {
  controlResult, evalItems, evalSetting, passFor, totalOf,
  FRAMES, ENTRUST_TYPES, CIVIL_SCOPES, RISKS, STAGES, stageIndex, CTL_CHECKS, frameLabel,
} from "./model";

/**
 * 도급·용역·위탁 화면의 쓰기 — 공용 `appendRow`·`patchRow` 만 쓴다(새 쓰기 함수를 만들지 않는다).
 *   · 관리의무 준수여부(이행 · 보완필요 · 미이행) · 증빙 이름   → contract_compliance
 *   · 수급인 평가(10항목 또는 총점만)                              → contract_eval_score(+) · contract (+ 관리의무 ①)
 *   · 평가 합격선·가중치 설정                                      → contract_eval_setting(+, 가장 늦은 줄이 지금 설정)
 *   · 적용 틀 · 위탁 유형 · 실질 지배 판단                         → contract
 *   · 도급 5단계 · 안전보건 관리비 계상·정산                        → contract
 */
const who = (role: string) => ROLE_STAFF[role] || "SD01-1";
const today = () => ymd();
const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const STATUS = ["이행", "보완필요", "미이행"];
const ccId = (contract_id: string, no: number) => `CCP-${contract_id.split("-")[1]}-${no}`;

function back(f: FormData, anchor: string, msg?: { err?: string; ok?: string }): never {
  const p = new URLSearchParams();
  p.set("role", v(f, "role") || "gm");
  if (v(f, "contract_id")) p.set("c", v(f, "contract_id"));
  if (msg?.err) p.set("err", msg.err);
  if (msg?.ok) p.set("ok", msg.ok);
  redirect(`/contracts?${p.toString()}#${anchor}`);
}
function refresh() {
  ["/contracts", "/system", "/report", "/exec", "/evidence"].forEach((p) => revalidatePath(p));
}

export async function setCompliance(form: FormData) {
  const role = String(form.get("role") || "gm");
  const cc_id = String(form.get("cc_id") || "");
  const status = String(form.get("status") || "");
  if (!cc_id || !STATUS.includes(status)) return;
  await patchRow("contract_compliance", "cc_id", cc_id,
    { status, checked_at: status === "미이행" ? "" : today(), checked_by: who(role) },
    who(role), `도급 관리의무 준수여부 — ${status}`);
  revalidatePath("/contracts");
}

export async function setComplianceEvidence(form: FormData) {
  const role = String(form.get("role") || "gm");
  const cc_id = String(form.get("cc_id") || "");
  if (!cc_id) return;
  const ev = await attachOf(form); // [캡처 v2] K03 — 파일을 올리면 저장, 없으면 이름 글자만
  if (!ev.evidence_name) return;
  await patchRow("contract_compliance", "cc_id", cc_id, { evidence_name: ev.evidence_name, evidence_url: ev.evidence_url },
    who(role), "도급 관리의무 증빙 등록");
  revalidatePath("/contracts");
}

/** 평가 결과를 계약과 관리의무 ①에 함께 반영한다 — 합격선은 설정값(계약의 작업 위험도에 따라). */
async function applyEval(f: FormData, contract_id: string, score: number, date: string, pass: number,
  detail: boolean, risk: string) {
  const by = who(v(f, "role") || "gm");
  await patchRow("contract", "contract_id", contract_id,
    { evaluation_done: "Y", eval_score: String(score), eval_date: date, eval_pass_mark: String(pass),
      eval_detail: detail ? "Y" : "", ...(risk ? { work_risk: risk } : {}) },
    by, "수급인 안전보건 수준 평가 입력");
  const ok = score >= pass;
  await patchRow("contract_compliance", "cc_id", ccId(contract_id, 1),
    { status: ok ? "이행" : "보완필요", checked_at: date, checked_by: by,
      evidence_name: `수급인 안전보건 수준 평가표(${date}).pdf`, evidence_url: "",
      finding: ok ? "" : `평가 점수 ${score}점 — 합격선(${pass}점) 미달, 보완계획 필요` },
    by, "관리의무 ① 평가 반영");
}

/** 총점만 적기 — 평가표를 따로 두고 점수만 옮기는 경우. 항목별 세부는 「세부 없음」으로 남는다. */
export async function evaluateVendor(f: FormData) {
  const contract_id = v(f, "contract_id");
  const score = Math.round(Number(v(f, "eval_score")));
  const date = v(f, "eval_date") || today();
  if (!contract_id) back(f, "eval", { err: "계약을 찾지 못했습니다" });
  if (!(score >= 0 && score <= 100) || v(f, "eval_score") === "") back(f, "eval", { err: "점수는 0~100 사이로 적으십시오" });
  if (date > today()) back(f, "eval", { err: "평가일이 오늘보다 늦습니다" });
  const c = (await readTable("contract", "contract_id")).find((r) => r.contract_id === contract_id);
  const risk = (RISKS as readonly string[]).includes(v(f, "work_risk")) ? v(f, "work_risk") : "";
  const pass = passFor({ ...(c || {}), ...(risk ? { work_risk: risk } : {}) }, await evalSetting());
  await applyEval(f, contract_id, score, date, pass, false, risk);
  refresh();
  back(f, "eval", { ok: `평가 ${score}점을 저장했습니다 — 합격선 ${pass}점 · 관리의무 ① ${score >= pass ? "이행" : "보완필요"}` });
}

/** 10항목 평가(서울시 안내서 4-6) — 항목마다 우수 5 · 보통 3 · 미흡 1, 설정된 가중치로 100점 환산. */
export async function evaluateVendorItems(f: FormData) {
  const contract_id = v(f, "contract_id");
  const date = v(f, "eval_date") || today();
  if (!contract_id) back(f, "eval", { err: "계약을 찾지 못했습니다" });
  if (date > today()) back(f, "eval", { err: "평가일이 오늘보다 늦습니다" });
  const items = await evalItems();
  const pts = items.map((it) => Number(v(f, `p${it.item_no}`)));
  const miss = items.filter((_, i) => ![5, 3, 1].includes(pts[i])).map((it) => it.item_name);
  if (miss.length) back(f, "eval", { err: `고르지 않은 항목: ${miss.join(" · ")}` });
  const risk = (RISKS as readonly string[]).includes(v(f, "work_risk")) ? v(f, "work_risk") : "";
  if (!risk) back(f, "eval", { err: "작업 위험도를 고르십시오(합격선이 정해집니다)" });
  const S = await evalSetting();
  const pass = S.marks[risk] || S.def;
  const total = totalOf(pts, S.weights);
  const row: Record<string, string> = {
    score_id: `EVS-${Date.now().toString(36).toUpperCase()}`, contract_id, eval_date: date,
    work_risk: risk, pass_mark: String(pass), total: String(total), result: total >= pass ? "합격" : "미달",
    weights: S.weights.join(","), evaluated_by: who(v(f, "role") || "gm"), note: v(f, "eval_note").slice(0, 200),
  };
  pts.forEach((p, i) => (row[`p${i + 1}`] = String(p)));
  await appendRow("contract_eval_score", row, row.evaluated_by, "수급인 평가 10항목 입력");
  await applyEval(f, contract_id, total, date, pass, true, risk);
  refresh();
  back(f, "eval", { ok: `10항목 평가 ${total}점(합격선 ${pass}점) — 관리의무 ① ${total >= pass ? "이행" : "보완필요"}` });
}

/** 합격선·가중치 설정 — 덮어쓰지 않고 새 줄로 쌓는다(언제 누가 바꿨는지 남는다). 이미 한 평가는 다시 매기지 않는다. */
export async function saveEvalSetting(f: FormData) {
  const role = v(f, "role") || "gm";
  if (!["gm", "mgr"].includes(role)) back(f, "evalset", { err: "합격선은 총괄·관리자만 바꿉니다" });
  const n = (k: string) => Math.round(Number(v(f, k)));
  const marks = [n("pass_default"), n("pass_general"), n("pass_risk"), n("pass_fire")];
  if (marks.some((x) => !(x >= 1 && x <= 100))) back(f, "evalset", { err: "합격선은 1~100 사이로 적으십시오" });
  const items = await evalItems();
  const w = items.map((it) => Number(v(f, `w${it.item_no}`)));
  if (w.some((x) => !(x >= 1 && x <= 10))) back(f, "evalset", { err: "가중치는 1~10 사이로 적으십시오" });
  await appendRow("contract_eval_setting", {
    setting_id: `EVSET-${Date.now().toString(36).toUpperCase()}`, pass_default: String(marks[0]),
    pass_general: String(marks[1]), pass_risk: String(marks[2]), pass_fire: String(marks[3]),
    weights: w.join(","), set_at: new Date().toISOString(), set_by: who(role),
  }, who(role), "수급인 평가 합격선·가중치 설정");
  refresh();
  back(f, "evalset", { ok: "설정을 저장했습니다 — 앞으로 하는 평가부터 적용합니다(이미 한 평가 점수는 그대로)" });
}

/** 적용 틀 · 위탁 유형 · 공중이용시설 운영·관리 위탁 여부 · 실질 지배 판단 — 사람이 확인하고 저장한다. */
export async function saveApply(f: FormData) {
  const role = v(f, "role") || "gm";
  const contract_id = v(f, "contract_id");
  if (role === "ceo") back(f, "apply", { err: "경영책임자 보기에서는 고치지 않습니다" });
  const frame = v(f, "apply_frame");
  const entrust = v(f, "entrust_type");
  const civil = v(f, "civil_scope");
  if (!(FRAMES as readonly string[]).includes(frame)) back(f, "apply", { err: "적용 틀을 고르십시오" });
  if (!(ENTRUST_TYPES as readonly string[]).includes(entrust)) back(f, "apply", { err: "위탁 유형을 고르십시오" });
  if (!(CIVIL_SCOPES as readonly string[]).includes(civil)) back(f, "apply", { err: "공중이용시설 운영·관리 위탁 여부를 고르십시오" });
  if (civil === "해당" && frame === "산업") back(f, "apply", { err: "공중이용시설·공중교통수단 운영·관리 위탁이면 적용 틀에 중대시민재해가 들어가야 합니다(중대시민재해 또는 둘 다)" });
  if (!v(f, "control_basis")) back(f, "apply", { err: "빠진 칸: 판단 근거(계약서·협약서 조항 등)" });
  const patch: Record<string, string> = {
    apply_frame: frame, entrust_type: entrust, civil_scope: civil, control_basis: v(f, "control_basis").slice(0, 300),
    control_confirmed_at: today(), control_confirmed_by: who(role),
  };
  if (v(f, "civil_basis")) patch.civil_basis = v(f, "civil_basis").slice(0, 300);
  for (const [k] of CTL_CHECKS) patch[k] = f.get(k) ? "Y" : "N";
  patch.control_result = controlResult(patch);
  await patchRow("contract", "contract_id", contract_id, patch, who(role), `실질 지배 판단 — ${patch.control_result}`);
  refresh();
  back(f, "apply", { ok: `판단을 저장했습니다 — 실질 지배 「${patch.control_result}」 · 적용 틀 「${frameLabel(frame)}」` });
}

/** 도급 5단계 — 한 단계씩 앞으로. 준공 정산은 계상액·실사용액이 있어야 닫힌다. */
export async function advanceStage(f: FormData) {
  const role = v(f, "role") || "gm";
  const contract_id = v(f, "contract_id");
  if (role === "ceo") back(f, "stage", { err: "경영책임자 보기에서는 고치지 않습니다" });
  const c = (await readTable("contract", "contract_id")).find((r) => r.contract_id === contract_id);
  if (!c) back(f, "stage", { err: "계약을 찾지 못했습니다" });
  const date = v(f, "stage_date") || today();
  if (date > today()) back(f, "stage", { err: "날짜가 오늘보다 늦습니다" });
  const cur = stageIndex(c!.proc_stage);
  const patch: Record<string, string> = {};
  if (cur >= STAGES.length - 1) back(f, "stage", { err: "이미 마지막 단계입니다" });
  const next = STAGES[cur + 1];
  if (next === "평가" && c!.evaluation_done !== "Y") back(f, "stage", { err: "수급인 평가를 먼저 입력하십시오(낙찰 통보 전 평가)" });
  if (next === "계약") patch.contract_at = date;
  if (next === "준공 정산") {
    const planned = v(f, "cost_planned") || c!.cost_planned || "";
    const settled = v(f, "cost_settled");
    if (!settled) back(f, "stage", { err: "빠진 칸: 안전보건 관리비 실사용 정산액" });
    if (!(Number(settled) >= 0)) back(f, "stage", { err: "정산액은 숫자로 적으십시오" });
    patch.completed_at = date; patch.settled_at = date; patch.cost_settled = String(Math.round(Number(settled)));
    if (planned) patch.cost_planned = String(Math.round(Number(planned)));
  }
  patch.proc_stage = next;
  await patchRow("contract", "contract_id", contract_id, patch, who(role), `도급 단계 — ${next}`);
  refresh();
  back(f, "stage", { ok: `「${next}」 단계로 넘겼습니다` });
}

/** 안전보건 관리비 계상액 — 계약 단계에서 적는다(준공 때 실사용액과 대조). */
export async function setCostPlanned(f: FormData) {
  const role = v(f, "role") || "gm";
  const contract_id = v(f, "contract_id");
  if (role === "ceo") back(f, "stage", { err: "경영책임자 보기에서는 고치지 않습니다" });
  const n = Number(v(f, "cost_planned"));
  if (!v(f, "cost_planned") || !(n >= 0)) back(f, "stage", { err: "계상액은 숫자로 적으십시오" });
  await patchRow("contract", "contract_id", contract_id, { cost_planned: String(Math.round(n)) }, who(role), "안전보건 관리비 계상액");
  refresh();
  back(f, "stage", { ok: "계상액을 저장했습니다" });
}
