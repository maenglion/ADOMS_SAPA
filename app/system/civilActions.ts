"use server";
// [캡처 v2] K02 — 중대시민재해(공중이용시설·공중교통수단) 체계 기록 입력(시행령 제10조제4·5·7호). (2026-09-24)
//   산업 쪽 체계 기록(actions.ts · system_record)과 같은 규칙: 기록은 civil_record 한 표에 한 줄씩, 문서·계획 칸은 patchRow 로만 고친다.
//   증빙은 파일 첨부(evidence_file → lib/attach.ts) 또는 파일 이름 글자(evidence_name). 행에 evidence_url 을 함께 남긴다(K03, 09-24).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow, patchRow } from "@/lib/write";
import { readTable } from "@/lib/data";
import { ROLE_STAFF, ceoConfirm } from "@/lib/roles";
import { CIV_RESULT_KEYS, CIV_RESULTS, CIV_ACTIONS, FMS_PLAN, RAIL_PLAN, OWN_PLAN } from "@/lib/system";
import { ymd } from "@/lib/day";
import { attachOf } from "@/lib/attach";

const today = () => ymd();
const nid = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const v = (f: FormData, k: string) => String(f.get(k) || "").trim();
const byOf = (f: FormData) => ROLE_STAFF[v(f, "role") || "gm"] || "SM01-1";
const halfLabel = (d: string) => `${d.slice(0, 4)} ${+d.slice(5, 7) <= 6 ? "상반기" : "하반기"}`;
const MOK7 = ["가", "나", "다", "라"] as const;
const BASES = [OWN_PLAN, FMS_PLAN, RAIL_PLAN];

function back(f: FormData, clause: number, q = "saved=1", hash = ""): never {
  redirect(`/system/civil?clause=${clause}&role=${v(f, "role") || "gm"}${q ? `&${q}` : ""}${hash}`);
}
function fail(f: FormData, clause: number, msg: string, extra = ""): never {
  return back(f, clause, `err=${encodeURIComponent(msg)}${extra}`);
}
function refresh() { revalidatePath("/system"); revalidatePath("/system/civil"); revalidatePath("/exec"); }

/** 경영책임자 보고받음 — 경영책임자 본인 또는 총괄의 대리 기록만(lib/roles ceoConfirm). */
function reportOf(f: FormData) {
  const c = ceoConfirm(v(f, "role") || "gm");
  const yes = c.ok && v(f, "ceo_reported") === "Y";
  return {
    ceo_reported: yes ? "Y" : "", reported_at: yes ? v(f, "reported_at") || today() : "",
    report_method: yes ? v(f, "report_method") : "", report_proxy: yes && c.proxy ? "Y" : "",
  };
}

/** civil_record 한 줄 — 칸을 모두 채워 두어 표 모양이 흔들리지 않게 한다. */
async function addCivil(f: FormData, row: Record<string, string>, action: string) {
  const d = row.done_at || v(f, "done_at") || today();
  const ev = await attachOf(f); // [캡처 v2] K03 — 같은 폼이면 한 번만 저장된다
  const full: Record<string, string> = {
    record_id: nid("CVR"), clause_ref: "", record_kind: "", title: "", target_ref: "", asset_id: "", facility_name: "", plan_year: "",
    done_at: d, half: halfLabel(d), checker_staff_id: v(f, "checker_staff_id") || byOf(f),
    r1: "", r2: "", r3: "", r4: "", covers: "", content: v(f, "content"),
    action_kind: "", action_needed: "", action_due: "", action_done_at: "",
    evidence_name: ev.evidence_name, evidence_url: ev.evidence_url, ...reportOf(f), created_by: byOf(f), note: "화면에서 등록",
    ...row,
  };
  full.done_at = d; full.half = halfLabel(d);
  await appendRow("civil_record", full, byOf(f), action);
  return full;
}

/** 시행령 제10조제5호 — 제1~4호 반기 점검 등록. 보완 필요·미흡이 있으면 제6호 조치 과제를 함께 받는다. */
export async function saveCivilHalf(f: FormData) {
  const res: Record<string, string> = {};
  for (const k of CIV_RESULT_KEYS) { const x = v(f, k); res[k] = (CIV_RESULTS as readonly string[]).includes(x) ? x : ""; }
  if (!Object.values(res).some(Boolean)) fail(f, 5, "제1~4호 가운데 점검 결과를 하나 이상 고릅니다.");
  const weak = CIV_RESULT_KEYS.filter((k) => res[k] === "보완 필요" || res[k] === "미흡");
  const act = v(f, "action_needed");
  if (weak.length && !act) fail(f, 5, "보완 필요·미흡이 있으면 제6호로 이어질 조치 과제를 한 줄 적습니다.");
  const d = v(f, "done_at") || today();
  const kind = v(f, "action_kind");
  await addCivil(f, {
    clause_ref: "10-5", record_kind: "반기 점검", done_at: d, ...res,
    title: `${halfLabel(d)} 제1~4호 이행 점검`,
    action_kind: act ? ((CIV_ACTIONS as readonly string[]).includes(kind) ? kind : "그 밖의 조치") : "",
    action_needed: act, action_due: act ? v(f, "action_due") : "",
  }, "제10조제5호 반기 점검");
  refresh();
  back(f, 5);
}

