"use server";
import { revalidatePath } from "next/cache";
import { appendRow, patchRow } from "@/lib/write";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { ORG_ITEMS } from "./items";
import { ymd } from "@/lib/day";
import { attachOf } from "@/lib/attach";

/** 선임·지정 등록 — 한 줄 더하면 매트릭스의 그 칸이 ●로 바뀐다(가장 최근 줄이 이긴다). */
export async function registerRole(form: FormData) {
  const role = String(form.get("role") || "gm");
  const item = String(form.get("role_item") || "");
  const def = ORG_ITEMS.find((x) => x.item === item);
  if (!def) return;
  const dept = def.scope === "기관" ? "" : String(form.get("dept_id") || "");
  if (def.scope === "부서" && !dept) return;
  const at = String(form.get("designated_at") || "") || ymd();
  const ev = await attachOf(form, "doc_name"); // [캡처 v2] K03 — 지정 문서 파일 첨부

  await appendRow(
    "safety_org_role",
    {
      role_id: `SOR-${Date.now().toString(36).toUpperCase()}`,
      role_item: item, scope: def.scope, dept_id: dept,
      designated: "Y", status: def.verb, method: String(form.get("method") || "직접"),
      designated_at: at, law_basis: def.law, clause_no: def.clause,
      staff_id: String(form.get("staff_id") || ""),
      doc_name: ev.evidence_name, evidence_url: ev.evidence_url,
      last_eval_at: "", note: "화면에서 등록",
    },
    ROLE_STAFF[role] || "SM01-1",
    `${item} ${def.verb} 등록`,
  );
  revalidatePath("/system");
}

/* ════════════════════════════════════════════════════════════════════
 * 체계 기록(시행령 제4조제1·3·5·7·8호) — 모두 appendRow / patchRow 로만 쓴다. (2026-09-21)
 * 입력마다 「경영책임자 보고받음」(보고일·방식)을 함께 받는다.
 * ════════════════════════════════════════════════════════════════════ */
const today = () => ymd();
const nid = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const v = (f: FormData, k: string) => String(f.get(k) || "").trim();
const byOf = (f: FormData) => ROLE_STAFF[v(f, "role") || "gm"] || "SM01-1";
const halfLabel = (d: string) => `${d.slice(0, 4)} ${+d.slice(5, 7) <= 6 ? "상반기" : "하반기"}`;
/** 경영책임자 보고받음 — 경영책임자 본인 또는 총괄의 대리 기록만 받는다(lib/roles ceoConfirm). */
function reportOf(f: FormData) {
  const c = ceoConfirm(v(f, "role") || "gm");
  const yes = c.ok && v(f, "ceo_reported") === "Y";
  return {
    ceo_reported: yes ? "Y" : "", reported_at: yes ? v(f, "reported_at") || today() : "",
    report_method: yes ? v(f, "report_method") : "", report_proxy: yes && c.proxy ? "Y" : "",
  };
}
function done() { revalidatePath("/system"); revalidatePath("/system/record"); }

/** 기록 한 줄(system_record). */
async function addRecord(f: FormData, row: Record<string, string>, action: string) {
  const d = row.done_at || v(f, "done_at") || today();
  // [캡처 v2] K03 — 파일 첨부 칸(evidence_file)이 있으면 저장. 이름은 기존 doc_name 칸(근거 문서·회의록)에, 주소는 evidence_url 에.
  const ev = await attachOf(f, "doc_name");
  const full = {
    record_id: nid("SYR"), clause_no: "", mok: "", record_kind: "", title: "", target_role: "", target_ref: "",
    target_staff_id: "", dept_id: "", done_at: d, half: halfLabel(d), checker_staff_id: v(f, "checker_staff_id") || byOf(f),
    content: v(f, "content"), action_needed: v(f, "action_needed"), action_done_at: "", covers: "", score: "", item_scores: "",
    substitute: "", budget_amount: "", doc_name: ev.evidence_name, evidence_url: ev.evidence_url, ...reportOf(f), created_by: byOf(f), note: "화면에서 등록",
    ...row,
  };
  full.done_at = d; full.half = halfLabel(d);
  await appendRow("system_record", full, byOf(f), action);
  return full;
}

/** 제1호 — 경영방침·목표 등록(새 문서) 또는 개정(기존 문서 고치기). */
export async function savePolicy(f: FormData) {
  const pid = v(f, "policy_id");
  const d = v(f, "done_at") || today();
  const posted = v(f, "posted") === "Y" ? "Y" : "N";
  let ref = pid;
  if (pid) {
    const patch: Record<string, string> = { revised_at: d, posted, posted_where: v(f, "posted_where") };
    if (v(f, "summary")) patch.summary = v(f, "summary");
    if (v(f, "title")) patch.title = v(f, "title");
    await patchRow("safety_policy", "policy_id", pid, patch, byOf(f), "경영방침·목표 개정");
  } else {
    const title = v(f, "title");
    if (!title) return;
    ref = nid("POL");
    await appendRow("safety_policy", {
      policy_id: ref, clause_no: "1", policy_kind: v(f, "policy_kind") || "경영방침", title,
      fiscal_year: v(f, "fiscal_year"), summary: v(f, "summary"), enacted_at: d, revised_at: "",
      posted, posted_where: v(f, "posted_where"), approver_role: v(f, "approver_role") || "경영책임자(시장)",
      owner_staff_id: byOf(f), note: "화면에서 등록",
    }, byOf(f), "경영방침·목표 등록");
  }
  await addRecord(f, { clause_no: "1", record_kind: pid ? "문서 개정" : "문서 등록", title: `${v(f, "title") || pid} ${pid ? "개정" : "등록"}`, target_ref: ref, done_at: d }, "제1호 기록");
  done();
}

/** 제3·7·8호 — 절차·매뉴얼 문서 등록(새 문서) 또는 개정(담은 목·개정일). */
export async function saveManual(f: FormData) {
  const no = v(f, "clause_no");
  const mid = v(f, "manual_id");
  const d = v(f, "done_at") || today();
  const covers = no === "8" ? ["가", "나", "다"].filter((k) => f.get(`cov_${k}`)).join("·") : "절차";
  const missing = no === "8" ? ["가", "나", "다"].filter((k) => !f.get(`cov_${k}`)).join("·") : "";
  let ref = mid;
  if (mid) {
    await patchRow("safety_manual", "manual_id", mid, { covers, missing, revised_at: d, ...(v(f, "title") ? { title: v(f, "title") } : {}) }, byOf(f), `제${no}호 문서 개정`);
  } else {
    const title = v(f, "title");
    if (!title) return;
    ref = nid("MAN");
    await appendRow("safety_manual", {
      manual_id: ref, clause_no: no, title, covers, missing, enacted_at: d, revised_at: "", last_check_at: "",
      owner_staff_id: byOf(f), note: "화면에서 등록",
    }, byOf(f), `제${no}호 문서 등록`);
  }
  await addRecord(f, { clause_no: no, record_kind: mid ? "문서 개정" : "문서 등록", title: `${v(f, "title") || mid} ${mid ? "개정" : "등록"}`, target_ref: ref, covers: no === "8" ? covers : "", done_at: d }, `제${no}호 문서 기록`);
  done();
}

/** 제3·7·8호 — 반기 점검(제3호는 위험성평가 결과 보고로 갈음 가능, 제8호는 훈련). 문서의 최근 점검일도 옮긴다. */
export async function saveHalfCheck(f: FormData) {
  const no = v(f, "clause_no");
  const kind = v(f, "record_kind") || "반기 점검";
  const ref = v(f, "target_ref");
  const d = v(f, "done_at") || today();
  const covers = no === "8" ? ["가", "나", "다"].filter((k) => f.get(`cov_${k}`)).join("·") : "";
  await addRecord(f, {
    clause_no: no, record_kind: kind, target_ref: ref, covers, done_at: d,
    title: v(f, "title") || `${halfLabel(d)} ${kind}`,
    substitute: kind === "위험성평가 결과 보고" ? "위험성평가" : kind === "위원회 논의" ? v(f, "substitute") || "산업안전보건위원회" : "",
  }, `제${no}호 ${kind}`);
  if (ref.startsWith("MAN") && kind !== "위원회 논의") await patchRow("safety_manual", "manual_id", ref, { last_check_at: d }, byOf(f), "최근 점검일");
  done();
}