/** 제5호 기록에 「보고받음」 또는 제6호 「조치 완료」를 뒤늦게 남긴다. */
export async function markCivil(f: FormData) {
  const id = v(f, "record_id");
  const clause = Number(v(f, "clause")) || 5;
  if (!id) back(f, clause, "");
  const what = v(f, "what");
  if (what === "action") {
    await patchRow("civil_record", "record_id", id, { action_done_at: v(f, "action_done_at") || today() }, byOf(f), "제10조제6호 조치 완료");
  } else {
    f.set("ceo_reported", "Y");
    const rp = reportOf(f);
    if (!rp.ceo_reported) fail(f, clause, "보고받음은 경영책임자 또는 총괄(대리 기록)만 남깁니다.");
    await patchRow("civil_record", "record_id", id, rp, byOf(f), "경영책임자 보고받음");
  }
  refresh();
  back(f, clause, "saved=1", what === "action" ? "#act" : "");
}

/** 시행령 제10조제7호 — 업무처리절차 문서 등록(새 문서) 또는 개정(담은 목·시행일). 개정 이력은 civil_record 에 한 줄씩. */
export async function saveCivilProc(f: FormData) {
  const mid = v(f, "manual_id");
  const title = v(f, "title");
  const d = v(f, "enacted_at") || today();
  const covers = MOK7.filter((k) => f.get(`cov_${k}`)).join("·");
  const missing = MOK7.filter((k) => !f.get(`cov_${k}`)).join("·");
  const att = await attachOf(f); // [캡처 v2] K03
  const ev = att.evidence_name;
  if (!mid && !title) fail(f, 7, "문서 이름을 적습니다.", "&add=1");
  if (!covers) fail(f, 7, "절차에 담은 목(가·나·다·라)을 하나 이상 고릅니다.", mid ? `&doc=${mid}` : "&add=1");
  let ref = mid, name = title;
  if (mid) {
    const old = (await readTable("civil_manual", "manual_id")).find((m) => m.manual_id === mid);
    if (!old) fail(f, 7, "고칠 문서를 찾지 못했습니다.");
    name = title || old.title;
    await patchRow("civil_manual", "manual_id", mid, {
      covers, missing, revised_at: d, ...(title ? { title } : {}), ...(ev ? { evidence_name: ev, evidence_url: att.evidence_url } : {}),
    }, byOf(f), "제10조제7호 업무처리절차 개정");
  } else {
    ref = nid("CMN");
    await appendRow("civil_manual", {
      manual_id: ref, clause_ref: "10-7", record_kind: "업무처리절차", title, covers, missing, basis: "",
      asset_id: "", facility_name: "", enacted_at: d, revised_at: "", done_at: "", last_check_at: "", reported_at: "",
      participants: "", owner_staff_id: byOf(f), evidence_name: ev, evidence_url: att.evidence_url, note: "화면에서 등록",
    }, byOf(f), "제10조제7호 업무처리절차 등록");
  }
  const rp = reportOf(f);
  if (rp.ceo_reported) await patchRow("civil_manual", "manual_id", ref, { reported_at: rp.reported_at }, byOf(f), "업무처리절차 경영책임자 보고받음");
  await addCivil(f, {
    clause_ref: "10-7", record_kind: mid ? "절차 개정" : "절차 등록", title: `${name} ${mid ? "개정" : "제정"}`,
    target_ref: ref, covers, done_at: d,
  }, `제10조제7호 절차 ${mid ? "개정" : "등록"}`);
  refresh();
  back(f, 7);
}

/** 계획 행 찾기 — 같은 시설(asset_id)·같은 연도의 줄. 없으면 올해 줄을 본떠 새로 만든다. */
async function planRow(f: FormData, clause: number) {
  const asset = v(f, "asset_id");
  const year = v(f, "plan_year") || today().slice(0, 4);
  if (!asset) fail(f, clause, "대상 시설을 고릅니다.");
  const all = await readTable("civil_safety_plan", "plan_id");
  const same = all.find((r) => r.asset_id === asset && String(r.plan_year) === year);
  if (same) return { row: same, isNew: false, year };
  const base = all.filter((r) => r.asset_id === asset).sort((a, b) => (String(a.plan_year) < String(b.plan_year) ? 1 : -1))[0];
  if (!base) fail(f, clause, "시설을 찾지 못했습니다.");
  return { row: base, isNew: true, year };
}