/** 기록에 「경영책임자 보고받음」 또는 「필요 조치 완료」를 뒤늦게 남긴다. */
export async function markRecord(f: FormData) {
  const id = v(f, "record_id");
  if (!id) return;
  const what = v(f, "what");
  if (what !== "action") { f.set("ceo_reported", "Y"); if (!reportOf(f).ceo_reported) return; }
  const patch = what === "action" ? { action_done_at: v(f, "action_done_at") || today() } : reportOf(f);
  await patchRow("system_record", "record_id", id, patch, byOf(f), what === "action" ? "필요 조치 완료" : "경영책임자 보고받음");
  done();
}

/** 제5호 가목 — 권한·예산 부여 문서. */
export async function saveGrant(f: FormData) {
  const target = v(f, "target_role");
  if (!target) return;
  await addRecord(f, {
    clause_no: "5", mok: "가", record_kind: "권한·예산 부여", title: `${target} 권한·예산 부여`, target_role: target,
    budget_amount: v(f, "budget_amount").replace(/[^0-9]/g, ""),
  }, "제5호 권한·예산 부여");
  done();
}

/** 제5호 나목 — 평가 기준 항목 고치기(항목·배점·사용 여부) 또는 더하기. */
export async function saveCriteria(f: FormData) {
  const id = v(f, "criteria_id");
  const pts = v(f, "points").replace(/[^0-9]/g, "");
  if (id) {
    await patchRow("eval_criteria", "criteria_id", id, { item: v(f, "item"), points: pts, active: v(f, "active") === "N" ? "N" : "Y" }, byOf(f), "평가 기준 수정");
  } else {
    const role = v(f, "target_role");
    if (!role || !v(f, "item")) return;
    await appendRow("eval_criteria", {
      criteria_id: nid("CR"), target_role: role, item_no: v(f, "item_no"), item: v(f, "item"), points: pts,
      law_basis: v(f, "law_basis"), active: "Y", note: "화면에서 등록",
    }, byOf(f), "평가 기준 항목 추가");
  }
  done();
}

/** 제5호 나목 — 반기 평가 한 명. 점수는 항목별로 받고 합을 낸다. 지정 기록의 최근 평가일도 옮긴다. */
export async function saveEval(f: FormData) {
  // 대상 = 「지정 기록 id|부서|담당」
  const [roleId, deptId = "", staffId = ""] = v(f, "target").split("|");
  const target = v(f, "target_role");
  if (!roleId || !target) return;
  f.set("dept_id", deptId);
  f.set("target_staff_id", staffId);
  const d = v(f, "done_at") || today();
  const items: string[] = [];
  let sum = 0;
  for (const [k, val] of f.entries()) {
    if (!k.startsWith("s_") || String(val) === "") continue;
    const n = Number(val);
    if (!Number.isFinite(n)) continue;
    items.push(`${k.slice(2)}=${n}`);
    sum += n;
  }
  await addRecord(f, {
    clause_no: "5", mok: "나", record_kind: "반기 평가", title: `${target} ${halfLabel(d)} 업무수행 평가`,
    target_role: target, target_ref: roleId, target_staff_id: v(f, "target_staff_id"), dept_id: v(f, "dept_id"),
    score: items.length ? String(sum) : "", item_scores: items.join(";"), done_at: d,
  }, "제5호 반기 평가");
  await patchRow("safety_org_role", "role_id", roleId, { last_eval_at: d }, byOf(f), "최근 평가일");
  done();
}

/** 제7호 — 종사자 의견 접수. */
export async function addVoice(f: FormData) {
  const content = v(f, "content");
  if (!content) return;
  const ch = v(f, "channel");
  const committee = ["산업안전보건위원회", "안전 및 보건에 관한 협의체", "노사협의체"].includes(ch);
  await appendRow("worker_voice", {
    voice_id: nid("VOC"), received_at: v(f, "received_at") || today(), channel: ch, dept_id: v(f, "dept_id"), content,
    review_result: "", action_taken: "", closed_at: "", stage: "접수", needs_improvement: "", reviewed_at: "",
    reviewer_staff_id: "", plan: "", plan_due: "", plan_owner_staff_id: "", done_at: "",
    substitute: committee ? ch : "", ...reportOf(f), note: "화면에서 등록",
  }, byOf(f), "종사자 의견 접수");
  done();
}

/** 제7호 — 의견 처리 단계 넘기기(검토 → 개선방안 → 이행 → 종결). 채운 칸만 고친다. */
export async function advanceVoice(f: FormData) {
  const id = v(f, "voice_id");
  const stage = v(f, "stage");
  if (!id || !stage) return;
  const d = v(f, "at") || today();
  const p: Record<string, string> = { stage };
  const put = (k: string, val: string) => { if (val) p[k] = val; };
  if (stage === "검토") { p.reviewed_at = d; p.reviewer_staff_id = byOf(f); put("review_result", v(f, "review_result")); put("needs_improvement", v(f, "needs_improvement")); }
  if (stage === "개선방안") { p.needs_improvement = "Y"; put("plan", v(f, "plan")); put("plan_due", v(f, "plan_due")); put("plan_owner_staff_id", v(f, "plan_owner_staff_id")); put("review_result", v(f, "review_result")); }
  if (stage === "이행") { put("action_taken", v(f, "action_taken")); }
  if (stage === "종결") { p.closed_at = d; p.done_at = d; put("action_taken", v(f, "action_taken")); }
  const rp = reportOf(f);
  if (rp.ceo_reported) Object.assign(p, rp);
  await patchRow("worker_voice", "voice_id", id, p, byOf(f), `종사자 의견 ${stage}`);
  done();
}

/** 시행령 제10조제4호 단서 — 시설물안전법·철도안전법 계획을 경영책임자가 보고받은 날을 남긴다(갈음 성립). */
export async function confirmPlan(form: FormData) {
  const role = String(form.get("role") || "gm");
  const id = String(form.get("plan_id") || "");
  if (!id) return;
  // 경영책임자만 — 총괄이 대신 적으면 「대리 기록」으로 남긴다. 그 밖의 역할은 받지 않는다.
  const c = ceoConfirm(role);
  if (!c.ok) return;
  const today = ymd();
  await patchRow("civil_safety_plan", "plan_id", id,
    { ceo_confirmed: "Y", confirmed_at: today, confirm_proxy: c.proxy ? "Y" : "", confirmed_by: ROLE_STAFF[role] || "" },
    ROLE_STAFF[role] || "SM01-1", c.proxy ? "안전계획 갈음 — 경영책임자 보고받음 대리 기록(총괄)" : "안전계획 갈음 — 경영책임자 보고받음 기록");
  revalidatePath("/system");
}

/** 시행령 제10조제7호 라목 — 대피훈련 기록 한 줄. */
export async function addDrill(form: FormData) {
  const role = String(form.get("role") || "gm");
  const name = String(form.get("facility_name") || "");
  if (!name) return;
  const dept = String(form.get("dept_id") || "");
  await appendRow("civil_manual", {
    manual_id: `CMN-${Date.now().toString(36).toUpperCase()}`,
    clause_ref: "10-7", record_kind: "대피훈련", title: `${name} 비상 대피훈련`, covers: "라", missing: "", basis: "",
    asset_id: String(form.get("asset_id") || ""), facility_name: name,
    enacted_at: "", revised_at: "", done_at: String(form.get("done_at") || "") || ymd(),
    last_check_at: "", reported_at: "", participants: "",
    owner_staff_id: dept && dept !== "D99" ? `SD${dept.slice(1)}-1` : "", note: "화면에서 등록",
  }, ROLE_STAFF[role] || "SM01-1", `${name} 대피훈련 등록`);
  revalidatePath("/system");
}

/** 시행령 제10조제7호 단서 — 철도안전관리체계(비상대응계획 포함)를 경영책임자가 보고받은 날을 체계 문서에 남긴다.
 *  대피훈련 갈음 판정은 lib/drill.ts drillSubstitutes 한 곳에서 이 날짜와 훈련 계획의 확인을 함께 읽는다. */
export async function confirmRailDoc(form: FormData) {
  const role = String(form.get("role") || "gm");
  const id = String(form.get("manual_id") || "");
  if (!id) return;
  const c = ceoConfirm(role);
  if (!c.ok) return;
  const at = String(form.get("reported_at") || "") || ymd();
  await patchRow("civil_manual", "manual_id", id, { reported_at: at }, ROLE_STAFF[role] || "SM01-1",
    c.proxy ? "철도안전관리체계 갈음 — 경영책임자 보고받음 대리 기록(총괄)" : "철도안전관리체계 갈음 — 경영책임자 보고받음 기록");
  revalidatePath("/system");
  revalidatePath("/drills");
  revalidatePath("/exec");
}