/** 시행령 제10조제4호 — 연 1회 이상 안전계획 등록. 갈음(시설물안전법 제6조 · 철도안전법 제6조)이면 경영책임자 확인·보고받음을 함께 받는다. */
export async function saveCivilPlan(f: FormData) {
  const { row, isNew, year } = await planRow(f, 4);
  const basis = BASES.includes(v(f, "plan_basis")) ? v(f, "plan_basis") : OWN_PLAN;
  const status = v(f, "plan_status") === "작성중" ? "작성중" : "수립";
  const d = v(f, "established_at") || today();
  const yn = (k: string) => (f.get(k) ? "Y" : "N");
  const planned = v(f, "items_planned").replace(/[^0-9]/g, "");
  const replace = basis !== OWN_PLAN;
  const c = ceoConfirm(v(f, "role") || "gm");
  const conf = replace && c.ok && v(f, "ceo_reported") === "Y";
  const att = await attachOf(f); // [캡처 v2] K03
  const patch: Record<string, string> = {
    plan_status: status, plan_basis: basis, mok_ga: yn("mok_ga"), mok_na: yn("mok_na"), mok_da: yn("mok_da"),
    established_at: d, evidence_name: att.evidence_name, evidence_url: att.evidence_url,
    ...(planned ? { items_planned: planned } : {}),
    // 계획을 새로 올리면 확인도 새로 받는다(제4호 단서 — 수립 여부와 내용을 확인·보고받아야 갈음).
    ceo_confirmed: conf ? "Y" : "", confirmed_at: conf ? v(f, "reported_at") || today() : "",
    confirm_proxy: conf && c.proxy ? "Y" : "", confirmed_by: conf ? ROLE_STAFF[v(f, "role") || "gm"] || "" : "",
  };
  let pid = row.plan_id;
  if (isNew) {
    pid = `CSP-${year}-${nid("N").slice(2)}`;
    await appendRow("civil_safety_plan", {
      plan_id: pid, plan_year: year, facility_kind: row.facility_kind, asset_id: row.asset_id, facility_name: row.facility_name,
      asset_gbn: row.asset_gbn, asset_kind: row.asset_kind, asset_class: row.asset_class, dept_id: row.dept_id,
      items_planned: "", items_done: "0", owner_staff_id: row.owner_staff_id, note: "화면에서 등록", ...patch,
    }, byOf(f), `${year}년 안전계획 등록 · ${row.facility_name}`);
  } else {
    await patchRow("civil_safety_plan", "plan_id", pid, patch, byOf(f), `${year}년 안전계획 등록 · ${row.facility_name}`);
  }
  const moks = (["가", "나", "다"] as const).filter((_, i) => patch[["mok_ga", "mok_na", "mok_da"][i]] === "Y").join("·");
  await addCivil(f, {
    clause_ref: "10-4", record_kind: replace ? "안전계획(갈음)" : "안전계획", title: `${row.facility_name} ${year}년 안전계획 ${status === "작성중" ? "작성 중" : "수립"}`,
    target_ref: pid, asset_id: row.asset_id, facility_name: row.facility_name, plan_year: year, covers: moks, done_at: d,
    content: replace ? basis : v(f, "content"), ceo_reported: conf ? "Y" : "", reported_at: conf ? patch.confirmed_at : "",
    report_method: conf ? v(f, "report_method") : "", report_proxy: conf && c.proxy ? "Y" : "",
  }, "제10조제4호 안전계획 등록");
  refresh();
  back(f, 4, `saved=1&asset=${encodeURIComponent(row.asset_id)}`);
}

/** 시행령 제10조제4호 「충실히 이행」 — 계획 항목 하나의 이행(참고 명세 061: 항목 · 이행일 · 내역 · 증빙). 이행 항목 수를 하나 올린다. */
export async function saveCivilPlanItem(f: FormData) {
  const { row, isNew, year } = await planRow(f, 4);
  if (isNew || row.plan_status !== "수립") fail(f, 4, `${year}년 안전계획이 수립되지 않은 시설입니다 — 계획부터 등록합니다.`, `&asset=${encodeURIComponent(v(f, "asset_id"))}`);
  const item = v(f, "item");
  if (!item) fail(f, 4, "이행한 계획 항목을 적습니다.", `&asset=${encodeURIComponent(row.asset_id)}`);
  const mok = ["가", "나", "다"].includes(v(f, "mok")) ? v(f, "mok") : "";
  const planned = Number(row.items_planned || 0), doneN = Number(row.items_done || 0);
  await addCivil(f, {
    clause_ref: "10-4", record_kind: "계획 이행", title: `${row.facility_name} · ${item}`, target_ref: row.plan_id,
    asset_id: row.asset_id, facility_name: row.facility_name, plan_year: year, covers: mok,
  }, "제10조제4호 안전계획 이행");
  if (planned && doneN < planned) await patchRow("civil_safety_plan", "plan_id", row.plan_id, { items_done: String(doneN + 1) }, byOf(f), "안전계획 이행 항목 +1");
  refresh();
  back(f, 4, `saved=1&asset=${encodeURIComponent(row.asset_id)}`);
}
